import type { NextConfig } from "next";
import { PRODUCTION_HOST, PRODUCTION_ORIGIN } from "./lib/site";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      allowedOrigins: [PRODUCTION_HOST, "localhost:3000"],
      bodySizeLimit: "10mb",
    },
  },
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
        : process.env.NODE_ENV === "production"
          ? PRODUCTION_ORIGIN
          : "http://localhost:3000"),
  },
  async redirects() {
    return [
      {
        source: "/auth/callback",
        destination: "/api/auth/callback/google",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
