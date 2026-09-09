'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { waLink } from '@/lib/constants';
import type { ChatAction, ChatMessage, ChatSession, ChatSource } from './types';

type Lang = 'ar' | 'en';
type JsonRecord = Record<string, unknown>;

const copy = {
  ar: {
    name: 'مساعد فناديمي',
    open: 'افتح مساعد فناديمي',
    close: 'إغلاق المحادثة',
    intro: 'أهلاً! أساعدك في البرامج والمواعيد والحجز. لا ترسل بيانات بطاقة الدفع.',
    consent: 'أوافق على إرسال رسائلي إلى خدمة المساعد لمعالجتها وحفظ سجل المحادثة حسب سياسة الخصوصية.',
    privacy: 'سياسة الخصوصية',
    agree: 'موافق، ابدأ المحادثة',
    consentRequired: 'يرجى تأكيد الموافقة للمتابعة.',
    placeholder: 'اكتب سؤالك…',
    send: 'إرسال',
    newChat: 'محادثة جديدة',
    history: 'السجل',
    noHistory: 'لا توجد محادثات سابقة.',
    delete: 'حذف المحادثة',
    deleting: 'جارٍ الحذف…',
    loading: 'يفكر المساعد…',
    loadingHistory: 'جارٍ تحميل المحادثات…',
    error: 'تعذر إكمال الطلب. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    offline: 'أنت غير متصل بالإنترنت. ستتمكن من الإرسال عند عودة الاتصال.',
    source: 'المصادر',
    confirm: 'تأكيد',
    confirmed: 'تم التأكيد',
    succeeded: 'اكتمل الطلب',
    failed: 'تعذر إكمال الطلب',
    confirming: 'جارٍ التأكيد…',
    actionWarning: 'راجع التفاصيل قبل التأكيد. لن نطلب بيانات بطاقتك هنا.',
    handoff: 'هل تحتاج مساعدة من الفريق؟',
    whatsapp: 'المتابعة عبر واتساب',
    escalate: 'اطلب متابعة الفريق',
    escalating: 'جارٍ تسجيل الطلب…',
    escalated: 'تم تسجيل طلبك. يفتح واتساب الآن…',
    fullPage: 'فتح صفحة المساعدة',
    empty: 'اسأل عن البرامج، الأعمار المناسبة، المواعيد أو طريقة الحجز.',
    quick: 'روابط سريعة',
    booking: 'احجز تجربة',
    consultation: 'احجز استشارة',
    enrollment: 'الاشتراك الشهري',
    payment: 'المدفوعات',
    account: 'حسابي',
    you: 'أنت',
    assistant: 'مساعد فناديمي',
  },
  en: {
    name: 'FunAdemy assistant',
    open: 'Open FunAdemy assistant',
    close: 'Close chat',
    intro: 'Hello! I can help with programs, schedules and booking. Do not send payment card details.',
    consent: 'I agree that my messages may be processed and chat history stored as described in the privacy policy.',
    privacy: 'Privacy policy',
    agree: 'Agree and start chatting',
    consentRequired: 'Please confirm your consent to continue.',
    placeholder: 'Type your question…',
    send: 'Send',
    newChat: 'New chat',
    history: 'History',
    noHistory: 'No previous conversations.',
    delete: 'Delete conversation',
    deleting: 'Deleting…',
    loading: 'Assistant is thinking…',
    loadingHistory: 'Loading conversations…',
    error: 'We could not complete that request. Please try again.',
    retry: 'Try again',
    offline: 'You are offline. You can send when your connection returns.',
    source: 'Sources',
    confirm: 'Confirm',
    confirmed: 'Confirmed',
    succeeded: 'Completed',
    failed: 'Could not complete',
    confirming: 'Confirming…',
    actionWarning: 'Review the details before confirming. We will never ask for card details here.',
    handoff: 'Need help from our team?',
    whatsapp: 'Continue on WhatsApp',
    escalate: 'Ask the team to follow up',
    escalating: 'Recording request…',
    escalated: 'Your request has been recorded. Opening WhatsApp…',
    fullPage: 'Open help page',
    empty: 'Ask about programs, age groups, schedules or how to book.',
    quick: 'Quick links',
    booking: 'Book a trial',
    consultation: 'Book a consultation',
    enrollment: 'Monthly enrollment',
    payment: 'Payments',
    account: 'My account',
    you: 'You',
    assistant: 'FunAdemy assistant',
  },
} as const;

