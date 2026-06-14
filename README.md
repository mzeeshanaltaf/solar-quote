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

### Run

```bash
npm run dev
```

## Bill upload + extraction (Phase 2.1)

The `/estimate` funnel lets a homeowner upload a bill (PDF/JPG/PNG/WebP), preview it,
and on confirm runs the extraction pipeline: the file is stored in a **private**
Vercel Blob, OCR'd with **Mistral OCR**, and turned into structured fields
(kWh, amount, currency, billing period, full + coarse address, utility) by
**OpenAI `gpt-5.4-mini`** via the AI SDK. The extracted values are shown in an
editable review card. See [docs/PHASE-2.md](docs/PHASE-2.md).

## Environment variables

See [.env.example](.env.example). Phase 1 needs only `DATABASE_URL`. **Phase 2.1 also
requires** `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, and `OPENAI_API_KEY` (optionally
`OPENAI_EXTRACTION_MODEL` to override the default model, and the `UPSTASH_*` keys for
rate limiting). Later phases add Google Maps and Better Auth keys.

## Design system

Warm-editorial direction defined in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md); tokens live in [app/globals.css](app/globals.css) (OKLCH sunlight palette, Young Serif display + Albert Sans body).
