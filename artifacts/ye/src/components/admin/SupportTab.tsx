'use client';

import { useCallback, useEffect, useState } from 'react';

type Item = {
  id: string | number;
  conversationId?: string | number;
  status: string;
  summary: string | null;
  reason?: string | null;
  contactMethod: string | null;
  assignedTo?: string | null;
  whatsappHref: string | null;
  createdAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  open: 'مفتوحة',
  active: 'نشطة',
  escalated: 'مصعّدة',
  closed: 'مغلقة',
  resolved: 'محلولة',
};

const CONTACT_LABEL: Record<string, string> = {
  whatsapp: 'واتساب',
  email: 'البريد الإلكتروني',
  phone: 'الهاتف',
  none: 'غير محدد',
};

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export function SupportTab() {
  const [conversations, setConversations] = useState<Item[]>([]);
  const [escalations, setEscalations] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [capabilities, setCapabilities] = useState({
    assignEscalation: true,
    updateConversationStatus: true,
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/svc/admin/support', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error('load_failed');
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setEscalations(data.escalations ?? []);
      setCapabilities(data.capabilities ?? {
        assignEscalation: true,
        updateConversationStatus: true,
      });
    } catch {
      setError('تعذّر تحميل صندوق الدعم. أعد المحاولة.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (item: Item, target: 'conversation' | 'escalation', action: 'assign' | 'close' | 'reopen') => {
    const key = `${target}-${item.id}`;
    setBusy(key);
    setError('');
    try {
      const res = await fetch(`/svc/admin/support/${encodeURIComponent(String(item.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, action, assignedTo: assignees[String(item.id)] }),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error('mutation_failed');
      await load();
    } catch {
      setError('تعذّر حفظ التغيير. أعد المحاولة.');
    } finally {
      setBusy(null);
    }
  };

  const statusBadge = (status: string) => (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
      ['closed', 'resolved'].includes(status)
        ? 'bg-[#F0F5FF] text-[#5F6B92]'
        : 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]'
    }`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );

  const contact = (item: Item) => (
    <div className="flex items-center gap-2 flex-wrap text-sm text-[#5F6B92]">
      <span>طريقة التواصل: {CONTACT_LABEL[item.contactMethod ?? 'none'] ?? item.contactMethod}</span>
      {item.whatsappHref && (
        <a
          href={item.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0e7a94] font-bold hover:underline"
          aria-label="فتح محادثة واتساب"
        >
          فتح واتساب ↗
        </a>
      )}
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin" />
      <div className="text-[#5F6B92] font-bold">جاري تحميل صندوق الدعم…</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#DFE5F2]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-display font-bold text-[#101A38]">صندوق دعم العملاء</h2>
            <p className="text-sm text-[#5F6B92] mt-1">ملخصات مختصرة فقط، دون عرض سجل المحادثة أو بيانات شخصية غير لازمة.</p>
          </div>
          <button onClick={() => void load()} className="px-4 py-2 rounded-xl border border-[#DFE5F2] text-[#1C54CB] font-bold">
            تحديث
          </button>
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-bold">{error}</div>}
      </header>

      <section className="space-y-3">
        <h3 className="font-display font-bold text-xl text-[#101A38]">التصعيدات ({escalations.length})</h3>
        {escalations.map((item) => {
          const key = `escalation-${item.id}`;
          const isClosed = ['closed', 'resolved'].includes(item.status);
          return (
            <article key={key} className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-[#101A38]">{item.summary || 'محادثة دعم بلا ملخص'}</div>
                  <div className="text-sm text-[#5F6B92] mt-1">سبب التصعيد: {item.reason || 'غير محدد'}</div>
                </div>
                {statusBadge(item.status)}
              </div>
              {contact(item)}
              <div className="text-xs text-[#5F6B92]">{dateLabel(item.createdAt)}</div>
              <div className="pt-3 border-t border-[#DFE5F2] flex gap-2 items-center flex-wrap">
                {capabilities.assignEscalation && (
                  <>
                    <input
                      value={assignees[String(item.id)] ?? item.assignedTo ?? ''}
                      onChange={(e) => setAssignees((old) => ({ ...old, [String(item.id)]: e.target.value }))}
                      maxLength={80}
                      aria-label="إسناد التصعيد إلى"
                      placeholder="اسم المسؤول"
                      className="input-hq max-w-xs"
                    />
                    <button
                      disabled={busy === key || !(assignees[String(item.id)] ?? item.assignedTo ?? '').trim()}
                      onClick={() => void mutate(item, 'escalation', 'assign')}
                      className="px-4 py-2 rounded-xl bg-[#1C54CB] text-white font-bold disabled:opacity-50"
                    >
                      إسناد
                    </button>
                  </>
                )}
                <button
                  disabled={busy === key}
                  onClick={() => void mutate(item, 'escalation', isClosed ? 'reopen' : 'close')}
                  className="px-4 py-2 rounded-xl border border-[#DFE5F2] text-[#5F6B92] font-bold disabled:opacity-50"
                >
                  {isClosed ? 'إعادة الفتح' : 'إغلاق'}
                </button>
              </div>
            </article>
          );
        })}
        {!escalations.length && <div className="text-center py-10 bg-white rounded-2xl border border-[#DFE5F2] text-[#5F6B92]">لا توجد تصعيدات.</div>}
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-bold text-xl text-[#101A38]">المحادثات ({conversations.length})</h3>
        {conversations.map((item) => {
          const key = `conversation-${item.id}`;
          const isClosed = ['closed', 'resolved'].includes(item.status);
          return (
            <article key={key} className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="font-bold text-[#101A38]">{item.summary || 'محادثة دعم بلا ملخص'}</div>
                {statusBadge(item.status)}
              </div>
              {contact(item)}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-[#5F6B92]">{dateLabel(item.createdAt)}</span>
                {capabilities.updateConversationStatus && (
                  <button
                    disabled={busy === key}
                    onClick={() => void mutate(item, 'conversation', isClosed ? 'reopen' : 'close')}
                    className="px-4 py-2 rounded-xl border border-[#DFE5F2] text-[#5F6B92] font-bold disabled:opacity-50"
                  >
                    {isClosed ? 'إعادة الفتح' : 'إغلاق'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!conversations.length && <div className="text-center py-10 bg-white rounded-2xl border border-[#DFE5F2] text-[#5F6B92]">لا توجد محادثات.</div>}
      </section>
    </div>
  );
}