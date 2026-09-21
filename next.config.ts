import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Server Actions reject request bodies over 1MB by default, which would
       * refuse most phone screenshots submitted as winner proof (PRD §09).
       *
       * The ceiling is Vercel's, not ours: a serverless function accepts at
       * most 4.5MB of request body, and anything larger is dropped before the
       * app ever sees it. The per-file caps in `lib/image-validation.ts` sit
       * below this with room for the multipart overhead the limit also counts.
       */
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
