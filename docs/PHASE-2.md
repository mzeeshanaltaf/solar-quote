# SolarQuote Phase 2 — Bill Upload + Extraction (split into 2.1 and 2.2)

## Context

Phase 1 (scaffold, marketing site, design system, Prisma schema) is complete. The
`/estimate` route is a stub ([app/estimate/page.tsx](../app/estimate/page.tsx)) carrying a
`// Phase 2 replaces this stub...` marker. The `QuoteSession` model already has every
field this phase writes to (`blobUrl`, `fileMimeType`, `kWhUsed`, `billAmount`,
`currency`, `billingPeriodDays`, `rawAddress`, `utilityName`, `extractionConfidence`),
and `lib/ratelimit.ts` already anticipates "the upload/extract routes in Phase 2."

The original [PLAN.md](PLAN.md) Phase 2 has four parts (upload route, extract route,
upload+review UI, real-bill testing). We are splitting it so the **core happy path ships
first**:

- **Phase 2.1 (this plan):** Upload a bill (PDF/JPG/PNG) → Mistral OCR to markdown →
  `gpt-5-mini` structured extraction (kWh, amount, currency, billing period, address,
  utility) → an editable review card where the user verifies/corrects the numbers. File
  persisted to Vercel Blob, fields persisted to a `QuoteSession` row (Neon).
- **Phase 2.2 (deferred):** manual-entry fallback, low-confidence highlighting, hardened
  error/retry states, the multi-bill real-world test corpus, and mobile camera polish.

**Confirmed decisions:** full Blob + DB persistence now; extraction via AI SDK
`generateObject` with `@ai-sdk/openai` (`gpt-5-mini`); Mistral OCR called via raw `fetch`
(no SDK, per the `/mistral-ocr` skill). Outcome: a homeowner can upload a bill and see
their own consumption/cost read back to them, editable, persisted — the front half of the
funnel working end to end.

---

## Prerequisites (do first)

1. **Provision Neon** and set the **pooled** `DATABASE_URL` (host contains `-pooler`) in
   `.env`. The current value is a placeholder; DB writes fail until this is real. Then
   `npx prisma migrate deploy` (the Phase 1 migration is already committed; no schema
   change is needed for 2.1 — every field exists).
2. **Confirm env vars** already present in `.env`: `BLOB_READ_WRITE_TOKEN`,
   `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`. No `.env.example`
   change needed (all already listed).
3. **Install dependencies:**
   - `@vercel/blob` — server upload to Blob.
   - `ai` and `@ai-sdk/openai` — `generateObject` structured extraction.
   - `react-dropzone` — drag/drop + camera-capture dropzone (optional; a plain
     `<input type="file" accept>` works too, decide at build time).
   - Verify the `gpt-5-mini` model ID is live before wiring it (per the `/ai-sdk` skill,
     never trust a model ID from memory). If unavailable, fall back to `gpt-4o-mini`
     behind the same `generateObject` call — only the model string changes.

---

## Phase 2.1 — Implementation

### Data / lib layer

- **`lib/ratelimit.ts`** — add an `extractRatelimit` limiter next to `contactRatelimit`,
  same null/fail-open pattern (e.g. `Ratelimit.slidingWindow(5, "10 m")`,
  `prefix: "ratelimit:extract"`). Anonymous uploads hit two paid APIs, so this gates the
  expensive route. Reuse the existing `getClientIp(headers)`.
- **`lib/extraction.ts`** (new) — the pipeline, kept server-only:
  - `ocrBill(fileUrl | base64, mimeType): Promise<string>` — POST to
    `https://api.mistral.ai/v1/ocr`, model `mistral-ocr-latest`, body
    `{ document: { type: "document_url" | "image_url", ... } }`. Pass the Blob URL as the
    document URL (no base64 needed once the file is in Blob). Join `pages[].markdown`.
  - `extractFields(markdown): Promise<ExtractedBill>` — `generateObject` with
    `@ai-sdk/openai` `openai("gpt-5-mini")` and the Zod schema below; a system prompt
    instructing it to read consumption + cost + address from an arbitrary global bill,
    return ISO-4217 currency, and emit `null` for anything not present (never guess).
  - **`ExtractedBillSchema` (Zod)** — single source of truth, shared by the route and the
    client review form: `kWhUsed`, `billAmount` (both `number().nullable()`),
    `currency` (ISO-4217 string, nullable), `billingPeriodDays` (int, nullable),
    `rawAddress`, `utilityName` (string, nullable), plus a `confidence` object with a
    `low | medium | high` per field (stored in `extractionConfidence` Json; the UI uses it
    in 2.2 for highlighting).

### API routes (mirror [app/api/contact/route.ts](../app/api/contact/route.ts) conventions)

