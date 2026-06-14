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

// Duration in ms. The final step uses Infinity so it stays until the
// operation finishes. OCR + extraction typically runs 10–30 s.
const STEPS = [
  { message: "Uploading your bill…", duration: 4000 },
  { message: "Reading every line…", duration: 8000 },
  { message: "Finding your kilowatt-hours…", duration: 8000 },
  { message: "Tidying up the numbers…", duration: Infinity },
];

interface ExtractionDialogProps {
  open: boolean;
}

export function ExtractionDialog({ open }: ExtractionDialogProps) {
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
          Extracting the figures from your electricity bill. This usually takes
          ten to thirty seconds.
        </DialogDescription>
        {/* Mounted only while open, so the step sequence restarts each time. */}
        {open && <ExtractionBody />}
      </DialogContent>
    </Dialog>
  );
}

function ExtractionBody() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let current = 0;
    function advance() {
      const next = current + 1;
      if (next < STEPS.length && STEPS[next].duration !== Infinity) {
        current = next;
        setStepIndex(current);
        timer = setTimeout(advance, STEPS[current].duration);
      } else if (next < STEPS.length) {
        current = next;
        setStepIndex(current);
      }
    }

    let timer = setTimeout(advance, STEPS[0].duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <SunIcon className="size-8 animate-spin text-primary animation-duration-[6s]" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Reading your bill</p>
        <div className="flex min-h-8 items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <ShimmeringText
                text={STEPS[stepIndex].message}
                className="font-heading text-lg"
                duration={2}
                spread={3}
                startOnView={false}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <motion.div
            key={i}
            className="h-1.5 rounded-full bg-primary"
            animate={{
              width: i === stepIndex ? 24 : 6,
              opacity: i <= stepIndex ? 1 : 0.3,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
