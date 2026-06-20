"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeftIcon,
  Loader2Icon,
  PencilLineIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { ExtractedBill } from "@/lib/bill-schema";
import type { EstimateParams, EstimateResult } from "@/lib/solar-math";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillDropzone } from "@/components/estimate/bill-dropzone";
import { ReviewCard } from "@/components/estimate/review-card";
import { ManualEntryForm } from "@/components/estimate/manual-entry-form";
import { LeadFormSheet } from "@/components/estimate/lead-form-sheet";
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

// The Google Maps JS bundle is heavy and browser-only — load it lazily, only
// once the funnel reaches the location step (and never on the server).
const LocationStep = dynamic(
  () =>
    import("@/components/estimate/location-step").then((m) => ({
      default: m.LocationStep,
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

// The results view pulls in motion + the SVG chart — only needed on the final
// screen, so load it lazily (and client-only) like the other heavy steps.
const ResultsView = dynamic(
  () =>
    import("@/components/estimate/results-view").then((m) => ({
      default: m.ResultsView,
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

type EstimateData = { params: EstimateParams; estimate: EstimateResult };

type Step =
  | "upload"
  | "preview"
  | "extracting"
  | "failed"
  | "manual"
  | "review"
  | "location"
  | "irradiance"
  | "estimating"
  | "results"
  | "estimate_failed";

// Drives the eyebrow step indicator. The funnel is four user-facing steps;
// several internal states map onto the same one (e.g. upload/preview/extracting
// are all "your bill").
const STEP_META: Record<Step, string> = {
  upload: "Step 1 of 4 · Your bill",
  preview: "Step 1 of 4 · Your bill",
  extracting: "Step 1 of 4 · Your bill",
  failed: "Step 1 of 4 · Your bill",
  manual: "Step 2 of 4 · Your bill",
  review: "Step 2 of 4 · Your bill",
  location: "Step 3 of 4 · Your roof",
  irradiance: "Step 3 of 4 · Your roof",
  estimating: "Step 4 of 4 · Your savings",
  results: "Step 4 of 4 · Your savings",
  estimate_failed: "Step 4 of 4 · Your savings",
};

type ApiResponse<T> = T & { success?: boolean; error?: string; message?: string };

// Experiment flag (build-time inlined). "vision" routes the funnel through the
// single-call /api/extract-vision path (gpt-5.4-mini reads the file directly);
// anything else keeps the proven upload → ocr → extract pipeline.
const EXTRACTION_MODE =
  process.env.NEXT_PUBLIC_EXTRACTION_MODE === "vision" ? "vision" : "ocr";

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
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  // Where manual entry should return to: "location" early in the funnel, or
  // straight back to "estimate" if the user came from a missing-figures estimate.
  const [manualReturn, setManualReturn] = useState<"location" | "estimate">(
    "location"
  );
  const [leadOpen, setLeadOpen] = useState(false);

  const reset = () => {
    setStep("upload");
    setError(null);
    setErrorCode(null);
    setFile(null);
    setSessionId(null);
    setBill(null);
    setEstimateData(null);
    setManualReturn("location");
    setLeadOpen(false);
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

  // Vision path: one call reads the stored file directly (no OCR step).
  const runVision = async (id: string): Promise<boolean> => {
    setPhase("extracting");
    const res = await fetch("/api/extract-vision", {
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

      // 2. Extract. Vision does it in one call; OCR mode reads then extracts.
      if (EXTRACTION_MODE === "vision") {
        await runVision(upData.sessionId);
      } else {
        if (!(await runOcr(upData.sessionId))) return;
        await runExtract(upData.sessionId);
      }
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
      if (EXTRACTION_MODE === "vision") {
        await runVision(sessionId);
      } else {
        if (redoOcr && !(await runOcr(sessionId))) return;
        await runExtract(sessionId);
      }
    } catch {
      setErrorCode("server");
      setStep("failed");
    }
  };

  // Compute + persist the estimate, then show the results. On a missing-figures
  // (insufficient) result, route to manual entry to fill the gap; on any other
  // failure, surface a retryable error — the funnel never dead-ends.
  const runEstimate = async (id: string) => {
    setStep("estimating");
    setError(null);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const data = (await res.json()) as ApiResponse<EstimateData>;
      if (data.success && data.params && data.estimate) {
        setEstimateData({ params: data.params, estimate: data.estimate });
        setStep("results");
        return;
      }
      if (data.error === "insufficient") {
        setManualReturn("estimate");
        setStep("manual");
        return;
      }
      setError(data.message ?? null);
      setStep("estimate_failed");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setStep("estimate_failed");
    }
  };

  // Pin confirmed: resolve the roof's solar irradiance (best-effort — Phase 4's
  // math falls back to a regional yield if it's missing), then size the system.
  const handleLocated = async () => {
    setStep("irradiance");
    if (sessionId) {
      try {
        await fetch("/api/irradiance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // Swallow — sizing falls back to a regional yield estimate.
      }
      await runEstimate(sessionId);
    }
  };

  // No confirmed pin (map unavailable, or the user couldn't find their roof):
  // skip irradiance entirely and size from the regional fallback yield. The
  // results view discloses that the sunlight figure is a regional estimate.
  const handleSkipLocation = () => {
    if (sessionId) void runEstimate(sessionId);
  };

  const heading = () => {
    switch (step) {
      case "review":
        return "Here’s what we found.";
      case "location":
        return "Find your roof.";
      case "irradiance":
        return "Checking your sunlight.";
      case "estimating":
        return "Crunching your numbers.";
      case "results":
        return "Here’s what your roof could do.";
      case "estimate_failed":
        return "Almost there.";
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
          {STEP_META[step]}
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
            if (manualReturn === "estimate") {
              // They came here to supply a missing figure — re-run sizing now,
              // no need to re-confirm the roof.
              setManualReturn("location");
              void runEstimate(id);
            } else {
              setStep("location");
            }
          }}
          onBack={() => {
            // Back to wherever they came from.
            if (manualReturn === "estimate") {
              setManualReturn("location");
              setStep("estimate_failed");
            } else {
              setStep(file ? "failed" : "upload");
            }
          }}
        />
      )}

      {step === "review" && sessionId && bill && (
        <ReviewCard
          sessionId={sessionId}
          bill={bill}
          onConfirmed={() => setStep("location")}
          onReset={reset}
        />
      )}

      {step === "location" && sessionId && (
        <LocationStep
          sessionId={sessionId}
          onConfirmed={handleLocated}
          onReset={reset}
          onSkip={handleSkipLocation}
        />
      )}

      {(step === "irradiance" || step === "estimating") && (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-muted/40 py-20 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin text-primary" />
          <span className="text-sm">
            {step === "irradiance"
              ? "Checking the sunlight at your roof…"
              : "Sizing your system and working out the savings…"}
          </span>
        </div>
      )}

      {step === "results" && estimateData && sessionId && (
        <>
          <ResultsView
            params={estimateData.params}
            baseline={estimateData.estimate}
            onRequestQuotes={() => setLeadOpen(true)}
            onReset={reset}
          />
          <LeadFormSheet
            sessionId={sessionId}
            open={leadOpen}
            onOpenChange={setLeadOpen}
          />
        </>
      )}

      {step === "estimate_failed" && (
        <div className="flex flex-col gap-6">
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>We couldn’t finish your estimate</AlertTitle>
            <AlertDescription>
              {error ??
                "Something went wrong working out your savings. Try again, or adjust your numbers."}
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size="lg"
              onClick={() => sessionId && runEstimate(sessionId)}
              className="sm:flex-1"
            >
              <RotateCcwIcon data-icon="inline-start" />
              Try again
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                setManualReturn("estimate");
                setStep("manual");
              }}
              className="sm:flex-1"
            >
              <PencilLineIcon data-icon="inline-start" />
              Check my numbers
            </Button>
          </div>
          <Button asChild variant="ghost" className="self-start">
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
