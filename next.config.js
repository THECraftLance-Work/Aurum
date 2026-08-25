/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    // Strip console.* from production builds (keeps error/warn for diagnostics)
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // Tree-shake barrel imports so a page importing 9 icons doesn't pull the
    // whole icon set into the client bundle.
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"]
  }
};
module.exports = nextConfig;
