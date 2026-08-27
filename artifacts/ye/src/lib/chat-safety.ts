/** Pure, conservative payment and assigned-secret detector. */
export function normalizeSafetyDigits(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    // Format characters have no semantic place inside a credential. Removing
    // them reconnects secrets split with zero-width, BOM, or bidi controls.
    .replace(/\p{Cf}/gu, '');
}

export function passesLuhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--, double = !double) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export type SensitivePaymentKind =
  | 'pan'
  | 'security_code'
  | 'bank_pin'
  | 'iban'
  | 'bank_account'
  | 'assigned_secret';

const SECRET_LABEL = String.raw`(?:\botp\b(?:\s*(?:code|password))?|\bone[\s-]*time\s*(?:code|password|passcode)\b|\bpin\b|\bpasscode\b|\bpassword\b|\bapi[\s_-]*key\b|\bsecret[\s_-]*key\b|\b(?:access|auth|authentication|authorization|bearer)[\s_-]*token\b|\btoken\b|\bprivate[\s_-]*key\b|\bcredentials?\b|\blogin[\s_-]*secret\b|رمز\s*التحقق(?:\s*البنكي)?|رمز\s*(?:لمرة|للاستخدام)\s*واحدة|كلمة\s*مرور\s*لمرة\s*واحدة|(?:ال)?رقم\s*السري|رقم\s*سري|رمز\s*المرور|كلمة\s*(?:المرور|السر)|مفتاح\s*(?:api|واجهة\s*البرمجة)|المفتاح\s*السري|مفتاح\s*سري|رمز\s*(?:الوصول|المصادقة|التوثيق|التفويض)|المفتاح\s*الخاص|مفتاح\s*خاص|بيانات\s*(?:الاعتماد|الدخول)|سر\s*الدخول)`;
const OTP_LABEL = String.raw`(?:\botp\b(?:\s*(?:code|password))?|\bone[\s-]*time\s*(?:code|password|passcode)\b|رمز\s*التحقق(?:\s*البنكي)?|رمز\s*(?:لمرة|للاستخدام)\s*واحدة|كلمة\s*مرور\s*لمرة\s*واحدة)`;
const STRONG_TOKEN_LABEL = String.raw`(?:\bapi[\s_-]*key\b|\bsecret[\s_-]*key\b|\bprivate[\s_-]*key\b|\b(?:access|auth|authentication|authorization|bearer)[\s_-]*token\b|مفتاح\s*(?:api|واجهة\s*البرمجة)|المفتاح\s*السري|مفتاح\s*سري|المفتاح\s*الخاص|مفتاح\s*خاص|رمز\s*(?:الوصول|المصادقة|التوثيق|التفويض))`;
const ASSIGNMENT_SEPARATOR_CHARS = String.raw`:=#,\u060c\u061b\-–—`;
const SECRET_ASSIGNMENT = String.raw`(?:[${ASSIGNMENT_SEPARATOR_CHARS}]|\bis\b|\bare\b|هو|هي)`;
const SECRET_VALUE = String.raw`(?:"[^"\r\n]{4,256}"|'[^'\r\n]{4,256}'|“[^”\r\n]{4,256}”|‘[^’\r\n]{4,256}’|[\p{L}\p{N}\p{M}!@#$%^&*._~+\-=/\\:?]{4,256})`;
const OPEN_QUOTE = String.raw`["'“‘]?`;
const CLOSE_QUOTE = String.raw`["'”’]?`;

