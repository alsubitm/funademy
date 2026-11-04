'use client';

import { useCallback, useEffect, useState } from 'react';
import { LiveSessions } from '@/components/instructor/LiveSessions';

type Instructor = { id: number; name: string; email: string; active: boolean; courseRunIds: number[] };
type RunOpt = { id: number; title: string; program: string };
type Form = { id: number | null; name: string; email: string; active: boolean; courseRunIds: number[]; password: string };

const EMPTY: Form = { id: null, name: '', email: '', active: true, courseRunIds: [], password: '' };

const ERR: Record<string, string> = {
  email_taken: 'هذا البريد مستخدم لحساب مدرّب آخر.',
  email_exists: 'هذا البريد مستخدم لحساب مدرّب آخر.',
  password_length: 'كلمة المرور يجب أن تكون بين 12 و128 حرفاً.',
  invalid_assignments: 'إحدى الدفعات المختارة لم تعد متاحة. حدّث القائمة وحاول مجدداً.',
  conflict: 'هذا البريد مستخدم لحساب مدرّب آخر.',
  duplicate_email: 'هذا البريد مستخدم لحساب مدرّب آخر.',
  invalid_email: 'صيغة البريد الإلكتروني غير صحيحة.',
  invalid_name: 'الاسم مطلوب.',
  name_required: 'الاسم مطلوب.',
  weak_password: 'كلمة المرور يجب أن تكون بين 12 و128 حرفاً.',
  invalid_password: 'كلمة المرور يجب أن تكون بين 12 و128 حرفاً.',
  password_too_short: 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل.',
  password_too_long: 'كلمة المرور يجب ألا تتجاوز 128 حرفاً.',
  invalid_runs: 'إحدى الدفعات المختارة غير موجودة.',
  invalid_course_runs: 'إحدى الدفعات المختارة غير موجودة.',
  not_found: 'الحساب غير موجود. حدّث القائمة.',
  rate_limited: 'طلبات كثيرة. انتظر قليلاً.',
  unavailable: 'الخدمة غير متاحة مؤقتاً.',
};

async function errorText(res: Response) {
  let code = '';
  try { const j = await res.json(); code = typeof j?.error === 'string' ? j.error : ''; } catch { /* ignore */ }
  if (ERR[code]) return ERR[code];
  if (res.status === 409) return ERR.email_taken;
  if (res.status === 429) return ERR.rate_limited;
  if (res.status === 503) return ERR.unavailable;
  return code ? `تعذّر الحفظ (${code}).` : 'تعذّر الحفظ. حاول مرة أخرى.';
}

