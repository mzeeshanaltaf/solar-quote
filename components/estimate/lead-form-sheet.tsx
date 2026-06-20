"use client";

import { useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon, ShieldCheckIcon } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Honeypot input. Must match HONEYPOT_FIELD in app/api/leads/route.ts.
// Name has no autofill heuristic (avoid "company"/"url"/"email"/etc.) so Chrome
// autofill never populates it — otherwise real submissions get flagged as bots.
const HONEYPOT_FIELD = "referral_token";

type Status = "idle" | "loading" | "success" | "error";

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

interface LeadFormSheetProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadFormSheet({ sessionId, open, onOpenChange }: LeadFormSheetProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const incomplete = !name.trim() || !email.trim();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (incomplete) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name,
          email,
          phone,
          preferredContact,
          notes,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (data.success) {
        setStatus("success");
      } else {
        setErrorMsg(data.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Couldn't send your details. Check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {status === "success" ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2Icon className="size-5 text-primary" />
                You&apos;re on the list
              </SheetTitle>
              <SheetDescription>
                Thanks, {name.split(" ")[0] || "there"}. We&apos;ll match you with
                vetted local installers and they&apos;ll reach out
                {preferredContact === "email"
                  ? " by email"
                  : preferredContact === "phone"
                    ? " by phone"
                    : " on WhatsApp"}
                . Your bill stays private until you choose to share it.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="button" size="lg">
                  Back to my estimate
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-xl">Get quotes from installers</SheetTitle>
              <SheetDescription>
                Tell us how to reach you. No obligation, free for homeowners — your
                bill is never shared until you ask.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 px-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="lead-name">
                    Name <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="lead-name"
                    name="name"
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-email">
                    Email <RequiredMark />
                  </FieldLabel>
                  <Input
                    id="lead-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={200}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-phone">Phone</FieldLabel>
                  <Input
                    id="lead-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    placeholder="Optional"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-preferred">
                    Preferred contact
                  </FieldLabel>
                  <Select
                    value={preferredContact}
                    onValueChange={setPreferredContact}
                  >
                    <SelectTrigger id="lead-preferred" name="preferredContact">
                      <SelectValue placeholder="How should we reach you?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="lead-notes">Anything to add?</FieldLabel>
                  <Textarea
                    id="lead-notes"
                    name="notes"
                    rows={3}
                    maxLength={2000}
                    placeholder="Roof type, timing, questions… (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <FieldDescription className="flex items-center gap-1.5">
                    <ShieldCheckIcon className="size-3.5 shrink-0 text-primary" />
                    We never sell your data. You can ask us to delete it any time.
                  </FieldDescription>
                </Field>

                {/* Honeypot — hidden from people and screen readers. */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[9999px] size-px overflow-hidden"
                >
                  <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
                  <input
                    id={HONEYPOT_FIELD}
                    name={HONEYPOT_FIELD}
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {status === "error" && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>Not sent</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
              </FieldGroup>
            </div>

            <SheetFooter>
              <Button
                type="submit"
                size="lg"
                disabled={status === "loading" || incomplete}
              >
                {status === "loading" && <Spinner data-icon="inline-start" />}
                {status === "loading" ? "Sending" : "Connect me with installers"}
              </Button>
              <SheetClose asChild>
                <Button type="button" size="lg" variant="ghost">
                  Maybe later
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
