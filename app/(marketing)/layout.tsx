import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Site-wide entity graph: WebSite (name + search-friendly identity) and
// Organization (logo for knowledge-panel / rich results). Rendered across the
// public marketing pages; the FAQ schema is on the landing page itself.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description:
        "Upload your electricity bill and get a free solar savings estimate: system size, savings in your own currency, and payback time.",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/logo.svg`,
    },
  ],
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="SolarQuote"
              width={1260}
              height={441}
              className="h-11 w-auto sm:h-12"
            />
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
              <Link href="/admin" className="text-background/40 hover:text-background">
                Admin
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
