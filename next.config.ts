import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification builds can go to a separate folder (NEXT_DIST_DIR=.next-verify) so a running `next start` keeps working.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  devIndicators: false,
  serverExternalPackages: [
    "@tscircuit/core",
    "circuit-to-svg",
    "circuit-json-to-gerber",
    "circuit-json-to-bom-csv",
    "circuit-json-to-kicad",
    "mongodb",
    "pg",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
