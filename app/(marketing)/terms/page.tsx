import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms that apply when you use SolarQuote to estimate solar savings from your electricity bill.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
        Terms of service
      </p>
      <h1 className="mt-4 text-4xl sm:text-5xl">
        Short, because the service is simple.
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated June 12, 2026
      </p>

      <div className="mt-12 flex max-w-[70ch] flex-col gap-10 leading-relaxed">
        <section aria-labelledby="terms-service">
          <h2 id="terms-service" className="text-2xl">
            The service
          </h2>
          <p className="mt-3 text-muted-foreground">
            SolarQuote turns the numbers on your electricity bill into a solar
            savings estimate: a suggested system size, projected production,
            projected savings, and a payback period. The service is free for
            homeowners. If you ask for installer quotes, we may introduce you
            to local installers who pay us for that introduction.
          </p>
        </section>

        <section aria-labelledby="terms-estimates">
          <h2 id="terms-estimates" className="text-2xl">
            Estimates are estimates
          </h2>
          <p className="mt-3 text-muted-foreground">
            Our figures are calculated from your own bill and public solar
            irradiance datasets (PVGIS, NASA POWER), with installation costs
            drawn from regional averages that are clearly labeled as such.
            They are a well-informed starting point, not a binding quote, an
            engineering assessment, or financial advice. Actual production,
            prices, tariffs, and regulations vary; always confirm final
            numbers with a qualified local installer before buying anything.
          </p>
        </section>

        <section aria-labelledby="terms-use">
          <h2 id="terms-use" className="text-2xl">
            Acceptable use
          </h2>
          <p className="mt-3 text-muted-foreground">
            Upload only bills you are entitled to share, typically your own.
            Do not use the service to harvest data, probe our systems, or
            submit automated bulk requests; we rate-limit and block abusive
            traffic.
          </p>
        </section>

        <section aria-labelledby="terms-liability">
          <h2 id="terms-liability" className="text-2xl">
            Liability
          </h2>
          <p className="mt-3 text-muted-foreground">
            The service is provided as-is. To the fullest extent permitted by
            law, we are not liable for decisions made on the basis of an
            estimate, for the conduct of installers we introduce, or for
            interruptions to the service itself.
          </p>
        </section>

        <section aria-labelledby="terms-privacy">
          <h2 id="terms-privacy" className="text-2xl">
            Your data
          </h2>
          <p className="mt-3 text-muted-foreground">
            How we handle your bill and contact details is covered by the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            , including your right to have everything deleted on request.
          </p>
        </section>

        <section aria-labelledby="terms-changes">
          <h2 id="terms-changes" className="text-2xl">
            Changes
          </h2>
          <p className="mt-3 text-muted-foreground">
            If these terms change in a way that matters, we will update the
            date above. Continued use after a change means you accept the new
            terms. Questions are welcome through the{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
