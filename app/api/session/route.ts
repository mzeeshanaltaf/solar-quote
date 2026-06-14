import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";

// Manual-entry fallback: a homeowner with no readable bill (or whose extraction
// failed) types the few numbers we need. This writes straight to a QuoteSession
// — no Blob, no OCR, no LLM — so it's the never-dead-end seam for the funnel.

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  incomplete: 422,
  not_found: 404,
  rate: 429,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  incomplete: "Enter at least your usage in kWh or your bill amount.",
  not_found: "We couldn't find that session. Please start over.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  server: "Something went wrong saving your details. Please try again.",
};

function fail(code: string) {
  return NextResponse.json(
    { success: false, error: code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

// Every field optional, but the refine below requires something usable.
const bodySchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    kWhUsed: z.number().nonnegative().nullable().optional(),
    billAmount: z.number().nonnegative().nullable().optional(),
    currency: z.string().trim().max(8).nullable().optional(),
    billingPeriodDays: z.number().int().positive().max(366).nullable().optional(),
    rawAddress: z.string().trim().max(500).nullable().optional(),
    addressTown: z.string().trim().max(200).nullable().optional(),
    addressCity: z.string().trim().max(200).nullable().optional(),
    addressState: z.string().trim().max(200).nullable().optional(),
    addressCountry: z.string().trim().max(200).nullable().optional(),
    utilityName: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    (b) =>
      (b.kWhUsed !== null && b.kWhUsed !== undefined) ||
      (b.billAmount !== null && b.billAmount !== undefined),
    { message: "incomplete" }
  );

// POST — create a session from manual entry, or update an existing one (e.g.
// when extraction failed but we already uploaded a file and have a sessionId).
export async function POST(req: NextRequest) {
  if (sessionRatelimit) {
    const { success } = await sessionRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    // Surface the refine message ("incomplete") distinctly from a malformed body.
    if (err instanceof z.ZodError && err.issues.some((i) => i.message === "incomplete")) {
      return fail("incomplete");
    }
    return fail("parse");
  }

  const { sessionId, currency, ...rest } = body;
  const data = {
    ...rest,
    currency: currency ? currency.toUpperCase() : currency,
    status: QuoteStatus.EXTRACTED,
  };

  try {
    if (sessionId) {
      const updated = await prisma.quoteSession.update({
        where: { id: sessionId },
        data,
        select: { id: true },
      });
      return NextResponse.json({ success: true, sessionId: updated.id });
    }

    const created = await prisma.quoteSession.create({
      data,
      select: { id: true },
    });
    return NextResponse.json({ success: true, sessionId: created.id });
  } catch (err) {
    // A bad sessionId (no matching row) is the common, recoverable case.
    if (sessionId) {
      console.error("Updating session from manual entry failed", err);
      return fail("not_found");
    }
    console.error("Creating session from manual entry failed", err);
    return fail("server");
  }
}
