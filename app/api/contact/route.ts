import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { contactRatelimit, getClientIp } from "@/lib/ratelimit";

// Honeypot field. The name is deliberately meaningless so Chrome's
// autofill heuristics (name/email/phone/address/url...) never match it,
// while naive bots still fill it like any other text input.
const HONEYPOT_FIELD = "subject_alt";

const contactSchema = z.object({
  name: z.string().trim().min(1, "fields").max(100, "length"),
  email: z.string().trim().min(1, "fields").email("email").max(200, "length"),
  message: z.string().trim().min(1, "fields").max(2000, "length"),
});

type RawSubmission = {
  name: string;
  email: string;
  message: string;
  honeypot: string;
};

async function parseBody(req: NextRequest): Promise<RawSubmission> {
  const ct = req.headers.get("content-type") ?? "";
  if (
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data")
  ) {
    const fd = await req.formData();
    return {
      name: (fd.get("name") as string | null) ?? "",
      email: (fd.get("email") as string | null) ?? "",
      message: (fd.get("message") as string | null) ?? "",
      honeypot: (fd.get(HONEYPOT_FIELD) as string | null) ?? "",
    };
  }
  const body = await req.json();
  return {
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    message: typeof body.message === "string" ? body.message : "",
    honeypot: typeof body[HONEYPOT_FIELD] === "string" ? body[HONEYPOT_FIELD] : "",
  };
}

const ERROR_STATUS: Record<string, number> = {
  parse: 400,
  fields: 400,
  email: 400,
  length: 400,
  rate: 429,
  server: 502,
};

const ERROR_MESSAGES: Record<string, string> = {
  parse: "Invalid submission. Please try again.",
  fields: "Please fill in your name, email, and message.",
  email: "Please enter a valid email address.",
  length: "One of the fields is too long. The message is capped at 2000 characters.",
  rate: "Too many messages from your connection. Please wait a few minutes and try again.",
  server: "We could not deliver your message right now. Please try again shortly.",
};

const SUCCESS_MESSAGE = "Your message has been received successfully";

export async function POST(req: NextRequest) {
  const isFormPost = !(req.headers.get("content-type") ?? "").includes(
    "application/json"
  );

  const fail = (code: string) =>
    isFormPost
      ? NextResponse.redirect(new URL(`/contact?error=${code}`, req.url), 303)
      : NextResponse.json(
          { success: false, message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server },
          { status: ERROR_STATUS[code] ?? 500 }
        );

  const succeed = (message: string) =>
    isFormPost
      ? NextResponse.redirect(new URL("/contact?sent=1", req.url), 303)
      : NextResponse.json({ success: true, message });

  let raw: RawSubmission;
  try {
    raw = await parseBody(req);
  } catch {
    return fail("parse");
  }

  // A filled honeypot means a bot: report success, deliver nothing.
  if (raw.honeypot) {
    return succeed(SUCCESS_MESSAGE);
  }

  if (contactRatelimit) {
    const { success } = await contactRatelimit.limit(getClientIp(req.headers));
    if (!success) return fail("rate");
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "fields");
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!webhookUrl || !apiKey) {
    console.error("Contact form: N8N_WEBHOOK_URL or N8N_API_KEY is not set");
    return fail("server");
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        name: parsed.data.name,
        email: parsed.data.email,
        message: parsed.data.message,
        submittedAt: new Date().toISOString(),
        source: "solarquote-contact-form",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`Contact webhook responded ${res.status}`);
      return fail("server");
    }

    const data = (await res.json()) as {
      success?: boolean;
      status?: string;
      message?: string;
    };
    if (!data.success) {
      console.error("Contact webhook reported failure", data);
      return fail("server");
    }

    return succeed(data.message ?? SUCCESS_MESSAGE);
  } catch (err) {
    console.error("Contact webhook call failed", err);
    return fail("server");
  }
}
