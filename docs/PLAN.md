# SolarQuote — Bill-to-Solar-Estimate Lead Generation Platform

## Context

A homeowner uploads an electricity bill (PDF/photo). The system extracts consumption + address via OCR/AI, fetches solar irradiance for the location, sizes a solar system, shows a savings/ROI estimate, and captures the visitor as a lead managed in an admin dashboard. The product is a lead-gen funnel: trust and zero friction for the homeowner, lead quality for the operator.

**Decisions made:**
- **Market:** Global from day one — no fixed bill schema; extraction is fully AI-driven; currency comes from the bill itself.
- **Pipeline:** Mistral OCR (`mistral-ocr-latest`, handles PDF + images, multilingual) → markdown → **OpenAI GPT-5.x** (`gpt-5.4-mini`) with structured outputs → typed JSON fields. (An experimental single-call vision path sends the file straight to `gpt-5.4-mini`, skipping OCR — see Phase 2.)
- **Stack:** Next.js (App Router) full-stack on Vercel, Tailwind v4, shadcn/ui, Prisma + **Neon Postgres**, **Vercel Blob** for bill files.
- **Maps:** Google Maps — Geocoding API (address → lat/lng) + Maps JS with satellite view for pin confirmation.
- **Auth:** Homeowner flow fully anonymous; admin dashboard behind **Better Auth** (email/password, seeded admin).
- **Lead routing v1:** Dashboard only — leads accumulate in admin; partner outreach is manual outside the system.
- **Lead gating:** Full results shown ungated; soft "Get quotes from installers" CTA opens the lead form.
- **Design:** `/impeccable` skill, **warm editorial** direction — sunlight palette (warm whites, amber/ochre, deep ink), serif display headlines, generous whitespace. Explicitly avoid generic AI-SaaS look.

**Technical calls (rationale inline):**
- **Irradiance:** PVGIS v5.3 `PVcalc` API (free, no key, returns annual kWh production per kWp directly — purpose-built for this; covers Europe/Africa/Asia/most of the Americas). Fallback: **NASA POWER** (fully global, free) → GHI × performance-ratio formula. Both called server-side.
- **ROI math (currency-agnostic, works globally):** effective tariff = bill amount ÷ kWh from the user's own bill — no tariff databases needed. Annual consumption extrapolated from billing period. System size kWp = target annual kWh ÷ specific yield (kWh/kWp/yr from PVGIS). Savings = min(production, consumption) × tariff (conservative; net-metering upside shown as a range). System cost from a per-kWp regional defaults table (constants file, clearly labeled "estimate"). Payback = cost ÷ annual savings; 25-yr view with 0.5%/yr panel degradation.
- **Manual-entry fallback:** if extraction fails or the user has no bill, a short form (monthly kWh or bill amount + country) feeds the same estimate engine. Never dead-end the funnel.
- **Abuse protection:** anonymous uploads hit three paid APIs — per-IP rate limiting (Upstash Ratelimit or in-DB counter), 10 MB file cap, MIME allowlist (pdf/jpg/png/webp/heic).

## Skills Map

| Skill | Used in | Purpose |
|---|---|---|
| `/impeccable` | Phases 1, 4, 6.2 | Warm-editorial design system, results page, final polish |
| `/frontend-design` | Phases 1, 4 | Distinctive non-AI-slop visual execution |
| `/shadcn` | Phases 1, 2, 5 | Component scaffolding (forms, tables, dialogs, sheets) |
| `/nextjs-best-practices` | All phases | App Router patterns, Server/Client component boundaries |
| `/vercel-react-best-practices` | All phases | Performance patterns, bundle/data-fetching hygiene |
| `/neon-postgres` | Phases 1, 3, 5 | Neon setup, pooled connection string, branching for dev |
| `/prisma-database-setup` | Phase 1 | Prisma + Neon wiring |
| `/mistral-ocr` | Phase 2 | OCR pipeline: PDF/photo → markdown |
| `/ai-sdk` | Phase 2 | `generateObject` with OpenAI provider for structured field extraction |
| `/shimmering-progress-dialog` | Phase 2 | Progress UX during 10–30 s extraction |
| `/nextjs-progressive-form` | Phase 5 | Hydration-proof lead capture form |
| `/better-auth-best-practices` | Phase 5 | Admin auth (email/password, middleware, seeding) |
| `/pdf-preview` | Phase 5 | Inline bill preview in admin (react-pdf, base64) |
| `/seo-audit` | Phase 6.5 | Pre-launch technical SEO pass on marketing + results pages |

