'use client';

import { useState, useEffect, useCallback } from 'react';

import {
  classifyJourneyStatement,
  classifyPrecheckResponse,
  isLrsReadDenied,
  missingJourneySteps,
  type PrecheckOutcome,
} from '@/lib/xapiParity';

/**
 * Admin «نيلك» tab — fires the NELC LRS test journey (wizard step 2:
 * «تشغيل اختبار التحقق») and reviews the permanent statement log.
 *
 * HOW SENDING WORKS: NELC's WAF geo-blocks our server egress (non-Saudi IP),
 * so the server only PREPARES the 10 statements (fresh UUIDs + LRS URL +
 * Basic auth — released only after the owner re-enters the admin password);
 * THIS BROWSER — the owner's device inside Saudi Arabia — POSTs them to the
 * LRS one by one, then reports the results back for the audit log. Reported
 * outcomes are stored labeled source='browser' (unverified server-side): the
 * authoritative delivery check is NELC's own wizard («بدء الاختبار»).
 *
 * SELF-CHECK (read-back): the same step-up + browser-relay pattern, but
 * READ-ONLY — the browser GETs the stored statements for the entered learner
 * + course straight from the LRS (agent + activity filter), classifies each
 * one against the per-step journey contracts via the shared classifier
 * (xapiParity — only contract-conforming statements count for NELC's
 * verifier) and shows the stored count, the conforming count, journey step
 * coverage and the verb list, so future runs can be confirmed without
 * burning a wizard verification attempt. Each check is recorded as one
 * distinguishable audit row (verb='self_check').
 *
 * SEQ003 (duplicates): NELC's verifier rejects re-sent journeys for the same
 * learner+course and demands a fresh national ID per verification attempt,
 * so `prepare` answers 409 duplicate_journey when the entered ID already has
 * a delivered row — surfaced here as an explicit warning with an opt-in
 * override instead of a silent re-send.
 *
 * PRE-SEND BURNED-ID CHECK (SEQ003 layer 2): our audit log is
 * PER-ENVIRONMENT while NELC's LRS is ONE shared store (a journey sent from
 * the dev preview looks "clean" on the published site and vice versa — this
 * burned a real ID on 2026-08-10). So before `prepare`, the browser asks the
 * LRS itself (agent-only query — any course, any environment) whether the ID
 * already has statements. Burned ⇒ red prompt whose override requires TYPING
 * the national ID; check failed (read-denied — our credentials are
 * write-only, so this is the common case — or network) ⇒ explicit
 * «تعذّر الفحص المسبق» confirmation; clean ⇒ send proceeds with no extra
 * step. FAIL-CLOSED via xapiParity.classifyPrecheckResponse: an error is
 * never a silent pass. The delivered-duplicate override (layer 1) demands
 * the same typed-ID confirmation.
 *
 * BINDING: identity/course are frozen at the start of each send flow, the
 * identity inputs lock while it runs, prompts carry the exact ID they were
 * raised for (editing the field dismisses them), and override grants are
 * honored ONLY for that bound ID — any other value re-runs the full
 * precheck. A checked ID can therefore never differ from the sent ID.
 */

const VERB_AR: Record<string, string> = {
  registered: 'التسجيل في الدورة (registered)',
  initialized: 'بدء التعلم (initialized)',
  watched: 'مشاهدة محتوى (watched)',
  completed_lesson: 'إتمام درس (completed)',
  attempted: 'محاولة اختبار (attempted)',
  completed_unit: 'إتمام وحدة (completed)',
  progressed: 'التقدم في الدورة (progressed)',
  completed_course: 'إتمام الدورة (completed)',
  rated: 'تقييم الدورة (rated)',
  earned: 'الحصول على الشهادة (earned)',
  self_check: 'فحص ذاتي — قراءة العبارات المخزنة',
};
const VERB_ORDER = [
  'registered',
  'initialized',
  'watched',
  'completed_lesson',
  'attempted',
  'completed_unit',
  'progressed',
  'completed_course',
  'rated',
  'earned',
];

const ENV_LABEL: Record<string, { label: string; cls: string }> = {
  staging: { label: 'بيئة الاختبار (Staging)', cls: 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]' },
  production: { label: 'بيئة الإنتاج (Production)', cls: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00]' },
};

const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type StepResult = {
  verb: string;
  statementId: string;
  ok: boolean;
  httpStatus: number | null;
  response: string;
};

type RunState = {
  ok: boolean;
  pending: boolean;
  environment: string;
  runId: string;
  results: StepResult[];
};

type PrepareResponse = {
  environment: string;
  runId: string;
  url: string;
  authorization: string;
  steps: { key: string; statementId: string; statement: Record<string, unknown> }[];
};

type CheckPrepareResponse = {
  environment: string;
  checkId: string;
  url: string;
  authorization: string;
};

type PrecheckPrepareResponse = {
  environment: string;
  url: string;
  authorization: string;
};

type CheckState = {
  pending: boolean;
  ok: boolean;
  httpStatus: number | null;
  matched: number;
  /**
   * How many of the matched statements satisfy their per-step journey
   * contract (classifyJourneyStatement — shared with the journey builder
   * and the tests). Only these count for NELC's verifier; journeys sent
   * before the contract fixes are stored too but never counted.
   */
  parityMatched: number;
  verbs: string[];
  /** Journey verbs still missing among the parity statements (multiset). */
  missingSteps: string[];
  hasMore: boolean;
  environment: string;
  detail: string;
  /**
   * HTTP 401 whose body says the LRS account lacks READ permission — NELC's
   * credentials for this platform are write-only. NOT a delivery failure:
   * shown as a calm informational state with a local delivery receipt
   * instead of an error (real errors — bad credentials, geo-block 403,
   * 5xx, network — keep readDenied=false and stay errors).
   */
  readDenied: boolean;
};

/** Error messages shared by the prepare (send) and check (read-back) calls. */
const PREP_ERRORS: Record<string, string> = {
  invalid_national_id: 'رقم الهوية يجب أن يكون 10 أرقام (رقم هوية المتعلم التجريبي).',
  invalid_course_iri: 'معرّف الدورة يجب أن يكون رابطاً صحيحاً يبدأ بـ https://',
  not_configured: 'الاتصال بنظام تسجيل التعلم (LRS) غير مهيأ — أضف بيانات الاعتماد أولاً.',
  reauth_failed: 'كلمة مرور الإدارة غير صحيحة — أعد إدخالها في خانة التأكيد.',
  dev_environment_blocked:
    'الخادم يرفض الإرسال من بيئة التطوير — اكتب رقم الهوية في خانة التأكيد داخل التنبيه الأحمر أولاً.',
};

/** Arabic reason line for the «تعذّر الفحص المسبق» prompt. */
const precheckReasonAr = (reason: string): string => {
  if (reason === 'read_denied') return 'حساب نيلك المتاح لنا للكتابة فقط ولا يسمح بالقراءة';
  if (reason === 'network' || reason.startsWith('browser_network')) return 'تعذّر اتصال متصفحك بنظام نيلك';
  if (reason === 'unparseable') return 'وصل ردّ غير مفهوم من النظام';
  if (reason.startsWith('http_')) return `رفض النظام طلب القراءة (HTTP ${reason.slice(5)})`;
  return reason;
};

/** Parse the summary JSON stored in a self_check audit row's response. */
const parseCheckSummary = (
  response: string | null,
): { matched: number; parityMatched?: number; verbs: string[]; detail: string } | null => {
  if (!response) return null;
  try {
    const j = JSON.parse(response) as {
      matched?: unknown;
      parityMatched?: unknown;
      verbs?: unknown;
      detail?: unknown;
    };
    if (typeof j.matched !== 'number') return null;
    return {
      matched: j.matched,
      parityMatched: typeof j.parityMatched === 'number' ? j.parityMatched : undefined,
      verbs: Array.isArray(j.verbs) ? j.verbs.map(String) : [],
      detail: typeof j.detail === 'string' ? j.detail : '',
    };
  } catch {
    return null;
  }
};

type LogRow = {
  id: number;
  runId: string;
  environment: string;
  nationalId: string;
  courseIri: string;
  verb: string;
  statementId: string;
  httpStatus: number | null;
  response: string | null;
  ok: boolean;
  source: string; // "server" | "browser" — who observed the LRS outcome
  createdAt: string;
};

type Config = {
  configured: boolean;
  environment: string;
  /**
   * SERVER-determined runtime environment (REPLIT_DEPLOYMENT on the server —
   * never the browser's address bar): true only on the published deployment
   * (funademy.io). false ⇒ the dev-environment warning banner is shown —
   * NELC's LRS is ONE store shared across environments, and the 2026-08-10
   * burned-ID incident came from sending out of the dev preview.
   */
  deployed: boolean;
  defaultCourseIri: string;
};

