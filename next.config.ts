import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  typescript: {
    // Types are checked locally — skip the tsc pass during `next build`
    // to avoid a Vercel hang caused by Next.js mangling the tsconfig include paths.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
