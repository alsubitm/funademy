'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** «طلب تعويض» button next to a missed session in the attendance list. */
export function MakeupButton({
  studentId,
  sessionId,
  labels,
}: {
  studentId: number;
  sessionId: number;
  labels: { request: string; sending: string; failed: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');

  const submit = async () => {
    setState('sending');
    const res = await fetch('/svc/account/makeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, sessionId }),
    });
    if (res.ok || res.status === 409) {
      // 409 already_requested → refresh reveals the existing request state.
      router.refresh();
    } else {
      setState('error');
    }
  };

  return (
    <button className="ptl-makeup-btn" onClick={submit} disabled={state === 'sending'}>
      {state === 'sending' ? labels.sending : state === 'error' ? labels.failed : labels.request}
    </button>
  );
}