## Architecture

```
app/
  (marketing)/page.tsx              # Phase 1 landing
  estimate/                          # the funnel (client flow, ssr:false wrapper)
    page.tsx                         # upload → review → location → results
  admin/                             # Phase 5, Better Auth protected
  api/
    upload/route.ts                  # → private Vercel Blob, creates QuoteSession
    ocr/route.ts                     # Mistral OCR → persists markdown on session
    extract/route.ts                 # GPT-5.x structured output over the markdown
    extract-vision/route.ts          # experimental single-call vision extraction (no OCR)
    session/route.ts                 # manual-entry fallback (typed numbers → QuoteSession)
    geocode/route.ts                 # Google Geocoding (server-side, key hidden)
    irradiance/route.ts              # PVGIS → NASA POWER fallback
    estimate/route.ts                # sizing + ROI calc, persists to session
    leads/route.ts                   # lead capture (progressive-form pattern)
    auth/[...all]/route.ts           # Better Auth
lib/
  extraction.ts  irradiance.ts  solar-math.ts  cost-defaults.ts  ratelimit.ts
prisma/schema.prisma
docs/PLAN.md                         # this document
```

**Data model (Prisma):**
- `QuoteSession` — id, status (`UPLOADED→EXTRACTED→LOCATED→ESTIMATED`), blobUrl, extracted fields (kWhUsed, billAmount, currency, billingPeriodDays, rawAddress, utilityName, extractionConfidence), lat/lng, formattedAddress, specificYield, systemKwp, annualProductionKwh, annualSavings, paybackYears, estimateJson (full breakdown).
- `Lead` — name, email, phone, preferredContact, notes, status enum (`NEW / CONTACTED / QUALIFIED / SENT_TO_PARTNER / CLOSED / JUNK`), → QuoteSession.
- Better Auth tables for admin user(s).

**Funnel UX (single `/estimate` flow, 4 steps, state persisted to QuoteSession after each step):**
1. **Upload** (drag-drop or camera capture on mobile) → shimmer progress dialog during OCR/extraction.
2. **Review** extracted fields in an editable card ("We read your bill — check these numbers"). Low-confidence fields highlighted. Manual-entry fallback lives here.
3. **Location** — geocoded pin on Google satellite map, draggable to the actual roof.
4. **Results** — the money screen: system size, monthly/annual savings in the bill's own currency, payback, 25-yr chart. Ungated. Soft CTA → lead form (sheet/dialog).

**Env vars:** `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY` (server, geocoding), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser, map display — HTTP-referrer restricted), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.

## Phases

### Phase 1 — Scaffold + Marketing Page
> **Skills:** `/nextjs-best-practices`, `/neon-postgres`, `/prisma-database-setup`, `/shadcn`, `/impeccable`, `/frontend-design`, `/vercel-react-best-practices`

1. `create-next-app` (TypeScript, App Router, Tailwind v4), shadcn init — follow `/nextjs-best-practices` for Server/Client component layout from the start.
2. Database: provision Neon project per `/neon-postgres` (pooled connection string for serverless, dev branch for local work); wire Prisma per `/prisma-database-setup`.
3. Design system via `/impeccable` + `/frontend-design`: warm-editorial tokens (palette, serif display font e.g. Fraunces/Source Serif + humanist sans, spacing scale) in `globals.css` — defined once, used by every later phase.
4. Landing page: hero ("Your bill already knows if solar is worth it"), 3-step how-it-works, trust/FAQ section, footer. Primary CTA routes to `/estimate` (stub until Phase 2). Mobile-first, semantic HTML, OG/meta tags. Keep it a Server Component except interactive islands (`/vercel-react-best-practices`).

### Phase 2 — Bill Upload + Extraction Pipeline ✅ (as built)
> **Skills:** `/mistral-ocr`, `/ai-sdk`, `/shimmering-progress-dialog`, `/shadcn`, `/vercel-react-best-practices`
> Detailed build notes: [docs/PHASE-2.md](PHASE-2.md). Shipped in 2.1 (happy path) + 2.2 (resilience), then a vision-extraction experiment.

