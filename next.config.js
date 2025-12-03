/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true, // Keep this if you are using Next.js App Router (common in Next 13)
                  // Remove it if you are using the Pages Router exclusively
  },
  // This is the crucial part: tell Next.js to transpile 'undici'
  transpilePackages: ['undici'],
};

module.exports = nextConfig;
