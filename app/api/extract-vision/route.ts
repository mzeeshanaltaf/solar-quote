import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { z } from "zod";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  ExtractionError,
  extractFromFile,
  type ExtractedBill,
} from "@/lib/extraction";

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_file: 409,
  not_a_bill: 422,
  rate: 429,
  extraction_failed: 502,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that upload. Please start over.",
  no_file: "No bill is attached to this session.",
  not_a_bill:
    "That doesn't look like an electricity bill. Check you uploaded the right file, or enter your numbers yourself.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  extraction_failed:
    "We couldn't pull the figures out of your bill. You can enter them yourself.",
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

// POST { sessionId } — vision path: read the stored bill bytes and send the
// image/PDF straight to the vision model in ONE call (classify + extract), then
// persist the figures. Replaces the /api/ocr + /api/extract two-step. Gated in
// the funnel behind NEXT_PUBLIC_EXTRACTION_MODE=vision while we A/B the two.
export async function POST(req: NextRequest) {
  // Light guard: the model call is paid, and this can be retried on one session.
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
    select: { id: true, blobUrl: true, fileMimeType: true },
  });
  if (!session) return fail("not_found");
  if (!session.blobUrl) return fail("no_file");

  let extracted: ExtractedBill;
  try {
    // Read the bytes back from the private store, then hand them to the model.
    const file = await get(session.blobUrl, { access: "private" });
    if (!file) return fail("no_file");
    const buffer = Buffer.from(await new Response(file.stream).arrayBuffer());
    extracted = await extractFromFile(
      buffer.toString("base64"),
      session.fileMimeType
    );
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error(`Vision extraction failed at ${err.stage}:`, err.message);
      return fail("extraction_failed");
    }
    console.error("Vision extraction failed", err);
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
    console.error("Persisting vision extraction failed", err);
    return fail("server");
  }

  return NextResponse.json({ success: true, extracted });
}
