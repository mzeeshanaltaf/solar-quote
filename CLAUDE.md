@AGENTS.md

# SolarQuote

Bill-to-solar-estimate lead-generation funnel. A homeowner uploads an electricity bill; the system extracts consumption + address (OCR/AI), fetches solar irradiance, sizes a system, and shows a savings/ROI estimate, capturing the visitor as a lead. Goal: trust + zero friction for the homeowner, lead quality for the operator. Global from day one — no fixed bill schema, currency comes from the bill itself. Full plan in [docs/PLAN.md](docs/PLAN.md); product + design rationale in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

## Stack

- **Next.js 16** (App Router) + **React 19**, full-stack. Self-hosted on a Hostinger VPS via **Coolify** (Docker/Nixpacks). Turbopack by default.
- **TypeScript**, `@/*` path alias → project root.
- **Tailwind v4** (CSS-first, configured in [app/globals.css](app/globals.css)) + **shadcn/ui** (Radix). Components in [components/ui/](components/ui/).
- **Prisma 7** + **Neon Postgres** (pooled connection via `@prisma/adapter-pg`).
- **Upstash** rate limiting; **Zod** validation; **lucide-react** icons.

## Commands

```bash
npm run dev        # next dev (Turbopack)
npm run build      # next build
npm run lint       # eslint
npx prisma migrate deploy   # apply prisma/migrations to DATABASE_URL
npx prisma generate         # regenerate client into ./generated
```

## Conventions

- **Prisma client is generated to `./generated`, not `node_modules`.** Import from `@/generated/client`. Always use the shared singleton in [lib/prisma.ts](lib/prisma.ts) (`import { prisma } from "@/lib/prisma"`) — never `new PrismaClient()` in app code. Re-run `prisma generate` after any schema change.
- **Schema** ([prisma/schema.prisma](prisma/schema.prisma)): `QuoteSession` (the funnel record — bill, extraction, location, estimate) has an optional 1:1 `Lead`. Status enums drive funnel/lead stages. Migrations are committed; create new ones rather than editing applied SQL.
- **API routes** validate input with Zod and degrade gracefully — see [app/api/contact/route.ts](app/api/contact/route.ts): honeypot anti-spam, Upstash rate limit (fails open when unconfigured), handles both JSON and form posts. Match this shape for new routes.
- **Rate limiting** ([lib/ratelimit.ts](lib/ratelimit.ts)): limiters are `null` when Upstash env vars are absent, so callers must null-check and fail open. Never dead-end the funnel on missing dev credentials.
- **Server vs Client:** default to Server Components. The estimate funnel is a client flow — wrap browser-only client trees with `next/dynamic` + `{ ssr: false }` to avoid hydration mismatch (see global guidance).
- **Use `cn()`** from [lib/utils.ts](lib/utils.ts) for conditional class merging.

## Design system

Warm-editorial "sunlight" direction — explicitly avoid the generic AI-SaaS look. Tokens live in [app/globals.css](app/globals.css): OKLCH palette where every neutral is tinted amber (no pure black/white), warm whites + amber/ochre + deep ink. Fonts: **Young Serif** for display/headings (`--font-display` / `font-heading`), **Albert Sans** for body (`--font-sans`). Generous whitespace, serif headlines. Lean on the `/impeccable` and `/frontend-design` skills for UI work.

## Environment

Phase 1 needs only `DATABASE_URL` (Neon **pooled** string — host contains `-pooler`). Later phases add S3 object storage (self-hosted MinIO — `S3_*`), Mistral OCR, OpenAI, Google Maps, Better Auth, Upstash, and n8n keys. See [.env.example](.env.example). Phase status is tracked in memory.

**Deployment:** self-hosted on a Hostinger VPS via **Coolify**, live at https://solarquote.zeeshanai.cloud, built from the repo `Dockerfile` (node:24-alpine). A push to `main` triggers a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) that calls the Coolify deploy API. The container start command runs `prisma migrate deploy` before `next start`, so committed migrations auto-apply on deploy. **Coolify's `DATABASE_URL` points at the same Neon database as local `.env`** — so local dev (and `npm run seed:admin`) writes to the production DB; there is no separate prod database. Runtime env on Coolify: all secrets incl. `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` and `S3_*`. `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` are seed-only (read by `scripts/seed-admin.ts`), not needed on Coolify. File storage is MinIO (S3-compatible) running as a Coolify service; the app reaches it over the internal Docker network.