/** Production outbox status (REAL learner data → NELC production LRS). */
type ProductionStatus = {
  configured: boolean;
  pending: number;
  sent: number;
  /** pending rows past the SERVER retry cap — browser flush only. */
  stalled: number;
  childrenWithId: number;
  childrenWithoutId: number;
  lastError: string | null;
  lastHttpStatus: number | null;
  /** rows the admin explicitly voided (skipped) — kept forever, never deleted. */
  voided: number;
  /**
   * READ-ONLY review list of every voided row (which child, which verb, the
   * last delivery error, the typed reason, who and when) — accountability
   * toward NELC. No delete, no silent un-void.
   */
  voidedRows?: {
    statementId: string;
    verb: string;
    nationalId: string;
    lastError: string | null;
    lastHttpStatus: number | null;
    voidReason: string | null;
    voidedBy: string | null;
    voidedAt: string | null;
    createdAt: string;
  }[];
  /**
   * HEAD OF THE QUEUE: delivery is strictly ordered, so if this row keeps
   * failing it blocks every statement behind it — for all children.
   * blocking=true once it has failed at least once.
   */
  head: {
    statementId: string;
    verb: string;
    nationalId: string;
    attempts: number;
    lastError: string | null;
    lastHttpStatus: number | null;
    createdAt: string;
    blocking: boolean;
  } | null;
};

function StatusChip({ ok, httpStatus }: { ok: boolean; httpStatus: number | null }) {
  if (ok) {
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]" dir="ltr">
        ✓ {httpStatus}
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FDECEC] text-[#B3261E]" dir="ltr">
      ✗ {httpStatus ?? 'شبكة'}
    </span>
  );
}

