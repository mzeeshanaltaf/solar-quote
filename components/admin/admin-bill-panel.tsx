"use client";

import dynamic from "next/dynamic";
import { Loader2Icon } from "lucide-react";

// react-pdf / pdfjs are client-only and crash on the server, so load the viewer
// lazily with ssr:false — which is only permitted inside a client component,
// hence this thin wrapper around the server-rendered detail page.
const AdminBillViewer = dynamic(
  () =>
    import("@/components/admin/admin-bill-viewer").then((m) => ({
      default: m.AdminBillViewer,
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

export function AdminBillPanel({
  sessionId,
  mimeType,
}: {
  sessionId: string;
  mimeType: string | null;
}) {
  return <AdminBillViewer sessionId={sessionId} mimeType={mimeType} />;
}
