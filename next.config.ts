import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to suppress webpack warning
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
      },
    ],
  },
};

export default nextConfig;
