import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth mounts all its endpoints (sign-in, sign-out, get-session, ...)
// under /api/auth/*. Sign-up is disabled in the auth config — there is one
// seeded admin, created out-of-band.
export const { GET, POST } = toNextJsHandler(auth);
