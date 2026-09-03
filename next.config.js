/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/(.*)", headers: security }];
  },
  // Production-only so `next dev --turbo` isn't flagged as unsupported
  // (removeConsole is a webpack/SWC build feature; Turbopack dev ignores it).
  ...(process.env.NODE_ENV === "production"
    ? {
        compiler: {
          // Strip console.* from production builds (keeps error/warn for diagnostics)
          removeConsole: { exclude: ["error", "warn"] }
        }
      }
    : {}),
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // Tree-shake barrel imports so a page importing 9 icons doesn't pull the
    // whole icon set into the client bundle.
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"]
  }
};
module.exports = nextConfig;
