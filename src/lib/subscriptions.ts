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

import type Stripe from "stripe";
import type { FulfilmentPath } from "@/data/products";
import type { StoredProduct } from "@/lib/products-store";
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

// ---------------------------------------------------------------------------
// Stripe builders. The discount is a Coupon, NOT 90%-priced prices, so that
// Michaela's dashboard shows the full list price with a visible discount line
// on every invoice: "the discount is priced in" stays inspectable, not hidden
// inside a mystery number.
// ---------------------------------------------------------------------------

export const SUBSCRIBE_COUPON_ID = "subscribe-and-save-10";

/** The reusable forever coupon: retrieve by fixed id, create on first use. */
export async function ensureSubscribeCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(SUBSCRIBE_COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id: SUBSCRIBE_COUPON_ID,
      percent_off: SUBSCRIBE_PERCENT,
      duration: "forever",
      name: `Subscribe and save ${SUBSCRIBE_PERCENT}%`,
    });
  }
  return SUBSCRIBE_COUPON_ID;
}

/**
 * A recurring line at the FULL list price (the coupon does the discounting).
 * Prefers the synced recurring price id; falls back to inline price_data,
 * mirroring buildCheckoutLineItem for products not yet synced to Stripe.
 */
export function buildSubscriptionLineItem(
  sp: StoredProduct,
  qty: number,
  weeks: FrequencyWeeks,
  recurringPriceId?: string,
): Stripe.Checkout.SessionCreateParams.LineItem {
  const quantity = Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
  if (recurringPriceId) {
    return { price: recurringPriceId, quantity };
  }
  return {
    quantity,
    price_data: {
      currency: "gbp",
      unit_amount: priceToPence(sp.price),
      recurring: { interval: "week", interval_count: weeks },
      product_data: { name: sp.name },
    },
  };
}

export const POSTAGE_LINE_NAME = "UK postage";

/**
 * Subscription mode cannot reuse the one-off shipping_options for every cycle,
 * so postage recurs as its own line. Null when the basket earned free postage.
 */
export function buildPostageLineItem(
  cost: number,
  weeks: FrequencyWeeks,
): Stripe.Checkout.SessionCreateParams.LineItem | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return {
    quantity: 1,
    price_data: {
      currency: "gbp",
      unit_amount: priceToPence(cost),
      recurring: { interval: "week", interval_count: weeks },
      product_data: { name: POSTAGE_LINE_NAME },
    },
  };
}

/**
 * Stamped onto the subscription, so every later invoice can be unpicked without
 * guessing: what postage was agreed, from which postcode, and what the basket
 * held. Values are strings because Stripe metadata values are strings, and the
 * summary is capped at 480 like the one-off session metadata.
 */
export function subscriptionMetadata(input: {
  weeks: FrequencyWeeks;
  postcode: string;
  itemSummary: string;
  postagePence: number;
}): Record<string, string> {
  return {
    br_frequency_weeks: String(input.weeks),
    br_postcode: input.postcode,
    br_item_summary: input.itemSummary.slice(0, 480),
    br_postage_pence: String(input.postagePence),
  };
}
