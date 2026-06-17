# SolarQuote

**Bill-to-solar-estimate lead-generation funnel.** A homeowner uploads an electricity
bill; SolarQuote reads the consumption and address straight off it (OCR + AI), fetches
real solar irradiance for the roof, sizes a system, and shows a personalised savings/ROI
estimate — in the bill's own currency — then captures the visitor as a lead for the
operator. Built to work **globally from day one**: no fixed bill schema, no tariff
database, currency comes from the bill itself.

🔗 **Live demo:** https://solar-quote-nu.vercel.app

## What it does

- **Reads any electricity bill** — PDF or phone photo, any country, layout, or language —
  via OCR and AI structured extraction, with per-field confidence flags.
- **Sizes the system from real sunlight data** — satellite-derived irradiance (PVGIS, with
  a global fallback) gives the roof's yield; the user confirms the exact roof on a map.
- **Currency-agnostic ROI** — the electricity tariff is derived from the user's own bill
  (`amount ÷ kWh`), so savings, payback, and a 25-year projection all land in their
  currency with no tariff tables.
- **Never dead-ends** — a manual-entry fallback, clear retry states, and graceful
  degradation keep the funnel moving even when an external service is unavailable.
- **Operator dashboard** — captured leads with filtering and search, plus a full detail
  view (estimate, extracted bill data, roof map, original bill preview) behind admin auth.

## How it works

1. **Upload** a bill (drag-and-drop or mobile camera) — a live progress dialog runs during
   extraction.
2. **Review** the numbers we read, with low-confidence fields flagged and editable.
3. **Locate** the roof by dragging a pin on a satellite map.
4. **Results** — the money screen: system size, annual and monthly savings, payback, and a
   25-year chart. A soft call-to-action opens the lead form.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma + Neon Postgres · Vercel Blob · Better Auth · Mistral OCR · OpenAI · Google Maps ·
PVGIS / NASA POWER irradiance · Upstash rate limiting.

## Getting started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database
- API keys for the services listed in [Environment variables](#environment-variables)

### Install

```bash
npm install
cp .env.example .env   # then fill in the values
```

### Database

Put your Neon **pooled** connection string (the host contains `-pooler`) in `.env` as
`DATABASE_URL`, then apply the schema:

```bash
npx prisma migrate deploy   # applies prisma/migrations
npx prisma generate
```

### Run

```bash
npm run dev          # start the dev server at http://localhost:3000
npm run build        # production build
npm run lint         # lint
npm test             # unit tests (solar math)
```

## Usage

### Homeowner funnel

Open the app and click **Check my bill** (or go to `/estimate`). Upload a bill, review the
extracted figures, confirm the roof on the map, and view the savings estimate. No account
or sign-up is required — the flow is fully anonymous.

### Admin dashboard

The operator dashboard lives at **`/admin`** (also reachable from a discreet link in the
site footer) and is protected by email/password auth. Public sign-up is disabled, so create
the single admin account once:

```bash
npm run seed:admin   # reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
```

Then sign in at **`/admin/login`**. Re-running the seed resets the admin password. From the
dashboard you can browse and search captured leads, filter by status, and open any lead to
see its estimate, extracted bill data, roof map, and the original uploaded bill.

## Environment variables

Copy [.env.example](.env.example) to `.env` and fill in the values.

### Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres **pooled** connection string (host contains `-pooler`). |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token — stores uploaded bills (private). |
| `MISTRAL_API_KEY` | Mistral OCR — turns bill files into text. |
| `OPENAI_API_KEY` | OpenAI — extracts structured fields from the bill. |
| `GOOGLE_MAPS_API_KEY` | Server-side key for the Geocoding API. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key for the map and roof thumbnail (restrict by HTTP referrer). |
| `BETTER_AUTH_SECRET` | Admin-auth signing secret (min 32 chars — `openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | The app's base URL (e.g. `http://localhost:3000` or your production URL). |

### Optional

| Variable | Purpose |
|---|---|
| `OPENAI_EXTRACTION_MODEL` | Override the extraction model (defaults to `gpt-5.4-mini`). |
| `NEXT_PUBLIC_EXTRACTION_MODE` | Set to `vision` to use the single-call vision extraction path. |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Vector map ID for the map marker (falls back to a demo map). |
| `BLOB_STORE_ID` | Vercel Blob store ID, if your setup requires it. |
| `N8N_WEBHOOK_URL`, `N8N_API_KEY` | Webhook to notify on new leads / contact messages. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis for rate limiting (fails open if unset). |

### Seed-only

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` are read **only** by `npm run seed:admin`.
They are not needed at runtime — provide them wherever you run the seed command.

## Deployment

Deployed on **Vercel** from the `main` branch (push to deploy). The `vercel-build` script
runs `prisma migrate deploy` before building, so schema migrations reach the database
automatically. Set the required environment variables in your Vercel project, then seed the
admin account once against the production database (`npm run seed:admin`).

## Documentation

Product and design rationale: [PRODUCT.md](PRODUCT.md) · [DESIGN.md](DESIGN.md). Full
technical plan: [docs/PLAN.md](docs/PLAN.md). The warm-editorial design tokens live in
[app/globals.css](app/globals.css).
