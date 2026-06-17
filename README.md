# SolarQuote

**Bill-to-solar-estimate lead-generation funnel.** A homeowner uploads an electricity
bill; SolarQuote reads the consumption and address straight off it (OCR + AI), fetches
real solar irradiance for the roof, sizes a system, and shows a personalised savings/ROI
estimate — in the bill's own currency — then captures the visitor as a lead for the
operator. Built to work **globally from day one**: no fixed bill schema, no tariff
database, currency comes from the bill itself.

🔗 **Live demo:** https://solar-quote-nu.vercel.app

## What it does

- **Reads any electricity bill** — PDF or phone photo, any country/layout/language — via
  Mistral OCR → GPT structured extraction, with a single-call vision path as an experiment.
- **Sizes the system from real sunlight data** — PVGIS (with a global NASA POWER fallback)
  gives the roof's specific yield; the user confirms the exact roof on a satellite map.
- **Currency-agnostic ROI** — the tariff is derived from the user's own bill
  (`amount ÷ kWh`), so savings, payback, and a 25-year projection land in their currency
  with no tariff tables.
- **Never dead-ends** — manual-entry fallback, typed error/retry states, and graceful
  degradation when any external API is unavailable.
- **Operator dashboard** — captured leads, filtering/search, and a full detail view
  (estimate, extracted bill data, roof map, original bill preview) behind admin auth.

## How it works

1. **Upload** a bill (drag-drop or mobile camera) → a live progress dialog during extraction.
2. **Review** the numbers we read, with low-confidence fields flagged and editable.
3. **Locate** the roof on a draggable satellite-map pin.
4. **Results** — the money screen: system size, annual/monthly savings, payback, 25-year
   chart. A soft CTA opens the lead form.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui · Prisma + Neon Postgres · Vercel Blob · Better Auth · Mistral OCR · OpenAI ·
Google Maps · PVGIS / NASA POWER · Upstash rate limiting. Full plan and rationale in
[docs/PLAN.md](docs/PLAN.md).

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

### Deploying

The app is deployed on **Vercel** from the `main` branch (push to deploy). The
`vercel-build` script runs `prisma migrate deploy` before the build, so schema
migrations reach the database automatically. Set the runtime env vars in Vercel —
at minimum `DATABASE_URL`, the extraction/maps keys, and (for the admin dashboard)
`BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`. Seed the admin account once against the
production database with `npm run seed:admin` (see [Lead capture + admin
dashboard](#lead-capture--admin-dashboard-phase-5)).

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

## Lead capture + admin dashboard (Phase 5)

The results screen's soft CTA opens a **lead form** (a sheet over the results): name,
email, phone, and preferred contact. **`POST /api/leads`** validates it (Zod + honeypot +
a dedicated rate limiter), upserts a `Lead` onto the anonymous `QuoteSession` (idempotent —
a resubmit updates contact details without resetting the operator's triage status), and
best-effort notifies the n8n webhook. Results stay **ungated**; capturing the lead is
optional.

The operator side lives under **`/admin`**, behind **Better Auth** (email/password):

- **`lib/auth.ts`** — Better Auth with the Prisma adapter. Public sign-up is **disabled**;
  there is exactly one seeded admin. `app/api/auth/[...all]/route.ts` mounts the endpoints.
- **`proxy.ts`** (Next.js 16 renamed `middleware` → `proxy`) does a cheap session-cookie
  check and bounces logged-out visitors to `/admin/login`; the `(dashboard)` layout then
  does the **authoritative** `auth.api.getSession` check (defense in depth).
- **Dashboard** (`/admin`) — a leads table with status filter + name/email search (driven by
  URL search params, so it stays a Server Component). Each row opens a **detail view**
  (`/admin/leads/[id]`): contact info, an editable status + notes triage panel
  (**`PATCH /api/leads/[id]`**, admin-guarded), the full estimate and extracted bill data, a
  Google Static Maps **roof thumbnail**, and the **original bill preview** — streamed from
  the private blob through the admin-guarded **`GET /api/admin/bill/[id]`** (react-pdf for
  PDFs, `<img>` for photos).

Seed the admin account once (reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`):

```bash
npm run seed:admin
```

The script talks to Better Auth's internal adapter directly, so it works even though the
public sign-up endpoint is closed. Re-running it resets the admin password. Sign in at
**`/admin/login`** (also reachable via a discreet link in the site footer).

## Environment variables

See [.env.example](.env.example). Phase 1 needs only `DATABASE_URL`. **Phase 2.1 also
requires** `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, and `OPENAI_API_KEY` (optionally
`OPENAI_EXTRACTION_MODEL` to override the default model, `NEXT_PUBLIC_EXTRACTION_MODE=vision`
to use the single-call vision path, and the `UPSTASH_*` keys for rate limiting). **Phase 3.1
adds** `GOOGLE_MAPS_API_KEY` (server, Geocoding API) and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
(browser, Maps JS — HTTP-referrer restricted); optionally `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
(a vector map ID for `AdvancedMarker`, falls back to `DEMO_MAP_ID`). **Phase 5 adds**
`BETTER_AUTH_SECRET` (min 32 chars — `openssl rand -base64 32`) and `BETTER_AUTH_URL`, plus
`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` for the one-off admin seed. The admin bill
thumbnail reuses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Static Maps), degrading to a coordinate
chip if absent.

## Design system

Warm-editorial direction defined in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md); tokens live in [app/globals.css](app/globals.css) (OKLCH sunlight palette, Young Serif display + Albert Sans body).
