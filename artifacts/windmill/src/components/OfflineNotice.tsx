import { useEffect, useRef, useState } from 'react';
import type { Language } from '@/lib/lesson-engine';

const copy = {
  en: {
    idle: 'Save this lesson on this device for classroom connection outages.',
    saving: 'Saving the complete lesson… Keep this page open.',
    ready: 'Offline ready on this browser. Saved progress stays on this device.',
    offline: 'You’re offline. The saved lesson is ready.',
    update: 'A lesson update is ready. Reload when convenient; saved progress is kept.',
    error: 'Offline copy unavailable or incomplete. Connect and try again.',
    unsupported: 'Offline saving needs a supported browser and a secure connection.',
    dev: 'Offline saving is available in the built lesson, not the development preview.',
    enable: 'Save for offline', retry: 'Try again', remove: 'Remove offline copy',
    reload: 'Update and reload', note: 'Browser storage can be cleared or evicted. Open this page and check readiness before class.',
  },
  ar: {
    idle: 'احفظ هذا الدرس على الجهاز لاستخدامه عند انقطاع اتصال الصف.',
    saving: 'جارٍ حفظ الدرس كاملاً… أبقِ الصفحة مفتوحة.',
    ready: 'الدرس جاهز دون اتصال في هذا المتصفح. يبقى تقدمك محفوظاً على الجهاز.',
    offline: 'أنت دون اتصال. الدرس المحفوظ جاهز.',
    update: 'يتوفر تحديث للدرس. أعد التحميل حين يناسبك؛ سيبقى تقدمك محفوظاً.',
    error: 'النسخة دون اتصال غير متاحة أو غير مكتملة. اتصل بالإنترنت وأعد المحاولة.',
    unsupported: 'الحفظ دون اتصال يتطلب متصفحاً مدعوماً واتصالاً آمناً.',
    dev: 'الحفظ دون اتصال متاح في النسخة المبنية، وليس معاينة التطوير.',
    enable: 'حفظ دون اتصال', retry: 'إعادة المحاولة', remove: 'إزالة النسخة دون اتصال',
    reload: 'تحديث وإعادة التحميل', note: 'قد يمسح المتصفح التخزين. افتح هذه الصفحة وتحقق من الجاهزية قبل الحصة.',
  },
};
type Status = 'idle' | 'saving' | 'ready' | 'error' | 'unsupported' | 'dev';
const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window;
// Capture the document version, never the (possibly newer) controller version.
const shellVersion = document.querySelector<HTMLMetaElement>('meta[name="windmill-shell-version"]')?.content;

async function isReady(worker: ServiceWorker): Promise<boolean> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(false); }, 5000);
    channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data?.ready === true); };
    worker.postMessage({ type: 'CHECK_READY' }, [channel.port2]);
  });
}

export function OfflineNotice({ lang }: { lang: Language }) {
  const [status, setStatus] = useState<Status>(import.meta.env.DEV ? 'dev' : supported() ? 'idle' : 'unsupported');
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequested = useRef(false);
  const t = copy[lang];

  async function observe(reg: ServiceWorkerRegistration) {
    registration.current = reg;
    setUpdate(!!reg.waiting);
    if (reg.active) setStatus(await isReady(reg.active) ? 'ready' : 'error');
    const watch = () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && reg.active) setUpdate(true);
        if (worker.state === 'activated') void isReady(worker).then(ok => setStatus(ok ? 'ready' : 'error'));
        if (worker.state === 'redundant' && !reg.active) setStatus('error');
      });
    };
    reg.onupdatefound = watch;
    watch();
  }

  useEffect(() => {
    const prune = () => navigator.serviceWorker.controller?.postMessage({ type: 'PRUNE_UNUSED' });
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'WINDMILL_SHELL_VERSION') {
        event.ports[0]?.postMessage({ version: shellVersion });
      }
    };
    const onNetwork = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void registration.current?.update().catch(() => {});
    };
    const onController = () => {
      if (reloadRequested.current) window.location.reload();
      else prune();
    };
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    if (!import.meta.env.DEV && supported()) {
      navigator.serviceWorker.addEventListener('message', onMessage);
      navigator.serviceWorker.addEventListener('controllerchange', onController);
      window.addEventListener('focus', prune);
      prune();
      void navigator.serviceWorker.getRegistration('/windmill/').then(reg => {
        // Never touch a main-site worker with a broader scope.
        if (reg?.scope === new URL('/windmill/', location.origin).href) {
          void observe(reg);
          if (navigator.onLine) void reg.update().catch(() => {});
        }
      }).catch(() => setStatus('error'));
    }
    // Closing another tab has no reliable service-worker event. A modest
    // heartbeat retries cleanup while the lesson remains open, also offline.
    const timer = !import.meta.env.DEV && supported() ? window.setInterval(prune, 60000) : undefined;
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', prune);
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
      if (supported()) navigator.serviceWorker.removeEventListener('controllerchange', onController);
      if (supported()) navigator.serviceWorker.removeEventListener('message', onMessage);
      if (registration.current) registration.current.onupdatefound = null;
    };
  }, []);

  async function enable() {
    setStatus('saving');
    try {
      const reg = await navigator.serviceWorker.register('/windmill/sw.js', { scope: '/windmill/', updateViaCache: 'none' });
      await observe(reg);
      if (reg.active && !(await isReady(reg.active))) {
        // Repair an evicted copy by a fresh install; progress is never touched.
        await reg.unregister();
        const fresh = await navigator.serviceWorker.register('/windmill/sw.js', { scope: '/windmill/', updateViaCache: 'none' });
        setStatus('saving');
        await observe(fresh);
      }
    } catch { setStatus('error'); }
  }

  async function remove() {
    try {
      await registration.current?.unregister();
      for (const key of await caches.keys()) {
        if (key.startsWith('funademy-windmill-shell-')) await caches.delete(key);
      }
      registration.current = null;
      setUpdate(false);
      setStatus('idle');
    } catch { setStatus('error'); }
  }

  return <aside className="offline-notice" aria-label={lang === 'ar' ? 'حالة الاتصال' : 'Offline availability'} data-testid="offline-notice">
    <p role="status">{update ? t.update : status === 'ready' && !online ? t.offline : t[status]}{status === 'ready' && <small> {t.note}</small>}</p>
    {(status === 'idle' || status === 'error') && <button className="btn btn-ghost" onClick={() => void enable()} data-testid="offline-save">{status === 'error' ? t.retry : t.enable}</button>}
    {update && <button className="btn btn-ghost" onClick={() => {
      reloadRequested.current = true;
      const waiting = registration.current?.waiting;
      if (waiting) waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      else window.location.reload(); // Another tab may already have activated it.
    }} data-testid="offline-update">{t.reload}</button>}
    {(status === 'ready' || status === 'error') && registration.current && <button className="btn btn-ghost" onClick={() => void remove()} data-testid="offline-remove">{t.remove}</button>}
  </aside>;
}
