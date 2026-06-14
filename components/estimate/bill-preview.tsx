"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Resolves correctly under both Turbopack and webpack.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface BillPreviewProps {
  file: File;
}

export function BillPreview({ file }: BillPreviewProps) {
  const isImage = file.type.startsWith("image/");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
      {isImage ? <ImagePreview file={file} /> : <PdfPreview file={file} />}
    </div>
  );
}

function ImagePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  // Free the object URL when the file changes or the preview unmounts.
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="max-h-[60vh] overflow-y-auto p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Your uploaded bill"
        className="mx-auto h-auto w-full rounded-lg"
      />
    </div>
  );
}

function PdfPreview({ file }: { file: File }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // react-pdf reloads the document whenever the `file` prop identity changes,
  // so keep it stable.
  const fileProp = useMemo(() => file, [file]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div
        ref={containerRef}
        className="max-h-[60vh] w-full overflow-y-auto rounded-lg"
      >
        <Document
          file={fileProp}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<PreviewSpinner />}
          error={
            <p className="p-6 text-center text-sm text-muted-foreground">
              We couldn&apos;t render a preview, but your file is fine — go ahead
              and process it.
            </p>
          }
        >
          {containerWidth > 0 && (
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          )}
        </Document>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <span>
            Page {pageNumber} of {numPages}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

function PreviewSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2Icon className="size-6 animate-spin text-primary" />
    </div>
  );
}
