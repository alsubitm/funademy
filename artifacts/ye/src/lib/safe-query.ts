/**
 * Wraps a DB query so that a failure (e.g. missing/renamed table during
 * `next build` against the production database at publish time) never
 * crashes the build. On failure the fallback is returned and the error
 * is logged.
 */
export async function safeQuery<T>(query: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.error(`[safe-query] ${label} failed, using fallback:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}
