import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { QuoteStatus } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { extractRatelimit, getClientIp } from "@/lib/ratelimit";

// Anonymous uploads feed paid OCR/LLM APIs, so we cap file size hard and
// allow only the formats Mistral OCR handles well.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  no_file: 400,
  type: 415,
  size: 413,
  rate: 429,
  server: 502,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "We couldn't read that upload. Please try again.",
  no_file: "Please choose a bill to upload.",
  type: "Unsupported file type. Upload a PDF, JPG, PNG, or WebP.",
  size: "That file is over the 10 MB limit. Try a smaller scan or photo.",
  rate: "Too many uploads from your connection. Please wait a few minutes.",
  server: "We couldn't store your bill right now. Please try again shortly.",
};

function fail(code: string) {
  return NextResponse.json(
    { success: false, error: code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
    { status: ERROR_STATUS[code] ?? 500 }
  );
}

export async function POST(req: NextRequest) {
  if (extractRatelimit) {
    const { success } = await extractRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  let file: File | null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return fail("parse");
  }

  if (!file || typeof file === "string" || file.size === 0) {
    return fail("no_file");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return fail("type");
  }
  if (file.size > MAX_BYTES) {
    return fail("size");
  }

  try {
    const ext = EXTENSION[file.type] ?? "bin";
    // Bills are PII — store privately. The extract route reads the bytes back
    // server-side (with the store token) to OCR them; the URL is never public.
    const blob = await put(`bills/${crypto.randomUUID()}.${ext}`, file, {
      access: "private",
      contentType: file.type,
    });

    const session = await prisma.quoteSession.create({
      data: {
        status: QuoteStatus.UPLOADED,
        blobUrl: blob.url,
        fileMimeType: file.type,
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      blobUrl: blob.url,
    });
  } catch (err) {
    console.error("Bill upload failed", err);
    return fail("server");
  }
}
