"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import {
  ArrowRightIcon,
  BadgeInfoIcon,
  LeafIcon,
  RotateCcwIcon,
  SunIcon,
  TrendingUpIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";

import {
  computeEstimate,
  formatKwh,
  formatKwp,
  formatMoney,
  formatYears,
  OFFSET_STOPS,
  type EstimateParams,
  type EstimateResult,
} from "@/lib/solar-math";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SavingsChart } from "@/components/estimate/savings-chart";

interface ResultsViewProps {
  params: EstimateParams;
  baseline: EstimateResult;
  onRequestQuotes: () => void;
  onReset: () => void;
}

// Animate a number from its previous value to the next, formatting each frame.
// Used for the headline so slider changes feel alive; honours reduced-motion.
function AnimatedValue({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduce) return;
    // onUpdate fires from the animation loop (not synchronously in the effect),
    // so it drives the count without cascading renders.
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  // Reduced-motion users always see the live value; everyone else sees it count.
  return <>{format(reduce ? value : display)}</>;
}

// Staggered fade-up reveal for each section of the page.
function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.08, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

function Stat({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="font-display text-3xl leading-none tabular-nums">{value}</p>
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
    </div>
  );
}

export function ResultsView({
  params,
  baseline,
  onRequestQuotes,
  onReset,
}: ResultsViewProps) {
  const [offset, setOffset] = useState(1);

  // Re-run the exact same pure math the server ran, for the chosen offset. The
  // 100% case reuses the persisted baseline so first paint is identical.
  const est = useMemo<EstimateResult>(
    () => (offset === 1 ? baseline : computeEstimate({ ...params, offset })),
    [offset, params, baseline]
  );

  const offsetPct = Math.round(est.consumptionOffset * 100);
  const currency = est.currency;
  // Past 100% the array generates more than the home uses. The conservative
  // model values only self-consumed power, so savings hold flat while size and
  // cost climb — we surface that surplus explicitly so the number doesn't look
  // stuck.
  const overBuilt = offset > 1;
  const surplusPct = Math.round((offset - 1) * 100);

  return (
    <div className="flex flex-col gap-10">
      {/* Hero — the money number */}
      <Reveal index={0} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Based on the numbers from your own bill
        </p>
        <p className="font-display text-[clamp(2.25rem,10vw,5.5rem)] leading-[0.95] text-primary tabular-nums text-balance">
          <AnimatedValue
            value={est.annualSavings}
            format={(n) => formatMoney(n, currency)}
          />
        </p>
        <p className="max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
          Estimated saving every year — about{" "}
          <span className="font-medium text-foreground">
            {formatMoney(est.monthlySavings, currency)}
          </span>{" "}
          a month.{" "}
          {overBuilt ? (
            <>
              That covers all the electricity you use, with about{" "}
              <span className="font-medium text-foreground">{surplusPct}%</span> to
              spare for export.
            </>
          ) : (
            <>
              That covers roughly{" "}
              <span className="font-medium text-foreground">{offsetPct}%</span> of the
              electricity you use, generated on your own roof.
            </>
          )}
        </p>
      </Reveal>

      {/* Offset slider — size the system live */}
      <Reveal index={1}>
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Your rooftop system
              </p>
              <p className="font-display text-4xl leading-none tabular-nums">
                {formatKwp(est.systemKwp)}
              </p>
            </div>
            <p className="text-right text-sm text-muted-foreground">
              sized to cover
              <br />
              <span className="font-medium text-foreground">
                {Math.round(offset * 100)}%
              </span>{" "}
              of your use
            </p>
          </div>

          <Slider
            value={[offset * 100]}
            min={OFFSET_STOPS[0] * 100}
            max={OFFSET_STOPS[OFFSET_STOPS.length - 1] * 100}
            step={20}
            onValueChange={([v]) => setOffset(v / 100)}
            aria-label="System size as a percentage of your electricity use"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {OFFSET_STOPS.map((s) => (
              <span
                key={s}
                className={cn(
                  "tabular-nums",
                  Math.round(offset * 100) === Math.round(s * 100) &&
                    "font-semibold text-foreground"
                )}
              >
                {Math.round(s * 100)}%
              </span>
            ))}
          </div>
          {overBuilt ? (
            <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground">
              Your panels now make about{" "}
              <span className="font-medium">{surplusPct}% more</span> than you use, so
              your yearly saving holds at{" "}
              <span className="font-medium">
                {formatMoney(est.annualSavings, currency)}
              </span>
              . We only count the power you actually use; the extra is exported for
              credits we leave out to stay conservative.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A smaller system costs less but covers less; going past 100% rarely pays
              off, since extra power you don&apos;t use only earns export credits.
            </p>
          )}
        </div>
      </Reveal>

      {/* Key numbers */}
      <Reveal index={2} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          icon={<SunIcon className="size-4" />}
          label="System size"
          value={formatKwp(est.systemKwp)}
          caption={`Produces ~${formatKwh(est.annualProductionKwh)} in year one`}
        />
        <Stat
          icon={<ZapIcon className="size-4" />}
          label="You use"
          value={formatKwh(est.annualConsumptionKwh)}
          caption={`At ${formatMoney(est.effectiveTariff, currency, 2)} per kWh from your bill`}
        />
        {est.costAvailable ? (
          <Stat
            icon={<WalletIcon className="size-4" />}
            label="Pays for itself in"
            value={est.paybackYears != null ? formatYears(est.paybackYears) : "—"}
            caption={`On an estimated ${formatMoney(est.systemCost!, currency)} installed`}
          />
        ) : (
          <Stat
            icon={<WalletIcon className="size-4" />}
            label="Lifetime savings"
            value={formatMoney(est.lifetimeSavings, currency)}
            caption={`We can't estimate install cost in ${currency ?? "this currency"} yet`}
          />
        )}
        <Stat
          icon={<TrendingUpIcon className="size-4" />}
          label="25-year savings"
          value={formatMoney(
            est.netLifetimeSavings ?? est.lifetimeSavings,
            currency
          )}
          caption={
            est.costAvailable
              ? "After paying off the system"
              : "Before installation cost"
          }
        />
      </Reveal>

      {/* 25-year chart */}
      <Reveal index={3}>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-xl">Your savings over 25 years</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cumulative savings as the panels pay for themselves and then run clear.
              Output eases off ~0.5% a year as panels age.
            </p>
          </div>
          <SavingsChart
            projection={est.projection}
            systemCost={est.systemCost}
            currency={currency}
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LeafIcon className="size-4 shrink-0 text-primary" />
            <span>
              Avoids roughly{" "}
              <span className="font-medium text-foreground">
                {est.co2AvoidedTonnesPerYear.toFixed(1)} tonnes of CO₂
              </span>{" "}
              every year.
            </span>
          </div>
        </div>
      </Reveal>

      {/* Soft CTA */}
      <Reveal index={4}>
        <div className="flex flex-col gap-5 rounded-2xl bg-primary p-7 text-primary-foreground sm:p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl text-primary-foreground sm:text-3xl">
              Like these numbers?
            </h2>
            <p className="max-w-[48ch] leading-relaxed text-primary-foreground/85">
              Get firm quotes from vetted local installers — no obligation, and your
              bill is never shared until you ask. You choose how you&apos;re contacted.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={onRequestQuotes}
              className="h-12 px-7 text-base"
            >
              Get quotes from installers
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <span className="text-sm text-primary-foreground/70">
              Free for homeowners, always.
            </span>
          </div>
        </div>
      </Reveal>

      {/* Assumptions — honest, expandable */}
      <Reveal index={5} className="flex flex-col gap-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="how">
            <AccordionTrigger className="text-base">
              <span className="flex items-center gap-2">
                <BadgeInfoIcon className="size-4 text-primary" />
                How we worked this out
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              <ul className="flex flex-col gap-2.5">
                <li>
                  <strong className="font-medium text-foreground">Your price.</strong>{" "}
                  {formatMoney(est.effectiveTariff, currency, 2)} per kWh, taken
                  straight from your bill amount divided by the units used — no tariff
                  tables, no guesswork.
                </li>
                <li>
                  <strong className="font-medium text-foreground">Sunlight.</strong>{" "}
                  {Math.round(est.specificYield).toLocaleString()} kWh per kWp a year{" "}
                  {est.specificYieldSource === "measured"
                    ? "from PVGIS/NASA satellite data for your exact roof."
                    : "estimated for your region (we couldn't fetch live data for the pin)."}
                </li>
                <li>
                  <strong className="font-medium text-foreground">Cost.</strong>{" "}
                  {est.costAvailable
                    ? `An estimated ${formatMoney(
                        est.systemCost!,
                        currency
                      )} installed, from regional per-kWp averages — a starting point, not a quote.`
                    : `We don't yet have an installed-cost estimate in ${
                        currency ?? "your currency"
                      }, so payback isn't shown.`}
                </li>
                <li>
                  <strong className="font-medium text-foreground">Savings.</strong>{" "}
                  Counted conservatively — only the power you actually use is valued at
                  your tariff; the price is held flat and panels lose ~0.5% output a
                  year over the 25-year view.
                </li>
              </ul>
              <p className="mt-4">
                These are estimates to help you decide whether to look further, not a
                binding offer.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="self-start"
        >
          <RotateCcwIcon data-icon="inline-start" />
          Start over with another bill
        </Button>
      </Reveal>
    </div>
  );
}
