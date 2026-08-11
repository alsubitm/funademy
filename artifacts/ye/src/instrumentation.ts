/**
 * Next.js instrumentation — runs once when the server process starts.
 *
 * Starts a periodic in-process sweep of stale `initiated` payments so that
 * seats held by abandoned checkouts are released even during quiet periods
 * with no site traffic. (Checkout also sweeps opportunistically, and
 * POST /svc/pay/sweep remains available for external cron pingers.)
 */

const SWEEP_INTERVAL_MS = 10 * 60_000; // every 10 minutes
const INITIAL_DELAY_MS = 60_000; // let the server settle before first sweep

declare global {
  // eslint-disable-next-line no-var
  var __yeSweepTimer: NodeJS.Timeout | undefined;
}

export async function register() {
  // Only in the Node.js server runtime — never in edge/browser bundles,
  // never during `next build`, never inside the vitest suite.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VITEST) return;

  // Guard against duplicate timers on dev-server hot reloads.
  if (globalThis.__yeSweepTimer) return;

  // One-time legacy cutover (Aug 2026): if this database still keeps its data
  // in the old dedicated "ye" schema (production, before its first publish of
  // the public-schema build), move everything into public BEFORE any feature
  // code touches the DB. Instant no-op afterwards.
  //
  // FAIL-CLOSED: once legacy data is positively detected, a failed or aborted
  // cutover must NOT let the server come up — the new Prisma client only sees
  // the public schema, so serving would show families an empty site while the
  // real data sits invisible in "ye". A refused boot is visible (deploy fails,
  // previous release keeps running) and recoverable; silent empty data is not.
  {
    const { prisma } = await import('@/lib/db');
    const { hasLegacyYeSchema, migrateYeSchemaToPublic } = await import('@/lib/migrate-ye-schema');
    let legacy = false;
    try {
      legacy = await hasLegacyYeSchema(prisma);
    } catch (e) {
      // Probe failed — DB unreachable. Nothing data-destructive at stake yet;
      // keep the long-standing boot behavior for DB outages (pages error
      // visibly, static pages still serve) instead of crash-looping the site.
      console.error('[legacy-schema-migration] could not probe for legacy "ye" schema (DB unreachable?):', e);
    }
    if (legacy) {
      const res = await migrateYeSchemaToPublic(prisma); // unexpected errors propagate → boot fails
      if ('aborted' in res && res.aborted) {
        const detail =
          `conflicts (rows on both sides): [${res.conflicts.join(', ')}]; ` +
          `orphans with rows: [${res.orphansWithRows.join(', ')}]`;
        console.error(`[legacy-schema-migration] FATAL: cutover aborted — ${detail}. Refusing to start.`);
        throw new Error(
          `[legacy-schema-migration] one-time ye→public cutover aborted (${detail}). ` +
            `Legacy data was left untouched in the "ye" schema; resolve the listed tables manually ` +
            `(or clear the conflicting public rows) and redeploy.`,
        );
      }
      console.log('[legacy-schema-migration] result:', JSON.stringify(res));
    }
  }

  const runSweep = async () => {
    try {
      const { sweepStalePayments } = await import('@/lib/pay-core');
      const { settled, expired, errors } = await sweepStalePayments();
      if (settled || expired || errors) {
        console.log(`[payments] periodic sweep: settled=${settled} expired=${expired} errors=${errors}`);
      }
    } catch (e) {
      console.error('[payments] periodic sweep failed:', e);
    }
    // NELC production outbox: retry pending real-learner statements. No-op
    // outside the published deployment or without production LRS secrets;
    // logs its own result only when it actually attempted rows.
    try {
      const { flushOutboxServer } = await import('@/lib/xapiOutbox');
      await flushOutboxServer();
    } catch (e) {
      console.error('[nelc-outbox] periodic flush failed:', e);
    }
  };

  // One-time data reconciliation: the academy is online-only (Aug 2026).
  // Converts any leftover in-person programs/slots/runs and stale FAQ copy —
  // idempotent, so it is a no-op once production data is converted.
  const reconcileOnlineOnly = async () => {
    try {
      const { prisma } = await import('@/lib/db');
      const p = await prisma.program.updateMany({ where: { format: 'in_person' }, data: { format: 'online' } });
      const s = await prisma.scheduleSlot.updateMany({ where: { format: 'in_person' }, data: { format: 'online' } });
      const r = await prisma.courseRun.updateMany({ where: { format: 'in_person' }, data: { format: 'online' } });
      await prisma.scheduleSlot.updateMany({ where: { location: { contains: 'Riyadh' } }, data: { location: null } });
      await prisma.courseRun.updateMany({ where: { location: { contains: 'Riyadh' } }, data: { location: null } });
      const f = await prisma.faqEntry.updateMany({
        where: { questionAr: 'هل الحصص أونلاين أم حضورية؟' },
        data: {
          questionEn: 'How are classes delivered?',
          questionAr: 'كيف تُقدَّم الحصص؟',
          answerEn: 'All programs run live online — a real teacher and a small group in every session, open to everyone from anywhere.',
          answerAr: 'جميع البرامج أونلاين — معلّم حقيقي ومجموعة صغيرة في كل حصة، ومتاحة للجميع من أي مكان.',
        },
      });
      const f2 = await prisma.faqEntry.updateMany({
        where: { questionAr: 'هل توفرون مجموعات المكعبات؟', answerAr: { contains: 'الحضورية' } },
        data: {
          answerEn: 'Yes — we guide you to the official e² Young Engineers kit your child needs at home, and building programs ship the kit to your door.',
          answerAr: 'نعم — نرشدك إلى مجموعة e² Young Engineers الرسمية التي يحتاجها طفلك في المنزل، وبرامج البناء تُشحن عدّتها إلى باب منزلك.',
        },
      });
      const t = await prisma.testimonial.updateMany({ where: { area: 'Riyadh' }, data: { area: 'Saudi Arabia' } });
      // Fix stale in-person / "live online" wording inside program texts.
      // Deliberately narrow: exact legacy label values and anchored phrases
      // only — never a bare substring like 'حضوري' (it would corrupt words
      // such as 'الحضورية' and admin-authored copy). Longest phrases first.
      const AR_EXACT: Record<string, string> = {
        'حضوري': 'أونلاين',
        'مباشر أونلاين / حضوري': 'أونلاين',
        'مباشر أونلاين': 'أونلاين',
        'أونلاين مباشر': 'أونلاين',
      };
      const EN_EXACT: Record<string, string> = {
        'In-person': 'Online',
        'Live online / in-person': 'Online',
        'Live online': 'Online',
      };
      const fixAr = (x: string) =>
        (AR_EXACT[x] ?? x)
          .replaceAll('حصص مباشرة أونلاين', 'حصص أونلاين')
          .replaceAll('مباشرة مدتها', 'مدتها')
          .replaceAll('أونلاين أو حضورياً', 'أونلاين بالكامل');
      const fixEn = (x: string) =>
        (EN_EXACT[x] ?? x)
          .replaceAll('live 45-minute classes, online or in person', 'live 45-minute classes, fully online')
          .replaceAll('live sessions', 'sessions')
          .replaceAll('Live online', 'Online')
          .replaceAll('live online', 'online');
      let textFixed = 0;
      for (const prog of await prisma.program.findMany()) {
        const data = {
          termsAr: prog.termsAr.map(fixAr),
          termsEn: prog.termsEn.map(fixEn),
          descAr: fixAr(prog.descAr),
          descEn: fixEn(prog.descEn),
          taglineAr: fixAr(prog.taglineAr),
          taglineEn: fixEn(prog.taglineEn),
        };
        const before = { termsAr: prog.termsAr, termsEn: prog.termsEn, descAr: prog.descAr, descEn: prog.descEn, taglineAr: prog.taglineAr, taglineEn: prog.taglineEn };
        if (JSON.stringify(data) !== JSON.stringify(before)) {
          await prisma.program.update({ where: { id: prog.id }, data });
          textFixed++;
        }
      }
      for (const faq of await prisma.faqEntry.findMany()) {
        const answerAr = fixAr(faq.answerAr);
        if (answerAr !== faq.answerAr) {
          await prisma.faqEntry.update({ where: { id: faq.id }, data: { answerAr } });
          textFixed++;
        }
      }
      if (p.count || s.count || r.count || f.count || f2.count || t.count) {
        console.log(`[online-only] reconciled: programs=${p.count} slots=${s.count} runs=${r.count} faqs=${f.count + f2.count}`);
      }
    } catch (e) {
      console.error('[online-only] reconciliation failed:', e);
    }
  };
  void reconcileOnlineOnly();

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never keep the process alive just for the sweep
  globalThis.__yeSweepTimer = timer;

  const kickoff = setTimeout(runSweep, INITIAL_DELAY_MS);
  kickoff.unref?.();

  console.log('[payments] periodic stale-payment sweep scheduled (every 10 min)');
}
