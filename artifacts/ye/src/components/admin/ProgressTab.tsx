'use client';

import { useRef, useState } from 'react';
import { RunPicker, type RunOption } from './RunPicker';

const BADGE_ICONS: Record<string, string> = { star: '⭐', gear: '⚙️', rocket: '🚀', crown: '👑', bolt: '⚡', kite: '🪁' };

export function ProgressTab() {
  // The selected run is kept as its own object so search/paging never loses its identity.
  const [selectedRun, setSelectedRun] = useState<RunOption | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [rosterState, setRosterState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [student, setStudent] = useState<any | null>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const runRef = useRef<number | null>(null);
  const studentRef = useRef<number | null>(null);
  const runId = selectedRun?.id ?? null;

  const pickRun = async (run: RunOption) => {
    runRef.current = run.id;
    studentRef.current = null;
    setSelectedRun(run);
    setStudent(null);
    setRoster([]);
    setRosterState('loading');
    const res = await fetch(`/svc/admin/roster?runId=${run.id}`);
    if (res.status === 401) { window.location.reload(); return; }
    if (runRef.current !== run.id) return; // a later pick superseded this one
    if (!res.ok) { setRosterState('error'); return; }
    setRoster((await res.json()).roster || []);
    setRosterState('idle');
  };

  const pickStudent = async (s: any) => {
    const run = selectedRun;
    if (!run) return;
    studentRef.current = s.id;
    setStudent(s);
    const res = await fetch(`/svc/admin/progress?studentId=${s.id}&programId=${run.program.id}`);
    if (runRef.current !== run.id || studentRef.current !== s.id) return;
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

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <h2 className="text-3xl font-display font-bold text-[#101A38]">المهارات والأوسمة</h2>
        <p className="text-sm text-[#5F6B92] mt-1 font-medium">اختر الدفعة ثم الطالب لتوثيق تقدمه — يظهر مباشرة في بوابة الأهالي</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <RunPicker value={selectedRun} onChange={pickRun} />
          <div>
            <label htmlFor="progress-student" className="block text-[13px] font-bold text-[#5F6B92] mb-2">الطالب</label>
            <select
              id="progress-student"
              data-testid="select-progress-student"
              value={student?.id ?? ''}
              onChange={(e) => {
                const r = roster.find((x) => x.student.id === Number(e.target.value));
                if (r) pickStudent(r.student);
              }}
              className="input-hq"
              disabled={!runId}
            >
              <option value="" disabled>{!runId ? 'اختر الدفعة أولاً' : rosterState === 'loading' ? 'جارٍ التحميل…' : rosterState === 'error' ? 'تعذّر تحميل الطلاب' : roster.length ? 'اختر طالباً…' : 'لا يوجد مسجلون'}</option>
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
