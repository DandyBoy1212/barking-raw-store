// Pick and mix bundles (spec step E.2): 5, 10 or 20 items, randomised from
// own-stock, in-stock Good Food products, priced as the sum of the real prices
// with a small stated saving. The randomisation is the product: "let us
// surprise your dog".
//
// Everything here is pure: no Firestore, no Stripe, no React, so the module is
// trivially unit-testable (mirrors subscriptions.ts and shipping.ts).
//
// The saving is 5%, deliberately below the 10% reserved for subscribe and save
// (spec section 6): the bundle's discount buys basket size, and it must never
// outbid the one discount the customer pays for with predictability. It is a
// percentage of the real prices rather than a flat per-item rate, so it stays
// honest whichever items the draw lands on and survives Michaela repricing
// under section 6.1 without anyone touching this file.

import type { FulfilmentPath, Pillar } from "@/data/products";
import { isMembersOnly } from "@/lib/product-fields";
import type { DeliveryProduct } from "@/lib/shipping";
import { priceToPence } from "@/lib/stripe-sync";

export const BUNDLE_SIZES = [5, 10, 20] as const;
export type BundleSize = (typeof BUNDLE_SIZES)[number];
export const BUNDLE_PERCENT = 5;

/** A frozen draw: what the customer saw is what checkout prices. */
export interface BundleSelection {
  size: BundleSize;
  items: string[];
}

export function isBundleSize(n: unknown): n is BundleSize {
  return (BUNDLE_SIZES as readonly number[]).includes(n as number);
}

/**
 * The products a bundle may draw from: Michaela's own shelf (spec 4.4, she
 * packs the parcel herself), the Good Food pillar, and nothing with a lead
 * time (spec 4.2: one ordered-in item would silently delay the whole parcel).
 * Callers pass the viewer's catalogue, which is already filtered to active,
 * unarchived and members-window-respecting products.
 */
export function bundlePool<
  T extends { pillar: Pillar; fulfilment: FulfilmentPath; leadTimeDays?: number },
>(products: T[]): T[] {
  return products.filter(
    (p) =>
      p.fulfilment === "own-stock" &&
      p.pillar === "good-food" &&
      !(Number(p.leadTimeDays ?? 0) > 0),
  );
}

/** Small seedable RNG so tests can pin a draw; production seeds from Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw `size` items: shuffle the pool once (Fisher-Yates), then deal round
 * robin. Per-product counts never differ by more than one, so a small bundle
 * is all distinct surprises and a big one is a fair spread of the shelf,
 * never five of the same sprat.
 */
export function drawBundle(
  poolSlugs: string[],
  size: BundleSize,
  rng: () => number = Math.random,
): string[] {
  if (poolSlugs.length === 0) return [];
  const shuffled = [...poolSlugs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const items: string[] = [];
  for (let i = 0; i < size; i++) items.push(shuffled[i % shuffled.length]);
  return items;
}

/**
 * The bundle price, computed in pence so no float drift: the sum of the real
 * prices, less BUNDLE_PERCENT. Null when the selection is empty or names a
 * product the catalogue does not carry, because a price for goods we cannot
 * identify is not a price.
 */
export function priceBundle(
  items: string[],
  bySlug: Map<string, { price: number }>,
): { list: number; price: number; saving: number } | null {
  if (items.length === 0) return null;
  let listPence = 0;
  for (const slug of items) {
    const p = bySlug.get(slug);
    if (!p) return null;
    listPence += priceToPence(p.price);
  }
  const pricePence = Math.round(listPence * (1 - BUNDLE_PERCENT / 100));
  return {
    list: listPence / 100,
    price: pricePence / 100,
    saving: (listPence - pricePence) / 100,
  };
}

/** The line name the drawer, the sheet and Stripe all agree on. */
export function bundleLabel(size: BundleSize): string {
  return `Pick & Mix (${size} items)`;
}

/**
 * Contents aggregated by product, biggest count first then alphabetical, in
 * the sheet's own "n x Name" idiom. This is the text Michaela packs from, so
 * an unresolvable slug degrades to the slug rather than vanishing.
 */
export function summariseBundleContents(
  items: string[],
  bySlug: Map<string, { name: string }>,
): string {
  const counts = new Map<string, number>();
  for (const slug of items) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  return [...counts.entries()]
    .map(([slug, qty]) => ({ name: bySlug.get(slug)?.name || slug, qty }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .map((e) => `${e.qty} x ${e.name}`)
    .join(", ");
}

/**
 * A bundle as the delivery rule sees it: own-stock goods in Michaela's one
 * parcel, priced at what the customer actually pays, so the free-over-35
 * threshold counts the real money.
 */
export function bundleDeliveryProduct(
  lineSlug: string,
  size: BundleSize,
  price: number,
): DeliveryProduct {
  return {
    slug: lineSlug,
    name: bundleLabel(size),
    price,
    fulfilment: "own-stock",
    leadTimeDays: 0,
  };
}

/**
 * Shape-check a bundle from a request body. Nothing here is trusted: size
 * must be a recognised size, items must be a list of non-empty strings.
 */
export function parseBundle(v: unknown): BundleSelection | null {
  if (!v || typeof v !== "object") return null;
  const raw = v as Record<string, unknown>;
  if (!isBundleSize(raw.size)) return null;
  if (!Array.isArray(raw.items)) return null;
  const items: string[] = [];
  for (const entry of raw.items) {
    if (typeof entry !== "string" || !entry) return null;
    items.push(entry);
  }
  return { size: raw.size, items };
}

export type BundleVerdict = { ok: true } | { ok: false; status: 400 | 403; error: string };

/**
 * The server's answer to a tampered bundle: every item must be in the live
 * catalogue, own stock, Good Food, zero lead time, and outside its members
 * only window unless the buyer is a member (403, mirroring the single-line
 * rule in the checkout route). The whole checkout is refused rather than the
 * line dropped, because silently repricing a surprise bag is worse than
 * asking the customer to draw again.
 */
export function validateBundle(
  sel: BundleSelection,
  catalogue: Array<{
    slug: string;
    pillar: Pillar;
    fulfilment: FulfilmentPath;
    leadTimeDays?: number;
    membersOnlyUntil?: string;
  }>,
  opts: { isMember: boolean; now: Date },
): BundleVerdict {
  const tampered: BundleVerdict = {
    ok: false,
    status: 400,
    error: "That Pick & Mix bundle does not match what we offer. Please draw a fresh one.",
  };
  if (sel.items.length !== sel.size) return tampered;
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const pool = new Set(bundlePool(catalogue).map((p) => p.slug));
  for (const slug of sel.items) {
    const p = bySlug.get(slug);
    if (!p) return tampered;
    if (!opts.isMember && isMembersOnly(p, opts.now)) {
      return {
        ok: false,
        status: 403,
        error: "That Pick & Mix bundle includes an item that is members only just now.",
      };
    }
    if (!pool.has(slug)) return tampered;
  }
  return { ok: true };
}
