// Phase 4 — Sizing + Savings/ROI math.
//
// Pure, deterministic, client-safe (no server-only deps): the /api/estimate
// route computes the baseline once, and the results page re-runs computeEstimate
// locally as the user drags the offset slider. Unit-tested in solar-math.test.ts.
//
// The whole model is currency-agnostic by design: the effective tariff comes
// from the user's OWN bill (amount ÷ kWh), so savings land in the bill's currency
// with no tariff database. Only the installed-cost estimate needs a currency
// bridge (USD cost-defaults → bill currency via FX), and when that bridge is
// missing we still show production and savings, just not cost/payback.

import {
  GRID_EMISSION_FACTOR_KG_PER_KWH,
  costPerKwpUsd,
  fallbackSpecificYield,
  usdFx,
} from "@/lib/cost-defaults";

// Annual panel output decline. 0.5%/yr is the standard linear-degradation
// assumption used across the industry for a 25-year view.
export const PANEL_DEGRADATION = 0.005;
export const PROJECTION_YEARS = 25;
// Most residential bills are monthly; assume that when the period is unknown so
// annualisation never divides by an absent number.
export const DEFAULT_BILLING_PERIOD_DAYS = 30;
// Slider stops, as fractions of annual consumption.
export const OFFSET_STOPS = [0.8, 1.0, 1.2] as const;

export class EstimateError extends Error {
  code: "insufficient";
  constructor(message: string) {
    super(message);
    this.name = "EstimateError";
    this.code = "insufficient";
  }
}

// --- the small pure pieces (individually unit-tested) -----------------------

/** Scale the billing-period consumption to a full year. */
export function annualConsumptionKwh(
  kWhUsed: number,
  billingPeriodDays: number | null | undefined
): number {
  const days =
    billingPeriodDays && billingPeriodDays > 0
      ? billingPeriodDays
      : DEFAULT_BILLING_PERIOD_DAYS;
  return kWhUsed * (365 / days);
}

/** Price per kWh implied by the bill itself, in the bill's currency. */
export function effectiveTariff(billAmount: number, kWhUsed: number): number {
  return billAmount / kWhUsed;
}

/** Capacity (kWp) needed to generate `targetAnnualKwh` at this site's yield. */
export function sizeSystemKwp(targetAnnualKwh: number, specificYield: number): number {
  return targetAnnualKwh / specificYield;
}

/** First-year output (kWh) of a `systemKwp` system before any degradation. */
export function annualProductionKwh(systemKwp: number, specificYield: number): number {
  return systemKwp * specificYield;
}

/** Output in a given project year, after linear panel degradation. */
export function productionInYear(
  year1ProductionKwh: number,
  year: number
): number {
  return year1ProductionKwh * Math.pow(1 - PANEL_DEGRADATION, year - 1);
}

// --- the full estimate ------------------------------------------------------

export interface EstimateParams {
  kWhUsed: number | null;
  billAmount: number | null;
  currency: string | null;
  billingPeriodDays: number | null;
  /** Measured specific yield (kWh/kWp/yr) from PVGIS/NASA, or null to fall back. */
  specificYield: number | null;
  country: string | null;
  /** Target offset as a fraction of annual consumption. Defaults to 1.0 (100%). */
  offset?: number;
}

export interface ProjectionPoint {
  year: number;
  productionKwh: number;
  savings: number; // that year, bill currency
  cumulativeSavings: number; // running total, bill currency
  netPosition: number | null; // cumulative savings minus system cost; null if no cost
}

export interface EstimateResult {
  offset: number;
  currency: string | null;

  specificYield: number;
  specificYieldSource: "measured" | "fallback";

  annualConsumptionKwh: number;
  effectiveTariff: number; // bill currency per kWh

  systemKwp: number;
  annualProductionKwh: number; // year 1
  /** Fraction of annual consumption the system offsets (capped at 1 for savings). */
  consumptionOffset: number;

  annualSavings: number; // bill currency, year 1
  monthlySavings: number; // annual / 12

  systemCost: number | null; // bill currency; null when FX for the currency is unknown
  costAvailable: boolean;
  paybackYears: number | null;

