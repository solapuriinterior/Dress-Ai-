import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() { return [
    { source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "microphone=(), geolocation=(), browsing-topics=()" },
    ] },
    ...["/login", "/dashboard", "/tryon"].map(source => ({ source, headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
    ] })),
  ]; },
};
export default nextConfig;
