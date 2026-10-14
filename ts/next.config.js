/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel-friendly — the app is a pure serverless function bundle.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Next 16: stable React 19 + app router
    optimizePackageImports: [],
  },
};

module.exports = nextConfig;
