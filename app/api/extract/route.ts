import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { z } from "zod";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { extractRatelimit, getClientIp } from "@/lib/ratelimit";
import {
  ExtractionError,
  extractFields,
  ocrBill,
  type ExtractedBill,
} from "@/lib/extraction";

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_file: 409,
  rate: 429,
  ocr_failed: 502,
  extraction_failed: 502,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that upload. Please start over.",
  no_file: "No bill is attached to this session.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  ocr_failed: "We couldn't read your bill. You can enter the numbers yourself.",
  extraction_failed:
    "We read your bill but couldn't pull the figures out. You can enter them yourself.",
  server: "Something went wrong. Please try again.",
};

function fail(code: string) {
  return NextResponse.json(
    { success: false, error: code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

const postSchema = z.object({ sessionId: z.string().min(1) });

// POST { sessionId } — OCR the stored bill, extract fields, persist them.
export async function POST(req: NextRequest) {
  if (extractRatelimit) {
    const { success } = await extractRatelimit.limit(getClientIp(req.headers));
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
    // Read the bytes back from the private store, then OCR them as base64.
    const file = await get(session.blobUrl, { access: "private" });
    if (!file) return fail("no_file");
    const buffer = Buffer.from(await new Response(file.stream).arrayBuffer());
    const markdown = await ocrBill(buffer.toString("base64"), session.fileMimeType);
    extracted = await extractFields(markdown);
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error(`Extraction failed at ${err.stage}:`, err.message);
      return fail(err.stage === "ocr" ? "ocr_failed" : "extraction_failed");
    }
    console.error("Extraction failed", err);
    return fail("server");
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
