import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  typescript: {
    // Types are checked locally — skip the tsc pass during `next build`
    // to avoid a Vercel hang caused by Next.js mangling the tsconfig include paths.
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: {
      // Prevent Turbopack from trying to bundle pdfjs-dist on Linux (WASM crash)
      "pdfjs-dist": "pdfjs-dist",
    },
  },
};

export default nextConfig;
