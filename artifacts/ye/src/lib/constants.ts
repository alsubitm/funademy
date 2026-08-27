export const WHATSAPP_NUMBER = '966505551021';
export const PHONE_DISPLAY = '+966 50 555 1021';
export const EMAIL = 'ceo@falconeye.sa';
export const LICENSE_NO = '4030388340';
/**
 * NELC (المركز الوطني للتعليم الإلكتروني) e-training license number.
 * Set the NELC_LICENSE_NO environment secret once the license is issued.
 * Leaving it unset keeps the site in "in preparation" state — never claim
 * a license that has not been issued (legal requirement).
 */
export const NELC_LICENSE_NO = process.env.NELC_LICENSE_NO ?? '';

export const waLink = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const WA_DEFAULT_AR = 'مرحباً! أريد حجز حصة تجريبية مجانية';

export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Watanona campaign */
export const EXHIBITION_DATE_ISO = '2027-09-23T16:00:00+03:00';
export const BRICK_KEY = 'watan-bricks';
export const BRICK_DAILY_LIMIT = 20;

/** Riyadh date (YYYY-MM-DD) */
export const riyadhDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(d);

export const arabicDigits = (value: number | string) =>
  String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
