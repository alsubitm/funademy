'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  channel?: string;
  messages?: Message[];
};

type Message = {
  id: string;
  role: string;
  content: string;
  channel: string;
  direction: string;
  deliveryStatus: string | null;
  deliveryError: string | null;
  createdAt: string;
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
  const [selected, setSelected] = useState<Item | null>(null);
  const [reply, setReply] = useState('');
  const [replyKey, setReplyKey] = useState(() => crypto.randomUUID());
  const [sendResult, setSendResult] = useState('');
  const loadSequence = useRef(0);
  const [capabilities, setCapabilities] = useState({
    assignEscalation: true,
    assignConversation: false,
    updateConversationStatus: true,
    whatsapp: { configured: false, sendConfigured: false, webhookConfigured: false, missing: [] as string[] },
  });

  const load = useCallback(async (conversationId?: string) => {
    const sequence = ++loadSequence.current;
    setError('');
    try {
      const selectedId = conversationId;
      const res = await fetch(`/svc/admin/support${selectedId ? `?conversation=${encodeURIComponent(String(selectedId))}` : ''}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error('load_failed');
      const data = await res.json();
      if (sequence !== loadSequence.current) return;
      setConversations(data.conversations ?? []);
      setEscalations(data.escalations ?? []);
      setSelected(data.selected ?? null);
      setCapabilities(data.capabilities ?? {
        assignEscalation: true,
        assignConversation: false,
        updateConversationStatus: true,
        whatsapp: { configured: false, sendConfigured: false, webhookConfigured: false, missing: [] },
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
      await load(selected ? String(selected.id) : undefined);
    } catch {
      setError('تعذّر حفظ التغيير. أعد المحاولة.');
    } finally {
      setBusy(null);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(`reply-${selected.id}`);
    setError('');
    setSendResult('');
    try {
      const res = await fetch(`/svc/admin/support/${encodeURIComponent(String(selected.id))}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply, idempotencyKey: replyKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return window.location.reload();
      if (!res.ok) {
        const code = data?.message?.deliveryError ?? data?.error;
        setSendResult(`تعذّر إرسال الرسالة عبر واتساب (${code ?? 'خطأ غير معروف'}). تم تسجيل حالة الفشل.`);
      } else {
        setReply('');
        setReplyKey(crypto.randomUUID());
        setSendResult('تم إرسال الرد وتسجيله.');
      }
      await load(String(selected.id));
    } catch {
      setSendResult('تعذّر الاتصال بخدمة الإرسال.');
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
            <p className="text-sm text-[#5F6B92] mt-1">محادثات موحّدة مع إخفاء أرقام الهواتف والبيانات الشخصية غير اللازمة.</p>
          </div>
           <button onClick={() => void load(selected ? String(selected.id) : undefined)} className="px-4 py-2 rounded-xl border border-[#DFE5F2] text-[#1C54CB] font-bold">
            تحديث
          </button>
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-bold">{error}</div>}
        {!capabilities.whatsapp.configured && (
          <div role="status" className="mt-4 rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-sm font-bold">
            تكامل واتساب غير مكتمل. الاستقبال: {capabilities.whatsapp.webhookConfigured ? 'جاهز' : 'غير مهيأ'}، الإرسال: {capabilities.whatsapp.sendConfigured ? 'جاهز' : 'غير مهيأ'}. محادثات الموقع لا تتأثر وتبقى متاحة.
          </div>
        )}
      </header>

      {selected && (
        <section className="bg-white p-5 sm:p-6 rounded-[24px] border-2 border-[#1C54CB] space-y-4">
          <div className="flex justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display font-bold text-xl text-[#101A38]">{selected.summary || 'محادثة دعم'}</h3>
              <div className="text-sm text-[#5F6B92]">القناة: {selected.channel === 'whatsapp' ? 'واتساب' : 'الموقع'}</div>
            </div>
            {statusBadge(selected.status)}
          </div>
          <div className="max-h-96 overflow-y-auto rounded-2xl bg-[#F7F9FD] p-4 space-y-3" aria-label="سجل المحادثة">
            {(selected.messages ?? []).map((message) => (
              <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 ${message.direction === 'outbound' ? 'mr-auto bg-[#1C54CB] text-white' : 'ml-auto bg-white border border-[#DFE5F2] text-[#101A38]'}`}>
                <div className="text-xs font-bold opacity-75 mb-1">{message.direction === 'outbound' ? 'فريق الدعم' : 'العميل'} · {message.channel === 'whatsapp' ? 'واتساب' : 'الموقع'}</div>
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                <div className="text-xs opacity-75 mt-1">
                  {dateLabel(message.createdAt)}
                  {message.direction === 'outbound' && ` · ${message.deliveryStatus ?? 'غير معروف'}`}
                  {message.deliveryError && ` · خطأ: ${message.deliveryError}`}
                </div>
              </div>
            ))}
            {!selected.messages?.length && <div className="text-center text-[#5F6B92]">لا توجد رسائل.</div>}
          </div>
          {selected.channel === 'whatsapp' && (
            <div className="space-y-2">
              <textarea
                value={reply}
                onChange={(event) => {
                  setReply(event.target.value);
                  setReplyKey(crypto.randomUUID());
                }}
                maxLength={4000}
                rows={3}
                className="input-hq w-full"
                placeholder="اكتب رد فريق الدعم…"
                aria-label="رد واتساب"
              />
              <button
                onClick={() => void sendReply()}
                disabled={!reply.trim() || busy === `reply-${selected.id}` || !capabilities.whatsapp.sendConfigured || ['closed', 'resolved'].includes(selected.status)}
                className="px-5 py-2 rounded-xl bg-[#1C54CB] text-white font-bold disabled:opacity-50"
              >
                إرسال عبر واتساب
              </button>
              {!capabilities.whatsapp.sendConfigured && <div className="text-sm font-bold text-amber-800">الإرسال متوقف حتى تكتمل إعدادات WhatsApp Cloud API. محادثات الموقع لا تتأثر.</div>}
              {['closed', 'resolved'].includes(selected.status) && <div className="text-sm font-bold text-[#5F6B92]">أعد فتح المحادثة قبل إرسال رد جديد.</div>}
              {sendResult && <div role="status" className={`text-sm font-bold ${sendResult.startsWith('تم ') ? 'text-green-700' : 'text-red-700'}`}>{sendResult}</div>}
            </div>
          )}
          <div className="pt-3 border-t border-[#DFE5F2] flex gap-2 items-center flex-wrap">
            {capabilities.assignConversation && (
              <>
                <input value={assignees[String(selected.id)] ?? selected.assignedTo ?? ''} onChange={(e) => setAssignees((old) => ({ ...old, [String(selected.id)]: e.target.value }))} maxLength={80} className="input-hq max-w-xs" placeholder="اسم المسؤول" aria-label="إسناد المحادثة إلى" />
                <button onClick={() => void mutate(selected, 'conversation', 'assign')} className="px-4 py-2 rounded-xl border border-[#1C54CB] text-[#1C54CB] font-bold">إسناد</button>
              </>
            )}
            <button onClick={() => void mutate(selected, 'conversation', ['closed', 'resolved'].includes(selected.status) ? 'reopen' : 'close')} className="px-4 py-2 rounded-xl border border-[#DFE5F2] text-[#5F6B92] font-bold">
              {['closed', 'resolved'].includes(selected.status) ? 'إعادة الفتح' : 'إغلاق'}
            </button>
          </div>
        </section>
      )}

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
            <article key={key} className={`bg-white p-5 rounded-2xl border space-y-3 ${String(selected?.id) === String(item.id) ? 'border-[#1C54CB]' : 'border-[#DFE5F2]'}`}>
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
                <button onClick={() => void load(String(item.id))} className="px-4 py-2 rounded-xl bg-[#101A38] text-white font-bold">فتح المحادثة</button>
              </div>
            </article>
          );
        })}
        {!conversations.length && <div className="text-center py-10 bg-white rounded-2xl border border-[#DFE5F2] text-[#5F6B92]">لا توجد محادثات.</div>}
      </section>
    </div>
  );
}