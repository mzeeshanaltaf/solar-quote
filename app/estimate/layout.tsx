import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estimate",
};

export default function EstimateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
