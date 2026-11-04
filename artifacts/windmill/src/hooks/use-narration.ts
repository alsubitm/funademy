import { useCallback, useEffect, useState } from 'react';
import type { Language } from '@/lib/lesson-engine';

export type NarrationStatus = 'idle' | 'speaking' | 'unsupported' | 'no-voice' | 'error';

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

/** Optional device speech synthesis. Never autoplays; caller cancels on context changes. */
export function useNarration(lang: Language) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [status, setStatus] = useState<NarrationStatus>(() => (supported() ? 'idle' : 'unsupported'));

  useEffect(() => {
    if (!supported()) { setStatus('unsupported'); return; }
    const synth = window.speechSynthesis;
    const pick = () => {
      const vs = synth.getVoices();
      const v = vs.find((x) => x.lang.toLowerCase().startsWith(lang)) ?? null;
      setVoice(v);
      setStatus((s) => (s === 'speaking' ? s : v ? 'idle' : 'no-voice'));
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => { synth.removeEventListener('voiceschanged', pick); synth.cancel(); };
  }, [lang]);

  const stop = useCallback(() => {
    if (!supported()) return;
    window.speechSynthesis.cancel();
    setStatus((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  const play = useCallback((text: string) => {
    if (!supported()) { setStatus('unsupported'); return; }
    if (!voice) { setStatus('no-voice'); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 0.95;
    u.onend = () => setStatus((s) => (s === 'speaking' ? 'idle' : s));
    u.onerror = (e) => { if (e.error !== 'canceled' && e.error !== 'interrupted') setStatus('error'); };
    setStatus('speaking');
    synth.speak(u);
  }, [voice]);

  return { status, available: !!voice && supported(), play, stop };
}
