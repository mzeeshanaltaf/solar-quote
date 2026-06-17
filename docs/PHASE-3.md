# SolarQuote Phase 3 — Location + Irradiance

> **Status (2026-06-17): Phase 3.1 ✅ built · Phase 3.2 ✅ built.**
> Split into two shippable sub-phases: **3.1** geocode route + map step UI
> (`/api/geocode`, `location-step.tsx`, funnel wired, `@vis.gl/react-google-maps`
> installed); **3.2** irradiance route + cache (`IrradianceCache` model +
> `0005_irradiance_cache` migration, `lib/irradiance.ts` PVGIS→NASA fallback,
> `/api/irradiance`, funnel fires it non-blocking after the pin is confirmed).
> Both build + lint + `prisma validate` clean. Verified locally per the
> Verification section, except the live map/geocode spot-checks (need real
> Google Maps keys) and the PVGIS/NASA yield spot-checks (need a provisioned DB
> to run the funnel end-to-end).

## Context

Phases 1 (scaffold, marketing, design system, Prisma schema) and 2 (bill upload
+ extraction) are complete. The `/estimate` funnel currently runs
upload → (ocr) → extract → **review** (or **manual**) → a placeholder **done**
screen ("pinning your roof and sizing your system — landing soon"). Phase 3
fills that gap: turn the extracted address into a confirmed roof location, then
fetch the solar irradiance (specific yield) that Phase 4's ROI math needs.

The `QuoteSession` model **already holds every location/irradiance field** this
phase writes — `lat`, `lng`, `formattedAddress`, `specificYield` — and the
`LOCATED` status enum value already exists. So **3.1 needs no migration**; only
3.2 adds a shared cache table.

**Confirmed decisions:**
- **Map library:** `@vis.gl/react-google-maps` (Google's modern React wrapper;
  `<APIProvider>` lazy-loads the Maps JS, hooks-based `Map` + `AdvancedMarker`).
