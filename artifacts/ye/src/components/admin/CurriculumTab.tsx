'use client';

import { useState, useEffect, useRef } from 'react';
import { englishReadiness } from '@/lib/learning-readiness';
import LessonVideoPreview from './LessonVideoPreview';

interface Subject {
  id: number;
  nameAr: string;
  nameEn: string;
  slug: string;
  icon: string;
  color: string;
  position: number;
  unitCount: number;
  lessonCount: number;
}

interface Unit {
  id: number;
  titleAr: string;
  titleEn: string;
  band: string;
  position: number;
  status: string;
  lessons: Lesson[];
}

interface Lesson {
  id: number;
  titleAr: string;
  titleEn: string;
  durationMinutes: number;
  status: string;
  position: number;
  isFreeSample: boolean;
  descAr: string | null;
  descEn: string | null;
  videoUrl: string | null;
  videoType: string;
  videoLanguage: string;
  videoUrlEn: string | null;
  videoTypeEn: string;
  exercises: { promptEn: string; options: string[]; optionsEn: string[] }[];
}

const BAND_LABELS: Record<string, string> = {
  explorers: 'المستكشفون', builders: 'الصانعون',
  achievers: 'المتفوقون', graduates: 'الخريجون',
};
const BANDS = ['explorers', 'builders', 'achievers', 'graduates'] as const;

