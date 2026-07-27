// Subscribe and save (spec section 6, step E.1): a repeating order at 10% off.
//
// The permanent 10% is RESERVED for this feature, because a recurring order is
// the only discount where the customer gives something back: predictable revenue.
// Eligibility is own-stock only (spec 4.4): supplier-posted lines carry the
// supplier's price, postage and availability, none of which we control, so an
// automatic recurring charge for them is a promise we cannot keep.
//
// Everything in this module is pure: no Stripe network calls except through the
// injected client in ensureSubscribeCoupon, no Firestore, no React.

import type { FulfilmentPath } from "@/data/products";
import { priceToPence } from "@/lib/stripe-sync";

export const SUBSCRIBE_PERCENT = 10;

export type FrequencyWeeks = 2 | 4 | 8;

export const SUBSCRIBE_FREQUENCIES: { weeks: FrequencyWeeks; label: string }[] = [
  { weeks: 2, label: "Every 2 weeks" },
  { weeks: 4, label: "Every 4 weeks" },
  { weeks: 8, label: "Every 8 weeks" },
];

/** 2, 4 or 8 (number or numeric string, since JSON bodies and Stripe metadata both hand us strings), else null. */
export function parseFrequencyWeeks(v: unknown): FrequencyWeeks | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : NaN;
  return n === 2 || n === 4 || n === 8 ? n : null;
}

/** Split basket lines into those that can repeat (own stock) and those that cannot. */
export function splitSubscribable<T extends { fulfilment: FulfilmentPath }>(
  items: { product: T; qty: number }[],
): { eligible: { product: T; qty: number }[]; ineligible: { product: T; qty: number }[] } {
  return {
    eligible: items.filter((i) => i.product.fulfilment === "own-stock"),
    ineligible: items.filter((i) => i.product.fulfilment !== "own-stock"),
  };
}

/**
 * The subscribe price: 10% off, computed in pence so no float drift. Note this
 * takes 10% OFF the list price; the divide-by-0.9 list price rule in spec 6.1
 * is Michaela's repricing decision and deliberately not implemented here.
 */
export function discounted(amount: number): number {
  return Math.round(priceToPence(amount) * (1 - SUBSCRIBE_PERCENT / 100)) / 100;
}
