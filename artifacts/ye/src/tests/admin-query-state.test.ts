import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminListQuery, setAdminParams } from '@/components/admin/useAdminQuery';

function browser(url: string) {
  const location = new URL(url);
  const navigate = vi.fn((_state, _title, next: string) => {
    const target = new URL(next, location);
    location.href = target.href;
  });
  vi.stubGlobal('window', {
    location,
    history: { state: { next: 'preserved' }, pushState: navigate, replaceState: navigate },
    dispatchEvent: vi.fn(),
  });
  return { location, navigate };
}
afterEach(() => vi.unstubAllGlobals());

describe('URL-backed admin list state', () => {
  it('sends only the selected panel filters and its cursor', () => {
    const params = new URLSearchParams('tab=runs&bq=child&bstatus=new&bcursor=next:20&rq=class&rstate=active&rseats=full&rprogram=4&rcursor=prev:7');
    expect(adminListQuery(params, 'b')).toBe('bq=child&bstatus=new&cursor=next%3A20');
    expect(adminListQuery(params, 'r')).toBe('rq=class&rstate=active&rseats=full&rprogram=4&cursor=prev%3A7');
    expect(adminListQuery(new URLSearchParams('bstatus=unknown&bowner=bad'), 'b')).toBe('');
  });
  it('resets booking paging when filters change without losing run state or the hash', () => {
    const { location, navigate } = browser('https://example.invalid/admin?tab=bookings&bcursor=next:20&rq=class&rcursor=prev:4#list');
    setAdminParams({ bq: 'سارة' });
    expect(location.searchParams.get('bq')).toBe('سارة');
    expect(location.searchParams.has('bcursor')).toBe(false);
    expect(location.searchParams.get('rcursor')).toBe('prev:4');
    expect(location.searchParams.get('rq')).toBe('class');
    expect(location.hash).toBe('#list');
    // Fresh state (no Next.js internal marker) lets the app router sync the new URL;
    // forwarding its old state made a later router commit restore stale filters.
    expect(navigate).toHaveBeenCalledWith({}, '', expect.any(String));
    expect(navigate.mock.calls[0][0]).not.toBe(window.history.state);
  });
  it('resets run paging on filter/clear, but page navigation keeps its filters', () => {
    const { location } = browser('https://example.invalid/admin?tab=runs&rq=class&rcursor=next:20&bowner=assigned&bcursor=next:9');
    setAdminParams({ rseats: 'full' });
    expect(location.searchParams.has('rcursor')).toBe(false);
    setAdminParams({ rcursor: 'next:10' }, 'push');
    expect(location.searchParams.get('rseats')).toBe('full');
    expect(location.searchParams.get('rcursor')).toBe('next:10');
    setAdminParams({ rq: null, rseats: 'all' });
    expect(location.searchParams.has('rq')).toBe(false);
    expect(location.searchParams.has('rseats')).toBe(false);
    expect(location.searchParams.has('rcursor')).toBe(false);
    expect(location.searchParams.get('bcursor')).toBe('next:9');
  });
});
