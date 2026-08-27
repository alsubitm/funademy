import { describe, expect, it } from 'vitest';
import { detectSensitivePaymentInput, normalizeSafetyDigits, passesLuhn } from '@/lib/chat-safety';

describe('chat payment-secret detection', () => {
  it('detects Luhn PANs in Latin and Arabic-Indic digits', () => {
    const testPan = '4111 1111 1111 1111';
    expect(passesLuhn(testPan.replace(/\D/g, ''))).toBe(true);
    expect(detectSensitivePaymentInput(`card ${testPan}`)).toBe('pan');
    const arabic = testPan.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    expect(normalizeSafetyDigits(arabic)).toBe(testPan);
    expect(detectSensitivePaymentInput(`بطاقة ${arabic}`)).toBe('pan');
  });

  it('blocks separator-obfuscated PAN-length runs without relying on Luhn', () => {
    expect(detectSensitivePaymentInput('4111 1111 1111 1112')).toBe('pan');
    expect(detectSensitivePaymentInput('4111.1111.1111.1112')).toBe('pan');
    expect(detectSensitivePaymentInput('4111\u200B1111\u200B1111\u200B1112')).toBe('pan');
    expect(detectSensitivePaymentInput('٤١١١\u20661111\u2069١١١١\u200F١١١٢')).toBe('pan');
    expect(detectSensitivePaymentInput('12345678901234567890')).toBeNull();
  });

  it('detects contextual security codes and bank account credentials', () => {
    expect(detectSensitivePaymentInput('CVV: 123')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 is my CVV')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 is my CVC')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 is the CVV')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 is my card CVV')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 is my card security code')).toBe('security_code');
    expect(detectSensitivePaymentInput('123 - CVV')).toBe('security_code');
    expect(detectSensitivePaymentInput('١٢٣ هو رمز الأمان الخاص ببطاقتي')).toBe('security_code');
    expect(detectSensitivePaymentInput('IBAN SA00 0000 0000 0000 0000 0000')).toBe('iban');
    expect(detectSensitivePaymentInput('IBAN GB29 NWBK 6016 1331 9268 19')).toBe('iban');
    expect(detectSensitivePaymentInput('IBAN، GB29 NWBK 6016 1331 9268 19')).toBe('iban');
    expect(detectSensitivePaymentInput('آيبان، GB29 NWBK 6016 1331 9268 19')).toBe('iban');
    expect(detectSensitivePaymentInput('IBAN - GB29 NWBK 6016 1331 9268 19')).toBe('iban');
    expect(detectSensitivePaymentInput('آيبان؛ GB29 NWBK 6016 1331 9268 19')).toBe('iban');
    expect(detectSensitivePaymentInput('bank account number 123456789')).toBe('bank_account');
    expect(detectSensitivePaymentInput('bank password is Alpha9_secret')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('البنك كلمة المرور هي Secret9')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('بطاقتي كلمة المرور هي سِرّي_آمن٩')).toBe('assigned_secret');
  });

  it('detects explicitly assigned secrets in both directions and scripts', () => {
    expect(detectSensitivePaymentInput('OTP: 123456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('123456 is my bank OTP')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('رمز التحقق هو ١٢٣٤٥٦')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('١٢٣٤٥٦ هو رمز التحقق البنكي')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('API key = "sk_live-مثال_12345"')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('access token is abc.def/ghi+123')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('المفتاح الخاص هو سِرّي_آمن٩')).toBe('assigned_secret');
  });

  it('detects strong adjacent OTP, token, bearer, and PEM forms', () => {
    expect(detectSensitivePaymentInput('OTP - 123456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('123456 - OTP')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('رمز التحقق، ١٢٣٤٥٦')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('OTP 123456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('123456 OTP')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('API key - sk_live_abc12345')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('API key sk_live_abc12345')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Bearer eyJ...')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Authorization: Bearer eyJhbGciOiJIUzI1Ni.abc123.sig456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Bearer "eyJhbGciOiJIUzI1Ni.abc123.sig456"')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput("Bearer 'eyJhbGciOiJIUzI1Ni.abc123.sig456'")).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Bearer “eyJhbGciOiJIUzI1Ni.abc123.sig456”')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Authorization:\nBearer ‘eyJhbGciOiJIUzI1Ni.abc123.sig456’')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('token eyJhbGciOiJIUzI1Ni.abc123.sig456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('A\u200BPI key sk_live_abc\u206012345')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('OT\u200BP 12\u200B3456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('Bea\u200Brer eyJhbGciOiJIUzI1Ni.abc123.sig456')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('private key\n-----BEGIN PRIVATE KEY-----\nYWJjMTIz\n-----END PRIVATE KEY-----')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('private key MIIEvgIBADANBgkqhki9w0BAQEFA_example123')).toBe('assigned_secret');
  });

  it('accepts assignment punctuation, line breaks, and quotes in both directions', () => {
    for (const separator of [':', '=', '#', '-', '–', '—', ',', '،', '؛']) {
      expect(detectSensitivePaymentInput(`OTP ${separator} 123456`)).toBe('assigned_secret');
      expect(detectSensitivePaymentInput(`123456 ${separator} OTP`)).toBe('assigned_secret');
    }
    expect(detectSensitivePaymentInput('"OTP"\n—\n"123456"')).toBe('assigned_secret');
    expect(detectSensitivePaymentInput('"123456"\n،\n"OTP"')).toBe('assigned_secret');
  });

  it('allows ordinary family details and OTP support questions without a code', () => {
    expect(detectSensitivePaymentInput('My phone is +966 50 555 1021 and my child is age 8')).toBeNull();
    expect(detectSensitivePaymentInput('My booking number is 123 and my child is age 8')).toBeNull();
    expect(detectSensitivePaymentInput('How do I receive the login OTP?')).toBeNull();
    expect(detectSensitivePaymentInput('I forgot my bank password')).toBeNull();
    expect(detectSensitivePaymentInput('كيف أغير كلمة مرور البنك؟')).toBeNull();
    expect(detectSensitivePaymentInput('موعد الحجز 2026-08-21 ورقم الحجز 48291 وعمر الطفل 9')).toBeNull();
    expect(detectSensitivePaymentInput('I need help with login OTP and booking ID 48291')).toBeNull();
    expect(detectSensitivePaymentInput('How do I get my OTP?')).toBeNull();
    expect(detectSensitivePaymentInput('I forgot my password')).toBeNull();
    expect(detectSensitivePaymentInput('my token is expired')).toBeNull();
    expect(detectSensitivePaymentInput('my token is not working')).toBeNull();
    expect(detectSensitivePaymentInput('my token is missing')).toBeNull();
    expect(detectSensitivePaymentInput('رمز التحقق لا يصل')).toBeNull();
    expect(detectSensitivePaymentInput('Where is the API key documentation?')).toBeNull();
    expect(detectSensitivePaymentInput('I need help with an API key reset')).toBeNull();
    expect(detectSensitivePaymentInput('My password reset is not working')).toBeNull();
    expect(detectSensitivePaymentInput('token documentation')).toBeNull();
    expect(detectSensitivePaymentInput('token expired')).toBeNull();
    expect(detectSensitivePaymentInput('token not working')).toBeNull();
    expect(detectSensitivePaymentInput('How do I get a token?')).toBeNull();
  });
});