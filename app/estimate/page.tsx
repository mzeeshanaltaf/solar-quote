import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Estimate",
};

// Phase 2 replaces this stub with the upload -> review -> location -> results funnel.
export default function EstimatePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col items-start justify-center gap-7 px-5 py-24 sm:px-8">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
        Almost ready
      </p>
      <h1 className="text-4xl sm:text-5xl">The bill reader is warming up.</h1>
      <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
        This is where you will photograph your bill and watch it turn into a
        solar estimate. The estimator launches shortly; there is nothing to
        sign up for in the meantime, so just come back with your latest bill.
      </p>
      <Button asChild variant="outline">
        <Link href="/">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to the front page
        </Link>
      </Button>
    </main>
  );
}