- **Irradiance caching:** a dedicated `IrradianceCache` Prisma model keyed by
  rounded lat/lng, shared across sessions (matches PLAN.md "cache by rounded
  lat/lng in Neon").

---

## Phase 3.1 — Geocode route + Map step UI

### `/api/geocode/route.ts` (new)

Follows the established route shape from [../app/api/extract/route.ts](../app/api/extract/route.ts)
and [../app/api/session/route.ts](../app/api/session/route.ts): typed
`ERROR_STATUS`/`ERROR_MESSAGES` maps, a `fail(code)` helper, Zod-validated body,
`sessionRatelimit` with the fail-open null-check, the `prisma` singleton, and
`QuoteStatus` from `@/generated/client`.

Two methods, mirroring how extract uses **POST (compute)** + **PATCH (persist
verified)**:

- **POST — geocode an address → candidates (no DB write).**
  Body: `{ sessionId: string, query?: string }`.
  - Load the session; build the geocoding query from `query` (search-box
    override) if present, else from `rawAddress`, else a comma-join of
    `addressTown/City/State/Country`. Nothing usable → typed `no_address`
    (UI shows the search box directly).
  - Call Google Geocoding REST server-side with `process.env.GOOGLE_MAPS_API_KEY`
    (**never** the `NEXT_PUBLIC_` key):
    `https://maps.googleapis.com/maps/api/geocode/json?address=<enc>&key=<KEY>`.
  - Map Google `status` → typed errors: `ZERO_RESULTS` → `no_results` (UI: show
    search box), `OVER_QUERY_LIMIT`/`REQUEST_DENIED`/`INVALID_REQUEST` →
    `geocode_failed` (502), network throw → `server`.
  - Return `{ success: true, candidates: [...] }`, each
    `{ formattedAddress, lat, lng, locationType, partialMatch, confidence }`.
    Derive `confidence` from `geometry.location_type` (`ROOFTOP`→high,
    `RANGE_INTERPOLATED`/`GEOMETRIC_CENTER`→medium, `APPROXIMATE`→low) and
    `partial_match`. Return the top ≤5.

- **PATCH — persist the confirmed pin.**
  Body: `{ sessionId, lat, lng, formattedAddress }` (Zod: lat ∈ [-90,90],
  lng ∈ [-180,180], `formattedAddress` trimmed/optional).
  - `prisma.quoteSession.update` → set `lat`, `lng`, `formattedAddress`,
    `status: QuoteStatus.LOCATED`. Return `{ success: true }`. Bad sessionId →
    `not_found`.

Rate limiting: reuse `sessionRatelimit` (20/10m) — generous enough for a few
search-box retries, and Google geocoding is cheap. The client geocodes on submit
only (not per keystroke).

### Map step component — `components/estimate/location-step.tsx` (new)

Client component, lazy-loaded into the funnel via `next/dynamic` `{ ssr: false }`
(same treatment as `BillPreview`), so the Maps JS bundle loads only when the user
reaches this step and we stay clear of the hydration rule.

Props mirror `ReviewCard`'s contract:
```ts
interface LocationStepProps {
  sessionId: string;
  onConfirmed: () => void;   // advance the funnel
  onReset: () => void;
}
```

Behavior:
- On mount, `POST /api/geocode { sessionId }`; set the pin to the top candidate
  and center the map. On `no_address`/`no_results`, jump to the
  search-box-prominent empty state.
- `<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>` →
  `<Map mapTypeId="satellite" defaultZoom={19} gestureHandling="greedy">` with a
  **draggable** `<AdvancedMarker>`; `onDragEnd` updates pin lat/lng in local
  state. (`AdvancedMarker` needs a `mapId` — use `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
  or a literal `"DEMO_MAP_ID"`.)
- Address search box (shadcn `Input` + `Button`) as the geocode-miss fallback:
  on submit, `POST /api/geocode { sessionId, query }`, re-center on the new top
  candidate.
- Show current `formattedAddress` as confirmation copy ("Drag the pin onto your
  actual roof").
- Primary **"This is my roof"** → `PATCH /api/geocode { sessionId, lat, lng,
  formattedAddress }`; on success call `onConfirmed()`. Internal
  `status: "idle" | "saving" | "error"` like `ReviewCard`. Never dead-ends — on
  geocode failure the user can still drag/type and confirm a pin manually.
- Visuals: reuse the `Card`/`CardHeader`/`CardContent` + warm-editorial tokens
  from [../components/estimate/review-card.tsx](../components/estimate/review-card.tsx)
  (`/impeccable` consistency). Map in a rounded bordered container.

### Funnel wiring — [../components/estimate/estimate-funnel.tsx](../components/estimate/estimate-funnel.tsx)

- Add `"location"` to the `Step` union (after `review`).
- Lazy-import `LocationStep` via `next/dynamic` `{ ssr: false }` near the
  `BillPreview` import.
- Re-point the two transitions that currently jump to `done`:
  - ReviewCard `onConfirmed={() => setStep("location")}` (was `"done"`).
  - ManualEntryForm `onDone={(id) => { setSessionId(id); setStep("location"); }}`
    (was `"done"`).
- Render: `{step === "location" && sessionId && (<LocationStep sessionId={sessionId} onConfirmed={() => setStep("done")} onReset={reset} />)}`.
- The step indicator is currently hardcoded `Step 1 of 4 · Your bill`. Make it
  derive from `step` (a small `STEP_META` map): bill steps →
  "Step 1/2 of 4 · Your bill", `location` → "Step 3 of 4 · Your roof". Add a
  `location` case to `heading()` ("Find your roof.").
- Soften the `done` copy now that location is captured (results still Phase 4).

### Deps / env

- Add dependency `@vis.gl/react-google-maps` (`npm install`).
- `.env.example` already lists `GOOGLE_MAPS_API_KEY` and
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; add an optional
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (needed by `AdvancedMarker`).
- Both keys must be set locally to exercise the map; the geocode route fails open
  with a typed error if the server key is missing.

---

## Phase 3.2 — Irradiance route + cache

### `IrradianceCache` Prisma model + migration

Add to [../prisma/schema.prisma](../prisma/schema.prisma):
```prisma
model IrradianceCache {
  id            String   @id @default(cuid())
  latKey        Float    // lat rounded to 2 dp (~1.1 km)
  lngKey        Float    // lng rounded to 2 dp
  specificYield Float    // kWh/kWp/yr
  source        String   // "pvgis" | "nasa"
  raw           Json     // upstream payload, for debugging
  createdAt     DateTime @default(now())
  @@unique([latKey, lngKey])
}
```
New migration `prisma/migrations/0005_irradiance_cache/` — never edit applied
SQL. Re-run `prisma generate`.

### `lib/irradiance.ts` (new)

Mirrors how extraction logic lives in `lib/extraction.ts`:
- `getSpecificYield(lat, lng): Promise<{ specificYield, source }>`.
- **Primary — PVGIS v5.3 `PVcalc`:**
  `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=&lon=&peakpower=1&loss=14&mountingplace=building&optimalangles=1&outputformat=json`.
  Read `outputs.totals.fixed.E_y` (annual kWh for 1 kWp) → that is
  `specificYield` directly.
- **Fallback — NASA POWER** (fully global): annual GHI
  (`ALLSKY_SFC_SW_DWN`) × performance ratio (~0.75) when PVGIS errors or returns
  out-of-coverage. Typed `IrradianceError` for the all-failed case.
- `roundKey(n)` helper — round lat/lng to 2 dp for the cache key.

### `/api/irradiance/route.ts` (new)

Same route shape as the others.
- **POST** body `{ sessionId }`. Load session; require `lat`/`lng` (else
  `no_location`, 409).
- Compute rounded cache key. Look up `IrradianceCache` by
  `@@unique([latKey,lngKey])` — hit → use it (no upstream call); miss → call
  `getSpecificYield`, then `upsert` the cache row.
- Persist `specificYield` on the session (status stays `LOCATED`; `ESTIMATED` is
  set later by Phase 4's estimate route).
- Return `{ success: true, specificYield, source }`. PVGIS + NASA both down →
  `irradiance_failed` (502); Phase 4 will degrade further to a regional constant.
- Rate limit: `sessionRatelimit` (free upstream APIs, bounded to sessions).

### Funnel wiring

When `LocationStep` confirms the pin (after the geocode PATCH succeeds), fire
`POST /api/irradiance { sessionId }`. Keep it lightweight in 3.2 (the Phase 4
results screen doesn't exist yet): show a brief "Checking sunlight at your roof…"
state, then advance to `done`. **Non-blocking** — on failure, store nothing and
still advance; Phase 4 handles the missing-yield fallback.

---

## Verification

**Phase 3.1**
- `npm run build` clean; `npx prisma validate` clean (no schema change in 3.1).
- `npm run dev`, run the funnel to review → confirm → land on the map step. With
  a real extracted address, the pin should sit on/near the property on satellite
  imagery; drag and confirm.
- Search-box fallback: a vague manual-entry city → `no_results`/`no_address`
  shows the search box; a real address re-centers and lets you confirm.
- DB: after "This is my roof", the `QuoteSession` row has
  `lat`/`lng`/`formattedAddress` set and `status = LOCATED`.
- Confirm `GOOGLE_MAPS_API_KEY` never appears in the client bundle (only
  `NEXT_PUBLIC_*` does).

**Phase 3.2**
- `npx prisma migrate dev` applies `0005_irradiance_cache` cleanly; `prisma
  generate` regenerates `./generated`.
- Spot-check specific yield vs. the PVGIS web tool for 3 known cities (PLAN.md):
  **Lahore ≈ 1500+**, **Berlin ≈ 1000**, **Phoenix ≈ 1700** kWh/kWp/yr.
- A second request for a nearby pin (same rounded key) hits the cache (no upstream
  call; a single `IrradianceCache` row).
- Force a PVGIS failure (ocean lat/lng, or break the URL) → NASA POWER fallback
  returns a plausible yield with `source: "nasa"`.
- DB: session has `specificYield` populated after the call.

## Files

- **New:** `app/api/geocode/route.ts`, `components/estimate/location-step.tsx`,
  `app/api/irradiance/route.ts`, `lib/irradiance.ts`,
  `prisma/migrations/0005_irradiance_cache/`.
- **Modified:** `components/estimate/estimate-funnel.tsx` (new step +
  transitions + dynamic step indicator), `prisma/schema.prisma` (cache model),
  `.env.example` (map id), `package.json` (`@vis.gl/react-google-maps`).
- **Reuse (don't re-create):** the `fail()`/error-map pattern from
  `app/api/extract/route.ts` & `app/api/session/route.ts`; `prisma` from
  `lib/prisma.ts`; `sessionRatelimit`/`getClientIp` from `lib/ratelimit.ts`;
  `QuoteStatus` from `@/generated/client`; Card/warm-editorial styling from
  `components/estimate/review-card.tsx`.
