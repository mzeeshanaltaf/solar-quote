# SolarQuote

Bill-to-solar-estimate lead generation platform. A homeowner uploads an electricity bill, the system extracts consumption and address, fetches solar irradiance for the location, sizes a system, and shows a savings/ROI estimate. Full plan: [docs/plan.md](docs/plan.md).

**Stack:** Next.js (App Router) · Tailwind v4 · shadcn/ui · Prisma + Neon Postgres · Vercel Blob.

## Setup

```bash
npm install
cp .env.example .env   # then fill in values
```

### Database (Neon)

1. Authenticate and create a project:
   ```bash
   npx neonctl@latest auth
   npx neonctl@latest projects create --name solarquote
   ```
2. Put the **pooled** connection string (host contains `-pooler`) in `.env` as `DATABASE_URL`.
3. Apply the schema:
   ```bash
   npx prisma migrate deploy   # applies prisma/migrations
   npx prisma generate
   ```

For local work, create a Neon dev branch and point `DATABASE_URL` at it:

```bash
npx neonctl@latest branches create --name dev
```

On Vercel, migrations apply automatically: the `vercel-build` script runs
`prisma migrate deploy` before building, so pending migrations reach the
production database on every deploy (requires a valid `DATABASE_URL`).

### Run

```bash
npm run dev
```

## Bill upload + extraction (Phase 2.1 + 2.2)

The `/estimate` funnel lets a homeowner upload a bill (PDF/JPG/PNG/WebP), preview it,
and on confirm runs a **three-stage pipeline** — each its own request so the progress
dialog reflects real work:

1. **`POST /api/upload`** — stores the file in a **private** Vercel Blob and creates the
   `QuoteSession`.
2. **`POST /api/ocr`** — OCRs the bill with **Mistral OCR** and persists the markdown on
   the session (so retries don't pay for OCR twice).
3. **`POST /api/extract`** — turns that markdown into structured fields (kWh, amount,
   currency, billing period, full + coarse address, utility) with **OpenAI
   `gpt-5.4-mini`** via the AI SDK. The same call also classifies whether the document is
   actually an electricity bill; if not, it returns a typed `not_a_bill` error.

The extracted values land in an editable **review card** that highlights any low-confidence
fields. Phase 2.2 adds the resilience layer: a **manual-entry fallback** (`POST /api/session`)
for users with no readable bill, hardened error/retry states (OCR vs. extraction vs.
rate-limit), and mobile camera capture. The funnel never dead-ends. See
[docs/PHASE-2.md](docs/PHASE-2.md) and the manual test matrix in
[docs/test-corpus.md](docs/test-corpus.md).

### Vision extraction (experimental)

An alternative to stages 2–3 above: **`POST /api/extract-vision`** sends the bill image/PDF
straight to `gpt-5.4-mini` in a **single call** (no Mistral OCR), reusing the same schema,
prompt, and relevance gate. Toggle it with the build-time flag
`NEXT_PUBLIC_EXTRACTION_MODE=vision` (anything else keeps the `upload → ocr → extract`
pipeline). In vision mode the funnel skips `/api/ocr` and `MISTRAL_API_KEY` is not needed.
This is an A/B experiment; if it wins on accuracy/latency/cost the OCR path will be retired.

## Location + irradiance (Phase 3.1 + 3.2)

After the review step, the funnel adds a **location step** so the estimate is sized for the
right roof:

1. **`POST /api/geocode`** — geocodes the bill's address with **Google Geocoding**
   server-side (the unrestricted key never reaches the browser) and returns candidate pins
   with a confidence derived from Google's `location_type`. The query is assembled from the
   full printed address plus the coarse town/city/state/country components.
2. **Map step** — a Google **satellite** view (`@vis.gl/react-google-maps`, lazy-loaded) with
   a **draggable pin** the homeowner nudges onto their actual roof, plus an address search box
   for when geocoding misses. It never dead-ends.
3. **`PATCH /api/geocode`** — persists the confirmed `lat`/`lng`/`formattedAddress` and moves
   the session to status `LOCATED`.

Once the pin is confirmed, the funnel fires **`POST /api/irradiance`** (non-blocking, behind
a brief "checking the sunlight" step) to resolve the roof's **specific yield** — the annual
kWh produced per kWp installed (kWh/kWp/yr), the multiplier Phase 4's ROI math needs.
**PVGIS** v5.3 (`PVcalc`) is the primary source; **NASA POWER** climatology is the global
fallback when PVGIS errors or a point is out of coverage. Results are cached in an
`IrradianceCache` table keyed by lat/lng rounded to 2 dp (~1.1 km), so nearby sessions reuse
one upstream call. The value is persisted on the session (status stays `LOCATED`; Phase 4
advances it to `ESTIMATED`). On failure the funnel still advances — Phase 4 handles the
missing-yield fallback. See [docs/PHASE-3.md](docs/PHASE-3.md).

## Sizing + savings/ROI results (Phase 4)

The final funnel step turns the bill figures and specific yield into the money screen:

1. **`POST /api/estimate`** — sizes the system and computes the savings/ROI, persists the
   headline numbers + full breakdown to the session, and advances status to `ESTIMATED`.
2. **Results screen** — a headline annual-savings number (count-up), a live **offset
   slider** (80 / 100 / 120% of your usage) that re-sizes the system and recomputes
   everything client-side, key stats (system size, payback, 25-year savings), a hand-built
   SVG **25-year cumulative-savings chart** with a payback marker, an honest "how we worked
   this out" breakdown, and a soft **"Get quotes from installers"** CTA (the lead form lands
   in Phase 5).

The ROI model is **currency-agnostic**: the effective tariff comes from the user's own bill
(`amount ÷ kWh`), so savings land in the bill's currency with no tariff database. Installed
cost uses per-kWp **USD** regional defaults converted via a static FX table — and degrades
gracefully (cost/payback hidden) for currencies without an FX entry, or falls back to a
regional specific yield when irradiance is unavailable. The math (`lib/solar-math.ts`) is
pure and **unit-tested** with `vitest` (`npm test`); the estimate tables live in
`lib/cost-defaults.ts`, every value labelled an estimate. See [docs/PHASE-4.md](docs/PHASE-4.md).

## Environment variables

See [.env.example](.env.example). Phase 1 needs only `DATABASE_URL`. **Phase 2.1 also
requires** `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, and `OPENAI_API_KEY` (optionally
`OPENAI_EXTRACTION_MODEL` to override the default model, `NEXT_PUBLIC_EXTRACTION_MODE=vision`
to use the single-call vision path, and the `UPSTASH_*` keys for rate limiting). **Phase 3.1
adds** `GOOGLE_MAPS_API_KEY` (server, Geocoding API) and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
(browser, Maps JS — HTTP-referrer restricted); optionally `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
(a vector map ID for `AdvancedMarker`, falls back to `DEMO_MAP_ID`). Later phases add Better
Auth keys.

## Design system

Warm-editorial direction defined in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md); tokens live in [app/globals.css](app/globals.css) (OKLCH sunlight palette, Young Serif display + Albert Sans body).
