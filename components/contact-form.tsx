"use client";

import { useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

// Honeypot input. Must match HONEYPOT_FIELD in app/api/contact/route.ts.
// The meaningless name keeps Chrome autofill from ever touching it.
const HONEYPOT_FIELD = "subject_alt";

// Visual cue only; screen readers already announce the inputs' `required`.
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

interface ContactFormProps {
  initialSuccess?: boolean;
  initialError?: string;
}

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm({
  initialSuccess = false,
  initialError,
}: ContactFormProps) {
  const [status, setStatus] = useState<Status>(
    initialSuccess ? "success" : initialError ? "error" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState(initialError ?? "");
  const [successMsg, setSuccessMsg] = useState(
    "Your message has been received successfully"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const incomplete = !name.trim() || !email.trim() || !message.trim();

  // React path: intercept and fetch. If hydration ever fails, the
  // action/method attributes below make the form fall back to a native
  // POST handled by the same API route.
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message,
          [HONEYPOT_FIELD]: fd.get(HONEYPOT_FIELD) ?? "",
        }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (data.success) {
        setSuccessMsg(data.message ?? "Your message has been received successfully");
        setStatus("success");
      } else {
        setErrorMsg(data.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Failed to send. Check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>Message sent</AlertTitle>
        <AlertDescription>
          {successMsg}. We read everything and reply when a reply is called
          for.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action="/api/contact" method="post" onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="contact-name">
            Name <RequiredMark />
          </FieldLabel>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            maxLength={100}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-email">
            Email <RequiredMark />
          </FieldLabel>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FieldDescription>
            Only used to reply to you. Never shared.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-message">
            Message <RequiredMark />
          </FieldLabel>
          <Textarea
            id="contact-message"
            name="message"
            rows={6}
            maxLength={2000}
            placeholder="A suggestion, an improvement, a question about your estimate..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <FieldDescription>
            Suggestions, improvements, questions, complaints: all welcome.
          </FieldDescription>
        </Field>

        {/* Honeypot: hidden from people and screen readers, visible to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
          <input
            id={HONEYPOT_FIELD}
            name={HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Not sent</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Field>
          <Button
            type="submit"
            size="lg"
            disabled={status === "loading" || incomplete}
          >
            {status === "loading" && <Spinner data-icon="inline-start" />}
            {status === "loading" ? "Sending" : "Send message"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