/*
 * Public /svc/chat contract:
 * GET/POST /svc/chat/conversations ({ consent:true, locale }); DELETE
 * /svc/chat/conversations/:id; POST /:id/messages ({content,idempotencyKey})
 * streams SSE delta/done events; POST /:id/actions/:actionId/confirm
 * ({confirm:true}) completes the action and returns its result. GET /:id is
 * the server transcript and prepared-action source of truth.
 */
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const record = isRecord(payload) ? payload : {};
    throw new Error(typeof record.error === 'string' ? record.error : `HTTP ${response.status}`);
  }
  return payload;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unbox(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}

function sessionsFrom(payload: unknown): ChatSession[] {
  const value = unbox(payload);
  const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.conversations) ? value.conversations : [];
  return list.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') return [];
    return [{ id: item.id, title: typeof item.title === 'string' ? item.title : undefined, updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined }];
  });
}

function sourcesFrom(value: unknown): ChatSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.url !== 'string') return [];
    return [{ title: typeof item.title === 'string' ? item.title : item.url, url: item.url }];
  });
  return sources.length ? sources : undefined;
}

function actionsFrom(value: unknown): ChatAction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') return [];
    const kind = typeof item.kind === 'string' ? item.kind : 'action';
    const payload = isRecord(item.payload) ? item.payload : {};
    const status = item.status === 'prepared' || item.status === 'confirmed' || item.status === 'succeeded' || item.status === 'failed' ? item.status : 'pending';
    return [{
      id: item.id,
      kind,
      payload,
      title: typeof item.title === 'string' ? item.title : actionTitle(kind, 'en'),
      description: typeof item.description === 'string' ? item.description : undefined,
      confirmLabel: typeof item.confirmLabel === 'string' ? item.confirmLabel : undefined,
      status,
    } satisfies ChatAction];
  });
  return actions.length ? actions : undefined;
}

function messageFrom(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const nested = isRecord(value.message) ? value.message : value;
  const content = typeof nested.content === 'string' ? nested.content : typeof nested.text === 'string' ? nested.text : null;
  if (!content) return null;
  return {
    id: typeof nested.id === 'string' ? nested.id : `message-${Date.now()}`,
    role: nested.role === 'user' ? 'user' : 'assistant',
    content,
    createdAt: typeof nested.createdAt === 'string' ? nested.createdAt : undefined,
    sources: sourcesFrom(nested.sources ?? nested.sourceRefs),
    actions: actionsFrom(nested.actions),
    handoff: nested.handoff === true,
  };
}

function messagesFrom(payload: unknown): ChatMessage[] {
  const value = unbox(payload);
  const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.messages) ? value.messages : [];
  return list.flatMap((item) => {
    const message = messageFrom(item);
    return message ? [message] : [];
  });
}

function conversationFrom(payload: unknown): ChatSession | null {
  const value = unbox(payload);
  const item = isRecord(value) && isRecord(value.conversation) ? value.conversation : value;
  if (!isRecord(item) || typeof item.id !== 'string') return null;
  return { id: item.id, title: typeof item.title === 'string' ? item.title : undefined };
}

