import { Volume2, VolumeX } from 'lucide-react';
import type { NarrationStatus } from '@/hooks/use-narration';
import type { FxStrings } from '@/i18n/features';

export function NarrationControl({ status, available, onPlay, onStop, f }: {
  status: NarrationStatus; available: boolean; onPlay: () => void; onStop: () => void; f: FxStrings;
}) {
  const speaking = status === 'speaking';
  const msg = status === 'speaking' ? f.nSpeaking : status === 'unsupported' ? f.nUnsupported : status === 'no-voice' ? f.nNoVoice : status === 'error' ? f.nError : '';
  return (
    <div className="narr">
      <div className="narr-row">
        <button type="button" className="btn btn-small" disabled={!available || speaking} onClick={onPlay} data-testid="button-narration-play">
          <Volume2 size={16} aria-hidden="true" />{f.nPlay}
        </button>
        <button type="button" className="btn btn-small" disabled={!speaking} onClick={onStop} data-testid="button-narration-stop">
          <VolumeX size={16} aria-hidden="true" />{f.nStop}
        </button>
      </div>
      <p className={`small narr-status ${status === 'error' || status === 'no-voice' || status === 'unsupported' ? 'warn' : ''}`} role="status" data-testid="status-narration">{msg}</p>
      {available && <p className="muted small">{f.nNote}</p>}
    </div>
  );
}
