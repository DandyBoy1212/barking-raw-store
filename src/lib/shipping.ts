// Shipping rules for Barking Raw.
// Free to DD1 to DD6. Otherwise a flat GBP 3.95, and free on any order over GBP 35.

export const FREE_OVER = 35;
export const FLAT_RATE = 3.95;
const LOCAL_AREA = "DD";
const LOCAL_MAX_DISTRICT = 6;

/** True for DD1..DD6 only (DD7+, DD11 etc. are not local). */
export function isLocalPostcode(postcode: string): boolean {
  if (!postcode) return false;
  const clean = postcode.toUpperCase().trim();
  // The outward code is the part before the space. With no space, the inward
  // code is always the last 3 chars, so strip those to get the outward code.
  const outward = clean.includes(" ")
    ? clean.split(/\s+/)[0]
    : clean.length > 3
      ? clean.slice(0, -3)
      : clean;
  const m = outward.match(/^([A-Z]{1,2})(\d{1,2})$/);
  if (!m) return false;
  const area = m[1];
  const district = parseInt(m[2], 10);
  return area === LOCAL_AREA && district >= 1 && district <= LOCAL_MAX_DISTRICT;
}

export type ShippingReason = "local" | "threshold" | "flat";

export interface Shipping {
  cost: number;
  free: boolean;
  reason: ShippingReason;
}

export function computeShipping(postcode: string, subtotal: number): Shipping {
  if (isLocalPostcode(postcode)) return { cost: 0, free: true, reason: "local" };
  if (subtotal >= FREE_OVER) return { cost: 0, free: true, reason: "threshold" };
  return { cost: FLAT_RATE, free: false, reason: "flat" };
}

/** Amount left to spend to unlock free postage (0 if already free / local). */
export function amountToFreePostage(postcode: string, subtotal: number): number {
  if (isLocalPostcode(postcode) || subtotal >= FREE_OVER) return 0;
  return Math.max(0, FREE_OVER - subtotal);
}
