"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SunIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShimmeringText } from "@/components/ui/shimmering-text";

// The funnel now runs three real, separately-awaited requests — upload, OCR,
// then extraction — so each phase here is driven by an actual server event
// rather than a timer. Within a phase the copy gently rotates so the dialog
// still feels alive during the longer waits.
export type ExtractionPhase = "uploading" | "ocr" | "extracting";

const PHASE_ORDER: ExtractionPhase[] = ["uploading", "ocr", "extracting"];

const PHASE_MESSAGES: Record<ExtractionPhase, string[]> = {
  uploading: ["Tucking your bill away safely…", "Getting your document ready…"],
  ocr: ["Reading every line…", "Tracing the numbers and dates…"],
  extracting: [
    "Making sense of it all…",
    "Finding your kilowatt-hours…",
    "Tidying up the figures…",
  ],
};

interface ExtractionDialogProps {
  open: boolean;
  phase: ExtractionPhase;
}

export function ExtractionDialog({ open, phase }: ExtractionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="text-center sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Reading your bill</DialogTitle>
        <DialogDescription className="sr-only">
          Uploading and extracting the figures from your electricity bill. This
          usually takes ten to thirty seconds.
        </DialogDescription>
        {open && <ExtractionBody phase={phase} />}
      </DialogContent>
    </Dialog>
  );
}

function ExtractionBody({ phase }: { phase: ExtractionPhase }) {
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <SunIcon className="size-8 animate-spin text-primary animation-duration-[6s]" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Reading your bill
        </p>
        <div className="flex min-h-8 items-center justify-center">
          {/* Keyed by phase so it remounts (and restarts at the first message)
              whenever the real phase changes — no setState-in-effect needed. */}
          <PhaseMessages key={phase} messages={PHASE_MESSAGES[phase]} />
        </div>
      </div>

      {/* One dot per real phase: filled for done + current, faded for upcoming. */}
      <div className="flex gap-1.5">
        {PHASE_ORDER.map((p, i) => (
          <motion.div
            key={p}
            className="h-1.5 rounded-full bg-primary"
            animate={{
              width: i === phaseIndex ? 24 : 6,
              opacity: i <= phaseIndex ? 1 : 0.3,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

function PhaseMessages({ messages }: { messages: string[] }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={msgIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        <ShimmeringText
          text={messages[msgIndex]}
          className="font-heading text-lg"
          duration={2}
          spread={3}
          startOnView={false}
        />
      </motion.div>
    </AnimatePresence>
  );
}
