/** @type {import('next').NextConfig} */
// next.config.js

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  reactStrictMode: true,
  // Firebase Admin 14 depends on ESM packages that must be loaded by the
  // Node.js runtime rather than bundled into Next.js server functions.
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
});