- **`app/api/upload/route.ts`** — `POST` multipart `FormData`:
  1. `extractRatelimit` null-check → fail open; on hit return `429`.
  2. Validate file: MIME allowlist (`application/pdf`, `image/jpeg`, `image/png`,
     `image/webp`) and **10 MB cap** — reject with the same code/status-map shape
     (`ERROR_STATUS` / `ERROR_MESSAGES`) the contact route uses.
  3. `put(...)` to Vercel Blob (`access: "public"`), then `prisma.quoteSession.create`
     with `blobUrl`, `fileMimeType`, `status: UPLOADED`.
  4. Return `{ sessionId, blobUrl }` JSON.
- **`app/api/extract/route.ts`** — `POST { sessionId }`:
  1. Load the session, run `ocrBill(blobUrl)` → `extractFields(markdown)`.
  2. `prisma.quoteSession.update`: write the extracted fields + `extractionConfidence`,
     set `status: EXTRACTED`.
  3. Return the parsed `ExtractedBill` JSON. On OCR/LLM failure return a typed error
     (`extraction_failed`) so the client can surface manual entry (full fallback lands in
     2.2) — **never throw a bare 500 that dead-ends the funnel.**
  - Both routes import the shared `prisma` singleton from
    [lib/prisma.ts](../lib/prisma.ts) and validate input with Zod.

### Funnel UI — `/estimate`

Replace the stub. Per CLAUDE.md hydration rule, the funnel is a client tree imported via
`next/dynamic` `{ ssr: false }` (it initializes browser-only state):

- **[app/estimate/page.tsx](../app/estimate/page.tsx)** — thin Server Component that
  dynamically imports the client funnel with `{ ssr: false }`.
- **`components/estimate/estimate-funnel.tsx`** (`"use client"`) — owns step state
  (`upload | extracting | review`) and the `sessionId` / `ExtractedBill` in `useState`.
- **`components/estimate/bill-dropzone.tsx`** — drag/drop + mobile camera
  (`<input type="file" accept="image/*,application/pdf" capture="environment">`),
  client-side size/type pre-check, then `POST /api/upload` → `POST /api/extract`.
- **Progress UX** — use the `/shimmering-progress-dialog` skill for the 10–30 s
  OCR+extraction wait (rotating warm-toned status lines). A basic dialog is enough for
  2.1; richer messaging in 2.2.
- **`components/estimate/review-card.tsx`** — editable card ("We read your bill — check
  these numbers"). Build with the existing **`Field` / `FieldGroup` / `FieldLabel`**
  system ([components/ui/field.tsx](../components/ui/field.tsx)) plus `Input`, `Button`,
  `Badge`, `Alert`, `Spinner` — same primitives as
  [components/contact-form.tsx](../components/contact-form.tsx). Fields: kWh used, bill
  amount, currency, billing period (days), address, utility. A "Looks good" action
  `PATCH`es any user edits back to the session (a small `/api/extract` PATCH or a dedicated
  `/api/session` route) and is the seam where Phase 3 (location) picks up.

Use design tokens from [app/globals.css](../app/globals.css) (`font-display` Young Serif
headlines, amber `primary`, warm neutrals) and `cn()` from
[lib/utils.ts](../lib/utils.ts). Lean on `/impeccable` + `/frontend-design` for the
dropzone and review card so they match the marketing page's hand-crafted feel.

---

## Phase 2.2 — Deferred (next iteration)

- **Manual-entry fallback** — short form (monthly kWh or bill amount + country) feeding the
  same `QuoteSession`, shown when extraction fails or the user has no bill. Never dead-end.
- **Low-confidence highlighting** — use the stored `extractionConfidence` to flag fields
  the model was unsure about in the review card.
- **Hardened error/retry states** — explicit OCR-fail / LLM-fail / rate-limited UI, retry,
  and graceful Blob/DB failure handling; richer shimmer status copy.
- **Real-bill test corpus** — US utility PDF, Pakistani DISCO photo, EU bill; verify
  currency + kWh land correctly across schemas/languages (PLAN.md Phase 2 step 4).
- **Mobile/camera polish** — upload-by-camera is the dominant global path; full responsive
  pass.

---

## Verification

- `npm run build` clean; `npx prisma validate` clean (no schema change expected).
- `npm run dev`, open `/estimate`: upload a sample bill (one PDF + one phone photo),
  confirm the shimmer dialog shows during extraction, and the review card renders kWh,
  amount, currency, and address read from the bill.
- Edit a field, confirm "Looks good" persists: check the `QuoteSession` row in Neon (or
  `npx prisma studio`) shows `status = EXTRACTED` with the edited values.
- Negative checks: oversized file (>10 MB) and a disallowed type are both rejected with a
  friendly message, not a crash; a forced OCR failure returns the typed error without
  dead-ending.
