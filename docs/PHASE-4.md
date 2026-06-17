# SolarQuote Phase 4 — Sizing + Savings/ROI Results

> **Status (2026-06-17): ✅ built.** Pure ROI math (`lib/solar-math.ts`) with
> 13 `vitest` unit tests, cost/FX/yield defaults (`lib/cost-defaults.ts`), the
> compute-and-persist route (`/api/estimate`, advances the session to
> `ESTIMATED`), and the results screen (`results-view.tsx` + a hand-built SVG
> `savings-chart.tsx`, motion reveals, live offset slider, soft CTA) wired into
> the funnel. `npm run build`, `npm run lint`, and `npm test` all clean. No
> schema change — every estimate column already existed on `QuoteSession`.

## Context

After Phase 3 the funnel reaches a confirmed roof pin with a measured specific
yield (kWh/kWp/yr) persisted on the session — or no yield if both PVGIS and NASA
failed. Phase 4 turns the bill figures + yield into the money screen and captures
the result.

## ROI model — currency-agnostic by design

Everything keys off the user's **own bill**, so it works in any market with no
tariff database:

- **Effective tariff** = `billAmount ÷ kWhUsed` (the bill's own price per kWh).
- **Annual consumption** = period kWh scaled to 365 days (assumes 30-day period
  when unknown).
- **System size** `kWp` = `(annualConsumption × offset) ÷ specificYield`.
- **Production** = `kWp × specificYield`, degrading 0.5%/yr over 25 years.
- **Savings** = `min(production, consumption) × tariff` — conservative: only
  self-consumed power is valued, the tariff is held flat (no price inflation),
  and export upside is left out of the headline.
- **Cost** comes from per-kWp **USD** regional defaults, converted to the bill's
  currency via a static FX table, so payback/net-savings stay in one currency.
- **Payback** = `cost ÷ annualSavings`; the chart shows cumulative savings
  crossing the cost line.

The **currency bridge degrades gracefully**: if the bill's currency has no FX
entry, cost/payback are `null` and the UI shows production + savings (which need
no conversion) instead of a wrong number. If `specificYield` is missing, a
**regional fallback yield** is used and labelled as such.

`lib/cost-defaults.ts` holds all three estimate tables (per-kWp USD cost, USD FX,
fallback yield) — every value clearly labelled an estimate, reviewed 2026-06.
`lib/solar-math.ts` is **pure and client-safe**: the route computes the baseline
once, and the results page re-runs `computeEstimate` locally as the slider moves.

## `/api/estimate/route.ts`

Same route shape as the other phases (typed `ERROR_STATUS`/`ERROR_MESSAGES`,
`fail()`, Zod body, fail-open `sessionRatelimit`, `prisma` singleton).

- **POST `{ sessionId }`** — load bill figures + `specificYield` + country;
  `computeEstimate` at 100% offset; persist `systemKwp`,
  `annualProductionKwh`, `annualSavings`, `paybackYears`, the resolved
  `specificYield`, and the full breakdown in `estimateJson`; advance status to
  `ESTIMATED`. Returns `{ params, estimate }` so the client slider recomputes
  against the exact same numbers (including any fallback yield).
- Missing kWh **and** amount → typed `insufficient` (422); the funnel routes the
  user to manual entry to fill the gap, then re-runs the estimate.

## Results UI

- **`results-view.tsx`** (client, lazy-loaded `{ ssr:false }`): hero savings
  number (count-up via `motion`), live **offset slider** (80 / 100 / 120% of
  consumption) recomputing everything client-side, key-stat grid, the 25-yr
  chart, an honest "how we worked this out" accordion, and the soft **"Get quotes
  from installers"** CTA. Staggered fade-up reveals; honours reduced-motion.
- **`savings-chart.tsx`** (client): hand-built SVG area chart of cumulative
  savings with a dashed system-cost line and an animated payback marker — no
  charting dependency, inherits the warm palette, scales via `viewBox`.
- **`components/ui/slider.tsx`**: shadcn/Radix slider (new).
- **Funnel** (`estimate-funnel.tsx`): the placeholder `done` step is replaced by
  `estimating` → `results` (with `estimate_failed` for retry/insufficient).
  After the irradiance call, `runEstimate` fires; the soft CTA sets a flag whose
  lead form arrives in Phase 5.

## Verification

- `npm test` — 13 `vitest` unit tests on `solar-math.ts` (annualisation, tariff,
  sizing, degradation, offset behaviour, fallback yield, unknown-currency
  degradation, PKR end-to-end, insufficient-input throw, formatting).
- `npm run build` + `npm run lint` clean.
- Manual: run the funnel to results, drag the offset slider (size/savings/payback
  update live), confirm the chart's payback marker matches the stat card, and
  check the `QuoteSession` row reaches `ESTIMATED` with the scalar columns +
  `estimateJson` populated.

## Files

- **New:** `lib/solar-math.ts`, `lib/solar-math.test.ts`, `lib/cost-defaults.ts`,
  `app/api/estimate/route.ts`, `components/ui/slider.tsx`,
  `components/estimate/savings-chart.tsx`, `components/estimate/results-view.tsx`,
  `vitest.config.ts`.
- **Modified:** `components/estimate/estimate-funnel.tsx` (results/estimating/
  estimate_failed steps + `runEstimate`), `package.json` (`test` script +
  `vitest` dev dep).
- **Reuse (don't re-create):** the `fail()`/error-map route pattern; `prisma`
  singleton; `sessionRatelimit`/`getClientIp`; `QuoteStatus`/`Prisma` from
  `@/generated/client`; warm-editorial Card styling and tokens.
