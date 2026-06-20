# Phase 6.4 — Launch

The launch gate: privacy/legal live and accurate, production env vars set on
Vercel, and one real-bill run through the live funnel. Code deliverables are
done; the rest is an operational runbook (steps a deploy needs that can't be
done from inside the repo).

## Legal pages — done

- `/privacy`, `/terms`, `/contact` ship as Server Components, linked from the
  marketing footer ([app/(marketing)/layout.tsx](../app/(marketing)/layout.tsx)).
- The privacy policy treats the whole bill as PII, names the processors it is
  sent to (OCR + language model, **Google Maps** for the address, PVGIS/NASA
  for irradiance), and promises deletion within 30 days.
- **The deletion channel is the contact form** → `POST /api/contact` → n8n
  webhook. The privacy promise is only real in production if
  `N8N_CONTACT_WEBHOOK_URL` + `N8N_API_KEY` are set (without them the form
  returns a `server` error). Verify this in the smoke test below.

## Production env vars (Vercel project settings)

The local `.env` and Vercel point at the **same Neon database** (see CLAUDE.md),
so there is no separate prod DB to provision. Set these on Vercel:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** string (host has `-pooler`), `sslmode=require` |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical origin, no trailing slash, e.g. `https://solar-quote-nu.vercel.app`. Drives OG/canonical tags — without it they fall back to `localhost:3000`. |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob (bills stored private) |
| `MISTRAL_API_KEY` | ✅ (OCR mode) | Skippable only if running `NEXT_PUBLIC_EXTRACTION_MODE=vision` |
| `OPENAI_API_KEY` | ✅ | Field extraction |
| `OPENAI_EXTRACTION_MODEL` | ➖ | Defaults to `gpt-5.4-mini` |
| `NEXT_PUBLIC_EXTRACTION_MODE` | ➖ | `ocr` (default) or `vision` |
| `GOOGLE_MAPS_API_KEY` | ✅ | Server, Geocoding API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ✅ | Browser, Maps JS + Static Maps thumbnail — **restrict by HTTP referrer to the prod domain** |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | ➖ | Vector map id; falls back to a demo map |
| `BETTER_AUTH_SECRET` | ✅ | ≥32 chars (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | ✅ | The prod base URL (same as `NEXT_PUBLIC_SITE_URL`) |
| `N8N_CONTACT_WEBHOOK_URL` / `N8N_LEAD_WEBHOOK_URL` / `N8N_API_KEY` | ✅ for launch | Lead + **deletion-request** delivery; the privacy policy depends on contact delivery |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ➖ (strongly advised) | Rate limiting; fails open if unset, leaving the paid APIs unprotected |

`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` are **seed-only** (read by
`npm run seed:admin`), not needed in the Vercel runtime.

## Deploy

- Pushing to `main` auto-deploys. The `vercel-build` script runs
  `prisma generate && prisma migrate deploy && next build`, so committed
  migrations apply automatically — confirm `npx prisma migrate status` is clean
  before pushing.
- First launch only: seed the admin once against the prod/shared DB —
  `npm run seed:admin` (idempotent; resets the password if re-run).

## End-to-end smoke test (against the live deployment)

Needs a real electricity bill (PII), so run it manually after deploy:

1. **Marketing** — `/` loads; logo renders; share-debugger (or view-source)
   shows OG/canonical pointing at the prod domain, not localhost.
2. **Funnel happy path** — `/estimate`: upload a real bill (try the mobile
   camera path), confirm extracted figures on the review card, confirm the roof
   pin on the satellite map, read the results (savings in the bill's currency,
   payback, 25-yr chart, offset slider recomputes).
3. **Fallbacks** — upload a non-bill → "doesn't look like a bill" → manual
   entry works; skip the map → regional-fallback estimate still renders.
4. **Lead capture** — request quotes, submit the lead form; verify the lead
   appears in `/admin` and the lead webhook fired.
5. **Deletion channel** — submit a `/contact` message; confirm the success
   state and that it reached the n8n inbox. This is the privacy commitment.
6. **Admin auth** — `/admin` redirects to login when signed out; the seeded
   account signs in; a lead detail shows the bill preview + map thumbnail.

## Out of scope (Phase 6.5)

robots.txt, sitemap, structured data, and the Lighthouse/Core-Web-Vitals pass
are the SEO audit, run last against the live site.
