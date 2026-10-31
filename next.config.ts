import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multipart API uploads pass through Vinext's progressive-action reader.
  // Leave room for the 30 MiB video limit plus multipart headers.
  experimental: { serverActions: { bodySizeLimit: "32mb" } },
};

export default nextConfig;