export function NelcTab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nationalId, setNationalId] = useState('');
  const [courseIri, setCourseIri] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunState | null>(null);
  /**
   * SEQ003 warning — set when `prepare` answers 409 duplicate_journey.
   * Bound to the exact ID it was raised for (see BINDING note above).
   */
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    nationalId: string;
    lastSentAt: string | null;
    /** true = delivered rows exist (ID burned); false = only an unrecorded prepared run. */
    delivered: boolean;
  } | null>(null);
  /**
   * PRE-SEND burned-ID check result (SEQ003 layer 2 — NELC's OWN LRS, any
   * course/environment): 'burned' = statements already stored for this ID;
   * 'unverifiable' = the check itself failed — never a silent pass.
   */
  const [precheckPrompt, setPrecheckPrompt] = useState<
    ({ nationalId: string } & Exclude<PrecheckOutcome, { kind: 'clean' }>) | null
  >(null);
  /** Typed-ID confirmation for strong overrides (burned ID / delivered duplicate). */
  const [overrideIdInput, setOverrideIdInput] = useState('');
  /**
   * DEV-ENVIRONMENT SEND BLOCK (task 119): outside the published deployment
   * the SERVER answers 403 dev_environment_blocked for the send actions
   * unless the request carries confirmDevSend:true. The flag is set ONLY
   * when the owner types the national ID into this separate confirmation
   * field inside the red banner — a click is not enough.
   */
  const [devConfirmInput, setDevConfirmInput] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);
  const [lastCheck, setLastCheck] = useState<CheckState | null>(null);
  const [production, setProduction] = useState<ProductionStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/svc/admin/nelc');
      if (res.status === 401) { window.location.reload(); return; }
      const data = await res.json();
      setConfig({
        configured: data.configured,
        environment: data.environment,
        // Fail-safe: only an explicit server "true" counts as the published
        // deployment — a missing field must show the warning, not hide it.
        deployed: data.deployed === true,
        defaultCourseIri: data.defaultCourseIri,
      });
      setLogs(data.logs || []);
      setProduction(data.production ?? null);
      setCourseIri((v) => v || data.defaultCourseIri || '');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const send = async (opts: { confirmedDuplicateFor?: string; precheckClearedFor?: string } = {}) => {
    if (!adminPassword.trim()) {
      setError('أدخل كلمة مرور الإدارة في خانة التأكيد قبل الإرسال.');
      return;
    }
    // FREEZE identity/course for the whole flow — the awaits below must never
    // pick up a mid-flight form edit (a checked ID differing from the sent ID
    // would defeat the burned-ID check). Override grants are honored only for
    // the exact ID they were given for; anything else re-runs the precheck.
    const id = nationalId.trim();
    const iri = courseIri.trim();
    const confirmDuplicate = opts.confirmedDuplicateFor === id;
    const skipPrecheck = opts.precheckClearedFor === id;
    // DEV-ENVIRONMENT BLOCK: outside the published deployment the server
    // refuses the send unless the owner typed the national ID into the
    // separate confirmation field in the red banner. Checked here too so the
    // user gets the explanation up front, but the SERVER is the real gate.
    const confirmDevSend = config?.deployed === false && devConfirmInput.trim() === id;
    if (config && !config.deployed && !confirmDevSend) {
      setError(
        'أنت في بيئة التطوير — الإرسال من هنا يحرق رقم الهوية نهائياً. للمتابعة رغم ذلك اكتب رقم الهوية في خانة التأكيد داخل التنبيه الأحمر أعلاه.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setLastRun(null);
    setDuplicatePrompt(null);
    setPrecheckPrompt(null);
    try {
      // 0) PRE-SEND BURNED-ID CHECK (SEQ003 layer 2) — ask NELC's OWN LRS
      //    whether this ID already has statements (any course, any
      //    environment; the server-side guard in `prepare` only sees THIS
      //    environment's audit log). skipPrecheck=true comes only from the
      //    explicit override buttons — never automatically.
      if (!skipPrecheck) {
        const pc = await fetch('/svc/admin/nelc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'precheck',
            password: adminPassword,
            nationalId: id,
            courseIri: iri,
          }),
        });
        const pcData = await pc.json().catch(() => ({}));
        if (pc.status === 401 && pcData.error !== 'reauth_failed') { window.location.reload(); return; }
        if (!pc.ok) {
          setError(PREP_ERRORS[pcData.error as string] ?? 'تعذّر تجهيز الفحص المسبق — أعد المحاولة.');
          return;
        }
        const { url: pcUrl, authorization: pcAuth } = pcData as PrecheckPrepareResponse;
        // THIS BROWSER queries the LRS (same geo-block relay as sending),
        // then classifies FAIL-CLOSED — an error is never a silent pass.
        let outcome: PrecheckOutcome;
        try {
          const res = await fetch(pcUrl, {
            headers: { 'X-Experience-API-Version': '1.0.3', Authorization: pcAuth },
            // A cached empty answer must never clear an ID that was burned
            // meanwhile — always ask the LRS itself, bypass the HTTP cache.
            cache: 'no-store',
          });
          const text = (await res.text().catch(() => '')) || '';
          outcome = classifyPrecheckResponse(res.ok, res.status, text);
        } catch (e) {
          outcome = {
            kind: 'unverifiable',
            reason: `browser_network: ${e instanceof Error ? e.message : 'failed'}`,
          };
        }
        if (outcome.kind !== 'clean') {
          setOverrideIdInput('');
          setPrecheckPrompt({ nationalId: id, ...outcome });
          return; // explicit user decision required before anything is sent
        }
      }
      // 1) The server prepares the journey (validation, fresh UUIDs, LRS creds).
      const prep = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          password: adminPassword,
          nationalId: id,
          courseIri: iri,
          // SEQ003: re-sending the same national ID duplicates statements in
          // NELC's LRS — the server refuses unless explicitly confirmed.
          confirmDuplicate,
          // Dev-environment block: true only after the typed-ID confirmation
          // in the red banner (never sent from the published deployment).
          ...(confirmDevSend ? { confirmDevSend: true } : {}),
        }),
      });
      const prepData = await prep.json().catch(() => ({}));
      // 401 + reauth_failed = wrong step-up password (show the message);
      // any other 401 = admin session expired → back to the login screen.
      if (prep.status === 401 && prepData.error !== 'reauth_failed') { window.location.reload(); return; }
      if (prep.status === 409 && prepData.error === 'duplicate_journey') {
        setOverrideIdInput('');
        setDuplicatePrompt({
          nationalId: id,
          lastSentAt: typeof prepData.lastSentAt === 'string' ? prepData.lastSentAt : null,
          delivered: prepData.delivered === true,
        });
        return;
      }
      if (!prep.ok) {
        setError(PREP_ERRORS[prepData.error as string] ?? 'تعذّر تجهيز الرحلة — أعد المحاولة.');
        return;
      }
      const { runId, environment, url, authorization, steps } = prepData as PrepareResponse;

      // 2) THIS BROWSER sends each statement directly to NELC's LRS — the
      //    owner's device is inside Saudi Arabia; NELC blocks our server IP.
      const results: StepResult[] = [];
      let allOk = true;
      setLastRun({ ok: false, pending: true, environment, runId, results: [] });
      for (const step of steps) {
        let r: StepResult;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Experience-API-Version': '1.0.3',
              Authorization: authorization,
            },
            body: JSON.stringify(step.statement),
          });
          const text = (await res.text().catch(() => '')).slice(0, 2000);
          r = { verb: step.key, statementId: step.statementId, ok: res.ok, httpStatus: res.status, response: text };
        } catch (e) {
          r = {
            verb: step.key,
            statementId: step.statementId,
            ok: false,
            httpStatus: null,
            response: `browser_network_or_cors: ${e instanceof Error ? e.message : 'failed'}`,
          };
        }
        results.push(r);
        setLastRun({ ok: false, pending: true, environment, runId, results: [...results] });
        if (!r.ok) { allOk = false; break; } // stop on first failure
      }
      setLastRun({ ok: allOk, pending: false, environment, runId, results });

      // 3) Report outcomes back for the permanent audit log (failures included).
      const rec = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Identity/course come from the server-stored prepared run — the
        // payload only references the runId and the per-step outcomes.
        body: JSON.stringify({ action: 'record', runId, results }),
      }).catch(() => null);
      if (!rec || !rec.ok) {
        setError('أُرسلت العبارات، لكن تعذّر حفظ السجل في قاعدة البيانات — أعد تحميل الصفحة للتحقق.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    if (!adminPassword.trim()) {
      setError('أدخل كلمة مرور الإدارة في خانة التأكيد قبل تشغيل الفحص.');
      return;
    }
    setCheckBusy(true);
    setError(null);
    setLastCheck(null);
    try {
      // 1) The server prepares a one-time read-back check (validation + LRS creds).
      const prep = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          password: adminPassword,
          nationalId: nationalId.trim(),
          courseIri: courseIri.trim(),
        }),
      });
      const prepData = await prep.json().catch(() => ({}));
      if (prep.status === 401 && prepData.error !== 'reauth_failed') { window.location.reload(); return; }
      if (!prep.ok) {
        setError(PREP_ERRORS[prepData.error as string] ?? 'تعذّر تجهيز الفحص — أعد المحاولة.');
        return;
      }
      const { checkId, environment, url, authorization } = prepData as CheckPrepareResponse;

      // 2) THIS BROWSER reads the stored statements straight from NELC's LRS
      //    (same geo-block reason as sending — the owner is inside Saudi Arabia).
      setLastCheck({
        pending: true, ok: false, httpStatus: null, matched: 0, parityMatched: 0, verbs: [],
        missingSteps: [], hasMore: false, environment, detail: '', readDenied: false,
      });
      let ok = false;
      let httpStatus: number | null = null;
      let matched = 0;
      let parityMatched = 0;
      let verbs: string[] = [];
      let missingSteps: string[] = [];
      let hasMore = false;
      let detail = '';
      let readDenied = false;
      try {
        const res = await fetch(url, {
          headers: { 'X-Experience-API-Version': '1.0.3', Authorization: authorization },
          cache: 'no-store',
        });
        httpStatus = res.status;
        const text = (await res.text().catch(() => '')) || '';
        if (res.ok) {
          try {
            const parsed = JSON.parse(text) as {
              statements?: {
                verb?: { display?: Record<string, string>; id?: string };
              }[];
              more?: string;
            };
            const sts = Array.isArray(parsed.statements) ? parsed.statements : [];
            matched = sts.length;
            verbs = sts.map((s) => s?.verb?.display?.['en-US'] || s?.verb?.id || 'unknown').slice(0, 60);
            // Only statements satisfying their per-step journey contract
            // count for NELC's verifier — the classifier is shared with the
            // journey builder and the tests (xapiParity), so "conforming"
            // means exactly what the current builder emits. A key-presence
            // or raw count alone would let malformed or old-format
            // statements fake readiness.
            const classified = sts.map((s) => classifyJourneyStatement(s));
            parityMatched = classified.filter((k) => k !== null).length;
            missingSteps = missingJourneySteps(classified);
            hasMore = Boolean(parsed.more);
            if (hasMore) detail = 'more_available';
            ok = true;
          } catch {
            detail = `unparseable_lrs_response: ${text.slice(0, 300)}`;
          }
        } else {
          detail = text.slice(0, 800);
          // Write-only credentials: NELC blocks READS for our send account.
          // Not a delivery failure — flagged so the UI shows a calm
          // informational state + a local delivery receipt instead of an error.
          readDenied = isLrsReadDenied(httpStatus, text);
        }
      } catch (e) {
        detail = `browser_network_or_cors: ${e instanceof Error ? e.message : 'failed'}`;
      }
      setLastCheck({ pending: false, ok, httpStatus, matched, parityMatched, verbs, missingSteps, hasMore, environment, detail, readDenied });

      // 3) Record ONE distinguishable audit row for the permanent log.
      const rec = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_check', checkId, ok, httpStatus, matched, parityMatched, verbs, missingSteps, detail }),
      }).catch(() => null);
      if (!rec || !rec.ok) {
        setError('تم تنفيذ الفحص، لكن تعذّر حفظه في السجل — أعد تحميل الصفحة للتحقق.');
      }
      await refresh();
    } finally {
      setCheckBusy(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  const envChip = ENV_LABEL[config?.environment ?? 'staging'] ?? ENV_LABEL.staging;

  // Group log rows by run (rows arrive newest-first; within a group restore
  // chronological statement order for readability).
  const groups: { runId: string; rows: LogRow[] }[] = [];
  for (const row of logs) {
    const g = groups.find((x) => x.runId === row.runId);
    if (g) g.rows.push(row);
    else groups.push({ runId: row.runId, rows: [row] });
  }

  // Local «delivery receipt» for the read-denied state: the latest SEND batch
  // (never a self_check row) from our own audit log — statement count, verbs,
  // NELC statement ids, time and HTTP statuses. Shown when NELC's write-only
  // credentials block the read-back, as proof the sends themselves succeeded.
  const receiptGroup = groups.find((g) => g.rows[0]?.verb !== 'self_check') ?? null;
  const receiptRows = receiptGroup ? [...receiptGroup.rows].reverse() : [];
  const receiptAllOk = receiptRows.length > 0 && receiptRows.every((r) => r.ok);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display font-bold text-xl text-[#101A38]">نيلك — نظام تسجيل التعلم (LRS)</h2>
        <div className="flex items-center gap-2">
          {config?.configured ? (
            <>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]">متصل ✓</span>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${envChip.cls}`}>{envChip.label}</span>
            </>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#FDECEC] text-[#B3261E]">غير مهيأ</span>
          )}
        </div>
      </div>

      {config && !config.deployed && (
        <div className="bg-[#FDECEC] border-2 border-[#B3261E] rounded-2xl p-5 space-y-2">
          <div className="font-display font-bold text-[#B3261E]">
            ⚠ أنت الآن في بيئة التطوير (المعاينة) — وليس الموقع المنشور
          </div>
          <p className="text-sm text-[#B3261E] leading-relaxed font-bold">
            مخزن نيلك واحد ومشترك بين بيئة التطوير والموقع المنشور، وأي إرسال من هنا يحرق رقم
            الهوية نهائياً كما لو أُرسل من الموقع الرسمي (هذا بالضبط ما حدث في حادثة 10 أغسطس
            2026). إجراء التحقق الرسمي يجب أن يتم من الموقع المنشور{' '}
            <span dir="ltr" className="font-mono">funademy.io</span> فقط.
          </p>
          <div className="border-t border-[#B3261E]/25 pt-3 space-y-2">
            <div className="text-xs font-bold text-[#B3261E] leading-relaxed">
              الخادم نفسه يرفض أي إرسال من هذه البيئة. للمتابعة رغم الخطر (سيُحرق الرقم كما لو
              أُرسل من الموقع الرسمي) اكتب رقم هوية المتعلم نفسه هنا للتأكيد:
            </div>
            <input
              value={devConfirmInput}
              onChange={(e) => setDevConfirmInput(e.target.value)}
              disabled={busy}
              inputMode="numeric"
              maxLength={10}
              placeholder="اكتب رقم الهوية للتأكيد"
              dir="ltr"
              className="font-mono border border-[#B3261E]/50 rounded-xl px-3 py-2 text-sm text-[#101A38] focus:outline-none focus:border-[#B3261E] bg-white"
            />
          </div>
        </div>
      )}

      {!config?.configured && (
        <div className="bg-[rgba(255,202,23,0.12)] border border-[#FFCA17] rounded-2xl p-5 space-y-2">
          <div className="font-display font-bold text-[#101A38]">الاتصال بنظام تسجيل التعلم غير مهيأ</div>
          <p className="text-sm text-[#5F6B92] leading-relaxed">
            لم تتم إضافة بيانات اعتماد بيئة الاختبار (Staging) بعد. أضف الأسرار التالية من إعدادات
            المشروع ثم عد إلى هذه الصفحة:
          </p>
          <div className="font-mono text-xs text-[#101A38] bg-white rounded-xl border border-[#DFE5F2] p-3 space-y-1" dir="ltr">
            <div>NELC_LRS_ENDPOINT</div>
            <div>NELC_LRS_KEY</div>
            <div>NELC_LRS_SECRET</div>
          </div>
          <p className="text-sm text-[#B3261E] font-bold">لن يتم إرسال أي بيانات ولن تظهر أي نتائج وهمية قبل اكتمال الإعداد.</p>
        </div>
      )}

      {/* Send form */}
      <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-4">
        <div>
          <div className="font-display font-bold text-[#101A38]">إرسال رحلة التعلم التجريبية</div>
          <p className="text-sm text-[#5F6B92] mt-1 leading-relaxed">
            تُرسل رحلة التعلم الكاملة (10 عبارات xAPI) بالترتيب الذي يطلبه معالج نيلك: التسجيل ←
            البدء ← المشاهدة ← إتمام درس ← محاولة اختبار ← إتمام وحدة ← التقدم ← إتمام الدورة ←
            التقييم ← الشهادة. بعد نجاح الإرسال أدخل نفس رقم الهوية في معالج نيلك واضغط
            «بدء الاختبار». مهم: أرسل الرحلة مرة واحدة فقط لكل رقم هوية — فاحص نيلك يرصد أي
            تكرار (قاعدة SEQ003) ويرفض الرحلة، ولكل محاولة تحقق جديدة استخدم رقم هوية جديداً
            لم يُرسل له من قبل.
          </p>
          <p className="text-sm text-[#8a6d00] bg-[rgba(255,202,23,0.12)] border border-[#FFCA17]/60 rounded-xl px-3 py-2 mt-2 leading-relaxed font-bold">
            مهم: تُرسَل العبارات من متصفحك أنت مباشرةً إلى نيلك، لأن خوادم نيلك تقبل الاتصال من
            داخل السعودية فقط. افتح هذه الصفحة من جهازك داخل السعودية وبدون VPN. تُحفظ النتائج في
            السجل كما يُبلغ عنها متصفحك، والتأكيد الرسمي هو نجاح «بدء الاختبار» في معالج نيلك.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-[#101A38] mb-1.5">رقم هوية المتعلم التجريبي</span>
            <input
              value={nationalId}
              onChange={(e) => {
                setNationalId(e.target.value);
                // Prompts are bound to the ID they were raised for — a stale
                // warning (or override grant) must not linger over a new ID.
                setPrecheckPrompt(null);
                setDuplicatePrompt(null);
              }}
              disabled={busy}
              inputMode="numeric"
              maxLength={10}
              placeholder="1XXXXXXXXX"
              dir="ltr"
              className="w-full font-mono border border-[#DFE5F2] rounded-xl px-4 py-3 text-[#101A38] focus:outline-none focus:border-[#1C54CB]"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-[#101A38] mb-1.5">معرّف الدورة (Course IRI)</span>
            <input
              value={courseIri}
              onChange={(e) => {
                setCourseIri(e.target.value);
                setPrecheckPrompt(null);
                setDuplicatePrompt(null);
              }}
              disabled={busy}
              placeholder="https://funademy.io/course/CR001"
              dir="ltr"
              className="w-full font-mono border border-[#DFE5F2] rounded-xl px-4 py-3 text-[#101A38] focus:outline-none focus:border-[#1C54CB]"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="block text-sm font-bold text-[#101A38] mb-1.5">
              كلمة مرور الإدارة (تأكيد إضافي)
            </span>
            <input
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              type="password"
              autoComplete="off"
              dir="ltr"
              className="w-full font-mono border border-[#DFE5F2] rounded-xl px-4 py-3 text-[#101A38] focus:outline-none focus:border-[#1C54CB]"
            />
            <span className="block text-xs text-[#5F6B92] mt-1 leading-relaxed">
              يُطلب التأكيد لأن الإرسال يسلّم متصفحَك بياناتِ اعتماد نيلك مؤقتاً — جلسة الدخول وحدها لا تكفي.
            </span>
          </label>
        </div>
        {error && (
          <div className="bg-[#FDECEC] text-[#B3261E] text-sm font-bold rounded-xl px-4 py-3">{error}</div>
        )}
        {precheckPrompt && precheckPrompt.kind === 'burned' && (
          <div className="bg-[#FDECEC] border border-[#B3261E]/40 rounded-xl px-4 py-3 space-y-3">
            <div className="text-sm font-bold text-[#B3261E] leading-relaxed">
              ✗ هذا الرقم محروق: نظام نيلك نفسه يخزّن {precheckPrompt.count}
              {precheckPrompt.hasMore ? '+' : ''} عبارة سابقة لهذا الرقم — من أي دورة أو بيئة
              (فُحص مخزن نيلك مباشرة، وليس سجلنا المحلي فقط). نيلك لا يحذف العبارات أبداً، لذا
              أي إرسال جديد سيُعدّ تكراراً (SEQ003) ولن ينجح هذا الرقم في الفاحص مطلقاً.
              استخدم رقم هوية جديداً لم يُرسل له من قبل.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPrecheckPrompt(null)}
                className="bg-[#1C54CB] text-white px-4 py-2 rounded-xl text-sm font-display font-bold"
              >
                حسناً — سأستخدم رقم هوية جديداً
              </button>
            </div>
            <div className="border-t border-[#B3261E]/20 pt-3 space-y-2">
              <div className="text-xs font-bold text-[#B3261E] leading-relaxed">
                للمتابعة رغم ذلك (لن ينجح الفحص وسيبقى الرقم محروقاً) اكتب رقم الهوية نفسه للتأكيد:
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={overrideIdInput}
                  onChange={(e) => setOverrideIdInput(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="اكتب رقم الهوية للتأكيد"
                  dir="ltr"
                  className="font-mono border border-[#B3261E]/50 rounded-xl px-3 py-2 text-sm text-[#101A38] focus:outline-none focus:border-[#B3261E]"
                />
                <button
                  onClick={() =>
                    send({
                      confirmedDuplicateFor: precheckPrompt.nationalId,
                      precheckClearedFor: precheckPrompt.nationalId,
                    })
                  }
                  disabled={busy || overrideIdInput.trim() !== precheckPrompt.nationalId}
                  className="bg-white border border-[#B3261E] text-[#B3261E] px-4 py-2 rounded-xl text-sm font-display font-bold disabled:opacity-50"
                >
                  متابعة الإرسال رغم الحرق
                </button>
              </div>
            </div>
          </div>
        )}
        {precheckPrompt && precheckPrompt.kind === 'unverifiable' && (
          <div className="bg-[rgba(255,202,23,0.12)] border border-[#FFCA17] rounded-xl px-4 py-3 space-y-3">
            <div className="text-sm font-bold text-[#8a6d00] leading-relaxed">
              ⚠ تعذّر الفحص المسبق: لم نستطع سؤال نظام نيلك إن كان هذا الرقم استُخدم من قبل
              ({precheckReasonAr(precheckPrompt.reason)}). لن يُرسل شيء تلقائياً — تأكد بنفسك أن
              الرقم جديد كلياً ولم تُرسل له رحلة من هذا الموقع ولا من بيئة التطوير، لأن الإرسال
              لرقم مستخدم يحرقه نهائياً.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPrecheckPrompt(null)}
                className="bg-white border border-[#DFE5F2] text-[#101A38] px-4 py-2 rounded-xl text-sm font-display font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => send({ precheckClearedFor: precheckPrompt.nationalId })}
                disabled={busy}
                className="bg-[#1C54CB] text-white px-4 py-2 rounded-xl text-sm font-display font-bold disabled:opacity-50"
              >
                أؤكد أن الرقم جديد — متابعة الإرسال
              </button>
            </div>
          </div>
        )}
        {duplicatePrompt && (
          <div className="bg-[rgba(255,202,23,0.12)] border border-[#FFCA17] rounded-xl px-4 py-3 space-y-3">
            <div className="text-sm font-bold text-[#8a6d00] leading-relaxed">
              {duplicatePrompt.delivered
                ? '⚠ هذا الرقم أُرسلت له رحلة من قبل'
                : '⚠ هذا الرقم جُهّزت له رحلة سابقة وقد تكون أُرسلت دون تسجيل نتيجتها'}
              {duplicatePrompt.lastSentAt ? ` (آخر مرة: ${fmtDateTime(duplicatePrompt.lastSentAt)})` : ''}
              . فاحص نيلك يعدّ الإرسال المتكرر «عبارات مكررة» (SEQ003) ويرفض الرحلة كلها، ويطلب
              رقم هوية جديداً لكل محاولة تحقق.
              {duplicatePrompt.delivered && (
                <>
                  {' '}
                  نظام نيلك لا يحذف العبارات القديمة أبداً، لذا هذا الرقم <b>محروق نهائياً</b>:
                  إعادة الإرسال له — حتى بعبارات سليمة تماماً — لن تنجح في الفحص مطلقاً.
                  الحل الوحيد هو رقم هوية جديد لم يُرسل له من قبل.
                </>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setDuplicatePrompt(null)}
                className="bg-[#1C54CB] text-white px-4 py-2 rounded-xl text-sm font-display font-bold"
              >
                حسناً — سأستخدم رقم هوية جديداً
              </button>
              {!duplicatePrompt.delivered && (
                <button
                  onClick={() =>
                    send({
                      confirmedDuplicateFor: duplicatePrompt.nationalId,
                      precheckClearedFor: duplicatePrompt.nationalId,
                    })
                  }
                  disabled={busy}
                  className="bg-white border border-[#B3261E] text-[#B3261E] px-4 py-2 rounded-xl text-sm font-display font-bold disabled:opacity-50"
                >
                  متابعة الإرسال رغم التحذير
                </button>
              )}
            </div>
            {duplicatePrompt.delivered && (
              /* Strong override: a DELIVERED journey exists, so re-sending is
                 guaranteed SEQ003 — require typing the ID, not just a click. */
              <div className="border-t border-[#FFCA17]/60 pt-3 space-y-2">
                <div className="text-xs font-bold text-[#B3261E] leading-relaxed">
                  للمتابعة رغم ذلك اكتب رقم الهوية نفسه للتأكيد — الإرسال سيضيف عبارات مكررة
                  وسيبقى الرقم مرفوضاً في فاحص نيلك بلا رجعة:
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={overrideIdInput}
                    onChange={(e) => setOverrideIdInput(e.target.value)}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="اكتب رقم الهوية للتأكيد"
                    dir="ltr"
                    className="font-mono border border-[#B3261E]/50 rounded-xl px-3 py-2 text-sm text-[#101A38] focus:outline-none focus:border-[#B3261E]"
                  />
                  <button
                    onClick={() =>
                      send({
                        confirmedDuplicateFor: duplicatePrompt.nationalId,
                        precheckClearedFor: duplicatePrompt.nationalId,
                      })
                    }
                    disabled={busy || overrideIdInput.trim() !== duplicatePrompt.nationalId}
                    className="bg-white border border-[#B3261E] text-[#B3261E] px-4 py-2 rounded-xl text-sm font-display font-bold disabled:opacity-50"
                  >
                    متابعة الإرسال رغم الحرق
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => send()}
          disabled={busy || !config?.configured}
          className="bg-[#1C54CB] text-white px-6 py-3 rounded-xl font-display font-bold disabled:opacity-50"
        >
          {busy ? 'جارٍ الإرسال من متصفحك…' : 'إرسال رحلة الاختبار إلى LRS'}
        </button>
        {config?.configured && (
          <div className="text-xs text-[#5F6B92] font-mono" dir="ltr">
            actor.mbox = mailto:&lt;national-id&gt;@gmail.com
          </div>
        )}
      </div>

      {/* Self-check (read-back) */}
      <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-4">
        <div>
          <div className="font-display font-bold text-[#101A38]">الفحص الذاتي — قراءة العبارات المخزنة</div>
          <p className="text-sm text-[#5F6B92] mt-1 leading-relaxed">
            يقرأ من نظام نيلك مباشرة (عبر متصفحك، بنفس قيد الموقع الجغرافي) العبارات المخزنة فعلاً
            لرقم الهوية ومعرّف الدورة المدخلين أعلاه، ويعرض عددها وأفعالها وكم منها مطابقٌ لبنية
            المثال الرسمي التي يحتسبها فحص نيلك. استخدمه بعد الإرسال للتأكد أن الرحلة قابلة
            للاسترجاع قبل الضغط على «بدء الاختبار» في معالج نيلك — دون استهلاك محاولة تحقق.
            يستخدم نفس خانات النموذج أعلاه (الهوية، الدورة، كلمة المرور).
          </p>
        </div>
        {lastCheck && (
          lastCheck.pending ? (
            <div className="bg-[#F0F5FF] rounded-xl px-4 py-3 text-sm font-bold text-[#1C54CB]">
              ⏳ جارٍ القراءة من نظام نيلك عبر متصفحك…
            </div>
          ) : lastCheck.ok ? (
            <div
              className={`rounded-xl px-4 py-3 space-y-2 border ${
                lastCheck.parityMatched >= 10 && lastCheck.missingSteps.length === 0
                  ? 'bg-[rgba(34,218,255,0.1)] border-[#22DAFF]/40'
                  : lastCheck.matched > 0
                    ? 'bg-[rgba(255,202,23,0.12)] border-[#FFCA17]/60'
                    : 'bg-[#FDECEC] border-[#B3261E]/30'
              }`}
            >
              <div
                className={`text-sm font-bold leading-relaxed ${
                  lastCheck.parityMatched >= 10 && lastCheck.missingSteps.length === 0
                    ? 'text-[#0e7a94]'
                    : lastCheck.matched > 0
                      ? 'text-[#8a6d00]'
                      : 'text-[#B3261E]'
                }`}
              >
                {lastCheck.parityMatched >= 10 && lastCheck.missingSteps.length === 0
                  ? `✓ وُجدت ${lastCheck.matched}${lastCheck.hasMore ? '+' : ''} عبارة مخزنة لهذا المتعلم وهذه الدورة، منها ${lastCheck.parityMatched} بالبنية المطابقة للمثال الرسمي وبكل أفعال الرحلة العشرة — جاهز لتشغيل «بدء الاختبار» في معالج نيلك.`
                  : lastCheck.matched >= 10 && lastCheck.parityMatched < 10
                    ? `⚠ وُجدت ${lastCheck.matched}${lastCheck.hasMore ? '+' : ''} عبارة، لكن ${lastCheck.parityMatched} فقط بالبنية المطابقة للمثال الرسمي (المطلوب 10) — البقية بصيغة لا يحتسبها فحص نيلك (مثل رحلات ما قبل المطابقة). أعد إرسال الرحلة ثم افحص مجدداً.`
                    : lastCheck.parityMatched >= 10 && lastCheck.missingSteps.length > 0
                      ? `⚠ العبارات المطابقة للمثال (${lastCheck.parityMatched}) لا تغطي كل أفعال الرحلة — الناقص: ${lastCheck.missingSteps.join('، ')}. أعد إرسال الرحلة ثم افحص مجدداً.`
                      : lastCheck.matched > 0
                        ? `⚠ وُجدت ${lastCheck.matched} عبارة فقط (منها ${lastCheck.parityMatched} مطابقة للمثال) — الرحلة الكاملة 10 عبارات. أعد إرسال الرحلة ثم افحص مجدداً.`
                        : '✗ لا توجد أي عبارات مخزنة لهذا المتعلم وهذه الدورة — تأكد من تطابق رقم الهوية ومعرّف الدورة حرفياً (معرّف الدورة حساس لحالة الأحرف) ثم أعد إرسال الرحلة.'}
              </div>
              {lastCheck.verbs.length > 0 && (
                <div className="flex flex-wrap gap-1.5" dir="ltr">
                  {lastCheck.verbs.map((v, i) => (
                    <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white border border-[#DFE5F2] text-[#101A38]">
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : lastCheck.readDenied ? (
            /* Write-only credentials: NOT a failure — calm informational state
               + a local delivery receipt from our own audit log. */
            <div className="bg-[#F0F5FF] border border-[#1C54CB]/25 rounded-xl px-4 py-3 space-y-3">
              <div className="text-sm font-bold text-[#1C54CB] leading-relaxed">
                ℹ نيلك تمنع القراءة لحساب الإرسال — هذا لا يعني فشل الإرسال.
              </div>
              <p className="text-sm text-[#5F6B92] leading-relaxed">
                بيانات اعتماد نيلك لمنصتنا صلاحيتها «إرسال فقط»: أي محاولة قراءة تُرفض
                (HTTP 401) حتى عندما يكون الإرسال ناجحاً بالكامل. للتأكد من التسليم اعتمد على
                إيصال التسليم أدناه من سجلاتنا، ثم على «بدء الاختبار» في معالج نيلك — وهو
                التأكيد الرسمي.
              </p>
              {receiptGroup ? (
                <div className="bg-white border border-[#DFE5F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-bold text-[#101A38]">
                      إيصال تسليم من سجلاتنا — آخر دفعة إرسال
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        receiptAllOk
                          ? 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]'
                          : 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00]'
                      }`}
                    >
                      {receiptRows.filter((r) => r.ok).length}/{receiptRows.length} عبارة مقبولة
                    </span>
                  </div>
                  <div className="text-xs text-[#5F6B92] font-mono" dir="ltr">
                    {fmtDateTime(receiptRows[0].createdAt)} · ID: {receiptRows[0].nationalId} · {receiptRows[0].courseIri}
                  </div>
                  <div className="space-y-1">
                    {receiptRows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 border-t border-[#F0F5FF] pt-1">
                        <div className="text-xs text-[#101A38]">{VERB_AR[r.verb] ?? r.verb}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#5F6B92] break-all" dir="ltr">
                            {r.statementId}
                          </span>
                          <StatusChip ok={r.ok} httpStatus={r.httpStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#5F6B92]">
                  لا توجد دفعة إرسال في سجلاتنا بعد — أرسل رحلة الاختبار أولاً ثم عد إلى هنا.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#FDECEC] border border-[#B3261E]/30 rounded-xl px-4 py-3 text-sm text-[#B3261E] leading-relaxed">
              <span className="font-bold" >
                ✗ فشلت القراءة {lastCheck.httpStatus ? `(HTTP ${lastCheck.httpStatus})` : '(خطأ شبكة)'} — تأكد أنك
                تفتح اللوحة من جهاز داخل السعودية وبدون VPN ثم أعد المحاولة.
              </span>
              {lastCheck.detail && (
                <div className="mt-1 text-[11px] font-mono break-all" dir="ltr">{lastCheck.detail}</div>
              )}
            </div>
          )
        )}
        <button
          onClick={runCheck}
          disabled={checkBusy || busy || !config?.configured}
          className="bg-white border-2 border-[#1C54CB] text-[#1C54CB] px-6 py-3 rounded-xl font-display font-bold disabled:opacity-50"
        >
          {checkBusy ? 'جارٍ القراءة من نظام نيلك…' : 'فحص العبارات المخزنة (قراءة فقط)'}
        </button>
      </div>

      {/* Last run result */}
      {lastRun && (
        <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-display font-bold text-[#101A38]">نتيجة آخر إرسال</div>
            {lastRun.pending ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#F0F5FF] text-[#1C54CB]">
                ⏳ جارٍ الإرسال من متصفحك…
              </span>
            ) : lastRun.ok ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]">
                ✓ متصفحك أبلغ بقبول الرحلة كاملة
              </span>
            ) : (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#FDECEC] text-[#B3261E]">
                ✗ توقفت الرحلة عند أول فشل
              </span>
            )}
          </div>
          <div className="space-y-2">
            {VERB_ORDER.map((verb, i) => {
              const r = lastRun.results.find((x) => x.verb === verb);
              const isSending = lastRun.pending && !r && i === lastRun.results.length;
              return (
                <div key={verb} className="border border-[#DFE5F2] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-bold text-[#101A38]">
                      {i + 1}. {VERB_AR[verb] ?? verb}
                    </div>
                    {r ? (
                      <StatusChip ok={r.ok} httpStatus={r.httpStatus} />
                    ) : isSending ? (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F0F5FF] text-[#1C54CB] animate-pulse">جارٍ الإرسال…</span>
                    ) : (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F0F5FF] text-[#5F6B92]">لم تُرسل</span>
                    )}
                  </div>
                  {r && (
                    <div className="mt-2 text-[11px] text-[#5F6B92] font-mono break-all" dir="ltr">
                      id: {r.statementId}
                    </div>
                  )}
                  {r && !r.ok && (
                    <div className="mt-1 text-[11px] text-[#B3261E] font-mono break-all bg-[#FDECEC] rounded-lg p-2" dir="ltr">
                      {r.response || 'no response body'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!lastRun.pending && !lastRun.ok &&
            lastRun.results.some((x) => x.response?.startsWith('browser_network_or_cors')) && (
            <div className="bg-[#FDECEC] border border-[#B3261E]/30 rounded-xl px-4 py-3 text-sm text-[#B3261E] leading-relaxed">
              تعذّر وصول متصفحك إلى نظام نيلك مباشرة. تأكد أنك تفتح لوحة الإدارة من جهاز داخل
              السعودية وبدون VPN ثم أعد المحاولة. إذا تكررت المشكلة أخبر المساعد — قد يلزم حل بديل.
            </div>
          )}
          {!lastRun.pending && lastRun.ok && (
            <div className="bg-[rgba(34,218,255,0.1)] border border-[#22DAFF]/40 rounded-xl px-4 py-3 text-sm text-[#0e7a94] font-bold leading-relaxed">
              الخطوة التالية: افتح معالج الربط في نيلك، أدخل رقم الهوية نفسه، ثم اضغط «بدء الاختبار».
              نتيجة القبول أعلاه مُبلّغة من متصفحك — نجاح اختبار المعالج هو التأكيد الرسمي من نيلك.
            </div>
          )}
        </div>
      )}

      {/* Production outbox — REAL learner data */}
      <ProductionOutboxPanel
        production={production}
        adminPassword={adminPassword}
        deployed={config?.deployed === true}
        onRefresh={refresh}
      />

      {/* Admin correction of a LOCKED child national ID (typo after send) */}
      <NationalIdFixPanel />

      {/* Log */}
      <div className="space-y-3">
        <h3 className="font-display font-bold text-lg text-[#101A38]">سجل الإرسالات</h3>
        {groups.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-[#DFE5F2] text-center text-[#5F6B92]">
            لا توجد إرسالات بعد.
          </div>
        ) : (
          groups.map((g) => {
            const rows = [...g.rows].reverse();
            const head = rows[0];
            const gEnv = ENV_LABEL[head.environment] ?? ENV_LABEL.staging;
            const allOk = rows.length === VERB_ORDER.length && rows.every((r) => r.ok);
            // Self-check groups are a single read-back row, not a journey.
            const isCheck = head.verb === 'self_check';
            const checkInfo = isCheck ? parseCheckSummary(head.response) : null;
            return (
              <div key={g.runId} className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-display font-bold text-[#101A38] text-sm" dir="ltr">
                      {fmtDateTime(head.createdAt)}
                    </div>
                    <div className="font-mono text-xs text-[#5F6B92] mt-0.5" dir="ltr">
                      ID: {head.nationalId} · {head.courseIri}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${gEnv.cls}`}>{gEnv.label}</span>
                    {head.source === 'browser' && (
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full bg-[#F0F5FF] text-[#5F6B92]"
                        title="النتائج كما أبلغ عنها متصفح المدير — التأكيد الرسمي من معالج نيلك"
                      >
                        عبر المتصفح
                      </span>
                    )}
                    {isCheck ? (
                      head.ok ? (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]">
                          ✓ فحص ذاتي: {checkInfo
                            ? `${checkInfo.matched} عبارة${typeof checkInfo.parityMatched === 'number' ? ` (${checkInfo.parityMatched} مطابقة للمثال)` : ''}`
                            : 'تم'}
                        </span>
                      ) : isLrsReadDenied(head.httpStatus, checkInfo?.detail ?? '') ? (
                        /* Write-only credentials — informational, not a failure. */
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full bg-[#F0F5FF] text-[#1C54CB]"
                          title="نيلك تمنع القراءة لحساب الإرسال — هذا لا يعني فشل الإرسال"
                        >
                          ℹ فحص ذاتي: القراءة محجوبة من نيلك
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FDECEC] text-[#B3261E]">✗ فحص ذاتي فشل</span>
                      )
                    ) : allOk ? (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]">
                        {head.source === 'browser' ? '✓ كاملة (إبلاغ المتصفح)' : '✓ كاملة'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FDECEC] text-[#B3261E]">✗ غير مكتملة</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => (
                    <div key={r.id} className="border-t border-[#F0F5FF] pt-1.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm text-[#101A38]">{VERB_AR[r.verb] ?? r.verb}</div>
                        <div className="flex items-center gap-2">
                          <StatusChip ok={r.ok} httpStatus={r.httpStatus} />
                          {r.response && !r.ok && (
                            <details className="text-[11px] text-[#5F6B92]">
                              <summary className="cursor-pointer font-bold">الرد</summary>
                              <div className="font-mono break-all max-w-md mt-1 bg-[#F0F5FF] rounded-lg p-2" dir="ltr">
                                {r.response}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      {r.verb === 'self_check' && r.ok && checkInfo && checkInfo.verbs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1" dir="ltr">
                          {checkInfo.verbs.map((v, i) => (
                            <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#F0F5FF] text-[#101A38]">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Production outbox panel — REAL kids' learning data → NELC's PRODUCTION
 * LRS. Statements queue automatically on real events (server-side); the
 * server retries delivery, and when its egress is geo-blocked the owner
 * flushes pending rows from THIS browser — the same relay pattern as the
 * staging journey above, with the same step-up password and a one-time
 * prepared-run handshake (`outbox_prepare` / `outbox_record`).
 */
function ProductionOutboxPanel({
  production,
  adminPassword,
  deployed,
  onRefresh,
}: {
  production: ProductionStatus | null;
  adminPassword: string;
  deployed: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Reason typed for voiding the stuck head row — required, stored forever. */
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  if (!production) return null;

  const voidHead = async () => {
    const head = production.head;
    if (!head) return;
    if (!adminPassword.trim()) {
      setErr('أدخل كلمة مرور الإدارة في خانة التأكيد أعلاه أولاً.');
      return;
    }
    if (!voidReason.trim()) {
      setErr('اكتب سبب التخطي أولاً — يُحفظ السبب في السجل بشكل دائم.');
      return;
    }
    setVoidBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'outbox_void',
          password: adminPassword,
          statementId: head.statementId,
          reason: voidReason.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          j.error === 'reauth_failed'
            ? 'كلمة مرور الإدارة غير صحيحة.'
            : j.error === 'not_pending'
              ? 'هذا السجل لم يعد معلّقاً (أُرسل أو خُطّي بالفعل) — حدّث الصفحة.'
              : j.error === 'reason_required'
                ? 'اكتب سبب التخطي أولاً.'
                : `تعذّر التخطي (${j.error ?? res.status}).`,
        );
        return;
      }
      setVoidReason('');
      setMsg('تم تخطي السجل العالق (لم يُحذف — بقي في السجل مع السبب). بقية القائمة أصبحت حرة للإرسال.');
    } finally {
      setVoidBusy(false);
      await onRefresh();
    }
  };

  const flushFromBrowser = async () => {
    if (!adminPassword.trim()) {
      setErr('أدخل كلمة مرور الإدارة في خانة التأكيد أعلاه أولاً.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const prep = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outbox_prepare', password: adminPassword }),
      });
      const pj = await prep.json().catch(() => ({}));
      if (!prep.ok) {
        setErr(
          pj.error === 'reauth_failed'
            ? 'كلمة مرور الإدارة غير صحيحة.'
            : pj.error === 'dev_environment_blocked'
              ? 'إرسال البيانات الحقيقية متاح فقط من الموقع المنشور funademy.io.'
              : pj.error === 'prod_not_configured'
                ? 'بيانات اعتماد بيئة الإنتاج غير مهيأة بعد.'
                : `تعذّر تجهيز الإرسال (${pj.error ?? prep.status}).`,
        );
        return;
      }
      if (!pj.runId || !Array.isArray(pj.statements) || pj.statements.length === 0) {
        setMsg('لا توجد سجلات معلّقة للإرسال.');
        return;
      }
      const results: {
        statementId: string;
        ok: boolean;
        httpStatus: number | null;
        response: string;
      }[] = [];
      for (const s of pj.statements as { statementId: string; statement: unknown }[]) {
        try {
          const r = await fetch(pj.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Experience-API-Version': '1.0.3',
              Authorization: pj.authorization,
            },
            body: JSON.stringify(s.statement),
            cache: 'no-store',
          });
          const text = (await r.text().catch(() => '')).slice(0, 2000);
          results.push({ statementId: s.statementId, ok: r.ok, httpStatus: r.status, response: text });
          if (!r.ok) break; // stop-on-failure — per-learner event order must hold
        } catch (e) {
          results.push({
            statementId: s.statementId,
            ok: false,
            httpStatus: null,
            response: `browser_network_or_cors: ${e instanceof Error ? e.message : 'unknown'}`.slice(0, 300),
          });
          break;
        }
      }
      const rec = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outbox_record', runId: pj.runId, results }),
      });
      const rj = await rec.json().catch(() => ({}));
      if (!rec.ok) {
        setErr(`أُرسلت السجلات لكن تعذّر تسجيل النتيجة (${rj.error ?? rec.status}) — حدّث الصفحة.`);
        return;
      }
      const okCount = results.filter((r) => r.ok).length;
      const failedRow = results.find((r) => !r.ok);
      const remaining = Math.max(0, production.pending - okCount);
      setMsg(
        okCount === results.length
          ? `تم إرسال ${okCount} سجلاً بنجاح.${remaining > 0 ? ` تبقّى ${remaining} — اضغط الزر مجدداً.` : ''}`
          : `أُرسل ${okCount} من ${results.length} ثم توقّف عند أول فشل (HTTP ${failedRow?.httpStatus ?? 'شبكة'}).`,
      );
    } finally {
      setBusy(false);
      await onRefresh();
    }
  };

  const chip = (label: string, value: number, warn: boolean) => (
    <span
      className={`text-xs font-bold px-3 py-1 rounded-full ${
        warn ? 'bg-[#FFF7DA] text-[#8a6d00]' : 'bg-[#F0F5FF] text-[#101A38]'
      }`}
    >
      {label}: {value}
    </span>
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display font-bold text-lg text-[#101A38]">
          بيانات التعلّم الحقيقية — بيئة الإنتاج
        </h3>
        {production.configured ? (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[rgba(34,218,255,0.15)] text-[#0e7a94]">
            مهيأ
          </span>
        ) : (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FDECEC] text-[#B3261E]">
            غير مهيأ — أضف بيانات اعتماد الإنتاج
          </span>
        )}
      </div>
      <p className="text-sm text-[#5F6B92] leading-relaxed">
        كل درس يكمله طفل مسجَّل برقم هويته يُضاف تلقائياً إلى قائمة الإرسال، ويحاول الخادم تسليمه
        لنيلك فوراً ثم كل ١٠ دقائق. إذا بقيت سجلات معلّقة (نيلك يحجب خوادمنا جغرافياً) أرسلها من
        متصفحك بالزر أدناه — يتطلب كلمة مرور الإدارة في خانة التأكيد أعلاه.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {chip('معلّق', production.pending, production.pending > 0)}
        {chip('مُرسَل', production.sent, false)}
        {production.voided > 0 && chip('مُتخطّى', production.voided, true)}
        {chip('أطفال برقم هوية', production.childrenWithId, false)}
        {chip('أطفال بدون رقم', production.childrenWithoutId, production.childrenWithoutId > 0)}
      </div>
      {production.head && production.head.blocking && (
        <div className="bg-[#FDECEC] border border-[#B3261E]/40 rounded-xl px-4 py-3 space-y-3">
          <div className="text-sm font-bold text-[#B3261E] leading-relaxed">
            ⚠ سجل عالق في رأس القائمة — الإرسال مرتّب، فما دام هذا السجل يفشل تبقى كل سجلات
            الأطفال خلفه محجوزة.
          </div>
          <div className="bg-white border border-[#DFE5F2] rounded-xl p-3 space-y-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#101A38]">{VERB_AR[production.head.verb] ?? production.head.verb}</span>
              <span className="font-mono text-[#5F6B92]" dir="ltr">ID: {production.head.nationalId}</span>
              <span className="font-mono text-[#5F6B92]" dir="ltr">
                محاولات الخادم: {production.head.attempts}
              </span>
              <span className="text-[#B3261E] font-bold" dir="ltr">
                {production.head.lastHttpStatus ? `HTTP ${production.head.lastHttpStatus}` : 'خطأ شبكة'}
              </span>
            </div>
            {production.head.lastError && (
              <div className="font-mono break-all bg-[#F0F5FF] rounded-lg p-2 text-[#101A38]" dir="ltr">
                {production.head.lastError.slice(0, 500)}
              </div>
            )}
            <div className="font-mono text-[10px] text-[#5F6B92] break-all" dir="ltr">
              {production.head.statementId}
            </div>
          </div>
          <div className="text-xs text-[#5F6B92] leading-relaxed">
            إن كان الفشل مؤقتاً (حجب جغرافي، انقطاع) فأعد المحاولة من متصفحك بالزر أدناه. أما إن
            كان نيلك يرفض هذا السجل رفضاً دائماً (مثل HTTP 400) فيمكن تخطيه لتحرير بقية القائمة —
            التخطي لا يحذف السجل: يبقى في قاعدة البيانات مع السبب ومن نفّذه ومتى، ولا يُعلَّم أبداً
            كأنه أُرسل.
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              disabled={voidBusy}
              maxLength={500}
              placeholder="سبب التخطي (إلزامي — يُحفظ في السجل)"
              className="flex-1 min-w-[220px] border border-[#B3261E]/50 rounded-xl px-3 py-2 text-sm text-[#101A38] focus:outline-none focus:border-[#B3261E] bg-white"
            />
            <button
              onClick={voidHead}
              disabled={voidBusy || busy || !voidReason.trim()}
              className="bg-white border border-[#B3261E] text-[#B3261E] px-4 py-2 rounded-xl text-sm font-display font-bold disabled:opacity-50"
            >
              {voidBusy ? 'جارٍ التخطي…' : 'تخطي هذا السجل (لن يُرسل)'}
            </button>
          </div>
          <div className="text-[11px] text-[#5F6B92]">
            يتطلب كلمة مرور الإدارة في خانة التأكيد أعلاه.
          </div>
        </div>
      )}
      {production.stalled > 0 && (
        <div className="bg-[#FFF7DA] border border-[#FFD400]/50 rounded-xl px-4 py-3 text-sm text-[#8a6d00] leading-relaxed">
          {production.stalled} سجلاً تجاوز محاولات الخادم الآلية (الحجب الجغرافي غالباً) — أرسلها
          من متصفحك بالزر أدناه.
        </div>
      )}
      {(production.voidedRows?.length ?? 0) > 0 && (
        <details className="border border-[#DFE5F2] rounded-xl px-4 py-3">
          <summary className="cursor-pointer text-sm font-display font-bold text-[#101A38]">
            السجلات المُتخطّاة ({production.voidedRows!.length}) — قائمة مراجعة (قراءة فقط)
          </summary>
          <p className="text-xs text-[#5F6B92] leading-relaxed mt-2">
            كل قرار تخطي يبقى محفوظاً هنا للمساءلة: أي طفل، أي فعل، آخر خطأ من نيلك، السبب المكتوب،
            ومتى نُفّذ. لا يمكن حذف هذه السجلات أو إعادتها للإرسال من هنا.
          </p>
          <div className="mt-3 space-y-2">
            {production.voidedRows!.map((row) => (
              <div
                key={row.statementId}
                className="bg-[#F8FAFF] border border-[#DFE5F2] rounded-xl p-3 space-y-1 text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#101A38]">{VERB_AR[row.verb] ?? row.verb}</span>
                  <span className="font-mono text-[#5F6B92]" dir="ltr">ID: {row.nationalId}</span>
                  <span className="text-[#8a6d00] font-bold" dir="ltr">
                    {row.lastHttpStatus ? `HTTP ${row.lastHttpStatus}` : 'خطأ شبكة'}
                  </span>
                  {row.voidedAt && (
                    <span className="text-[#5F6B92]" dir="ltr">{fmtDateTime(row.voidedAt)}</span>
                  )}
                </div>
                <div className="text-[#101A38] leading-relaxed">
                  <span className="font-bold">السبب:</span> {row.voidReason || '—'}
                  {row.voidedBy && (
                    <span className="text-[#5F6B92]"> — نفّذه: {row.voidedBy === 'admin' ? 'الإدارة' : row.voidedBy}</span>
                  )}
                </div>
                {row.lastError && (
                  <div className="font-mono break-all bg-white border border-[#DFE5F2] rounded-lg p-2 text-[#5F6B92]" dir="ltr">
                    {row.lastError}
                  </div>
                )}
                <div className="font-mono text-[10px] text-[#5F6B92] break-all" dir="ltr">
                  {row.statementId}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {production.lastError && (
        <details className="text-xs text-[#5F6B92]">
          <summary className="cursor-pointer font-bold">
            آخر خطأ تسليم{production.lastHttpStatus ? ` (HTTP ${production.lastHttpStatus})` : ' (شبكة)'}
          </summary>
          <div className="font-mono break-all mt-1 bg-[#F0F5FF] rounded-lg p-2" dir="ltr">
            {production.lastError.slice(0, 500)}
          </div>
        </details>
      )}
      {!deployed && (
        <div className="bg-[#FFF7DA] border border-[#FFD400]/50 rounded-xl px-4 py-3 text-sm text-[#8a6d00] leading-relaxed">
          أنت في بيئة التطوير — تجميع البيانات الحقيقية وإرسالها يعملان فقط على الموقع المنشور
          funademy.io.
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={flushFromBrowser}
          disabled={busy || production.pending === 0 || !production.configured}
          className="px-5 py-2.5 rounded-xl font-display font-bold text-sm bg-[#FFD400] text-[#101A38] disabled:opacity-50"
        >
          {busy ? 'جارٍ الإرسال…' : `إرسال المعلّق من متصفحي (${production.pending})`}
        </button>
      </div>
      {msg && (
        <div className="bg-[rgba(34,218,255,0.1)] border border-[#22DAFF]/40 rounded-xl px-4 py-3 text-sm text-[#0e7a94] font-bold leading-relaxed">
          {msg}
        </div>
      )}
      {err && (
        <div className="bg-[#FDECEC] border border-[#B3261E]/30 rounded-xl px-4 py-3 text-sm text-[#B3261E] leading-relaxed">
          {err}
        </div>
      )}
    </div>
  );
}

type FixChild = { id: number; name: string; nationalId: string; locked: boolean };

/**
 * Correct a LOCKED child national ID (typo discovered after statements were
 * already sent to NELC). Deliberately cautious: pick the child, type the new
 * ID, then RETYPE it to confirm; the server refuses duplicates and records a
 * permanent audit row (who/when/old/new). The old NELC records are never
 * deleted — the LRS keeps them forever ("burned" ID); a fresh
 * registered+progressed snapshot is queued under the corrected ID.
 */
function NationalIdFixPanel() {
  const [children, setChildren] = useState<FixChild[]>([]);
  const [audit, setAudit] = useState<FixAudit[]>([]);
  const [childId, setChildId] = useState<number | ''>('');
  const [newId, setNewId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/svc/admin/children/national-id', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setChildren(Array.isArray(j.children) ? j.children : []);
      setAudit(Array.isArray(j.corrections) ? j.corrections : []);
    } catch {
      /* panel is auxiliary — leave empty on failure */
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const lockedChildren = children.filter((c) => c.locked);
  const selected = children.find((c) => c.id === childId) ?? null;
  const idValid = /^[12]\d{9}$/.test(newId.trim());
  const canSubmit =
    !!selected && idValid && confirmId.trim() === newId.trim() && newId.trim() !== selected.nationalId;

  const submit = async () => {
    if (!canSubmit || !selected) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/svc/admin/children/national-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selected.id, newNationalId: newId.trim(), confirm: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(
          j.error === 'national_id_taken'
            ? 'الرقم الجديد مستخدم لطفل آخر — لا يمكن التكرار.'
            : j.error === 'invalid_national_id'
              ? 'رقم الهوية غير صالح (10 أرقام تبدأ بـ 1 أو 2).'
              : j.error === 'delivery_in_flight' || j.error === 'browser_flush_active'
                ? 'يوجد إرسال جارٍ لسجلات هذا الطفل الآن — انتظر دقيقة (أو حتى انتهاء إرسال المتصفح) ثم أعد المحاولة.'
              : j.error === 'not_locked'
                ? 'رقم هذا الطفل غير مقفل — يمكن لولي الأمر تعديله بنفسه من بوابة الأهالي.'
                : j.error === 'same_national_id'
                  ? 'الرقم الجديد مطابق للرقم الحالي.'
                  : `تعذّر التصحيح (${j.error ?? r.status}).`,
        );
        return;
      }
      setMsg(
        `تم التصحيح: ${j.oldNationalId} ← ${j.newNationalId}. أُلغي ${j.supersededPending} سجلاً معلّقاً تحت الرقم الخاطئ، وأُدرج ${j.snapshotQueued} سجلاً جديداً (تسجيل + نسبة التقدم) تحت الرقم الصحيح.`,
      );
      setChildId('');
      setNewId('');
      setConfirmId('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-4">
      <h3 className="font-display font-bold text-lg text-[#101A38]">
        تصحيح رقم هوية مقفل (خطأ إدخال)
      </h3>
      <p className="text-sm text-[#5F6B92] leading-relaxed">
        بعد أول إرسال لنيلك يُقفل رقم هوية الطفل ولا يستطيع ولي الأمر تغييره. إذا اكتُشف أن الرقم
        أُدخل بالخطأ، صحّحه من هنا فقط.
      </p>
      <div className="bg-[#FFF7DA] border border-[#FFD400]/50 rounded-xl px-4 py-3 text-sm text-[#8a6d00] leading-relaxed">
        تنبيه: سجلات نيلك القديمة تحت الرقم الخاطئ <b>لا تُحذف أبداً</b> — نظام نيلك لا يحذف
        السجلات، ويبقى الرقم الخاطئ «محروقاً». ما يحدث عند التصحيح: تُلغى السجلات المعلّقة غير
        المُرسلة تحت الرقم الخاطئ، ويُقيَّد سجل جديد (تسجيل + نسبة التقدم الحالية) تحت الرقم
        الصحيح، ويُحفظ التغيير في سجل تدقيق دائم.
      </div>
      {lockedChildren.length === 0 ? (
        <p className="text-sm text-[#5F6B92]">لا يوجد حالياً أطفال بأرقام هوية مقفلة.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-[#101A38] space-y-1">
            <span className="font-bold">الطفل</span>
            <select
              value={childId}
              onChange={(e) => { setChildId(e.target.value ? Number(e.target.value) : ''); setMsg(null); setErr(null); }}
              className="w-full border border-[#DFE5F2] rounded-xl px-3 py-2.5 bg-white"
            >
              <option value="">— اختر طفلاً —</option>
              {lockedChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.nationalId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#101A38] space-y-1">
            <span className="font-bold">الرقم الصحيح</span>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              value={newId}
              onChange={(e) => { setNewId(e.target.value); setMsg(null); setErr(null); }}
              placeholder="1XXXXXXXXX"
              className="w-full border border-[#DFE5F2] rounded-xl px-3 py-2.5 font-mono"
            />
          </label>
          <label className="text-sm text-[#101A38] space-y-1">
            <span className="font-bold">أعد كتابة الرقم للتأكيد</span>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              value={confirmId}
              onChange={(e) => { setConfirmId(e.target.value); setMsg(null); setErr(null); }}
              placeholder="1XXXXXXXXX"
              className="w-full border border-[#DFE5F2] rounded-xl px-3 py-2.5 font-mono"
            />
          </label>
        </div>
      )}
      {selected && newId.trim() && !idValid && (
        <p className="text-xs text-[#B3261E]">رقم الهوية: 10 أرقام تبدأ بـ 1 أو 2.</p>
      )}
      {selected && idValid && confirmId.trim() && confirmId.trim() !== newId.trim() && (
        <p className="text-xs text-[#B3261E]">الرقمان غير متطابقين.</p>
      )}
      {lockedChildren.length > 0 && (
        <button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="px-5 py-2.5 rounded-xl font-display font-bold text-sm bg-[#B3261E] text-white disabled:opacity-40"
        >
          {busy ? 'جارٍ التصحيح…' : 'تصحيح الرقم نهائياً'}
        </button>
      )}
      {msg && (
        <div className="bg-[rgba(34,218,255,0.1)] border border-[#22DAFF]/40 rounded-xl px-4 py-3 text-sm text-[#0e7a94] font-bold leading-relaxed">
          {msg}
        </div>
      )}
      {err && (
        <div className="bg-[#FDECEC] border border-[#B3261E]/30 rounded-xl px-4 py-3 text-sm text-[#B3261E] leading-relaxed">
          {err}
        </div>
      )}
      {audit.length > 0 && (
        <details className="text-sm text-[#5F6B92]">
          <summary className="cursor-pointer font-bold text-[#101A38]">
            سجل التصحيحات السابقة ({audit.length})
          </summary>
          <div className="mt-2 space-y-1">
            {audit.map((a) => (
              <div key={a.id} className="bg-[#F0F5FF] rounded-lg px-3 py-2 text-xs leading-relaxed">
                {fmtDateTime(a.createdAt)} — {a.childName}: <span dir="ltr" className="font-mono">{a.oldNationalId}</span> ←{' '}
                <span dir="ltr" className="font-mono">{a.newNationalId}</span> (بواسطة {a.changedBy === 'admin' ? 'الإدارة' : a.changedBy}
                ، أُلغي {a.supersededPending} معلّقاً، قُيّد {a.snapshotQueued} جديداً)
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type FixAudit = {
  id: number;
  childId: number | null;
  childName: string;
  oldNationalId: string;
  newNationalId: string;
  changedBy: string;
  supersededPending: number;
  snapshotQueued: number;
  createdAt: string;
};