function sourceFromRef(ref: string, lang: Lang): ChatSource {
  const [kind] = ref.split(':');
  const root = lang === 'ar' ? '' : '/en';
  if (kind === 'program' || kind === 'run' || kind === 'slot') {
    return { title: lang === 'ar' ? 'البرامج والمواعيد' : 'Programs and schedules', url: `${root}/programs` };
  }
  return { title: lang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently asked questions', url: `${root || '/'}#faq` };
}

async function streamMessage(conversationId: string, content: string, lang: Lang): Promise<{ message: ChatMessage; action?: ChatAction }> {
  const response = await fetch(`/svc/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ content, idempotencyKey: crypto.randomUUID() }),
  });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let messageId = `assistant-${Date.now()}`;
  let refs: ChatSource[] = [];
  let action: ChatAction | undefined;
  let handoff = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) continue;
      const eventValue: unknown = JSON.parse(dataLine.slice(5).trim());
      if (!isRecord(eventValue)) continue;
      if (eventValue.type === 'error') throw new Error('stream_error');
      if (eventValue.type === 'delta' && typeof eventValue.content === 'string') answer += eventValue.content;
      if (eventValue.type === 'done') {
        if (typeof eventValue.messageId === 'string') messageId = eventValue.messageId;
        if (Array.isArray(eventValue.sources)) refs = sourcesFrom(eventValue.sources) || [];
        if (eventValue.handoff === true) handoff = true;
        if (isRecord(eventValue.preparedAction) && typeof eventValue.preparedAction.id === 'string') {
          const kind = typeof eventValue.preparedAction.kind === 'string' ? eventValue.preparedAction.kind : 'action';
          const payload = isRecord(eventValue.preparedAction.payload) ? eventValue.preparedAction.payload : {};
          action = { id: eventValue.preparedAction.id, kind, payload, status: 'prepared', title: actionTitle(kind, lang), description: actionDescription(kind, payload, lang) };
        }
      }
    }
    if (done) break;
  }
  if (!answer) throw new Error('empty_stream');
  return { message: { id: messageId, role: 'assistant', content: answer, sources: refs, handoff }, action };
}

function actionTitle(kind: string, lang: Lang) {
  const ar = lang === 'ar';
  return kind === 'request_makeup' ? (ar ? 'طلب حصة تعويضية' : 'Request a make-up class') : kind === 'book_consultation' ? (ar ? 'حجز استشارة' : 'Book a consultation') : (ar ? 'حجز حصة تجريبية' : 'Book a trial class');
}
function actionDescription(kind: string, payload: Record<string, unknown>, lang: Lang) {
  const ar = lang === 'ar';
  if (kind === 'book_consultation') return `${ar ? 'الموعد' : 'Time'}: ${String(payload.startsAt || '')}`;
  return ar ? 'سيتم تنفيذ الطلب باستخدام بيانات حسابك بعد التأكيد.' : 'This will use your account details only after you confirm.';
}

function safeSourceUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function ChatAssistant({ lang, mode = 'widget' }: { lang: Lang; mode?: 'widget' | 'page' }) {
  const t = copy[lang];
  const [open, setOpen] = useState(mode === 'page');
  const [consented, setConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [online, setOnline] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const [lastDraft, setLastDraft] = useState('');
  const [confirming, setConfirming] = useState<string>();
  const [preparedActions, setPreparedActions] = useState<ChatAction[]>([]);
  const [escalating, setEscalating] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    setHistoryBusy(true);
    try {
      const payload = await request('/svc/chat/conversations');
      setSessions(sessionsFrom(payload));
      setHasAccount(isRecord(payload) && payload.hasFamilyAccount === true);
    } catch {
      setError(t.error);
    } finally {
      setHistoryBusy(false);
    }
  }, [t.error]);

  useEffect(() => {
    setConsented(localStorage.getItem('funademy-chat-consent') === 'yes');
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (open && consented) void loadSessions();
  }, [consented, loadSessions, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mode === 'widget') {
        setOpen(false);
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => textareaRef.current?.focus());
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, open, consented]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const acceptConsent = () => {
    if (!consentChecked) return;
    localStorage.setItem('funademy-chat-consent', 'yes');
    setConsented(true);
  };

  const escalate = async () => {
    if (!sessionId) return;
    setEscalating(true);
    try {
      await request(`/svc/chat/conversations/${encodeURIComponent(sessionId)}/escalations`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'human_requested' }),
      });
      setEscalated(true);
      window.open(waLink(lang === 'ar' ? 'مرحباً، سجلت طلب متابعة عبر المساعد.' : 'Hello, I recorded a follow-up request through the assistant.'), '_blank', 'noopener,noreferrer');
    } catch { setError(t.error); } finally { setEscalating(false); }
  };

  const selectSession = async (id: string) => {
    setError(undefined);
    setSessionId(id);
    setHistoryBusy(true);
    try {
      const payload = unbox(await request(`/svc/chat/conversations/${encodeURIComponent(id)}`));
      setMessages(messagesFrom(payload));
      setPreparedActions(actionsFrom(isRecord(payload) ? payload.preparedActions : []) || []);
    } catch {
      setMessages([]);
      setError(t.error);
    } finally {
      setHistoryBusy(false);
    }
  };

  const startNew = () => {
    setSessionId(undefined);
    setMessages([]);
    setDraft('');
    setError(undefined);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const deleteSession = async () => {
    if (!sessionId) return;
    setDeleting(true);
    try {
      await request(`/svc/chat/conversations/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      startNew();
    } catch {
      setError(t.error);
    } finally {
      setDeleting(false);
    }
  };

  const send = async (text = draft) => {
    const clean = text.trim();
    if (!clean || busy || !online) return;
    setLastDraft(clean);
    setDraft('');
    setError(undefined);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content: clean }]);
    setBusy(true);
    try {
      let activeId = sessionId;
      if (!activeId) {
        const createdPayload = await request('/svc/chat/conversations', {
          method: 'POST',
          body: JSON.stringify({ consent: true, locale: lang }),
        });
        const created = conversationFrom(createdPayload);
        if (!created) throw new Error('Missing conversation');
        activeId = created.id;
        setSessionId(activeId);
        setHasAccount(isRecord(createdPayload) && createdPayload.hasFamilyAccount === true);
      }
      const streamed = await streamMessage(activeId, clean, lang);
      setMessages((current) => [...current, streamed.message]);
      if (streamed.action) setPreparedActions((current) => [...current, streamed.action as ChatAction]);
      void loadSessions();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const confirmAction = async (actionId: string) => {
    setConfirming(actionId);
    setError(undefined);
    try {
      if (!sessionId) throw new Error('Missing conversation');
      const result = await request(`/svc/chat/conversations/${encodeURIComponent(sessionId)}/actions/${encodeURIComponent(actionId)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      const actionResult = isRecord(result) && isRecord(result.action) ? result.action : {};
      setPreparedActions((current) => current.map((action) => action.id === actionId ? { ...action, status: actionResult.status === 'succeeded' ? 'succeeded' : 'failed', result: actionResult.result } : action));
    } catch {
      setPreparedActions((current) => current.map((action) => action.id === actionId ? { ...action, status: 'failed' } : action));
      setError(t.error);
    } finally {
      setConfirming(undefined);
    }
  };

  const panel = (
    <section
      className={`sec chat-ui__panel ${mode === 'page' ? 'chat-ui__panel--page' : ''}`}
      role={mode === 'widget' ? 'dialog' : 'region'}
      aria-modal={mode === 'widget' ? true : undefined}
      aria-label={t.name}
    >
      <header className="chat-ui__header">
        <div><span className="chat-ui__status" aria-hidden="true" /> <strong>{t.name}</strong></div>
        <div className="chat-ui__header-actions">
          {consented && <button type="button" onClick={startNew} data-testid="button-new-chat">{t.newChat}</button>}
          {mode === 'widget' && (
            <button className="chat-ui__icon-button" type="button" aria-label={t.close} onClick={() => setOpen(false)} data-testid="button-close-chat">×</button>
          )}
        </div>
      </header>

      {!consented ? (
        <div className="chat-ui__consent">
          <div className="chat-ui__bot-mark" aria-hidden="true">✦</div>
          <h2>{t.name}</h2>
          <p>{t.intro}</p>
          <label className="chat-ui__consent-copy">
            <input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} data-testid="input-chat-consent" />
            <span>{t.consent} <Link href={lang === 'ar' ? '/privacy' : '/en/privacy'} data-testid="link-chat-privacy">{t.privacy}</Link></span>
          </label>
          <button className="chat-ui__primary" type="button" disabled={!consentChecked} onClick={acceptConsent} data-testid="button-chat-consent">{t.agree}</button>
        </div>
      ) : (
        <div className="chat-ui__workspace">
          <aside className="chat-ui__history" aria-label={t.history}>
            <strong>{t.history}</strong>
            {historyBusy && sessions.length === 0 ? <p role="status">{t.loadingHistory}</p> : null}
            {!historyBusy && sessions.length === 0 ? <p>{t.noHistory}</p> : null}
            <ul>
              {sessions.map((session) => (
                <li key={session.id}>
                  <button className={session.id === sessionId ? 'is-active' : ''} type="button" onClick={() => void selectSession(session.id)} data-testid={`button-chat-session-${session.id}`}>
                    {session.title || t.newChat}
                  </button>
                </li>
              ))}
            </ul>
            {sessionId && (
              <button className="chat-ui__delete" type="button" onClick={() => void deleteSession()} disabled={deleting} data-testid="button-delete-chat">
                {deleting ? t.deleting : t.delete}
              </button>
            )}
          </aside>

          <div className="chat-ui__conversation">
            <div className="chat-ui__messages" ref={scrollRef} aria-live="polite" aria-busy={busy}>
              {messages.length === 0 && !historyBusy ? <p className="chat-ui__empty">{t.empty}</p> : null}
              {messages.length === 0 && !historyBusy ? <QuickLinks lang={lang} t={t} hasAccount={hasAccount} /> : null}
              {messages.map((message) => (
                <article key={message.id} className={`chat-ui__message chat-ui__message--${message.role}`} data-testid={`message-chat-${message.id}`}>
                  <span className="chat-ui__speaker">{message.role === 'user' ? t.you : t.assistant}</span>
                  <p>{message.content}</p>
                  {message.sources?.length ? (
                    <div className="chat-ui__sources">
                      <strong>{t.source}</strong>
                      <ul>{message.sources.map((source, index) => {
                        const href = safeSourceUrl(source.url);
                        return href ? <li key={`${href}-${index}`}><a href={href} target="_blank" rel="noopener noreferrer" data-testid={`link-chat-source-${message.id}-${index}`}>{source.title}<span aria-hidden="true"> ↗</span></a></li> : null;
                      })}</ul>
                    </div>
                  ) : null}
                  {message.actions?.map((action) => (
                    <div className="chat-ui__action-card" key={action.id}>
                      <strong>{action.title}</strong>
                      {action.description && <p>{action.description}</p>}
                      <small>{t.actionWarning}</small>
                      <button type="button" disabled={action.status === 'confirmed' || confirming === action.id} onClick={() => void confirmAction(action.id)} data-testid={`button-confirm-action-${action.id}`}>
                        {action.status === 'confirmed' ? t.confirmed : confirming === action.id ? t.confirming : action.confirmLabel || t.confirm}
                      </button>
                    </div>
                  ))}
                  {message.handoff ? <Handoff lang={lang} label={t.handoff} whatsapp={t.whatsapp} /> : null}
                </article>
              ))}
              {preparedActions.map((action) => <ActionCard key={action.id} action={action} lang={lang} t={t} confirming={confirming} onConfirm={confirmAction} />)}
              {busy && <div className="chat-ui__typing" role="status"><i /><i /><i /><span className="sr-only">{t.loading}</span></div>}
            </div>

            {!online && <p className="chat-ui__notice" role="status">{t.offline}</p>}
            {error && <div className="chat-ui__error" role="alert"><span>{error}</span>{lastDraft && <button type="button" onClick={() => void send(lastDraft)}>{t.retry}</button>}</div>}
            <form className="chat-ui__composer" onSubmit={submit}>
              <label className="sr-only" htmlFor={`chat-input-${mode}`}>{t.placeholder}</label>
              <textarea
                id={`chat-input-${mode}`}
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={t.placeholder}
                rows={1}
                maxLength={2000}
                disabled={busy || !online}
                data-testid="input-chat-message"
              />
              <button className="chat-ui__send" type="submit" disabled={!draft.trim() || busy || !online} data-testid="button-send-chat">{t.send}</button>
            </form>
            <div className="chat-ui__footer-row">
              <Handoff lang={lang} label={t.handoff} whatsapp={t.whatsapp} compact />
              {sessionId && <button type="button" className="chat-ui__escalate" onClick={() => void escalate()} disabled={escalating || escalated} data-testid="button-chat-escalate">{escalated ? t.escalated : escalating ? t.escalating : t.escalate}</button>}
              {mode === 'widget' && <Link href={lang === 'ar' ? '/help' : '/en/help'} data-testid="link-full-chat">{t.fullPage}</Link>}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  if (mode === 'page') return <div className="chat-ui chat-ui--page">{panel}</div>;

  return (
    <div className={`chat-ui chat-ui--widget ${open ? 'is-open' : ''}`}>
      {open ? panel : null}
      <button
        ref={launcherRef}
        type="button"
        className="chat-ui__launcher"
        aria-label={t.open}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid="button-open-chat"
      >
        <span aria-hidden="true">✦</span>
        <span>{lang === 'ar' ? 'اسألنا' : 'Ask us'}</span>
      </button>
    </div>
  );
}

function Handoff({ lang, label, whatsapp, compact = false }: { lang: Lang; label: string; whatsapp: string; compact?: boolean }) {
  const message = lang === 'ar' ? 'مرحباً، أحتاج مساعدة من فريق فناديمي.' : 'Hello, I need help from the FunAdemy team.';
  return (
    <div className={compact ? 'chat-ui__handoff chat-ui__handoff--compact' : 'chat-ui__handoff'}>
      {!compact && <span>{label}</span>}
      <a href={waLink(message)} target="_blank" rel="noopener noreferrer" data-testid="link-chat-whatsapp">{whatsapp}<span aria-hidden="true"> ↗</span></a>
    </div>
  );
}

function ActionCard({ action, lang, t, confirming, onConfirm }: { action: ChatAction; lang: Lang; t: Record<string, string>; confirming?: string; onConfirm: (id: string) => Promise<void> }) {
  const done = action.status === 'succeeded';
  const failed = action.status === 'failed';
  return <div className="chat-ui__action-card">
    <strong>{action.title || actionTitle(action.kind || 'action', lang)}</strong>
    <p>{action.description || actionDescription(action.kind || 'action', action.payload || {}, lang)}</p>
    {done ? <p className="chat-ui__action-result">{t.succeeded}{action.result ? ` — ${JSON.stringify(action.result)}` : ''}</p> : failed ? <p className="chat-ui__action-result">{t.failed}</p> : <>
      <small>{t.actionWarning}</small>
      <button type="button" disabled={confirming === action.id} onClick={() => void onConfirm(action.id)} data-testid={`button-confirm-action-${action.id}`}>{confirming === action.id ? t.confirming : action.confirmLabel || t.confirm}</button>
    </>}
  </div>;
}

function QuickLinks({ lang, t, hasAccount }: { lang: Lang; t: Record<string, string>; hasAccount: boolean }) {
  const root = lang === 'ar' ? '' : '/en';
  return <nav className="chat-ui__quick" aria-label={t.quick}><strong>{t.quick}</strong><div>
    <Link href={`${root}/book`} data-testid="link-chat-book">{t.booking}</Link>
    <Link href={`${root}/consult`} data-testid="link-chat-consult">{t.consultation}</Link>
    <Link href={`${root}/enroll`} data-testid="link-chat-enroll">{t.enrollment}</Link>
    <Link href={`${root}/account`} data-testid="link-chat-account">{hasAccount ? t.account : `${t.account} / ${lang === 'ar' ? 'ابدأ هنا' : 'start here'}`}</Link>
  </div></nav>;
}