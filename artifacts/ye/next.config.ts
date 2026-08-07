import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Served at the root of the domain.
  poweredByHeader: false,
  // The preview pane proxies requests through an iframe on a different origin.
  allowedDevOrigins: ['*.replit.dev', '*.replit.app', '*.repl.co'],
  typescript: {
    // typecheck runs separately via `pnpm run typecheck`
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
