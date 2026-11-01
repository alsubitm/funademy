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
      const { sweepAbuseRetention } = await import('@/lib/abuse-retention');
      await sweepAbuseRetention();
    } catch (e) {
      console.error('[abuse-retention] periodic cleanup failed:', e);
    }
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
    // Keep the Google connector out of the instrumentation bundle (its SDK
    // depends on node:child_process, which Next's instrumentation compiler
    // cannot bundle). The protected localhost route owns the actual worker.
    try {
      const port = process.env.PORT;
      const secret = process.env.SESSION_SECRET;
      if (port && secret) {
        const res = await fetch(`http://127.0.0.1:${port}/svc/trial-followups/sweep`, {
          method: 'POST',
          headers: { 'x-internal-sweep': secret },
        });
        if (!res.ok) console.error(`[trial-followup] periodic delivery returned ${res.status}`);
      }
    } catch (e) {
      console.error('[trial-followup] periodic delivery failed:', e);
    }
  };

  // The academy confirmed that all classes are delivered in person.
  // Correct legacy delivery flags/copy without touching seats, prices or locations.
  const reconcileInPerson = async () => {
    try {
      const { prisma } = await import('@/lib/db');
      const p = await prisma.program.updateMany({ where: { format: 'online' }, data: { format: 'in_person' } });
      const s = await prisma.scheduleSlot.updateMany({ where: { format: 'online' }, data: { format: 'in_person' } });
      const r = await prisma.courseRun.updateMany({ where: { format: 'online' }, data: { format: 'in_person' } });
      const f = await prisma.faqEntry.updateMany({
        where: { questionAr: { in: ['هل الحصص أونلاين أم حضورية؟', 'كيف تُقدَّم الحصص؟'] } },
        data: {
          questionEn: 'How are classes delivered?',
          questionAr: 'كيف تُقدَّم الحصص؟',
          answerEn: 'All programs are in-person classes in Riyadh. Contact us for current locations and schedules.',
          answerAr: 'جميع البرامج حضورية في الرياض. تواصل معنا لمعرفة المواقع والمواعيد الحالية.',
        },
      });
      const f2 = await prisma.faqEntry.updateMany({
        where: { questionAr: 'هل توفرون مجموعات المكعبات؟' },
        data: {
          answerEn: 'Contact us for the equipment requirements for your chosen in-person program.',
          answerAr: 'تواصل معنا لمعرفة متطلبات العدة للبرنامج الحضوري الذي تختاره.',
        },
      });
      await prisma.faqEntry.updateMany({
        where: { OR: [{ questionAr: { contains: 'الأونلاين' } }, { questionEn: { contains: 'online classes', mode: 'insensitive' } }] },
        data: {
          questionAr: 'أين تُقام الحصص؟', questionEn: 'Where are classes held?',
          answerAr: 'تُقام الحصص حضورياً في الرياض. تواصل معنا لتأكيد موقع البرنامج ومواعيده.',
          answerEn: 'Classes take place in person in Riyadh. Contact us to confirm your program location and schedule.',
        },
      });
      // Fix stale in-person / "live online" wording inside program texts.
      // Deliberately narrow: exact legacy label values and anchored phrases
      // only — never a bare substring like 'حضوري' (it would corrupt words
      // such as 'الحضورية' and admin-authored copy). Longest phrases first.
      const AR_EXACT: Record<string, string> = {
        'أونلاين': 'حضوري في الرياض',
        'مباشر أونلاين / حضوري': 'حضوري في الرياض',
        'مباشر أونلاين': 'حضوري في الرياض',
        'أونلاين مباشر': 'حضوري في الرياض',
      };
      const EN_EXACT: Record<string, string> = {
        'Online': 'In-person in Riyadh',
        'Live online / in-person': 'In-person in Riyadh',
        'Live online': 'In-person in Riyadh',
      };
      const fixAr = (x: string) =>
        (AR_EXACT[x] ?? x)
          .replaceAll('أونلاين أو حضورياً', 'حضورياً في الرياض')
          .replaceAll('أونلاين بالكامل', 'حضورياً في الرياض')
          .replaceAll('حصص أونلاين', 'حصص حضورية')
          .replaceAll('أونلاين', 'حضوري');
      const fixEn = (x: string) =>
        (EN_EXACT[x] ?? x)
          .replaceAll('online or in person', 'in person in Riyadh')
          .replaceAll('fully online', 'in person in Riyadh')
          .replace(/\blive online\b/gi, 'in-person')
          .replace(/\bonline sessions\b/gi, 'in-person sessions')
          .replace(/\bonline classes\b/gi, 'in-person classes');
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
      if (p.count || s.count || r.count || textFixed) {
        console.log(`[in-person] reconciled: programs=${p.count} slots=${s.count} runs=${r.count} texts=${textFixed}`);
      }
    } catch (e) {
      console.error('[in-person] reconciliation failed:', e);
    }
  };
  void reconcileInPerson();

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never keep the process alive just for the sweep
  globalThis.__yeSweepTimer = timer;

  const kickoff = setTimeout(runSweep, INITIAL_DELAY_MS);
  kickoff.unref?.();

  console.log('[payments] periodic stale-payment sweep scheduled (every 10 min)');
}