  lifetimeSavings: number; // 25-yr cumulative gross savings, bill currency
  netLifetimeSavings: number | null; // lifetime savings minus cost; null if no cost

  co2AvoidedTonnesPerYear: number;

  projection: ProjectionPoint[];
}

/**
 * Size a system and compute its savings/ROI for one offset level.
 *
 * Requires both consumption (kWh) and spend (amount) to derive the tariff and
 * size the array — throws `EstimateError("insufficient")` otherwise so the
 * caller can route the user back to fill in the missing number. Cost and payback
 * are null (rather than wrong) when the bill currency has no FX entry.
 */
export function computeEstimate(p: EstimateParams): EstimateResult {
  const offset = p.offset ?? 1;

  if (!p.kWhUsed || p.kWhUsed <= 0 || !p.billAmount || p.billAmount <= 0) {
    throw new EstimateError(
      "Need both electricity used (kWh) and the bill amount to estimate savings."
    );
  }

  const measured = typeof p.specificYield === "number" && p.specificYield > 0;
  const specificYield = measured
    ? (p.specificYield as number)
    : fallbackSpecificYield(p.country);

  const consumption = annualConsumptionKwh(p.kWhUsed, p.billingPeriodDays);
  const tariff = effectiveTariff(p.billAmount, p.kWhUsed);

  const targetAnnual = consumption * offset;
  const systemKwp = sizeSystemKwp(targetAnnual, specificYield);
  const year1Production = annualProductionKwh(systemKwp, specificYield);

  // Cost (USD defaults → bill currency). Null when we can't convert.
  const fx = usdFx(p.currency);
  const systemCost = fx != null ? costPerKwpUsd(p.country) * systemKwp * fx : null;

  // 25-year projection: production degrades each year; savings are conservative
  // — only self-consumed kWh count (export upside is shown as a range in the UI,
  // not baked in here), and the tariff is held flat (no price-inflation tailwind).
  const projection: ProjectionPoint[] = [];
  let cumulative = 0;
  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const production = productionInYear(year1Production, year);
    const usefulKwh = Math.min(production, consumption);
    const savings = usefulKwh * tariff;
    cumulative += savings;
    projection.push({
      year,
      productionKwh: production,
      savings,
      cumulativeSavings: cumulative,
      netPosition: systemCost != null ? cumulative - systemCost : null,
    });
  }

  const annualSavings = Math.min(year1Production, consumption) * tariff;
  const paybackYears =
    systemCost != null && annualSavings > 0 ? systemCost / annualSavings : null;
  const consumptionOffset =
    consumption > 0 ? Math.min(1, year1Production / consumption) : 0;

  return {
    offset,
    currency: p.currency,
    specificYield,
    specificYieldSource: measured ? "measured" : "fallback",
    annualConsumptionKwh: consumption,
    effectiveTariff: tariff,
    systemKwp,
    annualProductionKwh: year1Production,
    consumptionOffset,
    annualSavings,
    monthlySavings: annualSavings / 12,
    systemCost,
    costAvailable: systemCost != null,
    paybackYears,
    lifetimeSavings: cumulative,
    netLifetimeSavings: systemCost != null ? cumulative - systemCost : null,
    co2AvoidedTonnesPerYear:
      (Math.min(year1Production, consumption) * GRID_EMISSION_FACTOR_KG_PER_KWH) /
      1000,
    projection,
  };
}

// --- display formatters (client-safe; Intl works in node + browser) ---------

/** Money in the bill's currency. Falls back to a plain number + code for codes
 *  Intl doesn't recognise, so an exotic currency never throws or shows "NaN". */
export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  fractionDigits = 0
): string {
  const code = currency?.trim().toUpperCase();
  if (code) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(amount);
    } catch {
      // Unknown/invalid ISO code — fall through to the plain format.
    }
  }
  const n = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  return code ? `${code} ${n}` : n;
}

export function formatKwh(kwh: number): string {
  return `${Math.round(kwh).toLocaleString()} kWh`;
}

export function formatKwp(kwp: number): string {
  // One decimal reads honestly for residential sizes (e.g. 6.1 kWp).
  return `${kwp.toFixed(1)} kWp`;
}

export function formatYears(years: number): string {
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} mo`;
  }
  return `${years.toFixed(1)} yr`;
}
