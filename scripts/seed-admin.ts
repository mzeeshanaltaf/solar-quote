import "dotenv/config";

import { auth } from "../lib/auth";

// Seeds (or re-syncs) the single admin account for the /admin dashboard.
//
// Public sign-up is disabled in lib/auth.ts, so we can't go through the HTTP
// /api/auth/sign-up endpoint. Instead we talk to Better Auth's internal
// adapter directly via auth.$context — the same primitives the sign-up flow
// uses (createUser + a hashed "credential" account), minus the closed gate.
//
// Run with: npx tsx scripts/seed-admin.ts
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "SolarQuote Admin";

  if (!email || !password) {
    console.error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment before seeding."
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });

  if (existing) {
    // Idempotent: refresh the password on the existing credential account so a
    // forgotten admin password can be reset by re-running the seed.
    const credential = existing.accounts.find(
      (a) => a.providerId === "credential"
    );
    const hash = await ctx.password.hash(password);
    if (credential) {
      // updatePassword stores the value verbatim, so hash first.
      await ctx.internalAdapter.updatePassword(existing.user.id, hash);
      console.log(`Admin already exists — password reset for ${email}.`);
    } else {
      await ctx.internalAdapter.createAccount({
        userId: existing.user.id,
        providerId: "credential",
        accountId: existing.user.id,
        password: hash,
      });
      console.log(`Admin user existed without a password — credential added for ${email}.`);
    }
    return;
  }

  const user = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  });
  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  console.log(`Seeded admin account: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  });
