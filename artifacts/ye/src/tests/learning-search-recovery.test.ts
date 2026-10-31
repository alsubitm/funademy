import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  effect: undefined as undefined | (() => void | (() => void)),
  pathname: '/learn/1/search',
}));

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function'
        ? value(harness.states[index]) : value;
    }];
  },
  useEffect: (effect: () => void | (() => void)) => { harness.effect = effect; },
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ childId: '1' }),
  useSearchParams: () => new URLSearchParams('q=robot'),
  usePathname: () => harness.pathname,
}));
vi.mock('next/link', () => ({ default: 'a' }));

import LearningSearchPage from '../app/(ar)/learn/[childId]/search/page';

function startSearch() {
  harness.cursor = 0;
  LearningSearchPage();
  return harness.effect?.();
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.states = [];
  harness.pathname = '/learn/1/search';
  vi.stubGlobal('window', { location: { href: '' } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('learning search session recovery', () => {
  it.each([
    ['/learn/1/search', '/learn'],
    ['/en/learn/1/search', '/en/learn'],
  ])('returns %s to localized child selection and clears prior results', async (pathname, destination) => {
    harness.pathname = pathname;
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1 }] })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetch);
    const cleanup = startSearch();
    await vi.advanceTimersByTimeAsync(300);
    expect(harness.states[1]).toEqual([{ id: 1 }]);
    cleanup?.();
    startSearch();
    expect(harness.states[1]).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(window.location.href).toBe(destination);
    expect(harness.states[1]).toEqual([]);
    expect(harness.states[2]).not.toBe('error');
  });

  it.each(['server', 'network'])('preserves retry recovery for %s failures', async (failure) => {
    const fetch = vi.fn();
    if (failure === 'server') fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    else fetch.mockRejectedValueOnce(new Error('offline'));
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 2 }] });
    vi.stubGlobal('fetch', fetch);
    const cleanup = startSearch();
    await vi.advanceTimersByTimeAsync(300);
    expect(harness.states[2]).toBe('error');
    expect(window.location.href).toBe('');
    cleanup?.();
    startSearch();
    await vi.advanceTimersByTimeAsync(300);
    expect(harness.states[2]).toBe('idle');
    expect(harness.states[1]).toEqual([{ id: 2 }]);
  });

  it('ignores an expired response from an aborted search', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    const cleanup = startSearch();
    vi.advanceTimersByTime(300);
    cleanup?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(window.location.href).toBe('');
  });
});
