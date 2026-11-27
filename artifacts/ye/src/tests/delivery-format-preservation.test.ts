/**
 * The owner offers BOTH in-person and live online classes (January 2027
 * onward). Server boot must never rewrite stored delivery formats or
 * admin-authored copy: an earlier boot hook flipped every online
 * Program/ScheduleSlot/CourseRun to in_person on each (autoscale) restart,
 * which silently removed families' online join links.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

describe('delivery format preservation', () => {
  it('server boot does not rewrite delivery formats or catalog copy', () => {
    const boot = readFileSync(path.join(SRC, 'instrumentation.ts'), 'utf8');
    expect(boot).not.toMatch(/reconcileInPerson/);
    expect(boot).not.toMatch(/format:\s*['"]online['"]/);
    expect(boot).not.toMatch(/in_person/);
    expect(boot).not.toMatch(/faqEntry\.update/);
    expect(boot).not.toMatch(/program\.update/);
  });

  it('trial slot cards label online slots as online', () => {
    const flow = readFileSync(path.join(SRC, 'components/book/BookingFlow.tsx'), 'utf8');
    expect(flow).toMatch(/s\.format === 'online' \? d\.online : d\.inPerson/);
  });
});