function isSecretStatus(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/^["'“‘]|["'”’]$/g, '')
    .toLocaleLowerCase('en');
  return /^(?:expired|missing|invalid|unavailable|unknown|forgotten|revoked|disabled|removed|redacted|hidden|empty|none|null|documentation|docs?|help|reset|setup|configuration|example|sample|not(?:[-_/ ]?(?:working|available|received|arriving))?|what|where|when|why|how|who|which)\b/u.test(normalized) ||
    /^(?:منتهي|منتهية|مفقود|مفقودة|غير[-_/ ]?(?:صالح|صالحة|متاح|متاحة|موجود|موجودة)|ملغي|ملغى|محذوف|مخفي|فارغ|لا[-_/ ]?(?:يعمل|تعمل|يصل|تصل)|نسيت|منسي|كيف|ما|ماذا|أين|اين|متى|لماذا|هل)(?:$|[\s.,،؛؟!/_-])/u.test(normalized);
}

function hasExplicitAssignedSecret(text: string): boolean {
  const labelToValue = new RegExp(
    String.raw`${OPEN_QUOTE}${SECRET_LABEL}${CLOSE_QUOTE}\s*${SECRET_ASSIGNMENT}\s*(${SECRET_VALUE})`,
    'giu',
  );
  for (const match of text.matchAll(labelToValue)) {
    if (!isSecretStatus(match[1])) return true;
  }

  // Possessive/context words are permitted between the reverse assignment
  // and its label, e.g. "123456 is my bank OTP".
  const reverseModifiers = String.raw`(?:(?:my|the|bank|banking|payment|card)\s+|(?:رمز|حساب|بنك|بنكي|البنك|بطاقة|بطاقتي)\s+){0,4}`;
  const valueToLabel = new RegExp(
    String.raw`(${SECRET_VALUE})\s*${SECRET_ASSIGNMENT}\s*${OPEN_QUOTE}${reverseModifiers}${SECRET_LABEL}${CLOSE_QUOTE}`,
    'giu',
  );
  for (const match of text.matchAll(valueToLabel)) {
    if (!isSecretStatus(match[1])) return true;
  }
  return false;
}

function unquoteSecretValue(value: string): string {
  return value.trim().replace(/^["'“‘]/u, '').replace(/["'”’]$/u, '');
}

function hasStrongDirectSecret(text: string): boolean {
  // Short numeric OTPs are strong enough only when immediately adjacent to
  // an OTP/one-time-code label. This avoids matching unrelated phone,
  // booking, age, and date numbers elsewhere in the sentence.
  const otpForward = new RegExp(
    String.raw`${OPEN_QUOTE}${OTP_LABEL}${CLOSE_QUOTE}\s*(?:[:=#,\u060c\u061b\-–—]\s*)?\d{4,8}(?!\d)`,
    'iu',
  );
  const otpReverse = new RegExp(
    String.raw`(?<!\d)\d{4,8}\s*(?:[:=#,\u060c\u061b\-–—]\s*)?${OPEN_QUOTE}${OTP_LABEL}${CLOSE_QUOTE}`,
    'iu',
  );
  if (otpForward.test(text) || otpReverse.test(text)) return true;

  // Whitespace-only API/token forms are accepted only for token-shaped
  // values, not ordinary prose such as "documentation", "reset", or "help".
  const directToken = new RegExp(
    String.raw`${OPEN_QUOTE}${STRONG_TOKEN_LABEL}${CLOSE_QUOTE}\s+(${SECRET_VALUE})`,
    'giu',
  );
  for (const match of text.matchAll(directToken)) {
    const value = unquoteSecretValue(match[1]);
    if (!isSecretStatus(value) &&
        value.length >= 8 &&
        (/\d/u.test(value) || /[!@#$%^&*._~+\-=/\\:?]/u.test(value) || /^(?:sk|pk|ghp|github_pat|xox|eyj)[_-]?/iu.test(value))) {
      return true;
    }
  }

  // A generic "token" label is intentionally stricter than an access/auth
  // label so ordinary token documentation and status prose remain allowed.
  const bareToken = new RegExp(
    String.raw`${OPEN_QUOTE}\btoken\b${CLOSE_QUOTE}\s+(${SECRET_VALUE})`,
    'giu',
  );
  for (const match of text.matchAll(bareToken)) {
    const value = unquoteSecretValue(match[1]);
    const jwt = /^[A-Z0-9_-]+\.[A-Z0-9_-]+\.[A-Z0-9_-]+$/iu.test(value);
    const knownPrefix = /^(?:sk|pk|api|ghp|github_pat|xox)[_-]/iu.test(value);
    const mixedToken = value.length >= 8 && /\d/u.test(value) && /[._-]/u.test(value);
    if (!isSecretStatus(value) && (jwt || knownPrefix || mixedToken)) return true;
  }

  // Standard HTTP bearer credentials do not always include a "token" label.
  const bearer = new RegExp(
    String.raw`(?:\bauthorization\b\s*[:=]?\s*)?\bbearer\b\s+(${SECRET_VALUE})`,
    'iu',
  );
  const bearerMatch = text.match(bearer);
  if (bearerMatch && !isSecretStatus(unquoteSecretValue(bearerMatch[1]))) return true;

  // A private-key header is itself definitive and blocks the entire PEM,
  // preventing both its header and base64 body from reaching persistence.
  if (/-----BEGIN\s+(?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED)\s+)?PRIVATE\s+KEY-----/iu.test(text)) return true;
  return false;
}

function hasIban(text: string): boolean {
  // Saudi IBANs are sufficiently distinctive to block without a label.
  if (/\bSA(?:[\s-]*\d){22}\b/i.test(text)) return true;
  // International IBANs require an explicit label. Separators are accepted
  // between every character, then removed before structural validation.
  const ibanLabel = new RegExp(
    String.raw`(?:\biban\b|آيبان|ايبان)\s*(?:[${ASSIGNMENT_SEPARATOR_CHARS}]\s*)?([A-Z]{2}[\s-]*\d[\s-]*\d(?:[\s-]*[A-Z0-9]){11,30})`,
    'iu',
  );
  const ibanMatch = text.match(ibanLabel);
  if (!ibanMatch) return false;
  const candidate = ibanMatch[1].replace(/[\s-]/g, '').toUpperCase();
  return candidate.length >= 15 &&
    candidate.length <= 34 &&
    /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(candidate);
}

export function detectSensitivePaymentInput(raw: string): SensitivePaymentKind | null {
  const text = normalizeSafetyDigits(raw);
  // Preserve the more specific classification when an IBAN contains a
  // PAN-length numeric BBAN segment.
  if (hasIban(text)) return 'iban';
  const panSeparator = String.raw`[\s\-–—./_,،·‧]*`;
  // Consume the complete separator-connected digit run, then count it. This
  // blocks any plausible 13-19 digit PAN regardless of checksum while
  // refusing to carve a PAN-sized substring from a run longer than 19.
  const panCandidates = text.match(new RegExp(String.raw`\d(?:${panSeparator}\d){12,}`, 'gu')) ?? [];
  if (panCandidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19;
  })) return 'pan';

  const assignment = SECRET_ASSIGNMENT;
  const cvvLabel = String.raw`(?:\bcvv2?\b|\bcvc2?\b|security\s*code|card\s*verification|رمز\s*(?:الأمان|الحماية|التحقق)(?:\s*للبطاقة)?(?:\s*(?:الخاص|الخاصة)\s*ب(?:بطاقتي|البطاقة|بطاقته|بطاقتها))?)`;
  const cvvReverseModifiers = String.raw`(?:(?:my|the|card|payment|bank)\s+|(?:الخاص|الخاصة|بي|ببطاقتي|للبطاقة)\s+){0,3}`;
  const cvv = new RegExp(
    String.raw`${cvvLabel}\s*(?:${assignment}\s*)?\d{3,4}(?!\d)|(?<!\d)\d{3,4}\s*${assignment}\s*${cvvReverseModifiers}${cvvLabel}`,
    'iu',
  );
  if (cvv.test(text)) return 'security_code';

  if (hasExplicitAssignedSecret(text)) return 'assigned_secret';
  if (hasStrongDirectSecret(text)) return 'assigned_secret';

  const banking = /(?:card|bank|banking|payment|بطاق|بنك|مصرف|دفع)/iu;
  const credentialLabel = /(?:\bpin\b|password|passcode|credential|user\s*name|username|login[\s-]*id|رقم\s*سري|كلمة\s*(?:المرور|السر)|بيانات\s*الدخول|اسم\s*المستخدم|معرّف\s*الدخول|معرف\s*الدخول|رمز\s*الدخول)/iu;
  // A value is required. Questions that merely mention a forgotten password
  // have no assignment operator and therefore remain safe support questions.
  const credentialAssignment = new RegExp(
    String.raw`(?:\bpin\b|password|passcode|credential|user\s*name|username|login[\s-]*id|رقم\s*سري|كلمة\s*(?:المرور|السر)|بيانات\s*الدخول|اسم\s*المستخدم|معرّف\s*الدخول|معرف\s*الدخول|رمز\s*الدخول).{0,30}?${assignment}\s*([^\s,;؟?]{4,64})(?=$|\s|[,;؟?])`,
    'iu',
  );
  if (banking.test(text) && credentialLabel.test(text) && credentialAssignment.test(text)) return 'bank_pin';
  const directNumericCredential = /(?:\bpin\b|رقم\s*سري|رمز\s*الدخول)\s*[:=]?\s*\d{4,8}(?!\d)/iu;
  if (banking.test(text) && directNumericCredential.test(text)) return 'bank_pin';
  const paymentOtp = new RegExp(
    String.raw`(?:\botp\b|one.?time\s*(?:password|code)|رمز\s*التحقق)\s*(?:${assignment}\s*)?\d{4,8}(?!\d)`,
    'iu',
  );
  if (banking.test(text) && paymentOtp.test(text)) return 'bank_pin';

  const accountContext = /(?:bank\s*account|account\s*(?:number|password|credential)|رقم\s*(?:الحساب|الحساب\s*البنكي)|حساب\s*(?:بنكي|مصرفي))/iu;
  const accountValue = new RegExp(String.raw`${accountContext.source}.{0,12}?${assignment}\s*\d{8,24}(?!\d)`, 'iu');
  const directAccountNumber = /(?:bank\s*account\s*number|account\s*number|رقم\s*(?:الحساب|الحساب\s*البنكي))\s*[:#=-]?\s*\d{8,24}(?!\d)/iu;
  if (accountValue.test(text) || directAccountNumber.test(text)) return 'bank_account';
  return null;
}