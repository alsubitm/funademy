import type { Prisma } from '@prisma/client';

// Self-contained on purpose: pay-core (reachable from instrumentation.ts) imports
// this module, and anything reachable from instrumentation is also bundled for
// the edge runtime, so no Node built-ins or next/headers here.
const toAsciiDigits = (raw: string) =>
  raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Saudi mobile → +9665XXXXXXXX (same rule as family-auth's normalizeSaudiPhone). */
function normalizeSaudiPhone(raw: string): string | null {
  const m = toAsciiDigits(raw).replace(/[\s\-()]/g, '').match(/^(?:\+?966|0)?(5\d{8})$/);
  return m ? `+966${m[1]}` : null;
}

/**
 * Kit delivery for ONLINE enrollments (owner decision, Nov 2026):
 * - every new online enrollment pays a one-time kit fee (CourseRun.kitFeeSar,
 *   VAT and SMSA delivery included) with its first month — one kit per child;
 * - kits ship anywhere in Saudi Arabia via SMSA;
 * - the kit fee is refundable only if the kit is returned (admin marks it).
 *
 * The parent enters the address at checkout; it is snapshotted on the Payment
 * and, once the payment settles and the enrollment activates, copied into one
 * KitShipment per kit line for the admin to ship.
 */
export type DeliveryAddress = {
  recipientName: string;
  recipientPhone: string; // +9665XXXXXXXX
  city: string;
  district: string;
  addressLine: string; // street, building number, extra details
  nationalAddressCode: string | null; // Saudi National Address short code, e.g. RRRD2929
  postalCode: string | null; // 5 digits
};

export type DeliveryField = keyof DeliveryAddress;

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Validate a delivery address from the request body. */
export function parseDeliveryAddress(
  input: unknown,
  fallbackPhone: string,
): { ok: true; address: DeliveryAddress } | { ok: false; field: DeliveryField } {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const recipientName = clean(b.recipientName, 80);
  if (recipientName.length < 2) return { ok: false, field: 'recipientName' };

  const phoneRaw = clean(b.recipientPhone, 20);
  const recipientPhone = phoneRaw ? normalizeSaudiPhone(phoneRaw) : fallbackPhone;
  if (!recipientPhone) return { ok: false, field: 'recipientPhone' };

  const city = clean(b.city, 60);
  if (city.length < 2) return { ok: false, field: 'city' };
  const district = clean(b.district, 80);
  if (district.length < 2) return { ok: false, field: 'district' };
  const addressLine = clean(b.addressLine, 200);
  if (addressLine.length < 5) return { ok: false, field: 'addressLine' };

  const codeRaw = toAsciiDigits(clean(b.nationalAddressCode, 12)).replace(/\s/g, '').toUpperCase();
  const nationalAddressCode = codeRaw || null;
  if (nationalAddressCode && !/^[A-Z]{4}\d{4}$/.test(nationalAddressCode)) return { ok: false, field: 'nationalAddressCode' };

  const postalRaw = toAsciiDigits(clean(b.postalCode, 10)).replace(/\s/g, '');
  const postalCode = postalRaw || null;
  if (postalCode && !/^\d{5}$/.test(postalCode)) return { ok: false, field: 'postalCode' };

  return { ok: true, address: { recipientName, recipientPhone, city, district, addressLine, nationalAddressCode, postalCode } };
}

/** Read a stored address snapshot (Payment.deliveryAddress / Family.deliveryAddress). */
export function storedAddress(value: Prisma.JsonValue | null | undefined): DeliveryAddress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  const opt = (k: string) => (typeof v[k] === 'string' && v[k] ? (v[k] as string) : null);
  const address: DeliveryAddress = {
    recipientName: str('recipientName'),
    recipientPhone: str('recipientPhone'),
    city: str('city'),
    district: str('district'),
    addressLine: str('addressLine'),
    nationalAddressCode: opt('nationalAddressCode'),
    postalCode: opt('postalCode'),
  };
  return address.recipientName && address.recipientPhone && address.city && address.addressLine ? address : null;
}

/**
 * Create the kit shipment for a settled payment line whose enrollment was just
 * activated. Idempotent per payment line (paymentItemId is unique). Returns
 * false when the address snapshot is missing so the caller can flag the
 * payment for admin review instead of silently skipping the kit.
 */
export async function createKitShipmentInTx(
  tx: Prisma.TransactionClient,
  payment: { familyId: number; deliveryAddress: Prisma.JsonValue | null },
  item: { id: number; enrollmentId: number | null; studentName: string; programAr: string; programEn: string; kitFeeSar: number },
): Promise<boolean> {
  if (item.kitFeeSar <= 0) return true;
  const address = storedAddress(payment.deliveryAddress);
  if (!address) return false;
  const enrollment = item.enrollmentId
    ? await tx.enrollment.findUnique({
        where: { id: item.enrollmentId },
        select: { courseRun: { select: { program: { select: { kitCode: true } } } } },
      })
    : null;
  await tx.kitShipment.upsert({
    where: { paymentItemId: item.id },
    update: {},
    create: {
      paymentItemId: item.id,
      familyId: payment.familyId,
      enrollmentId: item.enrollmentId,
      studentName: item.studentName,
      programAr: item.programAr,
      programEn: item.programEn,
      kitCode: enrollment?.courseRun.program.kitCode ?? '',
      kitFeeSar: item.kitFeeSar,
      ...address,
    },
  });
  return true;
}
