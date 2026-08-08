'use client';

import { useState, useEffect } from 'react';

const BADGE_ICONS: Record<string, string> = { star: '⭐', gear: '⚙️', rocket: '🚀', crown: '👑', bolt: '⚡', kite: '🪁' };

export function ProgressTab() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runId, setRunId] = useState<number | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [student, setStudent] = useState<any | null>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/svc/admin/runs');
      if (res.status === 401) { window.location.reload(); return; }
      const data = await res.json();
      setRuns((data.runs || []).filter((r: any) => r.active));
      setLoading(false);
    })();
  }, []);

  const selectedRun = runs.find((r) => r.id === runId) ?? null;

  const pickRun = async (id: number) => {
    setRunId(id);
    setStudent(null);
    const res = await fetch(`/svc/admin/roster?runId=${id}`);
    if (res.ok) setRoster((await res.json()).roster || []);
  };

  const pickStudent = async (s: any) => {
    setStudent(s);
    const res = await fetch(`/svc/admin/progress?studentId=${s.id}&programId=${selectedRun.program.id}`);
    if (res.ok) {
      const data = await res.json();
      setSkills(data.skills || []);
      setBadges(data.badges || []);
    }
  };

  const setSkill = async (skillId: number, status: string) => {
    setSkills((prev) => prev.map((sk) => (sk.id === skillId ? { ...sk, status: status === 'none' ? null : status } : sk)));
    const res = await fetch('/svc/admin/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id, skillId, status }),
    });
    if (!res.ok) pickStudent(student);
  };

  const setBadge = async (badgeId: number, award: boolean) => {
    setBadges((prev) => prev.map((b) => (b.id === badgeId ? { ...b, awardedAt: award ? new Date().toISOString() : null } : b)));
    const res = await fetch('/svc/admin/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id, badgeId, award }),
    });
    if (!res.ok) pickStudent(student);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <h2 className="text-3xl font-display font-bold text-[#101A38]">المهارات والأوسمة</h2>
        <p className="text-sm text-[#5F6B92] mt-1 font-medium">اختر الدفعة ثم الطالب لتوثيق تقدمه — يظهر مباشرة في بوابة الأهالي</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الدفعة</label>
            <select value={runId ?? ''} onChange={(e) => pickRun(Number(e.target.value))} className="input-hq">
              <option value="" disabled>اختر دفعة…</option>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.program?.nameAr} — {r.titleAr || r.time}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الطالب</label>
            <select
              value={student?.id ?? ''}
              onChange={(e) => {
                const r = roster.find((x) => x.student.id === Number(e.target.value));
                if (r) pickStudent(r.student);
              }}
              className="input-hq"
              disabled={!runId}
            >
              <option value="" disabled>{runId ? (roster.length ? 'اختر طالباً…' : 'لا يوجد مسجلون') : 'اختر الدفعة أولاً'}</option>
              {roster.map((r) => <option key={r.student.id} value={r.student.id}>{r.student.firstName} ({r.student.parentName || r.student.phone})</option>)}
            </select>
          </div>
        </div>
      </div>

      {student && (
        <>
          <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden">
            <div className="p-5 border-b border-[#DFE5F2] font-display font-bold text-[#101A38]">مهارات {student.firstName} — {selectedRun?.program?.nameAr}</div>
            <div className="p-4 space-y-3">
              {skills.map((sk) => (
                <div key={sk.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl border border-[#DFE5F2]">
                  <div className="flex-1 font-bold text-[#101A38]">{sk.nameAr}</div>
                  <div className="flex gap-2">
                    {[
                      { v: 'none', l: 'لم تبدأ', on: 'bg-[#F0F5FF] text-[#5F6B92] border-[#5F6B92]' },
                      { v: 'in_progress', l: 'قيد التعلم', on: 'bg-[rgba(28,84,203,0.12)] text-[#1C54CB] border-[#1C54CB]' },
                      { v: 'mastered', l: 'أتقنها ★', on: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00] border-[#D69F00]' },
                    ].map((o) => (
                      <button
                        key={o.v}
                        onClick={() => setSkill(sk.id, o.v)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                          (sk.status ?? 'none') === o.v ? o.on : 'bg-white text-[#5F6B92] border-[#DFE5F2]'
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {skills.length === 0 && <div className="text-center py-10 text-[#5F6B92] font-bold">لا توجد مهارات معرفة لهذا البرنامج.</div>}
            </div>
          </div>

          <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden">
            <div className="p-5 border-b border-[#DFE5F2] font-display font-bold text-[#101A38]">أوسمة {student.firstName}</div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {badges.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBadge(b.id, !b.awardedAt)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${
                    b.awardedAt ? 'border-[#D69F00] bg-[rgba(255,202,23,0.1)]' : 'border-dashed border-[#DFE5F2] bg-white opacity-70'
                  }`}
                >
                  <div className="text-3xl">{BADGE_ICONS[b.iconKey] ?? '⭐'}</div>
                  <div className="font-display font-bold text-sm text-[#101A38] mt-1">{b.nameAr}</div>
                  <div className="text-[11px] font-bold mt-1 text-[#5F6B92]">{b.awardedAt ? '✓ ممنوح — اضغط للإلغاء' : 'اضغط للمنح'}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