export default function CurriculumTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [units, setUnits] = useState<Record<number, Unit[]>>({});
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState<number | null>(null);
  const [showAddLesson, setShowAddLesson] = useState<number | null>(null); // unitId
  const [showExercises, setShowExercises] = useState<number | null>(null); // lessonId
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  async function loadSubjects() {
    const r = await fetch('/svc/admin/curriculum/subjects').catch(() => null);
    if (!r?.ok) { if (r?.status === 401) location.reload(); return; }
    setSubjects(await r.json());
    setLoading(false);
  }

  async function loadUnits(subjectId: number) {
    const r = await fetch(`/svc/admin/curriculum/units?subjectId=${subjectId}`).catch(() => null);
    if (!r?.ok) return;
    const data = await r.json();
    setUnits((u) => ({ ...u, [subjectId]: data }));
  }

  useEffect(() => { loadSubjects(); }, []);

  async function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!units[id]) await loadUnits(id);
  }

  async function deleteSubject(id: number) {
    if (!confirm('حذف هذه المادة وجميع وحداتها ودروسها؟')) return;
    await fetch(`/svc/admin/curriculum/subjects/${id}`, { method: 'DELETE' });
    await loadSubjects();
    if (expanded === id) setExpanded(null);
    showToast('تم الحذف');
  }

  async function deleteUnit(subjectId: number, unitId: number) {
    if (!confirm('حذف هذه الوحدة وجميع دروسها؟')) return;
    await fetch(`/svc/admin/curriculum/units/${unitId}`, { method: 'DELETE' });
    await loadUnits(subjectId);
    showToast('تم الحذف');
  }

  async function deleteLesson(subjectId: number, lessonId: number) {
    if (!confirm('حذف هذا الدرس؟')) return;
    await fetch(`/svc/admin/curriculum/lessons/${lessonId}`, { method: 'DELETE' });
    await loadUnits(subjectId);
    showToast('تم الحذف');
  }

  async function toggleLessonStatus(subjectId: number, lesson: Lesson) {
    const newStatus = lesson.status === 'published' ? 'draft' : 'published';
    await fetch(`/svc/admin/curriculum/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await loadUnits(subjectId);
  }

  async function moveUnit(subjectId: number, unitId: number, dir: 'up' | 'down') {
    const list = units[subjectId] ?? [];
    const idx = list.findIndex((u) => u.id === unitId);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx], b = list[swapIdx];
    await Promise.all([
      fetch(`/svc/admin/curriculum/units/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: b.position }) }),
      fetch(`/svc/admin/curriculum/units/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: a.position }) }),
    ]);
    await loadUnits(subjectId);
  }

  if (loading) return <div className="curr-wrap" style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;

  return (
    <div className="curr-wrap" dir="rtl">
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#101A38', color: '#fff', borderRadius: 10, padding: '10px 20px', zIndex: 999, fontSize: 14 }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>إدارة المناهج</h2>
        <button className="curr-add-btn" onClick={() => setShowAddSubject(true)}>+ إضافة مادة</button>
      </div>

      {subjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          لا توجد مواد بعد. أضف مادة للبدء.
        </div>
      )}

      {subjects.map((s) => (
        <div key={s.id} className="curr-subject-card">
          <div className="curr-subject-header" onClick={() => toggleExpand(s.id)}>
            <span className="curr-subject-icon" style={{ background: s.color + '22', borderRadius: 10, padding: 4 }}>{s.icon}</span>
            <div className="curr-subject-info">
              <div className="curr-subject-name">{s.nameAr} — {s.nameEn}</div>
              <div className="curr-subject-meta">{s.unitCount} وحدة · {s.lessonCount} درس · {s.slug}</div>
            </div>
            <div className="curr-subject-actions" onClick={(e) => e.stopPropagation()}>
              <button className="curr-icon-btn" onClick={() => deleteSubject(s.id)} title="حذف">🗑</button>
              <span style={{ color: '#ccc' }}>{expanded === s.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {expanded === s.id && (
            <div>
              {(units[s.id] ?? []).map((u, uIdx) => (
                <div key={u.id} className="curr-unit">
                  <div className="curr-unit-header">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="curr-icon-btn" onClick={() => moveUnit(s.id, u.id, 'up')} disabled={uIdx === 0}>↑</button>
                      <button className="curr-icon-btn" onClick={() => moveUnit(s.id, u.id, 'down')} disabled={uIdx === (units[s.id]?.length ?? 1) - 1}>↓</button>
                    </div>
                    <span className="curr-unit-title">{u.titleAr}</span>
                    <span className="curr-unit-band">{BAND_LABELS[u.band] ?? u.band}</span>
                    <span style={{ fontSize: 11, color: u.status === 'published' ? '#27ae60' : '#e67e22' }}>{u.status === 'published' ? 'منشور' : 'مسودة'}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="curr-add-btn" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setShowAddLesson(u.id)}>+ درس</button>
                      <button className="curr-icon-btn" onClick={() => deleteUnit(s.id, u.id)} title="حذف الوحدة">🗑</button>
                    </div>
                  </div>
                  <div className="curr-lessons-list">
                    {u.lessons.map((l) => (
                      <div key={l.id} className="curr-lesson-row">
                        <span className="curr-lesson-title">{l.titleAr}</span>
                        <span className="curr-lesson-meta">{l.durationMinutes}د</span>
                        <span style={{ fontSize: 11 }}>
                          النص الإنجليزي: {englishReadiness(l).text ? 'جاهز' : 'ناقص'} · الفيديو: {{
                            ready: 'إنجليزي حسب المؤلف (التشغيل غير مفحوص)', arabic: 'عربي فقط', unknown: 'اللغة غير محددة', none: 'بدون فيديو',
                          }[englishReadiness(l).video]}
                        </span>
                        <button className="curr-icon-btn" onClick={() => setEditingLesson(l)}>تعديل</button>
                        {l.isFreeSample && <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: 6 }}>مجاني</span>}
                        <span
                          style={{ fontSize: 11, color: l.status === 'published' ? '#27ae60' : '#e67e22', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => toggleLessonStatus(s.id, l)}
                        >
                          {l.status === 'published' ? 'منشور' : 'مسودة'}
                        </span>
                        <button className="curr-icon-btn edit" title="تمارين" onClick={() => setShowExercises(l.id)}>📝</button>
                        <button className="curr-icon-btn" onClick={() => deleteLesson(s.id, l.id)}>🗑</button>
                      </div>
                    ))}
                    {u.lessons.length === 0 && (
                      <div style={{ padding: '8px 0', color: '#ccc', fontSize: 13 }}>لا توجد دروس</div>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 16px' }}>
                <button className="curr-add-btn" onClick={() => setShowAddUnit(s.id)}>+ إضافة وحدة</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Add Subject Modal ── */}
      {showAddSubject && (
        <AddSubjectModal
          onClose={() => setShowAddSubject(false)}
          onDone={() => { loadSubjects(); setShowAddSubject(false); showToast('تم إضافة المادة'); }}
        />
      )}

      {/* ── Add Unit Modal ── */}
      {showAddUnit !== null && (
        <AddUnitModal
          subjectId={showAddUnit}
          onClose={() => setShowAddUnit(null)}
          onDone={() => { loadUnits(showAddUnit!); setShowAddUnit(null); loadSubjects(); showToast('تم إضافة الوحدة'); }}
        />
      )}

      {/* ── Add Lesson Modal ── */}
      {showAddLesson !== null && (
        <AddLessonModal
          unitId={showAddLesson}
          subjectId={expanded!}
          onClose={() => setShowAddLesson(null)}
          onDone={() => { loadUnits(expanded!); setShowAddLesson(null); loadSubjects(); showToast('تم إضافة الدرس'); }}
        />
      )}

      {/* ── Exercises Modal ── */}
      {editingLesson && (
        <AddLessonModal
          unitId={0} subjectId={expanded!} lesson={editingLesson}
          onClose={() => setEditingLesson(null)}
          onDone={() => { loadUnits(expanded!); setEditingLesson(null); showToast('تم حفظ الدرس'); }}
        />
      )}
      {showExercises !== null && (
        <ExercisesModal
          lessonId={showExercises}
          onClose={() => { setShowExercises(null); if (expanded) loadUnits(expanded); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────

function ModalWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="learn-modal-backdrop" onClick={onClose}>
      <div className="learn-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h2 className="learn-modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddSubjectModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ nameAr: '', nameEn: '', slug: '', icon: '📚', color: '#1C54CB' });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch('/svc/admin/curriculum/subjects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    setSaving(false);
    if (r.ok) onDone();
  }

  return (
    <ModalWrap title="إضافة مادة جديدة" onClose={onClose}>
      <label className="learn-label">الاسم بالعربية</label>
      <input className="learn-input" value={f.nameAr} onChange={(e) => setF((x) => ({ ...x, nameAr: e.target.value }))} />
      <label className="learn-label">الاسم بالإنجليزية</label>
      <input className="learn-input" value={f.nameEn} onChange={(e) => setF((x) => ({ ...x, nameEn: e.target.value }))} />
      <label className="learn-label">المعرّف (slug)</label>
      <input className="learn-input" value={f.slug} onChange={(e) => setF((x) => ({ ...x, slug: e.target.value }))} placeholder="math, science..." />
      <label className="learn-label">الأيقونة (emoji)</label>
      <input className="learn-input" value={f.icon} onChange={(e) => setF((x) => ({ ...x, icon: e.target.value }))} />
      <label className="learn-label">اللون (hex)</label>
      <input className="learn-input" type="color" value={f.color} onChange={(e) => setF((x) => ({ ...x, color: e.target.value }))} />
      <div className="learn-modal-actions">
        <button className="btn y" onClick={save} disabled={saving}>{saving ? '...' : 'حفظ'}</button>
        <button className="btn" onClick={onClose}>إلغاء</button>
      </div>
    </ModalWrap>
  );
}

function AddUnitModal({ subjectId, onClose, onDone }: { subjectId: number; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ titleAr: '', titleEn: '', band: 'explorers', status: 'published' });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch('/svc/admin/curriculum/units', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, subjectId }),
    });
    setSaving(false);
    if (r.ok) onDone();
  }

  return (
    <ModalWrap title="إضافة وحدة" onClose={onClose}>
      <label className="learn-label">عنوان الوحدة بالعربية</label>
      <input className="learn-input" value={f.titleAr} onChange={(e) => setF((x) => ({ ...x, titleAr: e.target.value }))} />
      <label className="learn-label">عنوان الوحدة بالإنجليزية</label>
      <input className="learn-input" value={f.titleEn} onChange={(e) => setF((x) => ({ ...x, titleEn: e.target.value }))} />
      <label className="learn-label">المستوى</label>
      <select className="learn-input" value={f.band} onChange={(e) => setF((x) => ({ ...x, band: e.target.value }))}>
        {BANDS.map((b) => <option key={b} value={b}>{BAND_LABELS[b]}</option>)}
      </select>
      <label className="learn-label">الحالة</label>
      <select className="learn-input" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
        <option value="published">منشور</option>
        <option value="draft">مسودة</option>
      </select>
      <div className="learn-modal-actions">
        <button className="btn y" onClick={save} disabled={saving}>{saving ? '...' : 'حفظ'}</button>
        <button className="btn" onClick={onClose}>إلغاء</button>
      </div>
    </ModalWrap>
  );
}

function AddLessonModal({ unitId, subjectId: _s, lesson, onClose, onDone }: { unitId: number; subjectId: number; lesson?: Lesson; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    titleAr: lesson?.titleAr ?? '', titleEn: lesson?.titleEn ?? '',
    descAr: lesson?.descAr ?? '', descEn: lesson?.descEn ?? '',
    videoUrl: lesson?.videoUrl ?? '', videoType: lesson?.videoType ?? 'youtube',
    videoLanguage: lesson?.videoLanguage ?? 'unknown', videoUrlEn: lesson?.videoUrlEn ?? '',
    videoTypeEn: lesson?.videoTypeEn ?? 'youtube',
    durationMinutes: lesson?.durationMinutes ?? 8, status: lesson?.status ?? 'published', isFreeSample: lesson?.isFreeSample ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/svc/admin/curriculum/lessons${lesson ? `/${lesson.id}` : ''}`, {
        method: lesson ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, unitId }),
      });
      if (r.ok) onDone();
      else setError('تعذر حفظ الدرس. تحقق من الحقول وروابط الفيديو.');
    } catch { setError('تعذر الاتصال. حاول مرة أخرى.'); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrap title={lesson ? 'تعديل الدرس' : 'إضافة درس'} onClose={onClose}>
      {error && <p role="alert">{error}</p>}
      <label className="learn-label">عنوان الدرس بالعربية</label>
      <input className="learn-input" value={f.titleAr} onChange={(e) => setF((x) => ({ ...x, titleAr: e.target.value }))} />
      <label className="learn-label">عنوان الدرس بالإنجليزية</label>
      <input className="learn-input" value={f.titleEn} onChange={(e) => setF((x) => ({ ...x, titleEn: e.target.value }))} />
      <label className="learn-label">الوصف بالعربية</label>
      <textarea className="learn-input" value={f.descAr} onChange={e => setF(x => ({ ...x, descAr: e.target.value }))} />
      <label className="learn-label">الوصف بالإنجليزية</label>
      <textarea className="learn-input" value={f.descEn} onChange={e => setF(x => ({ ...x, descEn: e.target.value }))} />
      <label className="learn-label">لغة الفيديو الأصلي</label>
      <select className="learn-input" value={f.videoLanguage} onChange={e => setF(x => ({ ...x, videoLanguage: e.target.value }))}>
        <option value="unknown">غير محددة</option><option value="ar">عربي</option>
        <option value="en">إنجليزي</option><option value="bilingual">عربي وإنجليزي</option>
      </select>
      <label className="learn-label">فيديو إنجليزي بديل (اختياري)</label>
      <input className="learn-input" value={f.videoUrlEn} onChange={e => setF(x => ({ ...x, videoUrlEn: e.target.value }))} placeholder="https://..." />
      <label className="learn-label">نوع الفيديو الإنجليزي</label>
      <select className="learn-input" value={f.videoTypeEn} onChange={e => setF(x => ({ ...x, videoTypeEn: e.target.value }))}>
        <option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="mp4">MP4</option>
      </select>
      <p style={{ fontSize: 12 }}>لا يظهر الفيديو العربي أو غير محدد اللغة في الدرس الإنجليزي. يُفضّل الفيديو الإنجليزي البديل عند توفره.</p>
      <LessonVideoPreview key={`en:${f.videoTypeEn}:${f.videoUrlEn}`} url={f.videoUrlEn} type={f.videoTypeEn} label="الفيديو الإنجليزي البديل" />
      <label className="learn-label">رابط الفيديو الأصلي</label>
      <input className="learn-input" value={f.videoUrl} onChange={(e) => setF((x) => ({ ...x, videoUrl: e.target.value }))} placeholder="https://youtu.be/..." />
      <label className="learn-label">نوع الفيديو</label>
      <select className="learn-input" value={f.videoType} onChange={(e) => setF((x) => ({ ...x, videoType: e.target.value }))}>
        <option value="youtube">YouTube</option>
        <option value="vimeo">Vimeo</option>
        <option value="mp4">MP4</option>
      </select>
      <LessonVideoPreview key={`original:${f.videoType}:${f.videoUrl}`} url={f.videoUrl} type={f.videoType} label="الفيديو الأصلي" />
      <label className="learn-label">مدة الدرس (دقائق)</label>
      <input className="learn-input" type="number" min={1} value={f.durationMinutes} onChange={(e) => setF((x) => ({ ...x, durationMinutes: Number(e.target.value) }))} />
      <label className="learn-label">الحالة</label>
      <select className="learn-input" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
        <option value="published">منشور</option>
        <option value="draft">مسودة</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#333' }}>
        <input type="checkbox" checked={f.isFreeSample} onChange={(e) => setF((x) => ({ ...x, isFreeSample: e.target.checked }))} />
        عينة مجانية
      </label>
      <div className="learn-modal-actions">
        <button className="btn y" onClick={save} disabled={saving}>{saving ? '...' : 'حفظ'}</button>
        <button className="btn" onClick={onClose}>إلغاء</button>
      </div>
    </ModalWrap>
  );
}

