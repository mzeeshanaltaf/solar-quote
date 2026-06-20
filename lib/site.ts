/**
 * Canonical origin for the deployment, used by `metadataBase`, the sitemap, the
 * robots file, and JSON-LD. In production `NEXT_PUBLIC_SITE_URL` must be the
 * custom domain (https://solarquote.zeeshanai.cloud) — the bare *.vercel.app
 * host 301-redirects to it, so canonical/OG URLs have to name the final host or
 * they point at a redirect. Trailing slash stripped so paths concatenate clean.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const SITE_NAME = "SolarQuote";
