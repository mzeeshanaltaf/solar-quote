# SolarQuote — Bill-to-Solar-Estimate Lead Generation Platform

## Context

A homeowner uploads an electricity bill (PDF/photo). The system extracts consumption + address via OCR/AI, fetches solar irradiance for the location, sizes a solar system, shows a savings/ROI estimate, and captures the visitor as a lead managed in an admin dashboard. The product is a lead-gen funnel: trust and zero friction for the homeowner, lead quality for the operator.

**Decisions made:**
- **Market:** Global from day one — no fixed bill schema; extraction is fully AI-driven; currency comes from the bill itself.
- **Pipeline:** Mistral OCR (`mistral-ocr-latest`, handles PDF + images, multilingual) → markdown → **OpenAI GPT-5.x** (e.g. `gpt-5-mini`) with structured outputs → typed JSON fields.
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
| `/impeccable` | Phases 1, 4, 6 | Warm-editorial design system, results page, final polish |
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
| `/seo-audit` | Phase 6 | Pre-launch technical SEO pass on marketing + results pages |

## Architecture

```
app/
  (marketing)/page.tsx              # Phase 1 landing
  estimate/                          # the funnel (client flow, ssr:false wrapper)
    page.tsx                         # upload → review → location → results
  admin/                             # Phase 5, Better Auth protected
  api/
    upload/route.ts                  # → Vercel Blob, creates QuoteSession
    extract/route.ts                 # Mistral OCR → GPT-5.x structured output
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

### Phase 2 — Bill Upload + Extraction Pipeline
> **Skills:** `/mistral-ocr`, `/ai-sdk`, `/shimmering-progress-dialog`, `/shadcn`, `/vercel-react-best-practices`

1. `/api/upload`: validate type/size → Vercel Blob → create QuoteSession. Rate limiting from day one.
2. `/api/extract`: OCR per `/mistral-ocr` (blob URL → markdown), then structured extraction per `/ai-sdk` — `generateObject` with the OpenAI provider (`gpt-5-mini`) and a Zod schema (kWh, bill amount, currency ISO code, billing period, address, utility, per-field confidence).
3. `/estimate` step 1+2 UI: upload dropzone (camera-friendly on mobile), progress dialog per `/shimmering-progress-dialog` (extraction takes 10–30 s), editable review card (shadcn form components), manual-entry fallback. Whole funnel tree imported via `next/dynamic` `{ ssr: false }` (browser APIs in state init — hydration rule).
4. Test with a corpus of real bills: US utility PDF, Pakistani DISCO photo, EU bill — verify currency + kWh land correctly.

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
> **Skills:** `/seo-audit`, `/vercel-react-best-practices`, `/impeccable`

1. Error states for every external call (OCR fail → manual entry; geocode fail → search box; PVGIS fail → NASA POWER → regional constant).
2. Mobile polish pass on the full funnel via `/impeccable` (upload-by-camera is the dominant global path).
3. Run `/seo-audit` on the marketing page: meta/OG tags, sitemap, structured data, Core Web Vitals; fix findings. Legal pages (privacy — bills are PII; data-deletion contact).
4. Performance pass per `/vercel-react-best-practices` (bundle analysis, image optimization, lazy boundaries).
5. Deploy to Vercel, production env vars, end-to-end smoke test with a real bill.

## Verification
- **Per phase:** `npm run build` clean; `npx prisma validate`/`migrate dev` clean.
- **Phase 2:** run dev server, upload 3 real bills (PDF + 2 photos, different countries), confirm extracted JSON correctness in the review screen.
- **Phase 3:** spot-check specific yield for 3 known cities (Lahore ≈ 1500+, Berlin ≈ 1000, Phoenix ≈ 1700 kWh/kWp/yr) against PVGIS web tool.
- **Phase 4:** unit tests for `solar-math.ts` (`vitest`) — known inputs → known payback; sanity-check a full funnel run.
- **Phase 5:** submit a lead end-to-end, verify it appears in admin with bill preview; verify `/admin` redirects when unauthenticated.
- **Phase 6:** Lighthouse mobile run on landing + results; full funnel on a real phone (camera upload).
