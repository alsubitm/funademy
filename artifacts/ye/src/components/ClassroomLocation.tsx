import { classroomLocation, classroomMapUrl, isCityOnlyLocation } from '@/lib/classroom-location';

export function ClassroomLocation({ location, lang }: {
  location?: string | null;
  lang: 'ar' | 'en';
}) {
  const cityOnly = isCityOnlyLocation(location);
  return (
    <span>
      📍 {classroomLocation(location, lang)}{' · '}
      <a href={classroomMapUrl(location)} target="_blank" rel="noopener noreferrer">
        {cityOnly
          ? (lang === 'ar' ? 'خريطة الرياض (ليست موقع المقر)' : 'Riyadh map (not the exact venue)')
          : (lang === 'ar' ? 'البحث عن المقر في الخرائط' : 'Search for venue on Maps')}
      </a>
    </span>
  );
}
