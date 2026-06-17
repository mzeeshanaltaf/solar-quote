"use client";

import { createAuthClient } from "better-auth/react";

// Browser-side auth client. baseURL is inferred from the current origin, so no
// env var is needed here. Used only by the admin login form and sign-out.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
