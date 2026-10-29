import type { NextConfig } from "next";

// No other site may frame Swami (clickjacking), sniff types, or read full URLs as referrers. Scripts are left to
// Next's defaults; frame-ancestors, base-uri, form-action and object-src are the parts of a CSP that cannot break it.
const security = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
};

export default nextConfig;
