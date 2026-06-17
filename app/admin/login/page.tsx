import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already signed in? Skip the form.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/admin");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <Link href="/" aria-label="SolarQuote home" className="inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="SolarQuote" className="h-11 w-auto" />
          </Link>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl">Operator sign in</h1>
            <p className="text-sm text-muted-foreground">
              The SolarQuote lead dashboard. Staff only.
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
