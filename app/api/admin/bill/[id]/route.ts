import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillBytes } from "@/lib/storage";

// Admin-only: stream a bill file back from the PRIVATE blob store so the
// dashboard can preview it. Bills are PII and the blob URL is never public —
// this route reads the bytes server-side after verifying an admin session, and
// the response is marked private/no-store so it isn't cached by intermediaries.
//
// [id] is the QuoteSession id.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new NextResponse("Not authorized", { status: 401 });
  }

  const { id } = await params;
  const quote = await prisma.quoteSession.findUnique({
    where: { id },
    select: { blobUrl: true, fileMimeType: true },
  });
  if (!quote?.blobUrl) {
    return new NextResponse("No bill on file", { status: 404 });
  }

  try {
    const bytes = await getBillBytes(quote.blobUrl);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": quote.fileMimeType ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error("Admin bill fetch failed", err);
    return new NextResponse("Could not load bill", { status: 502 });
  }
}
