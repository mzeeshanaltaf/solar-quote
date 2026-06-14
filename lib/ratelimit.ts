import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash-backed limiters, shared by the contact form now and the
// upload/extract routes in Phase 2. When Upstash isn't configured
// (e.g. a fresh local checkout) limiters are null and callers fail open,
// so missing credentials never dead-end the funnel in development.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn("Upstash env vars missing: rate limiting is disabled");
}

export const contactRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "ratelimit:contact",
    })
  : null;

// Bill upload + extraction hit Vercel Blob, Mistral OCR, and OpenAI — all
// paid — on anonymous requests, so we gate them harder than the contact form.
export const extractRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "ratelimit:extract",
    })
  : null;

// Manual entry / session edits only touch the database (no paid APIs), so this
// is more generous than the extract limiter — it must never block a legitimate
// fallback from a user whose extraction just failed (and already spent their
// extract budget). Kept separate so the two windows don't share a counter.
export const sessionRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 m"),
      prefix: "ratelimit:session",
    })
  : null;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "anonymous";
}
