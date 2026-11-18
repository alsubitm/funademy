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
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'geolocation=()' },
        // Report-only first: observe provider/media compatibility before enforcement.
        { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self' https:" },
      ],
    }];
  },
  allowedDevOrigins: devOrigins,
  typescript: {
    // typecheck runs separately via `pnpm run typecheck`
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
