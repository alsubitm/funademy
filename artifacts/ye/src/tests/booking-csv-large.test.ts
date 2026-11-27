import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: vi.fn(async () => null) }));
import { GET } from '@/app/(ar)/svc/admin/bookings/route';

const tag = `csv-large-${Date.now()}`;
const COUNT = 1234;
let programId: number;

beforeAll(async () => {
  const program = await prisma.program.create({ data: {
    slug: tag, kitCode: 'KIT-01', nameEn: tag, nameAr: tag, ageMin: 4, ageMax: 14,
    format: 'online', color: '#123456', level: 1, taglineEn: '', taglineAr: '',
    descEn: '', descAr: '', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
  } });
  programId = program.id;
  const slotId = (await prisma.scheduleSlot.create({ data: {
    programId, weekday: 1, time: '17:00', format: 'online', capacity: 12, seatsLeft: 12,
  } })).id;
  await prisma.booking.createMany({ data: Array.from({ length: COUNT }, (_, i) => ({
    programId, slotId, parentName: i % 2 ? `=${tag}-${i}` : `${tag}-${i}`, phone: '+966500000000',
    childFirstName: 'طفل', childBirthYear: 2018, neighborhood: 'riyadh',
  })) });
});
afterAll(async () => {
  if (!programId) return;
  await prisma.booking.deleteMany({ where: { programId } });
  await prisma.scheduleSlot.deleteMany({ where: { programId } });
  await prisma.program.delete({ where: { id: programId } });
});

describe('large booking CSV export', () => {
  it('streams every booking in bounded chunks, newest first, with safe cells', async () => {
    const spy = vi.spyOn(prisma.booking, 'findMany');
    const response = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv&bq=nothing&limit=1'));
    expect(response.status).toBe(200);
    const csv = await response.text();
    const takes = spy.mock.calls.map(([args]) => (args as any)?.take);
    spy.mockRestore();
    expect(takes.length).toBeGreaterThanOrEqual(3);
    expect(takes.every((take) => take === 500)).toBe(true);
    const lines = csv.split('\n');
    expect(lines[0].split(',')).toHaveLength(17);
    expect(lines).toHaveLength((await prisma.booking.count()) + 1);
    const ids = lines.slice(1).map((line) => Number(JSON.parse(line.split(',')[0])));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(lines.filter((line) => line.includes(`,"${tag}-`))).toHaveLength(COUNT / 2);
    expect(lines.filter((line) => line.includes(`,"'=${tag}-`))).toHaveLength(COUNT / 2);
  });

  it('can be interrupted mid-download and a fresh download still succeeds', async () => {
    const spy = vi.spyOn(prisma.booking, 'findMany');
    const first = await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'));
    const reader = first.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const afterCancel = spy.mock.calls.length;
    expect(afterCancel).toBeLessThanOrEqual(2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(spy.mock.calls.length).toBe(afterCancel);
    spy.mockRestore();

    const again = await (await GET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'))).text();
    expect(again.split('\n')).toHaveLength((await prisma.booking.count()) + 1);
  });
});
