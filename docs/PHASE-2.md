# SolarQuote Phase 2 — Bill Upload + Extraction

> **Status (2026-06-14): Phase 2.1 ✅ shipped · Phase 2.2 ✅ shipped.**
> Both phases are implemented, built, and committed. The funnel runs end-to-end
> against live Mistral OCR + OpenAI + Neon. One open item: the real-bill test
> corpus is **documented but not yet run** against real bills — see
> [test-corpus.md](test-corpus.md). The pipeline was also **re-architected from
> two routes to three** during 2.2 (see "Architecture change" below).

## Context

Phase 1 (scaffold, marketing site, design system, Prisma schema) is complete.
`/estimate` is now the live funnel (no longer a stub). The `QuoteSession` model
holds every field this phase writes (`blobUrl`, `fileMimeType`, `kWhUsed`,
`billAmount`, `currency`, `billingPeriodDays`, `rawAddress`, coarse address
components, `utilityName`, `extractionConfidence`) plus `ocrMarkdown` added in
2.2.

**Confirmed decisions (all implemented):** full Blob + DB persistence; extraction
via AI SDK `generateObject` with `@ai-sdk/openai`; Mistral OCR via raw `fetch`.
The Vercel Blob store is **private** (bills are PII) — `put` uses
`access:"private"` and the server reads the bytes back to base64 for OCR, so no
bill URL is ever public. Extraction model is **`gpt-5.4-mini`** (overridable via
`OPENAI_EXTRACTION_MODEL`).

---

## Architecture change (2.2): two routes → three

The original 2.1 plan had **`/api/upload`** then a single **`/api/extract`** that
did OCR **and** the LLM in one request. During 2.2 this was split into **three
sequentially-awaited routes** so the progress dialog reflects real work and
retries are cheap:

```
POST /api/upload  → store file in private Blob, create QuoteSession (status UPLOADED)
POST /api/ocr     → Mistral OCR → persist markdown to QuoteSession.ocrMarkdown
POST /api/extract → LLM over the stored markdown → classify + persist fields (EXTRACTED)
```

Why: (1) the dialog can show a genuine **uploading → reading → extracting** phase
per real request instead of timer-guessing; (2) a figure-parse failure re-runs
**only the LLM** (the OCR markdown is already persisted), so "Try again" doesn't
pay for OCR twice; (3) cleaner error attribution (OCR failures vs. LLM failures
come from different routes).

This required a schema change: **`QuoteSession.ocrMarkdown String?`** (migration
`0004_ocr_markdown`, applied to Neon).

---

## Phase 2.1 — Core happy path ✅

### Data / lib layer

- **`lib/bill-schema.ts`** — `ExtractedBillSchema` (Zod), the single source of
  truth shared by the server pipeline, the routes, and the client review form:
  `kWhUsed`, `billAmount`, `currency`, `billingPeriodDays`, `rawAddress`, coarse
  `addressTown/City/State/Country`, `utilityName`, plus a per-field `confidence`
  object (`low|medium|high`). 2.2 added `isElectricityBill` + `rejectionReason`.
