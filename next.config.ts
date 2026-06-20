import path from "path";
import type { NextConfig } from "next";

// react-pdf / pdfjs-dist optionally import the Node-only `canvas` module, which
// breaks browser builds. Stub it out for both bundlers (Turbopack on Vercel,
// webpack for any --webpack/local tooling). See global Next.js guidance.
const nextConfig: NextConfig = {
  // Tree-shake the motion barrel down to the specific exports each module uses
  // (the funnel pulls motion/AnimatePresence/useReducedMotion/animate across a
  // few components). lucide-react is already in Next's built-in optimize list.
  experimental: {
    optimizePackageImports: ["motion"],
  },
  turbopack: {
    resolveAlias: {
      canvas: path.resolve(__dirname, "./canvas-stub.js"),
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
