import { NextRequest, NextResponse } from 'next/server';

/** Defense in depth beyond SameSite cookies; provider webhooks authenticate themselves. */
export function isSafeApiMutation(req: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.nextUrl.pathname.startsWith('/svc/pay/webhook/')) return true;
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser API clients still require route authorization
  try {
    const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim()
      || req.headers.get('host') || req.nextUrl.host;
    return new URL(origin).host === host;
  } catch { return false; }
}

export function middleware(req: NextRequest) {
  return isSafeApiMutation(req)
    ? NextResponse.next()
    : NextResponse.json({ error: 'cross_origin_mutation' }, { status: 403 });
}

export const config = { matcher: '/svc/:path*' };
