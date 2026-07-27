// Pure logic for what a paid online order earns and depletes: loyalty points on
// the amounts actually paid, and stock decrements for tracked products. No
// Firestore, no next/headers, no React, so this module is trivially
// unit-testable (mirrors stall-sale.ts, which is the same maths for the stall).
// Rates come from loyalty.ts, the code's single definition, never restated.
//
// Three sources meet here, because no single one has everything:
// - cart lines carry exact slugs and quantities (the store_carts doc, whose id
//   rides in the Stripe session metadata), which is what stock needs;
// - Stripe's paid line items carry names and post-discount amounts, which is
//   what points need, since a discounted pound taken must not earn like a full
//   one (spec 6.1);
// - the product docs carry each product's rate and stock count.
//
// Line items join to products by exact name. The names originate from our own
// product docs, so the join holds at fulfilment time; a rename in the seconds
// between checkout and webhook degrades to "no points for that line", which is
// the safe direction. A pick-and-mix bundle line matches nothing on purpose:
// its drawn contents exist only as capped metadata text, and parsing prose to
// mutate stock is how counts go quietly wrong. Unmatched names are reported so
// the caller can log them.

import { earnRateFor, earnedPoints } from "@/lib/loyalty";
import type { SaleProduct } from "@/lib/stall-sale";

export type OrderCartLine = { slug: string; qty: number };
export type PaidItem = { name: string; qty: number; amount: number };

export type OrderOutcome = {
  points: number;
  pointItems: { slug: string; name: string; amount: number; points: number }[];
  stockChanges: { slug: string; stock: number }[];
  unmatched: string[];
};

export function buildOrderOutcome(
  cartLines: OrderCartLine[],
  paidItems: PaidItem[],
  products: Map<string, SaleProduct>,
): OrderOutcome {
  const byName = new Map<string, SaleProduct>();
  for (const product of products.values()) byName.set(product.name, product);

  const pointItems: OrderOutcome["pointItems"] = [];
  const unmatched: string[] = [];
  for (const item of paidItems) {
    const product = byName.get(item.name);
    if (!product) {
      unmatched.push(item.name);
      continue;
    }
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const points = earnedPoints(amount, earnRateFor(product));
    if (points > 0) pointItems.push({ slug: product.slug, name: product.name, amount, points });
  }

  const stockChanges: OrderOutcome["stockChanges"] = [];
  for (const line of cartLines) {
    const product = products.get(String(line.slug ?? ""));
    if (!product || typeof product.stock !== "number") continue;
    const qty = Math.trunc(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;
    stockChanges.push({ slug: product.slug, stock: Math.max(0, product.stock - qty) });
  }

  return {
    points: pointItems.reduce((sum, i) => sum + i.points, 0),
    pointItems,
    stockChanges,
    unmatched,
  };
}

/**
 * Cart-shaped lines synthesised from paid items by the same name join, for
 * subscription invoices, which carry no cart. Unmatched names simply do not
 * become lines, so a bundle on a subscription (not sellable today anyway)
 * could never corrupt stock.
 */
export function linesFromPaidItems(
  paidItems: PaidItem[],
  products: Map<string, SaleProduct>,
): OrderCartLine[] {
  const byName = new Map<string, SaleProduct>();
  for (const product of products.values()) byName.set(product.name, product);
  const lines: OrderCartLine[] = [];
  for (const item of paidItems) {
    const product = byName.get(item.name);
    const qty = Math.trunc(Number(item.qty));
    if (!product || !Number.isFinite(qty) || qty < 1) continue;
    lines.push({ slug: product.slug, qty });
  }
  return lines;
}
