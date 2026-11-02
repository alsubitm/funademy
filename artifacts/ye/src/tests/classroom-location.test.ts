import { describe, expect, it } from 'vitest';
import { classroomLocation, classroomMapUrl, isCityOnlyLocation, RIYADH_MAP_URL } from '../lib/classroom-location';

describe('owner-confirmed classroom city', () => {
  it.each([undefined, null, '', '  ', 'Riyadh', ' rIyAdH ', 'الرياض'])(
    'uses the confirmed city without inventing a venue for %s', (location) => {
      expect(isCityOnlyLocation(location)).toBe(true);
      expect(classroomLocation(location, 'en')).toContain('Riyadh — in person');
      expect(classroomLocation(location, 'en')).toContain('confirm the exact venue');
      expect(classroomLocation(location, 'ar')).toContain('الرياض — حضوري');
      expect(classroomMapUrl(location)).toBe(RIYADH_MAP_URL);
    },
  );

  it('preserves a configured specific venue and safely encodes its map search', () => {
    const venue = ' Example Centre & Hall #2 ';
    expect(classroomLocation(venue, 'en')).toBe(venue.trim());
    expect(isCityOnlyLocation(venue)).toBe(false);
    const map = new URL(classroomMapUrl(venue));
    expect(map.origin).toBe('https://www.google.com');
    expect(map.searchParams.get('query')).toBe('Example Centre & Hall #2, Riyadh, Saudi Arabia');
    expect(map.hash).toBe('');
  });
});