- **`lib/extraction.ts`** (server-only) — `ocrBill(base64, mime)` POSTs to
  `mistral-ocr-latest` and joins `pages[].markdown`; `extractFields(markdown)`
  runs `generateObject` with `openai("gpt-5.4-mini")` and a global-bill system
  prompt (extract only what's printed, ISO-4217 currency, `null` over guessing).
- **`lib/ratelimit.ts`** — `extractRatelimit` (5/10m) gates the entry point;
  same null/fail-open pattern as `contactRatelimit`.

### API routes

- **`/api/upload`** ✅ — multipart `FormData`; MIME allowlist + 10 MB cap; `put`
  to private Blob; `quoteSession.create` (status `UPLOADED`); returns
  `{ sessionId, blobUrl }`. Uses the shared `ERROR_STATUS`/`ERROR_MESSAGES` shape.
- **`/api/extract`** ✅ (reworked in 2.2 — see above) — `POST { sessionId }` runs
  the LLM over the persisted markdown and writes fields (status `EXTRACTED`);
  `PATCH { sessionId, ...fields }` saves the user's verified/corrected values.

### Funnel UI — `/estimate`

- **`app/estimate/page.tsx`** — thin Server Component dynamically importing the
  client funnel with `{ ssr:false }` (hydration rule).
- **`components/estimate/estimate-funnel.tsx`** — owns step state and the
  `sessionId` / `ExtractedBill`.
- **`components/estimate/bill-dropzone.tsx`** — drag/drop + file picker (+ camera
  in 2.2), client-side size/type pre-check.
- **`components/estimate/bill-preview.tsx`** — react-pdf / image preview before
  processing.
- **`components/estimate/extraction-dialog.tsx`** — shimmering progress dialog
  (phase-driven in 2.2).
- **`components/estimate/review-card.tsx`** — editable card built on
  `Field`/`FieldGroup`/`FieldLabel`; "Looks good" `PATCH`es edits back.

---

## Phase 2.2 — Resilience layer ✅

All five deferred items shipped:

- **Manual-entry fallback** ✅ — `components/estimate/manual-entry-form.tsx` +
  new **`/api/session`** route (`POST` creates a `QuoteSession` from typed numbers,
  or updates an existing one when extraction failed; requires kWh **or** bill
  amount; status `EXTRACTED`). Reachable from the upload step ("Enter your numbers
  instead") and from every failure screen. Gated by a new **`sessionRatelimit`**
  (20/10m) kept separate from `extractRatelimit` so a user whose extraction just
  failed isn't blocked from the manual path.
- **Low-confidence highlighting** ✅ — `review-card.tsx` flags fields whose stored
  `extractionConfidence` is `low` with a warm amber border/background and a summary
  banner counting the flagged fields.
- **Hardened error/retry states** ✅ — the funnel has dedicated `failed` and
  `manual` steps and surfaces the routes' **typed error codes** via a
  `FAILURE_COPY` map: `rate`, `ocr_failed`, `not_a_bill`, `extraction_failed`,
  `server`. "Try again" re-runs from the right point (OCR failures redo OCR +
  LLM; figure failures reuse the persisted markdown and redo only the LLM).
- **Relevance gate** ✅ (new in 2.2, beyond the original plan) — the extraction
  schema gained `isElectricityBill` + `rejectionReason`, filled in the **same**
  `generateObject` call (no extra LLM cost). A non-bill document returns a typed
  `not_a_bill` (422) and the funnel routes to manual entry — no garbage figures
  persisted.
- **Mobile/camera polish** ✅ — the dropzone has a dedicated "Take a photo"
  capture input (separate from the file picker, so phones aren't forced into the
  camera); buttons stack on mobile; the review/manual cards are responsive.
- **Phase-driven progress dialog** ✅ — `extraction-dialog.tsx` takes a
  `phase: "uploading" | "ocr" | "extracting"` prop with three real progress dots;
  copy rotates within each genuine phase.

### Still open

- **Real-bill test corpus** ⏳ — the test matrix (US / PK / EU / UK / IN / AU
  bills + negative checks) is written up in [test-corpus.md](test-corpus.md) but
  has **not yet been run against real bills**. Can't be automated without a stash
  of real (PII-bearing) statements. Known edge case to watch: **net-metered /
  solar-export bills** (e.g. LESCO with separate import/export meters) where
  `kWhUsed` is ambiguous between gross import and net — exactly what the review
  card's low-confidence highlighting is there to catch.

---

## Deployment / migrations

- **`vercel-build`** script runs `prisma generate && prisma migrate deploy &&
  next build`, so production migrations apply automatically on every Vercel deploy.
  (Local `npm run build` stays `prisma generate && next build` — DB-free.)
- Production needs these env vars set in Vercel: `DATABASE_URL` (pooled Neon),
  `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, and the
  `UPSTASH_*` pair. A bad/stale `DATABASE_URL` surfaces as a Prisma `P1000`
  `AuthenticationFailed` on the upload step.

## Verification

- `npm run build` clean; `npm run lint` clean; `npx prisma validate` clean.
- `/estimate`: upload a PDF and a phone photo → confirm the dialog shows
  uploading → reading → extracting, and the review card renders kWh, amount,
  currency, and address; edit a field and confirm "Looks good" persists
  (`status = EXTRACTED` in Neon).
- Negative checks: oversized/disallowed file rejected gracefully; a non-bill
  document hits the `not_a_bill` screen with manual entry; a forced OCR failure
  offers retry + manual entry without dead-ending.
