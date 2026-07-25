// Shipping rules for Barking Raw.
// Free to DD1 to DD6. Otherwise a flat GBP 3.95, and free on any order over GBP 35.

import type { FulfilmentPath } from "@/data/products";
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";

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

/** The only product fields the delivery rule needs. */
export interface DeliveryProduct {
  slug: string;
  name: string;
  price: number;
  fulfilment: FulfilmentPath;
  leadTimeDays: number;
  supplierPostage?: number;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
}

export interface DeliveryParcel {
  key: string;
  label: string;
  cost: number;
  note: string | null;
}

export interface BasketDelivery {
  parcels: DeliveryParcel[];
  total: number;
  ownStockSubtotal: number;
  amountToFreePostage: number;
}

/**
 * Turn a basket into the parcels it will actually arrive in.
 *
 * Everything from Michaela's own stock is one parcel under the existing site rule
 * (free to DD1 to DD6, otherwise GBP 3.95, free over GBP 35). Each supplier posted
 * line is its own parcel with its own postage and its own timing, because it does
 * not leave from her house. The customer sees this itemised in the basket and again
 * at checkout, so a mixed basket never becomes a surprise after payment.
 *
 * Two rules worth stating out loud:
 *  - the free postage threshold is measured against the own stock subtotal only,
 *    since the site's rule does not govern what the supplier charges;
 *  - supplier postage is charged once per line, not per unit, because a line is a parcel.
 */
export function computeBasketDelivery(
  items: { product: DeliveryProduct; qty: number }[],
  postcode: string,
): BasketDelivery {
  const own = items.filter((i) => i.product.fulfilment === "own-stock");
  const supplier = items.filter((i) => i.product.fulfilment === "supplier-posted");

  const ownStockSubtotal = own.reduce((s, i) => s + i.product.price * i.qty, 0);
  const parcels: DeliveryParcel[] = [];

  if (own.length > 0) {
    const shipping = computeShipping(postcode, ownStockSubtotal);
    const longestLead = own.reduce((n, i) => Math.max(n, i.product.leadTimeDays || 0), 0);
    parcels.push({
      key: "own-stock",
      label: "From Barking Raw",
      cost: shipping.cost,
      note: leadTimeNote({ leadTimeDays: longestLead }),
    });
  }

  for (const i of supplier) {
    const postage = Number(i.product.supplierPostage ?? 0);
    parcels.push({
      key: i.product.slug,
      label: i.product.name,
      cost: Number.isFinite(postage) && postage > 0 ? postage : 0,
      note: supplierArrivalNote(i.product),
    });
  }

  const total = Math.round(parcels.reduce((s, p) => s + p.cost, 0) * 100) / 100;
  return {
    parcels,
    total,
    ownStockSubtotal,
    amountToFreePostage: own.length > 0 ? amountToFreePostage(postcode, ownStockSubtotal) : 0,
  };
}
