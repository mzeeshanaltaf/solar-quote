import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/client";
import { leadRatelimit, getClientIp } from "@/lib/ratelimit";

// Honeypot field — meaningless name so Chrome autofill never touches it, while
// naive bots fill it like any other input. Mirrors /api/contact. Avoid tokens
// browsers autofill ("company"/"url"/"email"/…) or real users get flagged.
const HONEYPOT_FIELD = "referral_token";

const PREFERRED = ["email", "phone", "whatsapp"] as const;

const leadSchema = z.object({
  sessionId: z.string().min(1, "session"),
  name: z.string().trim().min(1, "fields").max(120, "length"),
  email: z.string().trim().min(1, "fields").email("email").max(200, "length"),
  phone: z.string().trim().max(40, "length").optional(),
  // Form/JSON parsing yields "" for an omitted field; treat that as "not set"
  // so the optional enum doesn't reject an empty string.
  preferredContact: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(PREFERRED).optional()
  ),
  notes: z.string().trim().max(2000, "length").optional(),
});

type RawSubmission = {
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  notes: string;
  honeypot: string;
};

function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v : "";
}

async function parseBody(req: NextRequest): Promise<RawSubmission> {
  const ct = req.headers.get("content-type") ?? "";
  if (
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data")
  ) {
    const fd = await req.formData();
    return {
      sessionId: str(fd.get("sessionId")),
      name: str(fd.get("name")),
      email: str(fd.get("email")),
      phone: str(fd.get("phone")),
      preferredContact: str(fd.get("preferredContact")),
      notes: str(fd.get("notes")),
      honeypot: str(fd.get(HONEYPOT_FIELD)),
    };
  }
  const body = await req.json();
  return {
    sessionId: typeof body.sessionId === "string" ? body.sessionId : "",
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    preferredContact:
      typeof body.preferredContact === "string" ? body.preferredContact : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    honeypot: typeof body[HONEYPOT_FIELD] === "string" ? body[HONEYPOT_FIELD] : "",
  };
}

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  fields: 400,
  email: 400,
  length: 400,
  session: 400,
  not_found: 404,
  rate: 429,
  server: 500,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid submission. Please try again.",
  fields: "Please add your name and email so installers can reach you.",
  email: "Please enter a valid email address.",
  length: "One of the fields is too long.",
  session: "We lost track of your estimate. Please start over.",
  not_found: "We couldn't find your estimate. Please start over.",
  rate: "Too many requests from your connection. Please wait a few minutes.",
  server: "We couldn't save your details right now. Please try again shortly.",
};

export async function POST(req: NextRequest) {
  const fail = (code: string) =>
    NextResponse.json(
      { success: false, error: code, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
      { status: ERROR_STATUS[code] ?? 500 }
    );

  let raw: RawSubmission;
  try {
    raw = await parseBody(req);
  } catch {
    return fail("parse");
  }

  // Bot filled the honeypot: report success, persist nothing.
  if (raw.honeypot) {
    return NextResponse.json({ success: true });
  }

  if (leadRatelimit) {
    const { success } = await leadRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    // Any validation failure is a client error; map known codes, else "fields".
    const code = parsed.error.issues[0]?.message ?? "fields";
    return fail(ERROR_MESSAGES[code] ? code : "fields");
  }
  const { sessionId, name, email, phone, preferredContact, notes } = parsed.data;

  // The session must exist (anonymous funnel record the lead attaches to).
  const session = await prisma.quoteSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return fail("not_found");

  try {
    // Idempotent: a user who reopens the form and resubmits updates their
    // details rather than hitting the 1:1 unique constraint. Status is only set
    // on first insert so an operator's triage isn't reset by a resubmit.
    await prisma.lead.upsert({
      where: { quoteSessionId: sessionId },
      create: {
        quoteSessionId: sessionId,
        name,
        email,
        phone: phone || null,
        preferredContact: preferredContact || null,
        notes: notes || null,
        status: LeadStatus.NEW,
      },
      update: {
        name,
        email,
        phone: phone || null,
        preferredContact: preferredContact || null,
        notes: notes || null,
      },
    });
  } catch (err) {
    console.error("Lead capture failed", err);
    return fail("server");
  }

  // Best-effort notify (n8n) — never block or fail the lead on a webhook hiccup.
  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (webhookUrl && apiKey) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          sessionId,
          name,
          email,
          phone: phone || null,
          preferredContact: preferredContact || null,
          notes: notes || null,
          submittedAt: new Date().toISOString(),
          source: "solarquote-lead-form",
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (err) {
      console.error("Lead webhook notify failed (non-fatal)", err);
    }
  }

  return NextResponse.json({ success: true });
}
