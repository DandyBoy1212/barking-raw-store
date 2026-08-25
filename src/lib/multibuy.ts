// The four for GBP 20 offer on the pre-packaged treat range.
//
// Everything here is pure: no Firestore, no Stripe, no React, so the arithmetic
// is trivially unit-testable (mirrors shipping.ts and pick-and-mix.ts).
//
// Scope, from the spec: the treat range only. Boxes are excluded and so are
// toys, because "any four" is the obvious reading of the offer and it is the
// wrong one. A Mystery Bargain Box at GBP 7.50 falling into a group of four
// would sell at GBP 5. A Pick and Mix bundle is one basket line at its own
// bundle price, so it neither counts towards a group nor receives the offer.

import type { ProductCategory } from "@/data/products";
import { priceToPence } from "@/lib/stripe-sync";

export const MULTIBUY_QTY = 4;
export const MULTIBUY_PRICE = 20;

/** The only product fields the offer needs. */
export interface MultibuyProduct {
  price: number;
  category: ProductCategory;
}

export interface Multibuy {
  /** How many complete groups of four the basket contains. */
  groups: number;
  /** GBP taken off the basket. Zero when the offer does not apply or would cost the customer. */
  saving: number;
  /** How many more treats would complete the next group, or 0 when none is part-built. */
  toNextGroup: number;
}

/**
 * What the offer takes off this basket.
 *
 * The groups are formed from the most expensive treats down. Grouping the
 * cheapest first would technically satisfy "four for twenty" while quietly
 * handing the customer the smallest possible saving, and an offer that is
 * arithmetically true but designed to disappoint is the behaviour this whole
 * shop exists in opposition to.
 *
 * A group is only discounted when its four items really do cost more than
 * GBP 20 together. Four items at GBP 4.50 come to GBP 18, and the offer must
 * never be a way of charging somebody GBP 20 for GBP 18 of treats.
 *
 * Worked in pence throughout, so no float drift.
 */
export function computeMultibuy(items: { product: MultibuyProduct; qty: number }[]): Multibuy {
  const units: number[] = [];
  for (const { product, qty } of items) {
    if (product.category !== "treats") continue;
    const n = Math.max(0, Math.floor(qty));
    for (let i = 0; i < n; i++) units.push(priceToPence(product.price));
  }
  units.sort((a, b) => b - a);

  const groups = Math.floor(units.length / MULTIBUY_QTY);
  const targetPence = priceToPence(MULTIBUY_PRICE);
  let savingPence = 0;
  for (let g = 0; g < groups; g++) {
    const group = units.slice(g * MULTIBUY_QTY, (g + 1) * MULTIBUY_QTY);
    const listPence = group.reduce((s, p) => s + p, 0);
    if (listPence > targetPence) savingPence += listPence - targetPence;
  }

  const remainder = units.length % MULTIBUY_QTY;
  return {
    groups,
    saving: savingPence / 100,
    // Only prompt when a group is genuinely part-built. An empty basket, or one
    // with no treats in it at all, is not "1 away from a deal".
    toNextGroup: remainder === 0 ? 0 : MULTIBUY_QTY - remainder,
  };
}
