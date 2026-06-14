"use client";

import { useMemo, useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon, RotateCcwIcon } from "lucide-react";

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

  // Phase 2.2 turns this into per-field highlighting; for now we just surface
  // a gentle "double-check" badge on anything the model was unsure about.
  const lowConfidence = useMemo(() => {
    const c = bill.confidence;
    return new Set<FieldKey>(
      (Object.keys(c) as FieldKey[]).filter((k) => c[k] === "low")
    );
  }, [bill.confidence]);

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
              className="uppercase"
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
