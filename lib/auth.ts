import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

// Admin-only authentication for the /admin dashboard. The homeowner funnel is
// fully anonymous — this guards the operator's lead inbox, nothing else.
//
// Public sign-up is disabled: there is exactly one (seeded) admin account, so
// the /api/auth/sign-up endpoint is closed at the framework level. New admins
// are created out-of-band by scripts/seed-admin.ts, which talks to the
// internal adapter directly (bypassing the disabled HTTP endpoint).
export const auth = betterAuth({
  // BETTER_AUTH_SECRET / BETTER_AUTH_URL are read from the environment; only
  // override here when those are unset.
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    // Operator sessions are long-lived but the cookie cache keeps the common
    // case (every guarded request) off the database.
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Must be last so Set-Cookie headers from auth endpoints survive Next's
  // server-action/route boundaries.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