export function InstructorsTab() {
  const [list, setList] = useState<Instructor[]>([]);
  const [runs, setRuns] = useState<RunOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoadErr('');
    try {
      const res = await fetch('/svc/admin/instructors', { cache: 'no-store', credentials: 'include' });
      if (res.status === 401) { window.location.reload(); return; }
      if (!res.ok) throw new Error();
      const d = await res.json();
      setList(d.instructors ?? []);
      setRuns(d.runs ?? []);
    } catch { setLoadErr('تعذّر تحميل حسابات المدرّبين.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runName = (id: number) => runs.find((r) => r.id === id)?.title ?? `#${id}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setFormErr('');
    const creating = form.id === null;
    if (!form.name.trim()) return setFormErr(ERR.invalid_name);
    if ((creating || form.password) && (form.password.length < 12 || form.password.length > 128)) return setFormErr(ERR.weak_password);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), courseRunIds: form.courseRunIds, password: form.password };
      if (!creating) { body.id = form.id; body.active = form.active; if (!form.password) delete body.password; }
      const res = await fetch('/svc/admin/instructors', { method: creating ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!res.ok) { setForm({ ...form, password: '' }); setFormErr(await errorText(res)); return; }
      setNotice(creating ? 'أُنشئ حساب المدرّب. شارك كلمة المرور معه بطريقة آمنة خارج الموقع.'
        : form.password ? 'حُفظت التغييرات وعُيّنت كلمة مرور جديدة، وأُلغيت جميع جلسات الدخول الحالية لهذا المدرّب.' : 'حُفظت التغييرات.');
      setForm(null);
      await load();
    } catch { setFormErr('تعذّر الاتصال بالخادم.'); setForm((f) => (f ? { ...f, password: '' } : f)); } finally { setBusy(false); }
  };

  const toggleActive = async (i: Instructor) => {
    if (i.active && !window.confirm(`إيقاف حساب ${i.name}؟ لن يتمكن من الدخول حتى إعادة التفعيل.`)) return;
    setNotice(''); setLoadErr('');
    const res = await fetch('/svc/admin/instructors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id: i.id, name: i.name, email: i.email, active: !i.active, courseRunIds: i.courseRunIds }) }).catch(() => null);
    if (!res || !res.ok) { setLoadErr(res ? await errorText(res) : 'تعذّر الاتصال بالخادم.'); return; }
    setNotice(i.active ? `أُوقف حساب ${i.name}.` : `أُعيد تفعيل حساب ${i.name}.`);
    load();
  };

  const filtered = list.filter((i) => !q.trim() || `${i.name} ${i.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggleRun = (id: number) => form && setForm({ ...form, courseRunIds: form.courseRunIds.includes(id) ? form.courseRunIds.filter((x) => x !== id) : [...form.courseRunIds, id] });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[#101A38]">المدرّبون</h2>
          <p className="text-[#5F6B92] mt-1">حسابات المدرّبين وإسناد الدفعات. لا يوجد تسجيل عام؛ الحسابات تُنشأ من هنا فقط.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/instructor" target="_blank" rel="noopener" className="px-5 py-3 rounded-xl border border-[#DFE5F2] bg-white font-bold text-[#1C54CB] hover:bg-[#F0F5FF]" data-testid="link-admin-instructor-panel">Instructor panel</a>
          <button onClick={() => { setForm({ ...EMPTY }); setFormErr(''); setNotice(''); }} className="px-5 py-3 rounded-xl bg-[#FFCA17] text-[#101A38] font-bold shadow-sm hover:brightness-95" data-testid="button-add-instructor">إضافة مدرّب</button>
        </div>
      </div>

      {notice && <div role="status" className="p-4 rounded-xl bg-[#E3F5EC] text-[#178A5B] font-bold border border-[#BFE6D2]" data-testid="text-instructors-notice">{notice}</div>}
      {loadErr && (
        <div role="alert" className="p-4 rounded-xl bg-[#FBE7E5] text-[#C2362B] font-bold flex justify-between items-center gap-3" data-testid="text-instructors-error">
          <span>{loadErr}</span>
          <button onClick={() => { setLoading(true); load(); }} className="px-4 py-2 rounded-lg bg-white border border-[#F0B9B2]" data-testid="button-instructors-retry">إعادة المحاولة</button>
        </div>
      )}

      {form && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-[#DFE5F2] p-6 shadow-sm space-y-4" data-testid="form-instructor">
          <h3 className="text-xl font-display font-bold text-[#101A38]">{form.id === null ? 'مدرّب جديد' : `تعديل: ${form.name}`}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block"><span className="text-sm font-bold text-[#5F6B92]">الاسم</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-3 rounded-xl border border-[#DFE5F2]" data-testid="input-instructor-name" /></label>
            <label className="block"><span className="text-sm font-bold text-[#5F6B92]">البريد الإلكتروني</span>
              <input required type="email" dir="ltr" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full p-3 rounded-xl border border-[#DFE5F2]" data-testid="input-instructor-email" /></label>
            <label className="block md:col-span-2"><span className="text-sm font-bold text-[#5F6B92]">{form.id === null ? 'كلمة المرور (12–128 حرفاً)' : 'كلمة مرور بديلة (اختياري، 12–128 حرفاً)'}</span>
              <input type="password" dir="ltr" autoComplete="new-password" required={form.id === null} minLength={12} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full p-3 rounded-xl border border-[#DFE5F2]" data-testid="input-instructor-password" />
              {form.id !== null && <span className="block text-xs text-[#B76E00] mt-1">تعيين كلمة مرور بديلة يلغي جميع جلسات الدخول الحالية لهذا المدرّب.</span>}
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-bold text-[#5F6B92] mb-2">الدفعات المسندة</legend>
            {runs.length === 0 ? <p className="text-sm text-[#5F6B92]">لا توجد دفعات بعد. أنشئ دفعة من تبويب الدفعات.</p> : (
              <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
                {runs.map((r) => (
                  <label key={r.id} className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer ${form.courseRunIds.includes(r.id) ? 'border-[#1C54CB] bg-[#F0F5FF]' : 'border-[#DFE5F2]'}`}>
                    <input type="checkbox" checked={form.courseRunIds.includes(r.id)} onChange={() => toggleRun(r.id)} className="mt-1" data-testid={`checkbox-run-${r.id}`} />
                    <span><span className="font-bold text-[#101A38] block">{r.title}</span><span className="text-xs text-[#5F6B92]" dir="ltr">{r.program}</span></span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          {form.id !== null && (
            <label className="flex items-center gap-2 font-bold text-[#101A38]">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="checkbox-instructor-active" /> الحساب مفعّل
            </label>
          )}
          {formErr && <div role="alert" className="p-3 rounded-xl bg-[#FBE7E5] text-[#C2362B] font-bold" data-testid="text-instructor-form-error">{formErr}</div>}
          <div className="flex gap-2">
            <button disabled={busy} className="px-6 py-3 rounded-xl bg-[#1C54CB] text-white font-bold disabled:opacity-50" data-testid="button-save-instructor">{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
            <button type="button" onClick={() => { setForm(null); setFormErr(''); }} className="px-6 py-3 rounded-xl border border-[#DFE5F2] font-bold text-[#5F6B92]" data-testid="button-cancel-instructor">إلغاء</button>
          </div>
        </form>
      )}

      <input type="search" placeholder="ابحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} className="w-full md:w-80 p-3 rounded-xl border border-[#DFE5F2] bg-white" data-testid="input-search-instructors" />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-[#E6EAF3] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-10 rounded-2xl border-2 border-dashed border-[#DFE5F2] bg-white" data-testid="empty-instructors">
          <p className="font-display font-bold text-xl text-[#101A38]">{list.length === 0 ? 'لا توجد حسابات مدرّبين بعد' : 'لا نتائج مطابقة'}</p>
          <p className="text-[#5F6B92] mt-1">{list.length === 0 ? 'أضف أول مدرّب وأسند له دفعاته.' : 'جرّب كلمة بحث أخرى.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => (
            <div key={i.id} className="bg-white rounded-2xl border border-[#DFE5F2] p-5 flex flex-wrap items-center justify-between gap-4" data-testid={`card-instructor-${i.id}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg text-[#101A38]" data-testid={`text-instructor-name-${i.id}`}>{i.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i.active ? 'bg-[#E3F5EC] text-[#178A5B]' : 'bg-[#EEF0F5] text-[#5F6B92]'}`} data-testid={`status-instructor-${i.id}`}>{i.active ? 'مفعّل' : 'موقوف'}</span>
                </div>
                <div className="text-sm text-[#5F6B92]" dir="ltr" style={{ textAlign: 'right' }}>{i.email}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {i.courseRunIds.length === 0 ? <span className="text-xs text-[#B76E00]">لا دفعات مسندة</span> :
                    i.courseRunIds.map((r) => <span key={r} className="text-xs px-2 py-1 rounded-lg bg-[#F0F5FF] text-[#1C54CB] font-bold">{runName(r)}</span>)}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setForm({ id: i.id, name: i.name, email: i.email, active: i.active, courseRunIds: [...i.courseRunIds], password: '' }); setFormErr(''); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="px-4 py-2 rounded-xl border border-[#DFE5F2] font-bold text-[#1C54CB]" data-testid={`button-edit-instructor-${i.id}`}>تعديل</button>
                <button onClick={() => toggleActive(i)} className={`px-4 py-2 rounded-xl font-bold ${i.active ? 'text-[#C2362B] border border-[#F0B9B2]' : 'text-[#178A5B] border border-[#BFE6D2]'}`} data-testid={`button-toggle-instructor-${i.id}`}>{i.active ? 'إيقاف' : 'إعادة تفعيل'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-8 border-t border-[#DFE5F2]" data-testid="section-admin-live">
        <LiveSessions lang="ar" admin />
      </div>
    </div>
  );
}
