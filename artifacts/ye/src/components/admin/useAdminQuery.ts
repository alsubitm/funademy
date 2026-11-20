'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

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
  // A filter change starts a new traversal; unrelated tabs retain their state.
  if (Object.keys(patch).some((k) => ['bq', 'bstatus', 'bowner', 'bprogram'].includes(k))) url.searchParams.delete('bcursor');
  if (Object.keys(patch).some((k) => ['rq', 'rstate', 'rseats', 'rprogram'].includes(k))) url.searchParams.delete('rcursor');
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '' || v === 'all') url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', next);
  window.dispatchEvent(new Event(EVT));
}

export type AdminPagination = {
  total: number; matching: number; previousCursor: string | null; nextCursor: string | null;
};
export const emptyPagination: AdminPagination = { total: 0, matching: 0, previousCursor: null, nextCursor: null };

/** Debounced URL-backed reads. Abort and generation checks also guard mutation refreshes
 * and browsers which finish a response after cancellation. Never show another query's rows.
 */
export function useAdminList<T>(endpoint: string, query: string) {
  const [result, setResult] = useState<{ query: string; data: T } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const currentQuery = useRef(query);
  currentQuery.current = query;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    // Mutation handlers may have started on another URL. Refresh the current
    // query when they finish, not the query captured when the mutation began.
    const requestQuery = currentQuery.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const version = ++generation.current;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`${endpoint}?${requestQuery}`, { cache: 'no-store', signal: abort.signal });
      if (response.status === 401) { window.location.reload(); return; }
      if (!response.ok) throw new Error('load');
      const data = await response.json();
      if (version === generation.current && currentQuery.current === requestQuery) setResult({ query: requestQuery, data });
    } catch {
      if (!abort.signal.aborted && version === generation.current && currentQuery.current === requestQuery) setError(true);
    } finally {
      if (version === generation.current && currentQuery.current === requestQuery) setBusy(false);
    }
  }, [endpoint]);
  useEffect(() => {
    setError(false);
    setBusy(true);
    const timer = setTimeout(() => void refresh(), 200);
    return () => { clearTimeout(timer); controller.current?.abort(); ++generation.current; };
  }, [refresh, query]);
  return { data: result?.query === query ? result.data : null, loading: !error && (busy || result?.query !== query), error, refresh };
}

export function adminListQuery(params: URLSearchParams, prefix: 'b' | 'r') {
  const query = new URLSearchParams();
  const keys = prefix === 'b' ? ['bq', 'bstatus', 'bowner', 'bprogram'] : ['rq', 'rstate', 'rseats', 'rprogram'];
  const choices: Record<string, readonly string[]> = {
    bstatus: ['new', 'contacted', 'enrolled', 'converted'],
    bowner: ['assigned', 'unassigned'],
    rstate: ['active', 'inactive'],
    rseats: ['available', 'full'],
  };
  for (const key of keys) {
    const value = params.get(key);
    if (choices[key] && (!value || !choices[key].includes(value))) continue;
    if (value && value !== 'all') query.set(key, value);
  }
  const cursor = params.get(`${prefix}cursor`);
  if (cursor) query.set('cursor', cursor);
  return query.toString();
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
