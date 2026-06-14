"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";

import type { ExtractedBill } from "@/lib/bill-schema";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillDropzone } from "@/components/estimate/bill-dropzone";
import { ReviewCard } from "@/components/estimate/review-card";
import { ExtractionDialog } from "@/components/estimate/extraction-dialog";

// react-pdf is client-only and heavy — load it lazily, only when previewing.
const BillPreview = dynamic(
  () =>
    import("@/components/estimate/bill-preview").then((m) => ({
      default: m.BillPreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/40 py-16">
        <Loader2Icon className="size-6 animate-spin text-primary" />
      </div>
    ),
  }
);

type Step = "upload" | "preview" | "extracting" | "review" | "done";

type ApiError = { error?: string; message?: string };

export function EstimateFunnel() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bill, setBill] = useState<ExtractedBill | null>(null);

  const reset = () => {
    setStep("upload");
    setError(null);
    setFile(null);
    setSessionId(null);
    setBill(null);
  };

  // Picking a file only stages it for preview — nothing is uploaded or read yet.
  const handleSelected = (selected: File) => {
    setError(null);
    setFile(selected);
    setStep("preview");
  };

  // The user confirms the preview, then we run the (paid) upload + extraction.
  const handleProcess = async () => {
    if (!file) return;
    setError(null);
    setStep("extracting");

    try {
      // 1. Upload to Vercel Blob + create the QuoteSession.
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = (await upRes.json()) as ApiError & {
        success?: boolean;
        sessionId?: string;
      };
      if (!upData.success || !upData.sessionId) {
        setError(upData.message ?? "We couldn't store your bill. Please try again.");
        setStep("preview");
        return;
      }
      setSessionId(upData.sessionId);

      // 2. OCR + structured extraction.
      const exRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: upData.sessionId }),
      });
      const exData = (await exRes.json()) as ApiError & {
        success?: boolean;
        extracted?: ExtractedBill;
      };
      if (!exData.success || !exData.extracted) {
        setError(
          exData.message ??
            "We couldn't read your bill. Try a clearer photo or a different file."
        );
        setStep("preview");
        return;
      }

      setBill(exData.extracted);
      setStep("review");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setStep("preview");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col gap-8 px-5 py-16 sm:px-8 sm:py-24">
      <ExtractionDialog open={step === "extracting"} />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
          Step 1 of 4 · Your bill
        </p>
        <h1 className="text-4xl sm:text-5xl">
          {step === "review"
            ? "Here’s what we found."
            : step === "done"
              ? "Saved. Next stop: your roof."
              : step === "preview" || step === "extracting"
                ? "Does this look right?"
                : "Let’s read your bill."}
        </h1>
        {step === "upload" && (
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Upload your latest electricity bill and we’ll pull out the few numbers that
            decide whether solar is worth it. Nothing to sign up for.
          </p>
        )}
        {(step === "preview" || step === "extracting") && (
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Check that this is the right bill and that it’s readable, then process it
            and we’ll pull out the numbers.
          </p>
        )}
      </div>

      {step === "upload" && <BillDropzone onFile={handleSelected} error={error} />}

      {(step === "preview" || step === "extracting") && file && (
        <div className="flex flex-col gap-5">
          <BillPreview file={file} />

          {error && (
            <Alert variant="destructive">
              <AlertTitle>We hit a snag</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={reset}
              disabled={step === "extracting"}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Choose a different file
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleProcess}
              disabled={step === "extracting"}
            >
              <SparklesIcon data-icon="inline-start" />
              Process my bill
            </Button>
          </div>
        </div>
      )}

      {step === "review" && sessionId && bill && (
        <ReviewCard
          sessionId={sessionId}
          bill={bill}
          onConfirmed={() => setStep("done")}
          onReset={reset}
        />
      )}

      {step === "done" && (
        <div className="flex flex-col items-start gap-6">
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Your bill is in</AlertTitle>
            <AlertDescription>
              We’ve saved your numbers. The next steps — pinning your roof and sizing your
              system — are landing soon.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeftIcon data-icon="inline-start" />
              Back to the front page
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
