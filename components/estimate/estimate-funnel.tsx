"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PencilLineIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { ExtractedBill } from "@/lib/bill-schema";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillDropzone } from "@/components/estimate/bill-dropzone";
import { ReviewCard } from "@/components/estimate/review-card";
import { ManualEntryForm } from "@/components/estimate/manual-entry-form";
import {
  ExtractionDialog,
  type ExtractionPhase,
} from "@/components/estimate/extraction-dialog";

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

type Step =
  | "upload"
  | "preview"
  | "extracting"
  | "failed"
  | "manual"
  | "review"
  | "done";

type ApiResponse<T> = T & { success?: boolean; error?: string; message?: string };

// Copy for the dedicated failure screen, keyed by the typed error code the
// extract route returns. Every path still offers manual entry, so the funnel
// never dead-ends.
const FAILURE_COPY: Record<string, { title: string; body: string; canRetry: boolean }> =
  {
    rate: {
      title: "Let's give it a minute",
      body: "We've had a lot of uploads from your connection. Wait a few minutes before trying that file again — or just type the numbers in now.",
      canRetry: false,
    },
    ocr_failed: {
      title: "We couldn't read that file",
      body: "The text didn't come through clearly. A sharper photo or a PDF often does the trick — or skip it and enter the numbers yourself.",
      canRetry: true,
    },
    not_a_bill: {
      title: "That doesn't look like an electricity bill",
      body: "Double-check you uploaded the right file. If you'd rather not hunt for it, just enter your numbers by hand.",
      canRetry: false,
    },
    extraction_failed: {
      title: "We read it, but couldn't pull the figures",
      body: "We saw the text but couldn't pin down the numbers we need. Try again, or enter them yourself — it only takes a moment.",
      canRetry: true,
    },
    server: {
      title: "Something went wrong on our side",
      body: "That's on us, not you. Give it another go, or enter your numbers by hand to keep moving.",
      canRetry: true,
    },
  };

function failureCopy(code: string | null) {
  return (code && FAILURE_COPY[code]) || FAILURE_COPY.server;
}

export function EstimateFunnel() {
  const [step, setStep] = useState<Step>("upload");
  const [phase, setPhase] = useState<ExtractionPhase>("uploading");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bill, setBill] = useState<ExtractedBill | null>(null);

  const reset = () => {
    setStep("upload");
    setError(null);
    setErrorCode(null);
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

  const goFailed = (data: ApiResponse<unknown>) => {
    setErrorCode(data.error ?? "server");
    setError(data.message ?? null);
    setStep("failed");
  };

  // OCR the stored bill to markdown (persisted server-side). Its own request so
  // the dialog can show a real "reading" phase and so retries can skip it.
  const runOcr = async (id: string): Promise<boolean> => {
    setPhase("ocr");
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    const data = (await res.json()) as ApiResponse<unknown>;
    if (!data.success) {
      goFailed(data);
      return false;
    }
    return true;
  };

  // Structured extraction over the persisted OCR markdown (no OCR cost here).
  const runExtract = async (id: string): Promise<boolean> => {
    setPhase("extracting");
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    const data = (await res.json()) as ApiResponse<{ extracted?: ExtractedBill }>;
    if (!data.success || !data.extracted) {
      goFailed(data);
      return false;
    }
    setBill(data.extracted);
    setStep("review");
    return true;
  };

  // The user confirms the preview: upload → OCR → extract, three real steps.
  const handleProcess = async () => {
    if (!file) return;
    setError(null);
    setErrorCode(null);
    setPhase("uploading");
    setStep("extracting");

    try {
      // 1. Upload to Vercel Blob + create the QuoteSession.
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = (await upRes.json()) as ApiResponse<{ sessionId?: string }>;
      if (!upData.success || !upData.sessionId) {
        // Upload problems (size/type/rate/store) are recoverable from preview.
        setError(upData.message ?? "We couldn't store your bill. Please try again.");
        setStep("preview");
        return;
      }
      setSessionId(upData.sessionId);

      // 2. OCR, then 3. extraction.
      if (!(await runOcr(upData.sessionId))) return;
      await runExtract(upData.sessionId);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setStep("preview");
    }
  };

  // Re-run from the right point: OCR failures redo OCR + extraction; figure
  // failures reuse the persisted markdown and only redo the (cheaper) LLM step.
  const handleRetry = async () => {
    if (!sessionId) {
      // The upload itself failed — start the whole thing over.
      await handleProcess();
      return;
    }
    const redoOcr = errorCode === "ocr_failed";
    setError(null);
    setErrorCode(null);
    setStep("extracting");
    try {
      if (redoOcr && !(await runOcr(sessionId))) return;
      await runExtract(sessionId);
    } catch {
      setErrorCode("server");
      setStep("failed");
    }
  };

  const heading = () => {
    switch (step) {
      case "review":
        return "Here’s what we found.";
      case "done":
        return "Saved. Next stop: your roof.";
      case "failed":
        return "Let’s try another way.";
      case "manual":
        return "Tell us the numbers.";
      case "preview":
      case "extracting":
        return "Does this look right?";
      default:
        return "Let’s read your bill.";
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col gap-8 px-5 py-16 sm:px-8 sm:py-24">
      <ExtractionDialog open={step === "extracting"} phase={phase} />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
          Step 1 of 4 · Your bill
        </p>
        <h1 className="text-4xl sm:text-5xl">{heading()}</h1>
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

      {step === "upload" && (
        <div className="flex flex-col gap-5">
          <BillDropzone onFile={handleSelected} error={error} />
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <span>No bill handy?</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setErrorCode(null);
                setSessionId(null);
                setStep("manual");
              }}
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              Enter your numbers instead
            </button>
          </div>
        </div>
      )}

      {(step === "preview" || step === "extracting") && file && (
        <div className="flex flex-col gap-5">
          <BillPreview file={file} />

          {error && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
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

      {step === "failed" && (
        <div className="flex flex-col gap-6">
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>{failureCopy(errorCode).title}</AlertTitle>
            <AlertDescription>
              {error ?? failureCopy(errorCode).body}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size="lg"
              onClick={() => setStep("manual")}
              className="sm:flex-1"
            >
              <PencilLineIcon data-icon="inline-start" />
              Enter numbers manually
            </Button>
            {failureCopy(errorCode).canRetry && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={handleRetry}
                className="sm:flex-1"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Try again
              </Button>
            )}
          </div>

          <button
            type="button"
            onClick={reset}
            className="self-start text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Use a different file
          </button>
        </div>
      )}

      {step === "manual" && (
        <ManualEntryForm
          sessionId={sessionId}
          reason={file ? "failed" : "no-bill"}
          onDone={(id) => {
            setSessionId(id);
            setStep("done");
          }}
          onBack={() => {
            // Back to wherever they came from: the failure screen if we have an
            // uploaded session, otherwise the upload step.
            setStep(file ? "failed" : "upload");
          }}
        />
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
