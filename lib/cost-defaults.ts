// Phase 4 — Cost & conversion defaults for the ROI estimate.
//
// EVERYTHING in this file is an ESTIMATE, not a quote. Installed solar cost,
// currency conversion, and the irradiance fallback all vary by market, installer,
// and the day. They exist so the funnel can always show a credible number; the
// results UI labels them as estimates and the real figures come from a partner.
//
// Client-safe and dependency-free (pure constants + lookups), so both the
// /api/estimate route and the live offset slider on the results page share it.
//
// Last reviewed: 2026-06.

// Normalise a free-text country (the bill's printed country, e.g. "United
// States", "U.S.A.", "pakistan ") to a lookup key.
function countryKey(country: string | null | undefined): string {
  return (country ?? "").trim().toLowerCase().replace(/\./g, "");
}

// ---------------------------------------------------------------------------
// Installed turnkey cost per kWp, in USD. Residential rooftop, all-in
// (panels + inverter + mounting + install). Rounded market estimates; the US is
// expensive, South Asia is cheap, Australia is the global low. Keyed by country
// with common aliases. Unknown → global default.
// ---------------------------------------------------------------------------
const DEFAULT_COST_PER_KWP_USD = 1100;

const COST_PER_KWP_USD: Record<string, number> = {
  // North America
  "united states": 2800,
  usa: 2800,
  us: 2800,
  america: 2800,
  canada: 2500,
  mexico: 1100,

  // United Kingdom & Ireland
  "united kingdom": 2100,
  uk: 2100,
  "great britain": 2100,
  britain: 2100,
  england: 2100,
  scotland: 2100,
  wales: 2100,
  ireland: 1900,

  // Western / Central Europe
  germany: 1500,
  france: 1600,
  netherlands: 1450,
  belgium: 1600,
  austria: 1550,
  switzerland: 2200,
  spain: 1200,
  portugal: 1250,
  italy: 1400,
  greece: 1200,
  sweden: 1500,
  norway: 1700,
  denmark: 1600,
  finland: 1550,
  poland: 1150,
  "czech republic": 1200,
  czechia: 1200,

  // Middle East & Africa
  "united arab emirates": 900,
  uae: 900,
  "saudi arabia": 850,
  egypt: 750,
  "south africa": 1050,
  nigeria: 900,
  kenya: 950,
  morocco: 950,

  // South & East Asia
  pakistan: 650,
  india: 700,
  bangladesh: 750,
  "sri lanka": 800,
  china: 700,
  japan: 1900,
  "south korea": 1500,
  korea: 1500,
  indonesia: 850,
  philippines: 1000,
  malaysia: 900,
  thailand: 900,
  vietnam: 800,
  singapore: 1300,

  // Oceania
  australia: 1000,
  "new zealand": 1700,

  // Latin America
  brazil: 900,
  argentina: 1100,
  chile: 1100,
  colombia: 1050,
};

/** Estimated installed cost per kWp in USD for a country (global default if unknown). */
export function costPerKwpUsd(country: string | null | undefined): number {
  return COST_PER_KWP_USD[countryKey(country)] ?? DEFAULT_COST_PER_KWP_USD;
}

// ---------------------------------------------------------------------------
// Approximate USD foreign-exchange table: units of the local currency per 1 USD.
// Used only to express the (USD-denominated) cost estimate in the bill's own
// currency, so payback and net-savings stay in one currency. Approximate mid-2026
// rates — fine for an estimate, never for a transaction. Unknown code → null, and
// the results UI hides cost/payback rather than show a wrong number.
// ---------------------------------------------------------------------------
const USD_FX: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.52,
  NZD: 1.64,
  CHF: 0.89,
  SEK: 10.6,
  NOK: 10.7,
  DKK: 6.9,
  PLN: 3.95,
  CZK: 23.2,
  JPY: 156,
  CNY: 7.2,
  KRW: 1360,
  SGD: 1.34,
  HKD: 7.8,
  INR: 84,
  PKR: 280,
  BDT: 117,
  LKR: 300,
  IDR: 16200,
  MYR: 4.6,
  THB: 36,
  VND: 25400,
  PHP: 58,
  AED: 3.67,
  SAR: 3.75,
  EGP: 49,
  ZAR: 18.3,
  NGN: 1500,
  KES: 129,
  MAD: 9.9,
  TRY: 33,
  BRL: 5.4,
  ARS: 940,
  CLP: 920,
  COP: 4050,
  MXN: 18.3,
};

/** Units of `currency` per 1 USD, or null when the code isn't in the table. */
export function usdFx(currency: string | null | undefined): number | null {
  const code = (currency ?? "").trim().toUpperCase();
  return USD_FX[code] ?? null;
}

// ---------------------------------------------------------------------------
// Fallback specific yield (kWh/kWp/yr) when BOTH PVGIS and NASA POWER failed
// (Phase 3.2 leaves specificYield null in that case). Coarse country estimates;
// global default is a conservative mid-latitude figure.
// ---------------------------------------------------------------------------
const DEFAULT_SPECIFIC_YIELD = 1150;

const FALLBACK_SPECIFIC_YIELD: Record<string, number> = {
  pakistan: 1600,
  india: 1550,
  bangladesh: 1450,
  "sri lanka": 1500,
  "united arab emirates": 1750,
  uae: 1750,
  "saudi arabia": 1800,
  egypt: 1800,
  "south africa": 1650,
  nigeria: 1550,
  kenya: 1600,
  morocco: 1700,
  australia: 1550,
  "new zealand": 1250,
  "united states": 1450,
  usa: 1450,
  us: 1450,
  canada: 1150,
  mexico: 1700,
  brazil: 1550,
  argentina: 1500,
  chile: 1700,
  colombia: 1450,
  spain: 1500,
  portugal: 1550,
  italy: 1350,
  greece: 1450,
  france: 1150,
  germany: 1000,
  netherlands: 950,
  "united kingdom": 950,
  uk: 950,
  ireland: 900,
  sweden: 950,
  norway: 850,
  poland: 1000,
  china: 1300,
  japan: 1200,
  "south korea": 1250,
  korea: 1250,
  indonesia: 1350,
  philippines: 1400,
  malaysia: 1350,
  thailand: 1450,
  vietnam: 1400,
  singapore: 1300,
};

/** Estimated kWh/kWp/yr for a country when no measured irradiance is available. */
export function fallbackSpecificYield(country: string | null | undefined): number {
  return FALLBACK_SPECIFIC_YIELD[countryKey(country)] ?? DEFAULT_SPECIFIC_YIELD;
}

// Grid emission factor (kg CO2 per kWh) — global average, for the "CO2 avoided"
// impact stat. A single number keeps it honest-but-simple; it's a feel-good
// figure, not a carbon accounting claim.
export const GRID_EMISSION_FACTOR_KG_PER_KWH = 0.4;
