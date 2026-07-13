# Production image for SolarQuote (Next.js 16 + Prisma 7).
#
# We use a Dockerfile instead of Coolify's default nixpacks build because the
# nixpacks image's pinned nixpkgs has no `nodejs_24`, and its `nodejs_22` is
# 22.11.0 — below Prisma 7.8's required Node >= 22.12. node:24-alpine gives a
# supported runtime directly.
FROM node:24-alpine

WORKDIR /app

# libc6-compat + openssl: Prisma engine/runtime needs them on Alpine.
RUN apk add --no-cache libc6-compat openssl

# Install deps first for layer caching. `prisma` is a devDependency and its
# `postinstall` (prisma generate) needs the schema, so copy prisma/ too.
# --include=dev guarantees build tooling (prisma, tailwind, typescript) is
# installed even if NODE_ENV leaks in.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev --no-audit --no-fund

# Build-time vars. NEXT_PUBLIC_* are inlined into the client bundle during
# `next build`; the rest mirror the values present in the previously-working
# Vercel/local build so nothing reads `undefined` at build. Coolify passes each
# build-time env var to `docker build` as a --build-arg.
ARG DATABASE_URL \
    NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_EXTRACTION_MODE \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_UMAMI_SCRIPT_URL \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID \
    BETTER_AUTH_URL \
    BETTER_AUTH_SECRET \
    GOOGLE_MAPS_API_KEY \
    MISTRAL_API_KEY \
    OPENAI_API_KEY \
    OPENAI_EXTRACTION_MODEL \
    BLOB_READ_WRITE_TOKEN \
    BLOB_STORE_ID \
    N8N_CONTACT_WEBHOOK_URL \
    N8N_LEAD_WEBHOOK_URL \
    N8N_API_KEY \
    UPSTASH_REDIS_REST_URL \
    UPSTASH_REDIS_REST_TOKEN
ENV DATABASE_URL=$DATABASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_EXTRACTION_MODE=$NEXT_PUBLIC_EXTRACTION_MODE \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_UMAMI_SCRIPT_URL=$NEXT_PUBLIC_UMAMI_SCRIPT_URL \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID \
    BETTER_AUTH_URL=$BETTER_AUTH_URL \
    BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
    GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
    MISTRAL_API_KEY=$MISTRAL_API_KEY \
    OPENAI_API_KEY=$OPENAI_API_KEY \
    OPENAI_EXTRACTION_MODEL=$OPENAI_EXTRACTION_MODEL \
    BLOB_READ_WRITE_TOKEN=$BLOB_READ_WRITE_TOKEN \
    BLOB_STORE_ID=$BLOB_STORE_ID \
    N8N_CONTACT_WEBHOOK_URL=$N8N_CONTACT_WEBHOOK_URL \
    N8N_LEAD_WEBHOOK_URL=$N8N_LEAD_WEBHOOK_URL \
    N8N_API_KEY=$N8N_API_KEY \
    UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL \
    UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["npm", "run", "start"]
