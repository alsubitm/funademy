'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * URL-backed admin view state. The query string is the single source of truth
 * so refresh, back and forward restore the same section and filters.
 */
const EVT = 'funademy:admin-query';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVT, cb);
  };
}
const snapshot = () => window.location.search;
const serverSnapshot = () => '';

export function useAdminSearch() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return new URLSearchParams(search);
}

export function setAdminParams(patch: Record<string, string | null>, mode: 'push' | 'replace' = 'replace') {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '' || v === 'all') url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', next);
  window.dispatchEvent(new Event(EVT));
}

/** Read one validated param; unknown values fall back safely. */
export function pick<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = params.get(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function useAdminParam<T extends string>(key: string, allowed: readonly T[] | null, fallback: T) {
  const params = useAdminSearch();
  const raw = params.get(key) ?? '';
  const value = allowed ? pick(params, key, allowed, fallback) : ((raw || fallback) as T);
  const set = useCallback((v: string, mode: 'push' | 'replace' = 'replace') => setAdminParams({ [key]: v === fallback ? null : v }, mode), [key, fallback]);
  return [value, set] as const;
}
