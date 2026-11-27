import type { Prisma } from '@prisma/client';

/** Immutable ID keysets: inserts/deletes and edits to dates/status cannot shift offsets.
 * Counts are live, not a frozen snapshot; a record can enter/leave a filter after an edit.
 */
export function listPage(params: URLSearchParams) {
  const raw = params.get('cursor') ?? '';
  const match = /^(next|prev):([1-9]\d{0,9})$/.exec(raw);
  if (raw && (!match || Number(match[2]) > 2147483647)) throw new Error('invalid_cursor');
  const limit = params.get('limit') ?? '25';
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) throw new Error('invalid_limit');
  const direction = match?.[1] ?? 'next';
  const edge = match ? Number(match[2]) : null;
  return {
    take: Number(limit),
    edge,
    direction,
    id: edge === null ? {} : direction === 'prev' ? { gt: edge } : { lt: edge },
    orderBy: { id: direction === 'prev' ? 'asc' as const : 'desc' as const },
  };
}

export function pageRows<T extends { id: number }>(rows: T[], page: ReturnType<typeof listPage>) {
  return page.direction === 'prev' ? [...rows].reverse() : rows;
}

function term(params: URLSearchParams, key: string) {
  const value = (params.get(key) ?? '').trim();
  if (value.length > 200) throw new Error('invalid_search');
  // Prisma contains uses SQL LIKE patterns. Treat the administrator's input literally.
  return value.replace(/[\\%_]/g, '\\$&');
}

function program(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value || value === 'all') return {};
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) throw new Error('invalid_program');
  return { programId: Number(value) };
}

function choice(params: URLSearchParams, key: string, choices: string[]) {
  const value = params.get(key) ?? 'all';
  if (!choices.includes(value)) throw new Error(`invalid_${key}`);
  return value;
}

export const paidTrial: Prisma.BookingWhereInput = { conversionItem: { is: { payment: { status: 'paid' } } } };

export function bookingFilter(params: URLSearchParams): Prisma.BookingWhereInput {
  const status = choice(params, 'bstatus', ['all', 'new', 'contacted', 'enrolled', 'converted']);
  const owner = choice(params, 'bowner', ['all', 'assigned', 'unassigned']);
  const q = term(params, 'bq');
  const text = { contains: q, mode: 'insensitive' as const };
  return {
    ...program(params, 'bprogram'),
    AND: [
      ...(status === 'converted' ? [paidTrial] : status === 'all' ? [] : [{ status: status as 'new' | 'contacted' | 'enrolled', NOT: paidTrial }]),
      ...(owner === 'all' ? [] : [owner === 'assigned' ? { NOT: { assignedTo: { equals: '' } } } : { assignedTo: '' }]),
      ...(q ? [{ OR: [
        { childFirstName: text }, { parentName: text }, { phone: text }, { email: text }, { assignedTo: text },
        { program: { nameAr: text } }, { program: { nameEn: text } },
      ] }] : []),
    ],
  };
}

export function runFilter(params: URLSearchParams): Prisma.CourseRunWhereInput {
  const state = choice(params, 'rstate', ['all', 'active', 'inactive']);
  const seats = choice(params, 'rseats', ['all', 'available', 'full']);
  const q = term(params, 'rq');
  const text = { contains: q, mode: 'insensitive' as const };
  return {
    ...program(params, 'rprogram'),
    ...(state === 'all' ? {} : { active: state === 'active' }),
    ...(seats === 'all' ? {} : { seatsLeft: seats === 'full' ? { lte: 0 } : { gt: 0 } }),
    ...(q ? { OR: [{ titleAr: text }, { location: text }, { time: text }, { program: { nameAr: text } }] } : {}),
  };
}