interface ExItem { id: number; type: string; promptAr: string; promptEn: string; options: string[]; correctAnswer: string; position: number; }

function ExercisesModal({ lessonId, onClose, showToast }: { lessonId: number; onClose: () => void; showToast: (m: string) => void }) {
  const [exercises, setExercises] = useState<ExItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [jsonInput, setJsonInput] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch(`/svc/admin/curriculum/lessons/${lessonId}/exercises`)
      .then((r) => r.ok ? r.json() : [])
      .then(setExercises)
      .finally(() => setLoading(false));
  }, [lessonId]);

  async function importExercises() {
    let parsed: unknown;
    try { parsed = JSON.parse(jsonInput); } catch { showToast('JSON غير صحيح'); return; }
    if (!Array.isArray(parsed)) { showToast('يجب أن يكون JSON مصفوفة'); return; }
    setImporting(true);
    const r = await fetch(`/svc/admin/curriculum/lessons/${lessonId}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: parsed, replace: replacing }),
    });
    setImporting(false);
    if (r.ok) {
      const res = await r.json();
      showToast(`تم: ${res.imported} تمارين، ${res.skipped} مرفوضة`);
      // Reload
      const r2 = await fetch(`/svc/admin/curriculum/lessons/${lessonId}/exercises`);
      setExercises(await r2.json());
      setJsonInput('');
    } else {
      showToast('حدث خطأ في الاستيراد');
    }
  }

  async function deleteExercise(exId: number) {
    await fetch(`/svc/admin/curriculum/exercises/${exId}`, { method: 'DELETE' });
    setExercises((prev) => prev.filter((e) => e.id !== exId));
    showToast('تم الحذف');
  }

  return (
    <div className="learn-modal-backdrop" onClick={onClose}>
      <div className="learn-modal" dir="rtl" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="learn-modal-title">تمارين الدرس</h2>

        {loading ? (
          <p>جاري التحميل...</p>
        ) : (
          <>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {exercises.length === 0 ? (
                <p style={{ color: '#888', fontSize: 13 }}>لا توجد تمارين</p>
              ) : exercises.map((ex) => (
                <div key={ex.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{ex.type}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{ex.promptAr}</span>
                  <span style={{ fontSize: 12, color: '#27ae60' }}>{ex.correctAnswer}</span>
                  <button className="curr-icon-btn" onClick={() => deleteExercise(ex.id)}>🗑</button>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
              <label className="learn-label" style={{ marginBottom: 4, display: 'block' }}>
                استيراد تمارين (JSON Array)
              </label>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 6px' }}>
                {`[{"type":"multiple_choice","promptAr":"...","promptEn":"...","options":["...","..."],"optionsEn":["English option 1","English option 2"],"correctAnswer":"..."}]`}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>
                ضع ترجمة كل خيار في optionsEn بنفس ترتيب options. تبقى correctAnswer قيمة الخيار الأصلي، وليس ترجمته.
              </p>
              <textarea
                className="learn-input"
                style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="الصق JSON هنا..."
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 6 }}>
                <input type="checkbox" checked={replacing} onChange={(e) => setReplacing(e.target.checked)} />
                استبدال التمارين الحالية
              </label>
              <div className="learn-modal-actions" style={{ marginTop: 8 }}>
                <button className="btn y" onClick={importExercises} disabled={importing}>{importing ? '...' : 'استيراد'}</button>
                <button className="btn" onClick={onClose}>إغلاق</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
