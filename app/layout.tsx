import type { Metadata, Viewport } from "next";
import { Albert_Sans, Young_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
});

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SolarQuote — Your bill already knows if solar is worth it",
    template: "%s · SolarQuote",
  },
  description:
    "Upload your electricity bill and get a personal solar estimate in minutes: system size, savings in your own currency, and payback time. Free, no sign-up.",
  openGraph: {
    title: "SolarQuote — Your bill already knows if solar is worth it",
    description:
      "Upload your electricity bill and get a personal solar estimate: system size, savings in your own currency, and payback time. Free, no sign-up.",
    siteName: "SolarQuote",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Tints the mobile browser chrome to the warm paper background and pins the app
// to its light, sunlit theme so iOS Safari never dark-inverts the funnel's form
// controls. The funnel is daylight-only by design (see DESIGN.md).
export const viewport: Viewport = {
  themeColor: "#faf7f0",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${albertSans.variable} ${youngSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
