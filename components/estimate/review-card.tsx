"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  RotateCcwIcon,
  SparkleIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ExtractedBill } from "@/lib/bill-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type FieldKey = keyof ExtractedBill["confidence"];

// Local form state keeps every value as a string so inputs stay controlled;
// we coerce back to number | string | null on save.
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

function toFormState(bill: ExtractedBill): FormState {
  return {
    kWhUsed: bill.kWhUsed?.toString() ?? "",
    billAmount: bill.billAmount?.toString() ?? "",
    currency: bill.currency ?? "",
    billingPeriodDays: bill.billingPeriodDays?.toString() ?? "",
    rawAddress: bill.rawAddress ?? "",
    addressTown: bill.addressTown ?? "",
    addressCity: bill.addressCity ?? "",
    addressState: bill.addressState ?? "",
    addressCountry: bill.addressCountry ?? "",
    utilityName: bill.utilityName ?? "",
  };
}

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

interface ReviewCardProps {
  sessionId: string;
  bill: ExtractedBill;
  onConfirmed: (values: {
    kWhUsed: number | null;
    billAmount: number | null;
    currency: string | null;
    billingPeriodDays: number | null;
    addressTown: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressCountry: string | null;
    rawAddress: string | null;
    utilityName: string | null;
  }) => void;
  onReset: () => void;
}

export function ReviewCard({ sessionId, bill, onConfirmed, onReset }: ReviewCardProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(bill));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Fields the model was unsure about (guessed, ambiguous, or null). We flag
  // these so the user's eye lands on exactly the figures worth double-checking.
  const lowConfidence = useMemo(() => {
    const c = bill.confidence;
    return new Set<FieldKey>(
      (Object.keys(c) as FieldKey[]).filter((k) => c[k] === "low")
    );
  }, [bill.confidence]);
  const lowCount = lowConfidence.size;

  // Warm amber treatment that pulls attention to a flagged input without the
  // alarm of a destructive/red state.
  const flag = (key: FieldKey) =>
    lowConfidence.has(key)
      ? "border-primary/55 bg-primary/5 focus-visible:border-primary focus-visible:ring-primary/25"
      : undefined;

  const handleConfirm = async () => {
    const values = {
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

    setStatus("saving");
    try {
      const res = await fetch("/api/extract", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...values }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (!data.success) {
        setErrorMsg(data.message ?? "We couldn't save your changes. Please try again.");
        setStatus("error");
        return;
      }
      onConfirmed(values);
    } catch {
      setErrorMsg("Failed to save. Check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">We read your bill — check these numbers</CardTitle>
        <CardDescription>
          Fix anything that looks off. These figures drive your whole estimate, so it
          pays to get them right.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {lowCount > 0 && (
          <Alert className="mb-6 border-primary/30 bg-primary/4 text-foreground">
            <SparkleIcon className="text-primary" />
            <AlertTitle>
              {lowCount === 1
                ? "One figure worth a second look"
                : `${lowCount} figures worth a second look`}
            </AlertTitle>
            <AlertDescription className="text-muted-foreground">
              We weren&apos;t fully sure about the highlighted{" "}
              {lowCount === 1 ? "field" : "fields"} below. Confirm{" "}
              {lowCount === 1 ? "it" : "they're"} right before continuing.
            </AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-kwh">
              Electricity used (kWh)
              <LowBadge show={lowConfidence.has("kWhUsed")} />
            </FieldLabel>
            <Input
              id="rev-kwh"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 450"
              className={flag("kWhUsed")}
              value={form.kWhUsed}
              onChange={set("kWhUsed")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-amount">
              Bill amount
              <LowBadge show={lowConfidence.has("billAmount")} />
            </FieldLabel>
            <Input
              id="rev-amount"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 120.50"
              className={flag("billAmount")}
              value={form.billAmount}
              onChange={set("billAmount")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-currency">
              Currency
              <LowBadge show={lowConfidence.has("currency")} />
            </FieldLabel>
            <Input
              id="rev-currency"
              placeholder="e.g. USD"
              maxLength={8}
              className={cn("uppercase", flag("currency"))}
              value={form.currency}
              onChange={set("currency")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-period">
              Billing period (days)
              <LowBadge show={lowConfidence.has("billingPeriodDays")} />
            </FieldLabel>
            <Input
              id="rev-period"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 30"
              className={flag("billingPeriodDays")}
              value={form.billingPeriodDays}
              onChange={set("billingPeriodDays")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rev-address">
              Full address (as printed)
              <LowBadge show={lowConfidence.has("rawAddress")} />
            </FieldLabel>
            <Textarea
              id="rev-address"
              rows={2}
              placeholder="House / street, area, city, country"
              className={flag("rawAddress")}
              value={form.rawAddress}
              onChange={set("rawAddress")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-town">
              Town / area
              <LowBadge show={lowConfidence.has("addressTown")} />
            </FieldLabel>
            <Input
              id="rev-town"
              placeholder="e.g. Gulshan-e-Iqbal"
              className={flag("addressTown")}
              value={form.addressTown}
              onChange={set("addressTown")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-city">
              City
              <LowBadge show={lowConfidence.has("addressCity")} />
            </FieldLabel>
            <Input
              id="rev-city"
              placeholder="e.g. Karachi"
              className={flag("addressCity")}
              value={form.addressCity}
              onChange={set("addressCity")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-state">
              State / region
              <LowBadge show={lowConfidence.has("addressState")} />
            </FieldLabel>
            <Input
              id="rev-state"
              placeholder="e.g. Sindh"
              className={flag("addressState")}
              value={form.addressState}
              onChange={set("addressState")}
            />
          </Field>

          <Field orientation="responsive">
            <FieldLabel htmlFor="rev-country">
              Country
              <LowBadge show={lowConfidence.has("addressCountry")} />
            </FieldLabel>
            <Input
              id="rev-country"
              placeholder="e.g. Pakistan"
              className={flag("addressCountry")}
              value={form.addressCountry}
              onChange={set("addressCountry")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="rev-utility">
              Utility company
              <LowBadge show={lowConfidence.has("utilityName")} />
            </FieldLabel>
            <Input
              id="rev-utility"
              placeholder="Your electricity provider"
              className={flag("utilityName")}
              value={form.utilityName}
              onChange={set("utilityName")}
            />
          </Field>

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Not saved</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              disabled={status === "saving"}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Use a different bill
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleConfirm}
              disabled={status === "saving"}
            >
              {status === "saving" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CheckCircle2Icon data-icon="inline-start" />
              )}
              {status === "saving" ? "Saving" : "Looks good — continue"}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function LowBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="outline" className="ml-1.5 text-[0.65rem] text-muted-foreground">
      double-check
    </Badge>
  );
}
