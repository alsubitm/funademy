import type { NextConfig } from 'next';

// The preview pane proxies requests through an iframe on a different origin.
// NOTE: Next's `*.replit.dev` wildcard matches a single label only, while the
// actual dev domain is `<id>.<cluster>.replit.dev` — so also allow the exact
// domain from the environment plus the two-label wildcard.
const devOrigins = ['*.replit.dev', '*.picard.replit.dev', '*.replit.app', '*.repl.co'];
if (process.env.REPLIT_DEV_DOMAIN) devOrigins.push(process.env.REPLIT_DEV_DOMAIN);

const nextConfig: NextConfig = {
  // Overridable so the build-resilience test can build into a throwaway
  // directory without clobbering the dev server's .next output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Served at the root of the domain.
  poweredByHeader: false,
  allowedDevOrigins: devOrigins,
  typescript: {
    // typecheck runs separately via `pnpm run typecheck`
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
