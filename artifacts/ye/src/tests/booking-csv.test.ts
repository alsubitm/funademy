import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { csvCell } from '@/lib/csv';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  bookings: vi.fn(),
  appointments: vi.fn(),
  count: vi.fn(),
}));
vi.mock('@/lib/db', () => {
  const prisma = {
    booking: { findMany: mocks.bookings, count: mocks.count, findFirst: vi.fn(async () => null) },
    appointment: { findMany: mocks.appointments },
    program: { findMany: vi.fn(async () => []) },
  };
  return { prisma: { ...prisma, $transaction: (fn: (tx: typeof prisma) => unknown) => fn(prisma) } };
});
vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: mocks.requireAdmin }));
import { GET } from '@/app/(ar)/svc/admin/bookings/route';

describe('spreadsheet-safe CSV cells', () => {
  it.each([
    '=HYPERLINK("https://example.invalid","click")', '+SUM(1,2)',
    '-1+2', '@SUM(1,2)', '  =1+1', '\t=1+1', '\r=1+1',
    '\n=1+1', '\u0000=1+1', '\uFEFF=1+1', '\tplain', '\rplain', '\nplain',
  ])('neutralizes %j without removing its content', (value) => {
    expect(csvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
  });

  it.each(['سارة أحمد', 'O\'Brien', 'Anne-Marie', 'a,b', 'a"b', 'a\nb', 'a\r\nb', 'a,=1', 'a\tb'])(
    'preserves ordinary text and CSV delimiters in %j', (value) => {
      expect(csvCell(value)).toBe(`"${value.replace(/"/g, '""')}"`);
    },
  );
  it('handles empty and scalar cells', () => {
    expect([null, undefined, '', 2020, true].map(csvCell))
      .toEqual(['""', '""', '""', '"2020"', '"true"']);
    expect(csvCell('+966500000000')).toBe(`"'+966500000000"`);
  });
});

describe('admin booking export', () => {
  const stored = {
    id: 1, createdAt: new Date('2026-01-01T00:00:00Z'),
    parentName: '=HYPERLINK("https://example.invalid","click")',
    childFirstName: ' \t@SUM(1,2)', phone: '+966500000000',
    email: '+formula@example.com', contactChannel: 'email',
    contactConsentAt: null, childBirthYear: 2020,
    program: { nameEn: '-1+1', slug: 'test' },
    assignedTo: '=1+1', trialAttendance: 'pending', status: 'new',
    communications: [], conversionItem: null,
  };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdmin.mockResolvedValue(null);
    mocks.bookings.mockResolvedValue([stored]);
    mocks.appointments.mockResolvedValue([]);
    mocks.count.mockResolvedValue(1);
  });

  it('neutralizes stored values in the actual CSV response', async () => {
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'));
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toContain('ye-bookings.csv');
    const csv = await response.text();
    for (const value of [stored.parentName, stored.childFirstName, stored.phone, stored.email, stored.program.nameEn, stored.assignedTo]) {
      expect(csv).toContain(csvCell(value));
    }
    expect(csv.split('\n')[0].split(',')).toHaveLength(17);
  });

  it('leaves JSON and stored values unchanged', async () => {
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings'));
    const { bookings } = await response.json();
    expect(bookings[0].parentName).toBe(stored.parentName);
    expect(bookings[0].childFirstName).toBe(stored.childFirstName);
  });

  it('still rejects unauthenticated CSV requests before querying bookings', async () => {
    mocks.requireAdmin.mockResolvedValue(NextResponse.json({ error: 'unauthorized' }, { status: 401 }));
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'));
    expect(response.status).toBe(401);
    expect(mocks.bookings).not.toHaveBeenCalled();
  });

  it('stops reading bookings when the download is interrupted', async () => {
    const chunk = (from: number) => Array.from({ length: 500 }, (_, i) => ({ ...stored, id: from - i }));
    mocks.bookings.mockImplementation(async ({ where }: any) => chunk(where?.id?.lt ? where.id.lt - 1 : 5000));
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'));
    const reader = response.body!.getReader();
    await reader.read(); // header
    await reader.read(); // first chunk
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const calls = mocks.bookings.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.bookings.mock.calls.length).toBe(calls);
  });

  it('fails the download instead of delivering a truncated file when a chunk read fails', async () => {
    mocks.bookings
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => ({ ...stored, id: 1000 - i })))
      .mockRejectedValueOnce(new Error('connection lost'));
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'));
    await expect(response.text()).rejects.toThrow('connection lost');
  });
});
