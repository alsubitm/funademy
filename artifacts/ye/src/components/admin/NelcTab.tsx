'use client';

import { useState, useEffect, useCallback } from 'react';

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
  defaultCourseIri: string;
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/svc/admin/nelc');
      if (res.status === 401) { window.location.reload(); return; }
      const data = await res.json();
      setConfig({
        configured: data.configured,
        environment: data.environment,
        defaultCourseIri: data.defaultCourseIri,
      });
      setLogs(data.logs || []);
      setCourseIri((v) => v || data.defaultCourseIri || '');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const send = async () => {
    if (!adminPassword.trim()) {
      setError('أدخل كلمة مرور الإدارة في خانة التأكيد قبل الإرسال.');
      return;
    }
    setBusy(true);
    setError(null);
    setLastRun(null);
    try {
      // 1) The server prepares the journey (validation, fresh UUIDs, LRS creds).
      const prep = await fetch('/svc/admin/nelc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          password: adminPassword,
          nationalId: nationalId.trim(),
          courseIri: courseIri.trim(),
        }),
      });
      if (prep.status === 401) { window.location.reload(); return; }
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) {
        setError(
          prepData.error === 'invalid_national_id'
            ? 'رقم الهوية يجب أن يكون 10 أرقام (رقم هوية المتعلم التجريبي).'
            : prepData.error === 'invalid_course_iri'
              ? 'معرّف الدورة يجب أن يكون رابطاً صحيحاً يبدأ بـ https://'
              : prepData.error === 'not_configured'
                ? 'الاتصال بنظام تسجيل التعلم (LRS) غير مهيأ — أضف بيانات الاعتماد أولاً.'
                : prepData.error === 'reauth_failed'
                  ? 'كلمة مرور الإدارة غير صحيحة — أعد إدخالها في خانة التأكيد.'
                  : 'تعذّر تجهيز الرحلة — أعد المحاولة.',
        );
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
            «بدء الاختبار». إعادة الإرسال آمنة — كل تشغيل يولّد معرفات جديدة.
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
              onChange={(e) => setNationalId(e.target.value)}
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
              onChange={(e) => setCourseIri(e.target.value)}
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
        <button
          onClick={send}
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
                    {allOk ? (
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
                    <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap border-t border-[#F0F5FF] pt-1.5">
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
