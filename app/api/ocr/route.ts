import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sessionRatelimit, getClientIp } from "@/lib/ratelimit";
import { ExtractionError, ocrBill } from "@/lib/extraction";

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  not_found: 404,
  no_file: 409,
  rate: 429,
  ocr_failed: 502,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid request.",
  not_found: "We couldn't find that upload. Please start over.",
  no_file: "No bill is attached to this session.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  ocr_failed: "We couldn't read your bill. You can enter the numbers yourself.",
  server: "Something went wrong. Please try again.",
};

function fail(code: string) {
  return NextResponse.json(
    { success: false, error: code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

const postSchema = z.object({ sessionId: z.string().min(1) });

// POST { sessionId } — OCR the stored bill to markdown and persist it on the
// session. Kept separate from /api/extract so the funnel can show a real
// "reading your bill" phase, and so a failed extraction can re-run the LLM
// without paying for OCR again. Bounded by needing a valid uploaded session;
// a light limiter guards against hammering the (paid) OCR endpoint.
export async function POST(req: NextRequest) {
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

  let markdown: string;
  try {
    // Read the bytes back from the private store, then OCR them as base64.
    const file = await get(session.blobUrl, { access: "private" });
    if (!file) return fail("no_file");
    const buffer = Buffer.from(await new Response(file.stream).arrayBuffer());
    markdown = await ocrBill(buffer.toString("base64"), session.fileMimeType);
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error(`OCR failed at ${err.stage}:`, err.message);
      return fail("ocr_failed");
    }
    console.error("OCR failed", err);
    return fail("server");
  }

  try {
    await prisma.quoteSession.update({
      where: { id: sessionId },
      data: { ocrMarkdown: markdown },
    });
  } catch (err) {
    console.error("Persisting OCR markdown failed", err);
    return fail("server");
  }

  return NextResponse.json({ success: true });
}
