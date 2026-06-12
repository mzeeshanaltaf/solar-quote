import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STEPS = [
  {
    n: "1",
    title: "Photograph your bill",
    body: "A phone photo or a PDF, in any language. We read the kWh, the amount, the currency, and the service address straight off the page. Nothing to type.",
  },
  {
    n: "2",
    title: "Point at your roof",
    body: "We place a pin on a satellite map from the address on the bill. Drag it onto your actual roof so the sunlight data matches your house, not your street.",
  },
  {
    n: "3",
    title: "Read your numbers",
    body: "System size, what it would produce, what you would save each year in your own currency, and when it pays for itself. All of it shown in full, before we ask you anything.",
  },
] as const;

const FAQS = [
  {
    q: "How accurate is the estimate?",
    a: "The consumption and price come from your own bill, and the sunlight data comes from PVGIS and NASA POWER, the same public datasets professionals use. Installation costs vary by market, so we show those as a clearly labeled range. Treat the result as a well-informed starting point, not a binding quote.",
  },
  {
    q: "Does it work in my country?",
    a: "Yes. There is no fixed bill format: the reader handles bills from any utility, in any language, and the savings are calculated in whatever currency your bill uses. Sunlight data covers the whole globe.",
  },
  {
    q: "What happens to my bill after I upload it?",
    a: "It is stored only to produce your estimate and is never sold or shared with installers without your explicit request. Bills contain personal information, so you can ask us to delete yours at any time.",
  },
  {
    q: "Is it really free? Who pays for this?",
    a: "Free for homeowners, always. If you like your numbers and ask for installer quotes, vetted local installers pay us for the introduction. That only happens when you ask; seeing your estimate costs nothing and obliges you to nothing.",
  },
  {
    q: "I don't have a bill handy.",
    a: "You can type two numbers instead: roughly what you pay per month and your country. The estimate engine works the same way, just with a little less precision than reading your actual bill.",
  },
  {
    q: "Will someone call me?",
    a: "Only if you ask for quotes, and you choose how to be contacted. There is no account, no phone wall in front of the results, and no surprise calls.",
  },
] as const;

function BillArtifact() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -top-10 -right-6 size-40 rounded-full bg-accent sm:-top-14 sm:-right-10 sm:size-56" />
      <div className="relative rotate-[1.5deg] rounded-lg border border-border bg-card p-6 shadow-[0_24px_48px_-24px_oklch(0.35_0.04_50/0.35)] sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Electricity statement
          </span>
          <span className="text-xs text-muted-foreground">Mar 2026</span>
        </div>
        <dl className="mt-6 flex flex-col gap-3 text-sm">
          {[
            ["Units consumed", "612 kWh"],
            ["Amount due", "$84.60"],
            ["Effective tariff", "$0.138 / kWh"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <span className="grow border-b border-dotted border-border" />
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 border-t border-dashed border-border pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-primary">
              What sunlight could cover
            </span>
            <span className="font-display text-3xl text-primary">~84%</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            6.1 kWp rooftop system, payback in 5.2 years
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28"
        >
          <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
                From your own numbers
              </p>
              <h1
                id="hero-heading"
                className="mt-5 max-w-[14ch] text-[clamp(2.625rem,7vw,5rem)] leading-[1.04]"
              >
                Your bill already knows if solar is worth it.
              </h1>
              <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
                Photograph your electricity bill and, in about a minute, see
                what a rooftop system would save you: in your currency,
                calculated from what you actually use and pay. No account, no
                phone number, no salesperson.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="h-12 px-7 text-base">
                  <Link href="/estimate">
                    Check my bill
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
                <a
                  href="#how-it-works"
                  className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Works with any utility, any language, anywhere the sun shines.
              </p>
            </div>
            <div className="px-4 sm:px-10 lg:col-span-5 lg:px-0">
              <BillArtifact />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="scroll-mt-16 border-t border-border/60"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <h2 id="how-heading" className="text-3xl sm:text-4xl">
              Three steps, one minute
            </h2>
            <ol className="mt-12 flex flex-col">
              {STEPS.map((step, i) => (
                <li
                  key={step.n}
                  className={`grid gap-4 py-10 sm:grid-cols-12 sm:gap-8 ${
                    i > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="font-display text-5xl text-primary sm:col-span-2 sm:text-6xl"
                  >
                    {step.n}
                  </span>
                  <div className="sm:col-span-6">
                    <h3 className="text-xl sm:text-2xl">{step.title}</h3>
                    <p className="mt-3 max-w-[58ch] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Promise band */}
        <section
          aria-labelledby="promise-heading"
          className="bg-primary text-primary-foreground"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <h2
              id="promise-heading"
              className="max-w-[22ch] text-3xl leading-snug sm:text-4xl"
            >
              Everything shown, nothing gated.
            </h2>
            <ul className="mt-8 flex flex-col gap-3 text-base/relaxed sm:flex-row sm:gap-10">
              <li>No account to create</li>
              <li className="sm:border-l sm:border-primary-foreground/30 sm:pl-10">
                No phone wall in front of results
              </li>
              <li className="sm:border-l sm:border-primary-foreground/30 sm:pl-10">
                Your bill deleted on request
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="faq-heading" className="text-3xl sm:text-4xl">
                Fair questions
              </h2>
              <p className="mt-4 max-w-[36ch] leading-relaxed text-muted-foreground">
                Solar marketing has earned your skepticism. Here is exactly how
                this works.
              </p>
            </div>
            <div className="lg:col-span-8">
              <Accordion type="single" collapsible>
                {FAQS.map((faq) => (
                  <AccordionItem key={faq.q} value={faq.q}>
                    <AccordionTrigger className="py-5 text-base">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="max-w-[68ch] text-base leading-relaxed text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section aria-labelledby="cta-heading" className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-7 px-5 py-20 sm:px-8 sm:py-24">
            <h2 id="cta-heading" className="max-w-[20ch] text-3xl sm:text-4xl">
              The answer is printed on your bill. Go get it.
            </h2>
            <Button asChild size="lg" className="h-12 px-7 text-base">
              <Link href="/estimate">
                Check my bill
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
    </>
  );
}
