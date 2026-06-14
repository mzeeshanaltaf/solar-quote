import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  ExtractionError,
  extractFields,
  type ExtractedBill,
} from "@/lib/extraction";

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_ocr: 409,
  not_a_bill: 422,
  rate: 429,
  extraction_failed: 502,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that upload. Please start over.",
  no_ocr: "We haven't read this bill yet. Please start over.",
  not_a_bill:
    "That doesn't look like an electricity bill. Check you uploaded the right file, or enter your numbers yourself.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  extraction_failed:
    "We read your bill but couldn't pull the figures out. You can enter them yourself.",
  server: "Something went wrong. Please try again.",
};

function fail(code: string, message?: string) {
  return NextResponse.json(
    {
      success: false,
      error: code,
      message: message ?? ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server,
    },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

const postSchema = z.object({ sessionId: z.string().min(1) });

// POST { sessionId } — extract structured fields from the OCR markdown that
// /api/ocr already persisted, classify whether it's really a bill, persist the
// figures. No OCR here, so a failed extraction can retry cheaply.
export async function POST(req: NextRequest) {
  // Light guard: the LLM call is paid, and this can be retried on one session.
  if (sessionRatelimit) {
    const { success } = await sessionRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  let sessionId: string;
  try {
    sessionId = postSchema.parse(await req.json()).sessionId;
  } catch {
    return fail("parse");
  }

  const session = await prisma.quoteSession.findUnique({
    where: { id: sessionId },
    select: { id: true, ocrMarkdown: true },
  });
  if (!session) return fail("not_found");
  if (!session.ocrMarkdown) return fail("no_ocr");

  let extracted: ExtractedBill;
  try {
    extracted = await extractFields(session.ocrMarkdown);
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error(`Extraction failed at ${err.stage}:`, err.message);
      return fail("extraction_failed");
    }
    console.error("Extraction failed", err);
    return fail("server");
  }

  // Relevance gate: the model classified the document. If it isn't a bill, we
  // don't persist garbage figures — we send the funnel to manual entry.
  if (!extracted.isElectricityBill) {
    const reason = extracted.rejectionReason?.trim();
    const message = reason
      ? `${reason} Check you uploaded the right file, or enter your numbers yourself.`
      : ERROR_MESSAGES.not_a_bill;
    return fail("not_a_bill", message);
  }

  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: {
        status: QuoteStatus.EXTRACTED,
        kWhUsed: extracted.kWhUsed,
        billAmount: extracted.billAmount,
        currency: extracted.currency,
        billingPeriodDays: extracted.billingPeriodDays,
        rawAddress: extracted.rawAddress,
        addressTown: extracted.addressTown,
        addressCity: extracted.addressCity,
        addressState: extracted.addressState,
        addressCountry: extracted.addressCountry,
        utilityName: extracted.utilityName,
        extractionConfidence: extracted.confidence,
      },
    });
  } catch (err) {
    console.error("Persisting extraction failed", err);
    return fail("server");
  }

  return NextResponse.json({ success: true, extracted });
}

// PATCH { sessionId, ...fields } — persist the user's verified/corrected values.
const patchSchema = z.object({
  sessionId: z.string().min(1),
  kWhUsed: z.number().nullable().optional(),
  billAmount: z.number().nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
  billingPeriodDays: z.number().int().nullable().optional(),
  rawAddress: z.string().trim().max(500).nullable().optional(),
  addressTown: z.string().trim().max(200).nullable().optional(),
  addressCity: z.string().trim().max(200).nullable().optional(),
  addressState: z.string().trim().max(200).nullable().optional(),
  addressCountry: z.string().trim().max(200).nullable().optional(),
  utilityName: z.string().trim().max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return fail("parse");
  }

  const { sessionId, ...fields } = body;
  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: fields,
    });
  } catch (err) {
    console.error("Saving bill edits failed", err);
    return fail("not_found");
  }

  return NextResponse.json({ success: true });
}
