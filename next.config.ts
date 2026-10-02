import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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
