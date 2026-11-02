import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Seed client view state without browser effects, authentication, or payment calls.
// Keep the real components and ClassroomLocation rendering (not a stub).
const state = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return {
    ...react,
    useState: (initial: unknown) => {
      const index = state.index++;
      const value = index < state.values.length
        ? state.values[index]
        : typeof initial === 'function' ? initial() : initial;
      return [value, vi.fn()];
    },
  };
});
vi.mock('@/components/account/AccountFlow', () => ({ AccountFlow: () => null }));
vi.mock('@/components/portal/MakeupButton', () => ({ MakeupButton: () => null }));
vi.mock('@/components/portal/RenewButton', () => ({ RenewButton: () => null }));
vi.mock('@/lib/db', () => ({
  isTransientDatabaseError: () => false,
  prisma: Object.fromEntries([
    'student', 'enrollment', 'attendance', 'studentSkill', 'makeupRequest',
    'studentBadge', 'skill', 'family', 'appointment', 'payment',
  ].map((name) => [name, { findMany: vi.fn(), findUnique: vi.fn() }])),
}));
vi.mock('@/lib/portal-sessions', () => ({ portalSessions: vi.fn(), joinUrlFor: () => null }));
vi.mock('@/lib/appointments', () => ({ formatRiyadh: () => '10:00' }));
vi.mock('@/lib/payments', () => ({
  moyasarLive: () => false, tamaraLive: () => false,
  paymentAvailability: async () => ({ moyasar: false, tamara: false }),
}));

import { ClassroomLocation } from '@/components/ClassroomLocation';
import { BookingFlow } from '@/components/book/BookingFlow';
import { EnrollFlow } from '@/components/enroll/EnrollFlow';
import { PortalView } from '@/components/portal/PortalView';
import { prisma } from '@/lib/db';
import { portalSessions } from '@/lib/portal-sessions';

type Lang = 'ar' | 'en';
const venue = 'Example Centre & Hall #2';
// Independent expectations: don't derive these from the helpers under test.
const cityUrl = 'https://www.google.com/maps/search/?api=1&query=Riyadh%2C%20Saudi%20Arabia';
const venueUrl = 'https://www.google.com/maps/search/?api=1&query=Example%20Centre%20%26%20Hall%20%232%2C%20Riyadh%2C%20Saudi%20Arabia';
const cityLabel = { ar: 'خريطة الرياض (ليست موقع المقر)', en: 'Riyadh map (not the exact venue)' };
const venueLabel = { ar: 'البحث عن المقر في الخرائط', en: 'Search for venue on Maps' };
const program = { id: 1, slug: 'test', nameAr: 'برنامج تجريبي', nameEn: 'Test program', ageMin: 4, ageMax: 18, color: '#fff', kitCode: 'T' };
const student = { id: 1, firstName: 'Test child', birthYear: new Date().getFullYear() - 8 };
const run = (location: string | null, id = 12) => ({
  id, programId: 1, program, titleAr: null, titleEn: null,
  weekday: 1, time: '16:00', format: 'in_person', location, seatsLeft: 5, monthlyPriceSar: 100,
});
const escape = (value: string) => value.replaceAll('&', '&amp;');

function checkLocation(html: string, lang: Lang, location: string | null, count = 1) {
  const city = location === null || location === 'Riyadh' || location === 'الرياض';
  const url = escape(city ? cityUrl : venueUrl);
  const anchors = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)]
    .map(([anchor]) => anchor).filter((anchor) => anchor.includes(`href="${url}"`));
  expect(anchors).toHaveLength(count);
  for (const anchor of anchors) {
    expect(anchor).toContain(city ? cityLabel[lang] : venueLabel[lang]);
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer"');
  }
  if (!city) expect(html).toContain(escape(venue));
  // Inspect rendered button contents, not source text, including nested spans/divs.
  for (const [button] of html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)) {
    expect(button).not.toMatch(/<a\b/);
  }
}

function renderClient(element: ReactElement, values: unknown[]) {
  state.values = values;
  state.index = 0;
  return renderToStaticMarkup(element);
}

