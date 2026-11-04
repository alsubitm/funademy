import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { ZoomPane } from '@/components/lab/ZoomPane';
import { ArrowDefs, WindmillModel, type Motion } from '@/components/model/WindmillModel';
import { BackView, ExplodedView, GearView } from '@/components/model/InspectViews';
import type { Lesson } from '@/data/lessons/windmill';
import type { FxStrings } from '@/i18n/features';

type View = 'front' | 'back' | 'gears' | 'exploded';
const VIEWS: View[] = ['front', 'back', 'gears', 'exploded'];

export function InspectDialog({ open, onClose, lesson, placed, motion, direction, f, closeLabel }: {
  open: boolean; onClose: () => void; lesson: Lesson; placed: readonly string[]; motion: Motion; direction: 1 | -1; f: FxStrings; closeLabel: string;
}) {
  const [view, setView] = useState<View>('front');
  const VB = lesson.viewBox;
  const props = { lesson, placed, motion, f, direction };
  return (
    <Dialog open={open} onClose={onClose} title={f.inspectTitle} closeLabel={closeLabel} testId="dialog-inspect" wide>
      <p className="schem-tag" data-testid="inspect-schematic-label">{f.schematic}</p>
      <div className="seg" role="tablist" aria-label={f.viewsLabel}>
        {VIEWS.map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={`seg-btn ${view === v ? 'on' : ''}`} data-testid={`inspect-view-${v}`} onClick={() => setView(v)}>
            {f.views[v]}
          </button>
        ))}
      </div>
      {placed.length < lesson.steps.length && <p className="muted small" data-testid="inspect-partial">{f.partial(placed.length, lesson.steps.length)}</p>}
      {view === 'back' && <p className="muted small">{f.backNote}</p>}
      <ZoomPane key={view} f={f} label={f.views[view]}>
        <div className="inspect-art" dir="ltr" data-testid={`inspect-art-${view}`}>
          {view === 'front' && (
            <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-label={f.viewSr.front}>
              <ArrowDefs />
              <WindmillModel lesson={lesson} placed={placed} motion={motion} direction={direction} />
            </svg>
          )}
          {view === 'back' && <BackView {...props} />}
          {view === 'gears' && <GearView {...props} />}
          {view === 'exploded' && <ExplodedView {...props} />}
        </div>
      </ZoomPane>
    </Dialog>
  );
}
