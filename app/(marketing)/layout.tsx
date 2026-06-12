import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-primary" aria-hidden="true" />
            <span className="font-display text-lg">SolarQuote</span>
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex"
          >
            <Link href="/#how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="/#faq" className="hover:text-foreground">
              Questions
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </nav>
          <Button asChild size="sm">
            <Link href="/estimate">Check my bill</Link>
          </Button>
        </div>
      </header>

      <main className="flex grow flex-col">{children}</main>

      <footer className="bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <span className="font-display text-lg">SolarQuote</span>
            <nav
              aria-label="Footer"
              className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-background/70"
            >
              <Link href="/#how-it-works" className="hover:text-background">
                How it works
              </Link>
              <Link href="/#faq" className="hover:text-background">
                Questions
              </Link>
              <Link href="/contact" className="hover:text-background">
                Contact
              </Link>
              <Link href="/privacy" className="hover:text-background">
                Privacy policy
              </Link>
              <Link href="/terms" className="hover:text-background">
                Terms
              </Link>
            </nav>
          </div>
          <p className="max-w-[75ch] text-sm leading-relaxed text-background/60">
            Savings figures are estimates derived from your bill and public
            irradiance data (PVGIS, NASA POWER); they are not a binding quote.
            Installation costs vary by market and installer.
          </p>
        </div>
      </footer>
    </div>
  );
}
