import type { Metadata } from "next";
import { Albert_Sans, Young_Serif } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
