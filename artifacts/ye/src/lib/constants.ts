export const WHATSAPP_NUMBER = '966505558387';
export const PHONE_DISPLAY = '+966 50 555 8387';
export const EMAIL = 'ceo@falconeye.sa';
export const LICENSE_NO = '4030388340';

export const waLink = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const WA_DEFAULT_AR = 'مرحباً! أريد حجز حصة تجريبية مجانية';

export const NEIGHBORHOODS = [
  { id: 'al-yasmin', en: 'Al Yasmin', ar: 'الياسمين' },
  { id: 'an-narjis', en: 'An Narjis', ar: 'النرجس' },
  { id: 'al-sahafah', en: 'Al Sahafah', ar: 'الصحافة' },
  { id: 'an-nada', en: 'An Nada', ar: 'الندى' },
  { id: 'an-nafal', en: 'An Nafal', ar: 'النفل' },
  { id: 'al-falah', en: 'Al Falah', ar: 'الفلاح' },
  { id: 'al-ghadir', en: 'Al Ghadir', ar: 'الغدير' },
  { id: 'at-taawun', en: 'At Taawun', ar: 'التعاون' },
  { id: 'king-salman', en: 'King Salman Nbhd', ar: 'حي الملك سلمان' },
  { id: 'other', en: 'Other', ar: 'أخرى' },
] as const;

/** Mini Watan exhibition — National Day */
export const EXHIBITION_DATE_ISO = '2027-09-23T16:00:00+03:00';

export const BRICK_KEY = 'watan-bricks';
export const BRICK_DAILY_LIMIT = 20;

export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEKDAYS_SHORT_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Riyadh date (YYYY-MM-DD) */
export const riyadhDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(d);

export const arabicDigits = (value: number | string) =>
  String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
