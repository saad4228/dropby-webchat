import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multipart API uploads pass through Vinext's progressive-action reader.
  // Leave room for the 15 MiB file limit plus multipart headers.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};

export default nextConfig;
