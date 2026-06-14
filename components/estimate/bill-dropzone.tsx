"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { UploadCloudIcon, FileTextIcon, AlertCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

interface BillDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export function BillDropzone({ onFile, disabled, error }: BillDropzoneProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setLocalError(null);
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        setLocalError(
          code === "file-too-large"
            ? "That file is over the 10 MB limit. Try a smaller scan or photo."
            : "Unsupported file. Upload a PDF, JPG, PNG, or WebP."
        );
        return;
      }
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    multiple: true,
    maxFiles: 1,
    disabled,
    noClick: true,
    noKeyboard: true,
  });

  const shownError = error ?? localError;

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-border bg-card/60 px-6 py-14 text-center transition-colors",
          isDragActive && "border-primary bg-accent/50",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {/* Mobile camera capture + file picker. The accept/capture attributes
            steer phones toward the camera; react-dropzone owns the rest. */}
        <input {...getInputProps()} capture="environment" />

        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloudIcon className="size-7" />
        </div>

        <div className="space-y-1.5">
          <p className="font-heading text-lg text-foreground">
            {isDragActive ? "Drop it right here" : "Add your electricity bill"}
          </p>
          <p className="mx-auto max-w-[34ch] text-sm text-muted-foreground">
            Drag a file in, or pick one from your device. On a phone you can
            snap a photo of the bill.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button type="button" onClick={open} disabled={disabled}>
            <FileTextIcon data-icon="inline-start" />
            Choose a file
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG, or WebP · up to 10 MB
        </p>
      </div>

      {shownError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Couldn&apos;t use that file</AlertTitle>
          <AlertDescription>{shownError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
