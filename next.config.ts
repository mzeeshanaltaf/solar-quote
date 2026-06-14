import path from "path";
import type { NextConfig } from "next";

// react-pdf / pdfjs-dist optionally import the Node-only `canvas` module, which
// breaks browser builds. Stub it out for both bundlers (Turbopack on Vercel,
// webpack for any --webpack/local tooling). See global Next.js guidance.
const nextConfig: NextConfig = {
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