// PortalView contains async server children. Resolve only those children before
// static rendering; synchronous components (including ClassroomLocation) stay real.
async function resolveServerChildren(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServerChildren));
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (typeof node.type === 'function' && node.type.constructor.name === 'AsyncFunction') {
    return resolveServerChildren(await (node.type as (props: unknown) => Promise<ReactNode>)(node.props));
  }
  if (!node.props.children) return node;
  return createElement(node.type, { ...node.props, key: node.key }, await resolveServerChildren(node.props.children));
}

afterEach(() => {
  state.values = [];
  state.index = 0;
  vi.clearAllMocks();
});

describe.each(['ar', 'en'] as const)('classroom location rendering (%s)', (lang) => {
  it.each([null, 'Riyadh', 'الرياض'])('labels city-only links honestly: %s', (location) => {
    checkLocation(renderToStaticMarkup(createElement(ClassroomLocation, { lang, location })), lang, location);
  });

  it('shows a city map before trial phone verification', () => {
    checkLocation(renderClient(createElement(BookingFlow, { lang, programs: [program], slots: [] }), []), lang, null);
  });

  for (const location of [null, 'Riyadh', 'الرياض', venue]) {
    it.each([2, 4])(`keeps the selected trial location at step %s (${location})`, (step) => {
      const html = renderClient(createElement(BookingFlow, {
        lang, programs: [program], slots: [run('Wrong venue', 11), run(location)],
      }), [
        step, 1, 12, null, 'Parent', '', 'Child', '2018', '', true, null, '', true,
      ]);
      expect(html).toContain(step === 2 ? 'slot-list' : 'success-box');
      if (step === 2) expect(html).toContain('class="slot-item sel"');
      checkLocation(html, lang, location);
      if (step === 4) expect(html).not.toContain('Wrong venue');
    });

    it.each([false, true])(`keeps enrollment location in selection/confirmation done=%s (${location})`, (confirmed) => {
      const done = confirmed ? {
        reference: 'TEST-REF', totalSar: 100, discountSar: 0, simulated: false,
        items: [{ studentId: 1, courseRunId: 12, studentName: 'Test child',
          programNameAr: program.nameAr, programNameEn: program.nameEn, totalSar: 100 }],
      } : null;
      const html = renderClient(createElement(EnrollFlow, { lang }), [
        false, true, [student], [run('Wrong venue', 11), run(location)],
        { items: [], subtotalSar: 0, discountSar: 0, totalSar: 0 },
        1, 'moyasar_mada', false, null, done,
      ]);
      expect(html).toContain(confirmed ? 'enr-done' : 'enr-runs');
      checkLocation(html, lang, location);
      if (confirmed) expect(html).not.toContain('Wrong venue');
    });
  }

  it.each([null, venue])('renders locations in all portal surfaces (%s)', async (location) => {
    for (const model of Object.values(prisma)) {
      if (model && typeof model === 'object' && 'findMany' in model && vi.isMockFunction(model.findMany)) {
        model.findMany.mockResolvedValue([]);
      }
    }
    vi.mocked(prisma.student.findMany).mockResolvedValue([student] as never);
    vi.mocked(prisma.family.findUnique).mockResolvedValue({ id: 1, phone: 'test-only' } as never);
    const courseRun = run(location);
    const session = { id: 1, date: new Date('2099-01-01'), status: 'scheduled', courseRun };
    const makeupSession = { ...session, id: 2, date: new Date('2099-01-02') };
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{
      id: 1, status: 'active', monthlyPriceSar: 100, discountPct: 0,
      paidThrough: new Date('2099-02-01'), courseRun, student,
    }] as never);
    vi.mocked(prisma.makeupRequest.findMany).mockResolvedValue([{
      id: 1, sessionId: 1, status: 'approved', session, makeupSession,
    }] as never);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{
      id: 1, kind: 'trial', startsAt: new Date('2099-01-03'), meetUrl: null,
    }] as never);
    vi.mocked(portalSessions).mockResolvedValue({ upcoming: [session], recorded: [] } as never);
    const html = renderToStaticMarkup(await resolveServerChildren(await PortalView({ lang, familyId: 1 })));
    // Hero + enrollment + regular upcoming + makeup upcoming + makeup details,
    // plus the trial appointment's explicit city-only map.
    checkLocation(html, lang, location, location === null ? 6 : 5);
    if (location !== null) checkLocation(html, lang, null);
    for (const marker of ['ptl-next', 'ptl-enr', 'id="upcoming"', 'ptl-mk-row']) {
      expect(html).toContain(marker);
    }
  });
});
