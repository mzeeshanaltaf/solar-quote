"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/spinner";

// The funnel initializes browser-only state (file uploads, drag/drop, etc.), so
// we skip SSR entirely to avoid hydration mismatch (see global Next.js
// guidance). `ssr: false` is only allowed inside a Client Component.
const EstimateFunnel = dynamic(
  () =>
    import("@/components/estimate/estimate-funnel").then((m) => ({
      default: m.EstimateFunnel,
    })),
  {
    ssr: false,
    loading: () => (
      <main className="mx-auto flex w-full max-w-2xl grow items-center justify-center px-5 py-24">
        <Spinner className="size-6 text-primary" />
      </main>
    ),
  }
);

export default function EstimatePage() {
  return <EstimateFunnel />;
}
