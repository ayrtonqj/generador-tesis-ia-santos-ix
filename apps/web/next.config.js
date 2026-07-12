/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  output: 'standalone',
  transpilePackages: ['@kimy/shared-types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'radix-ui'],
  },
};

module.exports = nextConfig;
