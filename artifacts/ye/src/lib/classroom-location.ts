/** The owner confirmed Riyadh for all classes, not a street address. */
export const RIYADH_MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Riyadh%2C%20Saudi%20Arabia';

export function isCityOnlyLocation(location: string | null | undefined): boolean {
  return !location?.trim() || /^(riyadh|الرياض)$/i.test(location.trim());
}

export function classroomLocation(location: string | null | undefined, lang: 'ar' | 'en'): string {
  const value = location?.trim();
  if (isCityOnlyLocation(value)) {
    return lang === 'ar'
      ? 'الرياض — حضوري. تواصل معنا لتأكيد المقر الدقيق قبل الحضور.'
      : 'Riyadh — in person. Contact us to confirm the exact venue before attending.';
  }
  return value!;
}

export function classroomMapUrl(location: string | null | undefined): string {
  return isCityOnlyLocation(location)
    ? RIYADH_MAP_URL
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location!.trim()}, Riyadh, Saudi Arabia`)}`;
}
