import type { NextRequest } from 'next/server';

/**
 * Absolute origin for provider callback URLs. Behind the Replit proxy the
 * request's own origin is localhost, so prefer the forwarded headers.
 */
export function originFromRequest(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
}
