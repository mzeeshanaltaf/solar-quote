"use client";

import { useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon, ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";

type FormState = {
  kWhUsed: string;
  billAmount: string;
  currency: string;
  billingPeriodDays: string;
  rawAddress: string;
  addressTown: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  utilityName: string;
};

const EMPTY: FormState = {
  kWhUsed: "",
  billAmount: "",
  currency: "",
  billingPeriodDays: "",
  rawAddress: "",
  addressTown: "",
  addressCity: "",
  addressState: "",
  addressCountry: "",
  utilityName: "",
};

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

export interface ManualValues {
  kWhUsed: number | null;
  billAmount: number | null;
  currency: string | null;
  billingPeriodDays: number | null;
  rawAddress: string | null;
  addressTown: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressCountry: string | null;
  utilityName: string | null;
}

interface ManualEntryFormProps {
  // Present when we already uploaded a bill but extraction failed — we update
  // that same session instead of creating a new one.
  sessionId?: string | null;
  // Tailors the heading copy to why the user landed here.
  reason: "failed" | "no-bill";
  onDone: (sessionId: string, values: ManualValues) => void;
  onBack: () => void;
}

export function ManualEntryForm({
  sessionId,
  reason,
  onDone,
  onBack,
}: ManualEntryFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const values: ManualValues = {
      kWhUsed: numOrNull(form.kWhUsed),
      billAmount: numOrNull(form.billAmount),
      currency: strOrNull(form.currency)?.toUpperCase() ?? null,
      billingPeriodDays: numOrNull(form.billingPeriodDays),
      rawAddress: strOrNull(form.rawAddress),
      addressTown: strOrNull(form.addressTown),
      addressCity: strOrNull(form.addressCity),
      addressState: strOrNull(form.addressState),
      addressCountry: strOrNull(form.addressCountry),
      utilityName: strOrNull(form.utilityName),
    };

    if (values.kWhUsed === null && values.billAmount === null) {
      setErrorMsg("Enter at least your usage in kWh or your bill amount.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, ...values }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        sessionId?: string;
        message?: string;
      };
      if (!data.success || !data.sessionId) {
        setErrorMsg(
          data.message ?? "We couldn't save your details. Please try again."
        );
        setStatus("error");
        return;
      }
      onDone(data.sessionId, values);
    } catch {
      setErrorMsg("Failed to save. Check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">
          {reason === "failed"
            ? "No problem — enter the numbers yourself"
            : "Enter your numbers by hand"}
        </CardTitle>
        <CardDescription>
          {reason === "failed"
            ? "We couldn't read that file, but you don't need it. Grab these few figures off your latest bill."
            : "Don't have a bill handy? Copy these few figures off your latest statement and we'll take it from there."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="man-kwh">Electricity used (kWh)</FieldLabel>
              <Input
                id="man-kwh"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 450"
                value={form.kWhUsed}
                onChange={set("kWhUsed")}
              />
              <FieldDescription>
                Your usage for the billing period. Enter this or the bill amount —
                either one gets you an estimate.
              </FieldDescription>
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-amount">Bill amount</FieldLabel>
              <Input
                id="man-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 120.50"
                value={form.billAmount}
                onChange={set("billAmount")}
              />
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-currency">Currency</FieldLabel>
              <Input
                id="man-currency"
                placeholder="e.g. USD"
                maxLength={8}
                className="uppercase"
                value={form.currency}
                onChange={set("currency")}
              />
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-period">Billing period (days)</FieldLabel>
              <Input
                id="man-period"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="e.g. 30 for a monthly bill"
                value={form.billingPeriodDays}
                onChange={set("billingPeriodDays")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="man-address">
                Full address <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                id="man-address"
                rows={2}
                placeholder="House / street, area, city, country"
                value={form.rawAddress}
                onChange={set("rawAddress")}
              />
              <FieldDescription>
                The more precise your address, the better we can pin your roof on the
                map next.
              </FieldDescription>
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-town">Town / area</FieldLabel>
              <Input
                id="man-town"
                placeholder="e.g. Gulshan-e-Iqbal"
                value={form.addressTown}
                onChange={set("addressTown")}
              />
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-city">City</FieldLabel>
              <Input
                id="man-city"
                placeholder="e.g. Karachi"
                value={form.addressCity}
                onChange={set("addressCity")}
              />
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-state">State / region</FieldLabel>
              <Input
                id="man-state"
                placeholder="e.g. Sindh"
                value={form.addressState}
                onChange={set("addressState")}
              />
            </Field>

            <Field orientation="responsive">
              <FieldLabel htmlFor="man-country">Country</FieldLabel>
              <Input
                id="man-country"
                placeholder="e.g. Pakistan"
                value={form.addressCountry}
                onChange={set("addressCountry")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="man-utility">Utility company</FieldLabel>
              <Input
                id="man-utility"
                placeholder="Your electricity provider"
                value={form.utilityName}
                onChange={set("utilityName")}
              />
            </Field>

            {status === "error" && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Couldn&apos;t save</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={status === "saving"}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back
              </Button>
              <Button type="submit" size="lg" disabled={status === "saving"}>
                {status === "saving" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckCircle2Icon data-icon="inline-start" />
                )}
                {status === "saving" ? "Saving" : "Continue"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
