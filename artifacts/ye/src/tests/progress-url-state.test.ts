import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRunById, parseRunParam } from '@/components/admin/RunPicker';
import { setAdminParams } from '@/components/admin/useAdminQuery';

const run = (id: number) => ({ id, titleAr: `دفعة ${id}`, time: '17:00', startDate: '2026-01-01', program: { id: 1, nameAr: 'برنامج' } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('progress tab URL state', () => {
  it('accepts only positive int4 IDs from the URL', () => {
    expect(parseRunParam('42')).toBe(42);
    for (const bad of [null, '', '0', '-1', '#4', '4a', '01', '2147483648']) expect(parseRunParam(bad)).toBeNull();
  });

  it('stores run and student with fresh history state, and a new run clears the student', () => {
    const location = new URL('https://example.invalid/admin?tab=progress&bq=x');
    const navigate = vi.fn((_s, _t, next: string) => { location.href = new URL(next, location).href; });
    vi.stubGlobal('window', { location, history: { state: { __NA: true }, pushState: navigate, replaceState: navigate }, dispatchEvent: vi.fn() });
    setAdminParams({ prun: '7', pstudent: null }, 'push');
    setAdminParams({ pstudent: '3' }, 'push');
    expect(location.searchParams.get('prun')).toBe('7');
    expect(location.searchParams.get('pstudent')).toBe('3');
    setAdminParams({ prun: '9', pstudent: null }, 'push');
    expect(location.searchParams.get('prun')).toBe('9');
    expect(location.searchParams.has('pstudent')).toBe(false);
    expect(location.searchParams.get('bq')).toBe('x');
    for (const call of navigate.mock.calls) expect(call[0]).toEqual({});
  });
});

describe('fetchRunById', () => {
  it('resolves via rq=#id and pages past text matches with higher IDs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ runs: [run(90), run(80)], nextCursor: 'next:80' }))
      .mockResolvedValueOnce(json({ runs: [run(50), run(12)], nextCursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchRunById(50)).toEqual(run(50));
    const first = new URL(fetchMock.mock.calls[0][0], 'http://x');
    expect(first.pathname).toBe('/svc/admin/runs');
    expect(first.searchParams.get('options')).toBe('1');
    expect(first.searchParams.get('rq')).toBe('#50');
    expect(new URL(fetchMock.mock.calls[1][0], 'http://x').searchParams.get('cursor')).toBe('next:80');
  });

  it('returns null for missing/inactive runs without paging further', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ runs: [run(90), run(40)], nextCursor: 'next:40' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchRunById(50)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on request failures so the UI can offer a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ error: 'x' }, 500)));
    await expect(fetchRunById(5)).rejects.toThrow();
  });
});

describe('studentUrlAction across class navigation', () => {
  it('Back from class B to A/X waits for A\'s roster instead of erasing X', async () => {
    const { studentUrlAction } = await import('@/components/admin/ProgressTab');
    // URL already restored to A(1)/X(10); state still shows B(2) with its roster.
    expect(studentUrlAction({ urlRun: 1, urlStudent: 10, runId: 2, rosterRunId: 2, rosterStudentIds: [20], currentStudentId: null })).toBe('wait');
    // Run A resolved but its roster has not loaded yet.
    expect(studentUrlAction({ urlRun: 1, urlStudent: 10, runId: 1, rosterRunId: 2, rosterStudentIds: [20], currentStudentId: null })).toBe('wait');
    // A's roster loaded: X is restored.
    expect(studentUrlAction({ urlRun: 1, urlStudent: 10, runId: 1, rosterRunId: 1, rosterStudentIds: [10, 11], currentStudentId: null })).toBe('load');
    expect(studentUrlAction({ urlRun: 1, urlStudent: 10, runId: 1, rosterRunId: 1, rosterStudentIds: [10, 11], currentStudentId: 10 })).toBe('keep');
    // Forward to B/Y behaves the same way.
    expect(studentUrlAction({ urlRun: 2, urlStudent: 20, runId: 1, rosterRunId: 1, rosterStudentIds: [10, 11], currentStudentId: 10 })).toBe('wait');
    expect(studentUrlAction({ urlRun: 2, urlStudent: 20, runId: 2, rosterRunId: 2, rosterStudentIds: [20], currentStudentId: null })).toBe('load');
  });
  it('clears only a student absent from the matching roster, and shows none without a param', async () => {
    const { studentUrlAction } = await import('@/components/admin/ProgressTab');
    expect(studentUrlAction({ urlRun: 1, urlStudent: 99, runId: 1, rosterRunId: 1, rosterStudentIds: [10], currentStudentId: null })).toBe('clear');
    expect(studentUrlAction({ urlRun: 1, urlStudent: null, runId: 1, rosterRunId: 1, rosterStudentIds: [10], currentStudentId: 10 })).toBe('none');
  });
});
