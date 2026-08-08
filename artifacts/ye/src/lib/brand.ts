/**
 * FunAdemy brand configuration — the single source of truth for brand names,
 * the footer credit line, tagline, and license. "FunAdemy" is ALWAYS written
 * in Latin letters, even inside Arabic text.
 */
import { LICENSE_NO } from '@/lib/constants';

export const BRAND = {
  /** Latin, always — never transliterated. */
  name: 'FunAdemy',
  /** Small-print partner credit only. */
  partner: 'e² Young Engineers',
  company: 'Falcon Eye Ltd',
  companyAr: 'فالكون آي المحدودة',
  licenseNo: LICENSE_NO,
  taglineAr: 'FunAdemy — حيث تلتقي المتعة بالأكاديمية',
  taglineEn: 'FunAdemy — WHERE FUN MEETS ACADEMY',
  /** Exact footer credit line — identical everywhere. */
  creditLine: `FunAdemy · e² Young Engineers · Falcon Eye Ltd — License ${LICENSE_NO}`,
  copyright: (year: number) => `© ${year} Falcon Eye Ltd. All rights reserved.`,
  legoDisclaimer:
    'LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize or endorse this site.',
} as const;
