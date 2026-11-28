'use client';

import { useMemo, useState } from 'react';
import { WEEKDAYS_AR } from '@/lib/constants';

type Program = { id: number; nameAr: string; ageMin?: number; ageMax?: number };

/**
 * Create a whole timetable of groups in one step: choose days and times, then
 * tick which programs run in each slot. Shared settings (format, size, price,
 * kit fee, dates) apply to every group. Calls POST /svc/admin/runs/batch.
 */
export function TimetableBuilder({ programs, onCreated }: { programs: Program[]; onCreated: () => void }) {
  const [format, setFormat] = useState<'online' | 'in_person'>('online');
  const [titleAr, setTitleAr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('8');
  const [price, setPrice] = useState('1380');
  const [kitFee, setKitFee] = useState('570');
  const [location, setLocation] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [timesText, setTimesText] = useState('17:00, 19:00');
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const times = useMemo(
    () => [...new Set(timesText.split(/[,،\s]+/).map((t) => t.trim()).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort(),
    [timesText],
  );
  const slots = useMemo(
    () => [...days].sort((a, b) => a - b).flatMap((d) => times.map((t) => ({ key: `${d}|${t}`, weekday: d, time: t }))),
    [days, times],
  );
  const groups = slots.flatMap((s) => (picked[s.key] ?? []).map((programId) => ({ programId, weekday: s.weekday, time: s.time })));

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const toggleProgram = (key: string, id: number) =>
    setPicked((cur) => {
      const list = cur[key] ?? [];
      return { ...cur, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });

  const create = async () => {
    setMessage(null);
    if (!startDate || !endDate || groups.length === 0) {
      setMessage({ ok: false, text: 'اختر تاريخ البداية والنهاية، ثم الأيام والأوقات، ثم البرامج لكل موعد.' });
      return;
    }
    if (!confirm(`سيتم إنشاء ${groups.length} دفعة ${format === 'online' ? 'أونلاين' : 'حضورية'}. متابعة؟`)) return;
    setBusy(true);
    try {
      const res = await fetch('/svc/admin/runs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format, titleAr: titleAr || null, startDate, endDate,
          capacity: Number(capacity), monthlyPriceSar: Number(price),
          kitFeeSar: format === 'online' ? Number(kitFee || 0) : 0,
          location: format === 'in_person' ? location || null : null,
          groups,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reasons: Record<string, string> = {
          validation: 'تحقق من الحقول (السعة ١–١٠٠، الأسعار أرقام صحيحة، النهاية بعد البداية).',
          duplicate_group: 'نفس البرنامج مكرر في نفس اليوم والوقت.',
          no_sessions_in_range: 'أحد الأيام لا يقع بين تاريخ البداية والنهاية.',
          program_not_found: 'برنامج غير موجود — حدّث الصفحة.',
        };
        setMessage({ ok: false, text: reasons[data.error] ?? 'تعذّر الإنشاء — حاول مرة أخرى.' });
        return;
      }
      setMessage({
        ok: true,
        text: `تم إنشاء ${data.created} دفعة${data.skipped ? `، وتخطي ${data.skipped} موجودة مسبقاً` : ''}.${data.active ? '' : ' الدفعات الحضورية مخفية حتى تضيف مقراً مؤكداً وتفعّلها.'}`,
      });
      setPicked({});
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  const label = 'block text-[13px] font-bold text-[#5F6B92] mb-2';
  const chip = (on: boolean) =>
    on
      ? { background: '#7C3AED', color: '#FFFFFF', borderColor: '#7C3AED' }
      : { background: '#FFFEFA', color: '#101A38', borderColor: '#E8DCC4' };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#DFE5F2] grid gap-5" data-testid="timetable-builder">
      <div>
        <h3 className="font-display font-extrabold text-xl text-[#101A38]">إنشاء جدول كامل</h3>
        <p className="text-sm text-[#5F6B92] mt-1">اختر الأيام والأوقات، ثم حدّد البرامج في كل موعد. تُنشأ كل الدفعات مرة واحدة بنفس الإعدادات.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className={label} htmlFor="tt-format">نوع الحصص</label>
          <select id="tt-format" className="input-hq" value={format} onChange={(e) => {
            const f = e.target.value as 'online' | 'in_person';
            setFormat(f);
            setCapacity(f === 'online' ? '8' : '16');
          }}>
            <option value="online">أونلاين</option>
            <option value="in_person">حضوري</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="tt-title">اسم الدفعة (اختياري)</label>
          <input id="tt-title" className="input-hq" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="مثال: دفعة يناير ٢٠٢٧" />
        </div>
        <div>
          <label className={label} htmlFor="tt-start">تاريخ البداية</label>
          <input id="tt-start" type="date" className="input-hq" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="tt-end">تاريخ النهاية</label>
          <input id="tt-end" type="date" className="input-hq" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="tt-cap">عدد الأطفال في الدفعة</label>
          <input id="tt-cap" type="number" min="1" max="100" className="input-hq font-mono text-center" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="tt-price">السعر الشهري (ر.س)</label>
          <input id="tt-price" type="number" min="0" className="input-hq font-mono text-center" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        {format === 'online' ? (
          <div>
            <label className={label} htmlFor="tt-kit">رسوم الطقم — مرة واحدة (ر.س)</label>
            <input id="tt-kit" type="number" min="0" max="10000" className="input-hq font-mono text-center" value={kitFee} onChange={(e) => setKitFee(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={label} htmlFor="tt-loc">المقر (اتركه فارغاً إن لم يتأكد)</label>
            <input id="tt-loc" className="input-hq" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        )}
        <div>
          <label className={label} htmlFor="tt-times">الأوقات (مفصولة بفاصلة)</label>
          <input id="tt-times" dir="ltr" className="input-hq font-mono" value={timesText} onChange={(e) => setTimesText(e.target.value)} placeholder="17:00, 19:00" />
        </div>
      </div>

      <div>
        <span className={label}>الأيام</span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS_AR.map((d, i) => (
            <button key={i} type="button" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}
              className="px-3 py-1.5 rounded-full text-sm font-bold border" style={chip(days.includes(i))}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {slots.length > 0 && (
        <div className="grid gap-3">
          <span className={label}>البرامج في كل موعد</span>
          {slots.map((s) => (
            <div key={s.key} className="border border-[#E8DCC4] rounded-2xl p-3">
              <div className="font-bold text-[#101A38] mb-2">{WEEKDAYS_AR[s.weekday]} <span className="font-mono" dir="ltr">{s.time}</span></div>
              <div className="flex flex-wrap gap-2">
                {programs.map((p) => {
                  const on = (picked[s.key] ?? []).includes(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={on} onClick={() => toggleProgram(s.key, p.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-bold border" style={chip(on)}>
                      {p.nameAr}{p.ageMin != null && p.ageMax != null ? ` (${p.ageMin}–${p.ageMax})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <div role={message.ok ? 'status' : 'alert'} className="text-sm font-bold" style={{ color: message.ok ? '#146c3c' : '#a12622' }}>{message.text}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[#5F6B92]">عدد الدفعات التي ستُنشأ: <b className="text-[#101A38]">{groups.length}</b></span>
        <button type="button" disabled={busy || groups.length === 0} onClick={create}
          className="text-white px-8 py-3.5 rounded-xl font-display font-bold text-lg disabled:opacity-60" style={{ background: '#7C3AED' }}>
          {busy ? 'جاري الإنشاء…' : `إنشاء ${groups.length} دفعة`}
        </button>
      </div>
    </div>
  );
}
