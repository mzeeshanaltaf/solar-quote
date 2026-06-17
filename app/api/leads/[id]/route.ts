import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/client";
import { LEAD_STATUSES } from "@/lib/lead-status";

// Admin-only: update a lead's triage status and/or notes from the dashboard.
// The proxy guards page routes (/admin/*) but not /api/*, so this self-guards
// with a real session check.
const patchSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: "nothing to update",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Not authorized." },
      { status: 401 }
    );
  }

  const { id } = await params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid update." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status as LeadStatus } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      },
      select: { id: true, status: true, notes: true },
    });
    return NextResponse.json({ success: true, lead: updated });
  } catch {
    // Prisma throws if the row doesn't exist.
    return NextResponse.json(
      { success: false, message: "Lead not found." },
      { status: 404 }
    );
  }
}
