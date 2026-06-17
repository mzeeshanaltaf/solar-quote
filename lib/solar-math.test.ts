import { describe, expect, it } from "vitest";

import {
  EstimateError,
  PROJECTION_YEARS,
  annualConsumptionKwh,
  annualProductionKwh,
  computeEstimate,
  effectiveTariff,
  formatMoney,
  productionInYear,
  sizeSystemKwp,
  type EstimateParams,
} from "@/lib/solar-math";

describe("pure pieces", () => {
  it("annualises a monthly bill", () => {
    expect(annualConsumptionKwh(612, 30)).toBeCloseTo(612 * (365 / 30), 5);
  });

  it("defaults to a 30-day period when the billing period is missing", () => {
    expect(annualConsumptionKwh(612, null)).toBeCloseTo(annualConsumptionKwh(612, 30), 5);
    expect(annualConsumptionKwh(612, 0)).toBeCloseTo(annualConsumptionKwh(612, 30), 5);
  });

  it("derives the effective tariff from the bill itself", () => {
    expect(effectiveTariff(84.6, 612)).toBeCloseTo(0.1382, 4);
  });

  it("sizes capacity from target output and yield", () => {
    expect(sizeSystemKwp(7446, 1700)).toBeCloseTo(4.38, 2);
  });

  it("production = capacity * yield, and degrades over the years", () => {
    expect(annualProductionKwh(5, 1500)).toBe(7500);
    expect(productionInYear(7500, 1)).toBe(7500);
    expect(productionInYear(7500, 25)).toBeLessThan(7500);
    // 0.5%/yr over 24 elapsed years.
    expect(productionInYear(7500, 25)).toBeCloseTo(7500 * 0.995 ** 24, 4);
  });
});

const PHOENIX: EstimateParams = {
  kWhUsed: 612,
  billAmount: 84.6,
  currency: "USD",
  billingPeriodDays: 30,
  specificYield: 1700,
  country: "United States",
};

describe("computeEstimate — full ROI", () => {
  it("sizes to ~100% offset and produces a sane payback", () => {
    const r = computeEstimate(PHOENIX);
    expect(r.specificYieldSource).toBe("measured");
    // At 100% offset, production ≈ consumption.
    expect(r.annualProductionKwh).toBeCloseTo(r.annualConsumptionKwh, 2);
    expect(r.systemKwp).toBeGreaterThan(3);
    expect(r.systemKwp).toBeLessThan(6);
    // ~$1k/yr saved, payback in a believable window.
    expect(r.annualSavings).toBeGreaterThan(800);
    expect(r.annualSavings).toBeLessThan(1300);
    expect(r.paybackYears).not.toBeNull();
    expect(r.paybackYears!).toBeGreaterThan(5);
    expect(r.paybackYears!).toBeLessThan(20);
    expect(r.projection).toHaveLength(PROJECTION_YEARS);
    expect(r.lifetimeSavings).toBeGreaterThan(r.annualSavings);
  });

  it("oversizing past 100% costs more but caps self-consumption savings", () => {
    const base = computeEstimate({ ...PHOENIX, offset: 1.0 });
    const over = computeEstimate({ ...PHOENIX, offset: 1.2 });
    const under = computeEstimate({ ...PHOENIX, offset: 0.8 });

    expect(over.systemKwp).toBeGreaterThan(base.systemKwp);
    expect(over.systemCost!).toBeGreaterThan(base.systemCost!);
    // Savings are capped at consumption, so 120% saves the same as 100%...
    expect(over.annualSavings).toBeCloseTo(base.annualSavings, 2);
    // ...which means a longer payback than the right-sized system.
    expect(over.paybackYears!).toBeGreaterThan(base.paybackYears!);
    // Under-sizing scales savings down with the offset.
    expect(under.annualSavings).toBeCloseTo(base.annualSavings * 0.8, 2);
  });

  it("falls back to a regional yield when none was measured", () => {
    const r = computeEstimate({ ...PHOENIX, specificYield: null });
    expect(r.specificYieldSource).toBe("fallback");
    expect(r.specificYield).toBeGreaterThan(0);
  });

  it("hides cost/payback for a currency with no FX entry, but still shows savings", () => {
    const r = computeEstimate({ ...PHOENIX, currency: "XX" });
    expect(r.costAvailable).toBe(false);
    expect(r.systemCost).toBeNull();
    expect(r.paybackYears).toBeNull();
    expect(r.netLifetimeSavings).toBeNull();
    expect(r.annualSavings).toBeGreaterThan(0);
    expect(r.projection.at(-1)!.netPosition).toBeNull();
  });

  it("works in the bill's own currency (Lahore / PKR)", () => {
    const r = computeEstimate({
      kWhUsed: 700,
      billAmount: 28000,
      currency: "PKR",
      billingPeriodDays: 30,
      specificYield: 1550,
      country: "Pakistan",
    });
    expect(r.costAvailable).toBe(true);
    expect(r.annualSavings).toBeGreaterThan(0);
    expect(r.paybackYears!).toBeGreaterThan(1);
  });

  it("throws when neither tariff input is usable", () => {
    expect(() => computeEstimate({ ...PHOENIX, billAmount: null })).toThrow(EstimateError);
    expect(() => computeEstimate({ ...PHOENIX, kWhUsed: 0 })).toThrow(EstimateError);
  });
});

describe("formatMoney", () => {
  it("formats a known currency", () => {
    expect(formatMoney(1234, "USD")).toMatch(/1,234/);
  });
  it("falls back to code + number for an unknown code", () => {
    expect(formatMoney(1234, "XX")).toMatch(/1,234/);
  });
});