**Pipeline split into three sequentially-awaited routes** (the original plan's single `/api/extract` was split so the progress dialog reflects real work and retries are cheap):

1. **`/api/upload`** — multipart `FormData`; MIME allowlist (pdf/jpg/png/webp) + 10 MB cap; `put` to a **private** Vercel Blob (`access:"private"` — bills are PII, never a public URL); creates `QuoteSession` (status `UPLOADED`). Gated by `extractRatelimit` (5/10m).
2. **`/api/ocr`** — reads the bytes back from the private store to base64, OCRs with **Mistral** (`mistral-ocr-latest`) per `/mistral-ocr`, and **persists the markdown** to a new `QuoteSession.ocrMarkdown` column (migration `0004_ocr_markdown`) so retries don't pay for OCR twice.
3. **`/api/extract`** — `generateObject` per `/ai-sdk` over the persisted markdown with the OpenAI provider (**`gpt-5.4-mini`**, overridable via `OPENAI_EXTRACTION_MODEL`; `reasoningEffort:"medium"`, `serviceTier:"flex"`) and the shared `ExtractedBillSchema` (kWh, bill amount, ISO currency, billing period, `rawAddress` + coarse `addressTown/City/State/Country`, utility, per-field confidence). **POST** extracts + persists (status `EXTRACTED`); **PATCH** saves the user's verified/corrected values. A failed figure-parse re-runs only this LLM step (OCR markdown is already stored).

**Relevance gate** (beyond original plan): the schema also carries `isElectricityBill` + `rejectionReason`, filled in the *same* `generateObject` call (no extra cost). A non-bill returns a typed `not_a_bill` (422) and the funnel routes to manual entry — no garbage figures persisted.

**Manual-entry fallback** is its own route **`/api/session`** (POST creates *or* updates a `QuoteSession` from typed numbers; requires kWh **or** bill amount; status `EXTRACTED`), gated by a separate generous `sessionRatelimit` (20/10m, shared with `/api/ocr` + `/api/extract`) so a user whose extraction just failed isn't blocked from the manual path.

**Vision-extraction experiment** (`/api/extract-vision`): a single-call alternative that sends the bill image/PDF straight to `gpt-5.4-mini` (no Mistral OCR), reusing the same schema, prompt, and relevance gate. Gated by the build-time flag `NEXT_PUBLIC_EXTRACTION_MODE=vision`; the funnel branches between `upload→ocr→extract` and `upload→extract-vision`. A/B experiment — if it wins on accuracy/latency/cost, the OCR path will be retired.

**`/estimate` UI** (client funnel, imported via `next/dynamic` `{ ssr:false }` — hydration rule): `estimate-funnel.tsx` owns step state; `bill-dropzone.tsx` (separate file picker + dedicated mobile "Take a photo" capture input); `bill-preview.tsx` (react-pdf / `<img>` preview); phase-driven `extraction-dialog.tsx` per `/shimmering-progress-dialog` (`uploading → ocr → extracting` dots); `review-card.tsx` (editable shadcn form, **low-confidence fields highlighted** amber with a summary banner); `manual-entry-form.tsx`. The funnel has dedicated `failed` + `manual` steps surfacing the routes' typed error codes via a `FAILURE_COPY` map (`rate`/`ocr_failed`/`not_a_bill`/`extraction_failed`/`server`) — it never dead-ends.

**Still open:** the real-bill test corpus (US/PK/EU/UK/IN/AU + negative checks) is documented in [docs/test-corpus.md](test-corpus.md) but **not yet run against real bills** (needs PII-bearing statements). Known edge case to watch: net-metered/solar-export bills where `kWhUsed` is ambiguous between gross import and net.

### Phase 3 — Location + Irradiance
> **Skills:** `/nextjs-best-practices`, `/neon-postgres`, `/vercel-react-best-practices`

1. `/api/geocode`: Google Geocoding on the extracted address; return candidates + confidence. Server-side route so the unrestricted key never reaches the browser (`/nextjs-best-practices`).
2. Map step UI: satellite view, draggable pin, "this is my roof" confirm. Address search box fallback when geocoding misses. Lazy-load the Maps JS bundle (`/vercel-react-best-practices`).
3. `/api/irradiance`: PVGIS `PVcalc` (lat/lng, 1 kWp, optimal tilt) → specific yield; NASA POWER fallback path; cache responses by rounded lat/lng in Neon.

### Phase 4 — Sizing + Savings/ROI Results
> **Skills:** `/impeccable`, `/frontend-design`, `/framer-motion-animator`, `/vercel-react-best-practices`

1. `lib/solar-math.ts`: pure, unit-tested functions — consumption extrapolation, kWp sizing, production, savings range, payback, 25-yr projection with degradation.
2. `lib/cost-defaults.ts`: per-kWp installed-cost defaults by region/country, labeled as estimates.
3. Results page (the screen that sells): headline savings number in the bill's currency, system size card, payback timeline, 25-yr cumulative-savings chart (recharts), offset slider (80/100/120%) recomputing live. Full `/impeccable` + `/frontend-design` pass — this page must look hand-crafted; tasteful number/section reveals via `/framer-motion-animator`.
4. Soft CTA → lead form.

### Phase 5 — Lead Capture + Admin Dashboard
> **Skills:** `/nextjs-progressive-form`, `/better-auth-best-practices`, `/pdf-preview`, `/shadcn`, `/neon-postgres`

1. Lead form (sheet over results): name, email, phone, preferred contact — built per `/nextjs-progressive-form` so it survives hydration failures. Persists Lead → QuoteSession.
2. Admin auth per `/better-auth-best-practices`: email/password, seed script for the admin user, middleware guarding `/admin`.
3. Admin dashboard (shadcn data table, sheet, dialog): leads list (filter by status/date, search), lead detail view — extracted bill data, estimate summary, map thumbnail, original bill preview per `/pdf-preview` (react-pdf for PDFs; `<img>` for photo bills), status dropdown + notes.

### Phase 6 — Hardening + Launch
> **Skills:** `/vercel-react-best-practices`, `/impeccable`, `/seo-audit`

Broken into sub-phases — each a discrete, shippable unit. `/seo-audit` runs last, against the live deployment.

#### Phase 6.1 — Resilience / graceful degradation ✅ (as built)
> **Skills:** `/vercel-react-best-practices`

Error states for every external call: OCR fail → manual entry; geocode fail → search box; PVGIS fail → NASA POWER → regional constant. The funnel never dead-ends.

Most of the chain was already in place from Phases 2–4 (the `FAILURE_COPY` failure step → manual entry; `getSpecificYield`'s PVGIS→NASA fallback; a null `specificYield` making `computeEstimate` use `fallbackSpecificYield`, disclosed on the results page as "estimated for your region"). 6.1 closed the two remaining gaps: (1) the location step no longer dead-ends — a `onSkip` escape ("Estimate from my area instead", and a "Continue to my estimate" CTA when the browser Maps key is missing) proceeds straight to a regional-fallback estimate without a pin; (2) `/api/geocode` now bounds its upstream call with `AbortSignal.timeout(15s)`, matching `lib/irradiance.ts`, so a hung Google request can't stall the funnel.

#### Phase 6.2 — Mobile polish pass
> **Skills:** `/impeccable`

Full-funnel mobile polish via `/impeccable` — upload-by-camera is the dominant global path.

#### Phase 6.3 — Performance pass
> **Skills:** `/vercel-react-best-practices`

Bundle analysis, image optimization, lazy boundaries.

#### Phase 6.4 — Launch
> **Skills:** `/vercel-react-best-practices`

Legal pages (privacy — bills are PII; data-deletion contact) so privacy is live at launch. Deploy to Vercel with production env vars; end-to-end smoke test with a real bill.

#### Phase 6.5 — SEO audit *(final)*
> **Skills:** `/seo-audit`

Run `/seo-audit` on the marketing + results pages: meta/OG tags, sitemap, structured data, Core Web Vitals; fix findings, verified against the live deployment.

## Verification
- **Per phase:** `npm run build` clean; `npx prisma validate`/`migrate dev` clean.
- **Phase 2:** run dev server, upload 3 real bills (PDF + 2 photos, different countries), confirm extracted JSON correctness in the review screen.
- **Phase 3:** spot-check specific yield for 3 known cities (Lahore ≈ 1500+, Berlin ≈ 1000, Phoenix ≈ 1700 kWh/kWp/yr) against PVGIS web tool.
- **Phase 4:** unit tests for `solar-math.ts` (`vitest`) — known inputs → known payback; sanity-check a full funnel run.
- **Phase 5:** submit a lead end-to-end, verify it appears in admin with bill preview; verify `/admin` redirects when unauthenticated.
- **Phase 6.2 / 6.4:** full funnel on a real phone (camera upload). **Phase 6.5:** Lighthouse mobile run on landing + results.
