import "server-only";

// Phase 3.2 — Solar irradiance. We need the "specific yield" (annual kWh
// produced per kWp of installed capacity) for a roof, which Phase 4's ROI math
// multiplies by the system size. PVGIS is the primary source (it already folds
// in tilt, orientation, and temperature losses for an optimally-angled panel);
// NASA POWER is the fully-global fallback for points PVGIS doesn't cover.
//
// Mirrors lib/extraction.ts: a typed error class, a couple of focused upstream
// calls, and a single public function the route calls.

export type IrradianceSource = "pvgis" | "nasa";

export interface IrradianceResult {
  specificYield: number; // kWh/kWp/yr
  source: IrradianceSource;
  raw: unknown; // upstream payload, persisted to the cache for debugging
}

export class IrradianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrradianceError";
  }
}

// Cache key: round lat/lng to 2 dp (~1.1 km), small enough that the specific
// yield is effectively identical, large enough that nearby roofs share a row.
export function roundKey(n: number): number {
  return Math.round(n * 100) / 100;
}

// Performance ratio applied to NASA's plane-of-array irradiance to approximate
// real PV output (inverter, wiring, temperature, soiling losses). PVGIS bakes
// an equivalent factor in already; for NASA we apply it ourselves. 0.75 is the
// usual industry rule-of-thumb.
const PERFORMANCE_RATIO = 0.75;

interface PvgisResponse {
  outputs?: {
    totals?: {
      fixed?: {
        E_y?: number; // annual energy output (kWh) for the requested peakpower
      };
    };
  };
}

// PVGIS v5.3 PVcalc for a 1 kWp, optimally-angled, building-mounted system.
// E_y for peakpower=1 is the specific yield directly (kWh/kWp/yr).
async function fromPvgis(lat: number, lng: number): Promise<IrradianceResult> {
  const url = new URL("https://re.jrc.ec.europa.eu/api/v5_3/PVcalc");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("peakpower", "1");
  url.searchParams.set("loss", "14");
  url.searchParams.set("mountingplace", "building");
  url.searchParams.set("optimalangles", "1");
  url.searchParams.set("outputformat", "json");

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new IrradianceError(`PVGIS request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    // PVGIS returns 400 for out-of-coverage points (e.g. open ocean) — let the
    // caller fall back to NASA.
    throw new IrradianceError(`PVGIS responded ${res.status}`);
  }

  const data = (await res.json()) as PvgisResponse;
  const yield_ = data.outputs?.totals?.fixed?.E_y;
  if (typeof yield_ !== "number" || !Number.isFinite(yield_) || yield_ <= 0) {
    throw new IrradianceError("PVGIS returned no usable yield");
  }
  return { specificYield: yield_, source: "pvgis", raw: data };
}

interface NasaResponse {
  properties?: {
    parameter?: {
      ALLSKY_SFC_SW_DWN?: Record<string, number>; // monthly daily averages + ANN
    };
  };
}

// NASA POWER climatology: annual all-sky surface shortwave (GHI) in
// kWh/m²/day. Multiply by 365 for annual GHI (≈ kWh/m²/yr), then by the
// performance ratio for an approximate kWh/kWp/yr. Coarser than PVGIS (it
// ignores tilt/orientation gains) but global and dependable.
async function fromNasa(lat: number, lng: number): Promise<IrradianceResult> {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  url.searchParams.set("parameters", "ALLSKY_SFC_SW_DWN");
  url.searchParams.set("community", "RE");
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("format", "JSON");

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new IrradianceError(`NASA POWER request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new IrradianceError(`NASA POWER responded ${res.status}`);
  }

  const data = (await res.json()) as NasaResponse;
  const ann = data.properties?.parameter?.ALLSKY_SFC_SW_DWN?.ANN;
  if (typeof ann !== "number" || !Number.isFinite(ann) || ann <= 0) {
    throw new IrradianceError("NASA POWER returned no usable irradiance");
  }
  const specificYield = ann * 365 * PERFORMANCE_RATIO;
  return { specificYield, source: "nasa", raw: data };
}

/**
 * Resolve the annual specific yield (kWh/kWp/yr) for a roof. PVGIS first; on any
 * PVGIS failure or out-of-coverage point, fall back to NASA POWER. Throws
 * IrradianceError only when BOTH sources fail.
 */
export async function getSpecificYield(
  lat: number,
  lng: number
): Promise<IrradianceResult> {
  try {
    return await fromPvgis(lat, lng);
  } catch (pvgisErr) {
    console.warn("PVGIS failed, falling back to NASA POWER:", (pvgisErr as Error).message);
    try {
      return await fromNasa(lat, lng);
    } catch (nasaErr) {
      throw new IrradianceError(
        `Both irradiance sources failed (PVGIS: ${(pvgisErr as Error).message}; ` +
          `NASA: ${(nasaErr as Error).message})`
      );
    }
  }
}
