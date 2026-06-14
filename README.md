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

## Environment variables

See [.env.example](.env.example). Phase 1 needs only `DATABASE_URL`. **Phase 2.1 also
requires** `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, and `OPENAI_API_KEY` (optionally
`OPENAI_EXTRACTION_MODEL` to override the default model, `NEXT_PUBLIC_EXTRACTION_MODE=vision`
to use the single-call vision path, and the `UPSTASH_*` keys for rate limiting). Later
phases add Google Maps and Better Auth keys.

## Design system

Warm-editorial direction defined in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md); tokens live in [app/globals.css](app/globals.css) (OKLCH sunlight palette, Young Serif display + Albert Sans body).
