# Stage 17: Pick and Mix Bundles (E.2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Pick & Mix" block on the Good Food page: choose 5, 10 or 20 items, the site draws a randomised assortment from own-stock Good Food products, priced at the sum of the real prices with a small stated saving, carried as one basket line whose contents the customer sees, the server re-prices, and Michaela's sheet lists.

**Architecture:** All logic lives in a pure module `src/lib/pick-and-mix.ts` (pool, seedable draw, pence-exact pricing, parse and validate), fully unit-tested. The cart carries a bundle as one `CartLine` with an optional `bundle` field holding the frozen selection; the drawer renders the contents; the checkout route validates and re-prices the bundle server-side and refuses tampering and discount stacking; the webhook copies per-bundle contents from session metadata onto the order doc, and the fulfilment sheet's item summary lists the contents inline.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, Stripe checkout sessions, Vitest. Builds on stages 7 (pillars, fulfilment paths), 9 (Good Food page) and 16 (subscribe and save).

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- Baseline: 390 tests passing, `npx tsc --noEmit` clean, `npm run lint` at exactly 3 pre-existing errors (CartProvider.tsx and thank-you/page.tsx). Do not fix them, do not add any.
- The E.1 subscription branch in `src/app/api/checkout/route.ts` stays undisturbed for baskets without a bundle. A body with no bundle lines must behave byte-identically to today, except that `metadata.itemSummary` in payment mode is now capped at 480 characters (see Decisions, D8).
- Run tests with `npx vitest run <path>`; whole suite with `npm test`.
- Do not push, merge, or touch `HANDOVER.md` / `vercel.json`. Do not touch the stall files, badge admin, or members area.
- Commit per task, message style per `git log`, body ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Decisions (each one written down so nobody re-litigates it blind)

- **D1. Eligible pool.** Own-stock AND `pillar === "good-food"` AND `leadTimeDays === 0`, drawn from the viewer's catalogue. The catalogue handed to `CartProvider` (layout.tsx) is already filtered to active, unarchived, and members-only-window-respecting products per viewer, so pool eligibility client-side needs only the three product checks. Spec 4.4 grounds the own-stock rule: a supplier-posted line cannot be randomised into a parcel Michaela packs herself. Lead time is excluded for the same physical reason: a bundle is packed from the shelf today, and one ordered-in item would silently delay the whole surprise parcel (spec 4.2's exact complaint).
- **D2. Pricing: real prices, fixed percentage off.** A bundle costs the sum of the drawn items' actual prices with `BUNDLE_PERCENT = 5` per cent off, computed in pence. Why not a flat per-item rate: with a pool whose prices vary, a flat rate under-recovers whenever the draw lands on the dear items and over-charges when it lands on the cheap ones, and it goes stale the day Michaela reprices under section 6.1. A percentage of real prices is honest on every draw and survives repricing untouched. Why 5 and not 10: section 6 reserves the permanent 10% for subscribe and save, the only discount where the customer gives something back; the bundle's 5% buys basket size (5, 10 or 20 packs at once) and must stay visibly smaller than the subscribe reward. Michaela controls the price the same two ways she controls everything: product prices in the admin, and the one constant in code.
- **D3. No stacking, enforced server-side.** A basket containing a bundle: refuses `frequencyWeeks` (400; bundles are one-off orders, and the drawer never offers subscribe when a bundle is present), ignores any `discountCode`, and does not set `allow_promotion_codes`. Section 6's rule is that each discount buys one thing; the bundle's saving is already priced in.
- **D4. The draw.** Seedable `mulberry32` RNG (tests pass a seed; production uses `Math.random`). `drawBundle` Fisher-Yates-shuffles the pool once and deals `size` items round-robin (`shuffled[i % pool.length]`), so per-product counts never differ by more than one: a 5-bundle is 5 distinct surprises, a 20-bundle is a fair spread of everything, and no draw is ever five of the same sprat. The selection is frozen at add-to-basket time; a re-roll is a new add.
- **D5. One basket line.** `CartLine` gains an optional `bundle: { size, items }`; the line's `slug` is a minted unique id, `qty` is fixed at 1 (no stepper; another bundle is another draw). The drawer lists the contents under the line.
- **D6. Server re-validation.** The checkout route parses the bundle shape, then validates: recognised size, item count equals size, every slug in the live catalogue, own-stock, good-food, zero lead time, and the members-only window (403 for a non-member, mirroring the single-line rule). Any failure refuses the whole checkout; a tampered bundle never reaches Stripe. The price is recomputed server-side from the live catalogue; the client's number is never trusted.
- **D7. The sheet row.** Each bundle's summary entry is `Pick & Mix (10 items): 3 x Chicken Feet, 2 x Whole Sprats, ...`, aggregated by product. That entry rides in `metadata.itemSummary` (which feeds the fulfilment sheet row), and each bundle additionally gets its own metadata key `bundle_1`, `bundle_2`, ... so a very long mixed basket that truncates the joined summary still carries every bundle's full contents; the webhook copies those keys onto the order doc as `bundles`.
- **D8. Metadata cap.** Stripe rejects any metadata value over 500 characters, which would fail the whole session. The payment-mode `itemSummary` was unsliced (latent today, reachable the moment a 20-item bundle lands), so it is now sliced to 480 like every other metadata value in the file.
- **D9. Stock.** Nothing in the codebase decrements a stock counter, because none exists: the stage 4 inventory plan (`docs/plans/2026-07-17-stage-4-inventory.md`) was written and never implemented, and "in stock" means `active && !archived` (exactly what `getStoredProducts` filters). Bundle contents therefore follow what the webhook does today: nothing. The day stage 4 lands, bundle contents are already recorded per order (`bundles` on the doc) so the decrement can be wired without archaeology.
- **D10. Delivery.** A bundle is own-stock goods in Michaela's single parcel. For `computeBasketDelivery`, each bundle line becomes a pseudo `DeliveryProduct` (`fulfilment: "own-stock"`, `leadTimeDays: 0`, `price` = the discounted bundle price), so the free-over-GBP-35 threshold counts what the customer actually pays for it. Client and server do the same mapping.

---

## File Structure

- **Create** `src/lib/pick-and-mix.ts` — the whole pure surface: `BUNDLE_SIZES`, `BUNDLE_PERCENT`, `BundleSize`, `BundleSelection`, `isBundleSize`, `bundlePool`, `mulberry32`, `drawBundle`, `priceBundle`, `bundleLabel`, `summariseBundleContents`, `bundleDeliveryProduct`, `parseBundle`, `validateBundle`.
- **Create** `src/lib/pick-and-mix.test.ts` — tests for all of the above.
- **Modify** `src/components/CartProvider.tsx` — `bundle` on `CartLine`, `addBundle`, bundle-aware `subtotal` and `delivery`, qty guard. (Carries a known lint error; do not worsen it.)
- **Modify** `src/components/BasketDrawer.tsx` — render bundle lines with contents, no stepper; suppress subscribe and discount code when a bundle is present, with honest notices.
- **Modify** `src/app/api/checkout/route.ts` — accept `bundle` on a line, validate, re-price, stacking gates, bundle metadata, itemSummary slice.
- **Modify** `src/app/api/webhooks/stripe/route.ts` — copy `bundle_N` metadata onto the order doc as `bundles`.
- **Create** `src/components/PickAndMixBuilder.tsx` — the client block: size choice, draw, shown selection and price, add to basket, draw again.
- **Modify** `src/app/good-food/page.tsx` — the Pick & Mix band, after the shelf.

---

### Task 1: The pure draw and pricing module

**Files:**
- Create: `src/lib/pick-and-mix.ts`
- Test: `src/lib/pick-and-mix.test.ts`

**Interfaces:**
- Produces (consumed by every later task):
  - `BUNDLE_SIZES: readonly [5, 10, 20]`, `type BundleSize = 5 | 10 | 20`, `BUNDLE_PERCENT = 5`
  - `interface BundleSelection { size: BundleSize; items: string[] }`
  - `isBundleSize(n: unknown): n is BundleSize`
  - `bundlePool<T extends { pillar: Pillar; fulfilment: FulfilmentPath; leadTimeDays?: number }>(products: T[]): T[]`
  - `mulberry32(seed: number): () => number`
  - `drawBundle(poolSlugs: string[], size: BundleSize, rng?: () => number): string[]`
  - `priceBundle(items: string[], bySlug: Map<string, { price: number }>): { list: number; price: number; saving: number } | null`
  - `bundleLabel(size: BundleSize): string`
  - `summariseBundleContents(items: string[], bySlug: Map<string, { name: string }>): string`
  - `bundleDeliveryProduct(lineSlug: string, size: BundleSize, price: number): DeliveryProduct`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pick-and-mix.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BUNDLE_PERCENT,
  BUNDLE_SIZES,
  bundleDeliveryProduct,
  bundleLabel,
  bundlePool,
  drawBundle,
  isBundleSize,
  mulberry32,
  priceBundle,
  summariseBundleContents,
} from "@/lib/pick-and-mix";

const mk = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.replace(/-/g, " "),
  price: 5,
  pillar: "good-food" as const,
  fulfilment: "own-stock" as const,
  leadTimeDays: 0,
  ...over,
});

describe("sizes", () => {
  it("recognises exactly 5, 10 and 20", () => {
    expect(BUNDLE_SIZES).toEqual([5, 10, 20]);
    expect(isBundleSize(5)).toBe(true);
    expect(isBundleSize(10)).toBe(true);
    expect(isBundleSize(20)).toBe(true);
    expect(isBundleSize(15)).toBe(false);
    expect(isBundleSize("10")).toBe(false);
    expect(isBundleSize(null)).toBe(false);
  });
});

describe("bundlePool", () => {
  it("keeps only own-stock, good-food, zero lead time products", () => {
    const pool = bundlePool([
      mk("sprats"),
      mk("supplier-chew", { fulfilment: "supplier-posted" }),
      mk("shampoo", { pillar: "healthy-body" }),
      mk("big-kibble", { leadTimeDays: 14 }),
    ]);
    expect(pool.map((p) => p.slug)).toEqual(["sprats"]);
  });

  it("treats a missing leadTimeDays as zero", () => {
    const pool = bundlePool([mk("sprats", { leadTimeDays: undefined })]);
    expect(pool).toHaveLength(1);
  });
});

describe("mulberry32", () => {
  it("is deterministic for a seed and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe("drawBundle", () => {
  const pool = ["a", "b", "c", "d"];

  it("draws exactly the asked-for count, all from the pool", () => {
    const items = drawBundle(pool, 10, mulberry32(1));
    expect(items).toHaveLength(10);
    for (const s of items) expect(pool).toContain(s);
  });

  it("is deterministic for the same seed and varies across seeds", () => {
    expect(drawBundle(pool, 5, mulberry32(7))).toEqual(drawBundle(pool, 5, mulberry32(7)));
    const draws = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => drawBundle(pool, 5, mulberry32(s)).join(",")),
    );
    expect(draws.size).toBeGreaterThan(1);
  });

  it("spreads the draw: per-product counts never differ by more than one", () => {
    for (const seed of [1, 2, 3]) {
      for (const size of [5, 10, 20] as const) {
        const items = drawBundle(pool, size, mulberry32(seed));
        const counts = new Map<string, number>();
        for (const s of items) counts.set(s, (counts.get(s) ?? 0) + 1);
        const values = [...counts.values()];
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a 5 from a pool of 9 is 5 distinct products", () => {
    const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const items = drawBundle(nine, 5, mulberry32(3));
    expect(new Set(items).size).toBe(5);
  });

  it("returns empty for an empty pool", () => {
    expect(drawBundle([], 5, mulberry32(1))).toEqual([]);
  });
});

describe("priceBundle", () => {
  const bySlug = new Map([
    ["a", { price: 6.5 }],
    ["b", { price: 4.0 }],
  ]);

  it("charges the real sum less the stated percentage, in exact pence", () => {
    // 2 x 6.50 + 1 x 4.00 = 17.00 list; 5% off = 16.15
    const priced = priceBundle(["a", "a", "b"], bySlug);
    expect(priced).toEqual({ list: 17, price: 16.15, saving: 0.85 });
  });

  it("never drifts on awkward floats", () => {
    const awkward = new Map([["a", { price: 0.1 }], ["b", { price: 0.2 }]]);
    const priced = priceBundle(["a", "b"], awkward);
    // 30 pence list, 5% off is 28.5 rounded to 29 pence.
    expect(priced).toEqual({ list: 0.3, price: 0.29, saving: 0.01 });
  });

  it("refuses a selection containing an unknown slug", () => {
    expect(priceBundle(["a", "ghost"], bySlug)).toBeNull();
  });

  it("refuses an empty selection", () => {
    expect(priceBundle([], bySlug)).toBeNull();
  });

  it("states the percentage it charges", () => {
    expect(BUNDLE_PERCENT).toBe(5);
  });
});

describe("labels and summaries", () => {
  it("names the line for the drawer, the sheet and Stripe", () => {
    expect(bundleLabel(10)).toBe("Pick & Mix (10 items)");
  });

  it("aggregates contents by product, most of a thing first", () => {
    const names = new Map([
      ["chicken-feet", { name: "Chicken Feet" }],
      ["sprats", { name: "Whole Sprats" }],
    ]);
    const text = summariseBundleContents(
      ["sprats", "chicken-feet", "chicken-feet"],
      names,
    );
    expect(text).toBe("2 x Chicken Feet, 1 x Whole Sprats");
  });

  it("falls back to the slug for a name it cannot resolve", () => {
    expect(summariseBundleContents(["ghost"], new Map())).toBe("1 x ghost");
  });
});

describe("bundleDeliveryProduct", () => {
  it("is own-stock, zero lead, priced at what the customer pays", () => {
    expect(bundleDeliveryProduct("pick-and-mix-x", 10, 16.15)).toEqual({
      slug: "pick-and-mix-x",
      name: "Pick & Mix (10 items)",
      price: 16.15,
      fulfilment: "own-stock",
      leadTimeDays: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: FAIL, cannot resolve `@/lib/pick-and-mix`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/pick-and-mix.ts`:

```ts
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
import type { DeliveryProduct } from "@/lib/shipping";
import { isMembersOnly } from "@/lib/product-fields";
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
```

(`isMembersOnly` is imported now and used by Task 2's `validateBundle`; if the linter objects to the unused import in this intermediate state, add it in Task 2 instead.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: PASS. Then `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pick-and-mix.ts src/lib/pick-and-mix.test.ts docs/plans/2026-07-26-stage-17-pick-and-mix.md
git commit -m "feat: the pick and mix draw, priced in pence with the saving stated"
```

---

### Task 2: Parse and validate a bundle server-side

**Files:**
- Modify: `src/lib/pick-and-mix.ts`
- Test: `src/lib/pick-and-mix.test.ts`

**Interfaces:**
- Consumes: Task 1's `BundleSelection`, `isBundleSize`, plus `isMembersOnly` from `@/lib/product-fields`.
- Produces (consumed by Task 4's checkout route):
  - `parseBundle(v: unknown): BundleSelection | null`
  - `type BundleVerdict = { ok: true } | { ok: false; status: 400 | 403; error: string }`
  - `validateBundle(sel: BundleSelection, catalogue: Array<{ slug: string; pillar: Pillar; fulfilment: FulfilmentPath; leadTimeDays?: number; membersOnlyUntil?: string }>, opts: { isMember: boolean; now: Date }): BundleVerdict`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/pick-and-mix.test.ts` (add `parseBundle`, `validateBundle` to the import):

```ts
describe("parseBundle", () => {
  it("accepts a well-shaped bundle", () => {
    expect(parseBundle({ size: 5, items: ["a", "b", "c", "d", "e"] })).toEqual({
      size: 5,
      items: ["a", "b", "c", "d", "e"],
    });
  });

  it.each([
    [null],
    ["ten"],
    [{ size: 15, items: [] }],
    [{ size: "10", items: [] }],
    [{ size: 5 }],
    [{ size: 5, items: "abcde" }],
    [{ size: 5, items: [1, 2, 3, 4, 5] }],
    [{ size: 5, items: ["a", "", "c", "d", "e"] }],
  ])("rejects %j", (raw) => {
    expect(parseBundle(raw)).toBeNull();
  });
});

describe("validateBundle", () => {
  const catalogue = [
    mk("sprats"),
    mk("chicken-feet"),
    mk("supplier-chew", { fulfilment: "supplier-posted" }),
    mk("shampoo", { pillar: "healthy-body" }),
    mk("big-kibble", { leadTimeDays: 14 }),
    mk("members-treat", { membersOnlyUntil: "2999-01-01" }),
  ];
  const now = new Date("2026-07-26T12:00:00Z");
  const opts = { isMember: false, now };
  const five = (slug: string) => ({
    size: 5 as const,
    items: [slug, "sprats", "sprats", "chicken-feet", "chicken-feet"],
  });

  it("accepts a bundle drawn from the honest pool", () => {
    expect(validateBundle(five("sprats"), catalogue, opts)).toEqual({ ok: true });
  });

  it("rejects an item count that does not match the size", () => {
    const verdict = validateBundle({ size: 10, items: ["sprats"] }, catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(400);
  });

  it.each([
    ["a slug the catalogue does not carry", "ghost"],
    ["a supplier-posted product", "supplier-chew"],
    ["a product from another pillar", "shampoo"],
    ["a product with a lead time", "big-kibble"],
  ])("rejects %s with a 400", (_desc, slug) => {
    const verdict = validateBundle(five(slug), catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(400);
  });

  it("refuses a members-only item to a non-member with a 403", () => {
    const verdict = validateBundle(five("members-treat"), catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(403);
  });

  it("allows the same item to a member while the window holds", () => {
    expect(validateBundle(five("members-treat"), catalogue, { isMember: true, now })).toEqual({
      ok: true,
    });
  });

  it("allows everyone the item once the window has passed", () => {
    const later = new Date("2999-06-01T00:00:00Z");
    expect(
      validateBundle(five("members-treat"), catalogue, { isMember: false, now: later }),
    ).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: FAIL, `parseBundle` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/pick-and-mix.ts`:

```ts
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
```

(Add the `isMembersOnly` import to the top of the file if Task 1 deferred it.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: PASS. Then `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pick-and-mix.ts src/lib/pick-and-mix.test.ts
git commit -m "feat: a bundle is parsed and re-validated before anyone is charged"
```

---

### Task 3: The basket carries a bundle as one line

**Files:**
- Modify: `src/components/CartProvider.tsx`
- Modify: `src/components/BasketDrawer.tsx`

**Interfaces:**
- Consumes: Task 1's `BundleSelection`, `priceBundle`, `bundleLabel`, `summariseBundleContents`, `bundleDeliveryProduct`, `BundleSize`.
- Produces: `CartLine` gains `bundle?: BundleSelection`; `useCart()` gains `addBundle(size: BundleSize, items: string[]): void` (consumed by Task 5's builder).

There are no component tests in this codebase and this task follows that
convention; the pure arithmetic it leans on is tested in Tasks 1 and 2, and
the wiring is proven by tsc, lint and the Task 6 sweep.

- [ ] **Step 1: Extend CartProvider**

In `src/components/CartProvider.tsx`:

1. Add to the imports:

```ts
import {
  bundleDeliveryProduct,
  priceBundle,
  type BundleSelection,
  type BundleSize,
} from "@/lib/pick-and-mix";
import type { DeliveryProduct } from "@/lib/shipping";
```

2. Extend the line type and context:

```ts
export interface CartLine {
  slug: string;
  qty: number;
  /** Present on a Pick & Mix line: the frozen draw the customer saw. */
  bundle?: BundleSelection;
}
```

Add `addBundle: (size: BundleSize, items: string[]) => void;` to `CartCtx`.

3. Implement `addBundle` beside `add` (each bundle is its own line under a
minted id; a second identical draw is still a separate line):

```ts
const addBundle = (size: BundleSize, items: string[]) =>
  setLines((prev) => [
    ...prev,
    {
      slug: `pick-and-mix-${size}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      qty: 1,
      bundle: { size, items },
    },
  ]);
```

4. Guard `setQty` so a bundle line's quantity is fixed at 1 (removal still
works through qty <= 0; another bundle is another draw, not qty 2):

```ts
const setQty = (slug: string, qty: number) =>
  setLines((prev) =>
    qty <= 0
      ? prev.filter((l) => l.slug !== slug)
      : prev.map((l) => (l.slug === slug && !l.bundle ? { ...l, qty } : l)),
  );
```

5. Make `subtotal` bundle-aware:

```ts
const subtotal = useMemo(
  () =>
    lines.reduce((s, l) => {
      if (l.bundle) return s + (priceBundle(l.bundle.items, bySlug)?.price ?? 0);
      const p = bySlug.get(l.slug);
      return s + (p ? p.price * l.qty : 0);
    }, 0),
  [lines, bySlug],
);
```

6. Make `delivery` count a bundle as own-stock goods:

```ts
const delivery = (postcode: string) =>
  computeBasketDelivery(
    lines
      .map((l): { product: DeliveryProduct | undefined; qty: number } => {
        if (l.bundle) {
          const priced = priceBundle(l.bundle.items, bySlug);
          return {
            product: priced
              ? bundleDeliveryProduct(l.slug, l.bundle.size, priced.price)
              : undefined,
            qty: 1,
          };
        }
        return { product: bySlug.get(l.slug), qty: l.qty };
      })
      .filter((i): i is { product: DeliveryProduct; qty: number } => Boolean(i.product)),
    postcode,
  );
```

7. Add `addBundle` to the provider value.

Do not touch the two `useEffect` blocks: the known lint error lives there and
must stay at exactly one error in this file.

- [ ] **Step 2: Render bundle lines in BasketDrawer**

In `src/components/BasketDrawer.tsx`:

1. Add to the imports:

```ts
import { bundleLabel, priceBundle, summariseBundleContents } from "@/lib/pick-and-mix";
```

2. Above `basketItems`, derive the bundle facts once:

```ts
const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
const hasBundle = lines.some((l) => Boolean(l.bundle));
```

3. In the line list, before the `const p = detail(l.slug);` lookup, branch on
a bundle line (one line, contents listed, remove only, no stepper):

```tsx
{lines.map((l) => {
  if (l.bundle) {
    const priced = priceBundle(l.bundle.items, bySlug);
    return (
      <div className="line-item" key={l.slug}>
        <div style={{ flex: 1 }}>
          <div className="line-item__name">{bundleLabel(l.bundle.size)}</div>
          <div className="line-item__meta">
            {priced ? gbp(priced.price) : ""}
            {priced && priced.saving > 0 && ` (saves ${gbp(priced.saving)})`}
            <button
              onClick={() => remove(l.slug)}
              style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginLeft: 8 }}
            >
              remove
            </button>
          </div>
          <div className="line-item__meta" style={{ fontStyle: "italic" }}>
            {summariseBundleContents(l.bundle.items, bySlug)}
          </div>
        </div>
      </div>
    );
  }
  const p = detail(l.slug);
  if (!p) return null;
  return ( /* existing single-product line, unchanged */ );
})}
```

4. Suppress subscribe when a bundle is present (a bundle is a one-off), and
say why rather than hiding silently. Change:

```ts
const canSubscribe = basketItems.length > 0 && ineligible.length === 0 && !hasBundle;
```

and extend the notice chain after the subscribe fieldset:

```tsx
) : hasBundle ? (
  <p className="notice">
    A Pick & Mix bundle is a one-off order, so repeat orders and discount codes
    do not apply while one is in the basket. The saving is already in its price.
  </p>
) : ineligible.length > 0 ? (
```

(`basketItems` already excludes bundle lines because `detail()` cannot resolve
their minted slug; `hasBundle` makes the intent explicit rather than relying
on that accident.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` clean, `npm run lint` still exactly 3 errors, `npm test` all passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/CartProvider.tsx src/components/BasketDrawer.tsx
git commit -m "feat: the basket holds a bundle as one line with its contents shown"
```

---

### Task 4: Checkout re-prices the bundle and refuses stacking; the sheet sees the contents

**Files:**
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: Task 2's `parseBundle` and `validateBundle`; Task 1's `priceBundle`, `bundleLabel`, `summariseBundleContents`, `bundleDeliveryProduct`; `priceToPence` from `@/lib/stripe-sync`; `DeliveryProduct` from `@/lib/shipping`.
- Produces: request `lines` may carry `bundle`; session metadata gains `bundle_1..n`; order docs gain `bundles: string[]` when present.

- [ ] **Step 1: Accept and price bundle lines in the checkout route**

In `src/app/api/checkout/route.ts`:

1. Extend the request line type:

```ts
interface Line {
  slug: string;
  qty: number;
  bundle?: unknown;
}
```

2. Add to the imports:

```ts
import {
  bundleDeliveryProduct,
  bundleLabel,
  parseBundle,
  priceBundle,
  summariseBundleContents,
  validateBundle,
} from "@/lib/pick-and-mix";
import { priceToPence } from "@/lib/stripe-sync";
import type { DeliveryProduct } from "@/lib/shipping";
```

3. Beside the existing accumulators add:

```ts
const bundleContents: string[] = [];
const bundleDeliveryItems: { product: DeliveryProduct; qty: number }[] = [];
```

4. At the top of the `for (const l of lines)` loop, handle a bundle line
before the single-product lookup (server catalogue, server prices, whole
checkout refused on tampering rather than a line silently dropped):

```ts
if (l.bundle !== undefined) {
  const sel = parseBundle(l.bundle);
  if (!sel) {
    return NextResponse.json(
      { error: "That Pick & Mix bundle does not match what we offer. Please draw a fresh one." },
      { status: 400 },
    );
  }
  const verdict = validateBundle(sel, catalogue, { isMember, now });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  }
  const priced = priceBundle(sel.items, bySlug);
  if (!priced) {
    return NextResponse.json(
      { error: "That Pick & Mix bundle does not match what we offer. Please draw a fresh one." },
      { status: 400 },
    );
  }
  const contents = summariseBundleContents(sel.items, bySlug);
  subtotal += priced.price;
  summary.push(`${bundleLabel(sel.size)}: ${contents}`);
  bundleContents.push(`${bundleLabel(sel.size)}: ${contents}`);
  line_items.push({
    quantity: 1,
    price_data: {
      currency: "gbp",
      unit_amount: priceToPence(priced.price),
      product_data: {
        name: bundleLabel(sel.size),
        // The contents on the Stripe line itself, so the dashboard shows what
        // was in the bag without opening the sheet. Stripe caps this field.
        description: contents.slice(0, 250),
      },
    },
  });
  bundleDeliveryItems.push({
    product: bundleDeliveryProduct(`pick-and-mix-${sel.size}-${bundleContents.length}`, sel.size, priced.price),
    qty: 1,
  });
  continue;
}
```

5. Stacking gates, straight after the `line_items.length === 0` check (before
the existing subscription eligibility check):

```ts
// A bundle's saving is already in its price, and section 6 exists precisely
// so discounts never stack: while one is in the basket there is no repeat
// order and no discount code. The drawer says the same; a hand-built request
// must hit the same wall.
const hasBundle = bundleContents.length > 0;
if (frequencyWeeks && hasBundle) {
  return NextResponse.json(
    { error: "A Pick & Mix bundle is a one-off order. Remove it to set up a repeat order." },
    { status: 400 },
  );
}
```

6. Point delivery at both arrays:

```ts
const delivery = computeBasketDelivery([...deliveryItems, ...bundleDeliveryItems], postcode);
```

7. Refuse the welcome code alongside the existing gate, changing the discount
condition to:

```ts
if (discountCode && db && !frequencyWeeks && !hasBundle) {
```

8. In the payment-mode session: cap the summary and carry each bundle's full
contents in its own metadata key (Stripe rejects any metadata value over 500
characters, so the previously unsliced itemSummary was one long basket away
from failing the whole session):

```ts
...(discounts.length ? { discounts } : hasBundle ? {} : { allow_promotion_codes: true }),
metadata: {
  cartId,
  postcode,
  itemSummary: summary.join(", ").slice(0, 480),
  ...Object.fromEntries(bundleContents.map((c, i) => [`bundle_${i + 1}`, c.slice(0, 480)])),
  // ...existing deliveryBreakdown and parcelCount stay as they are
},
```

- [ ] **Step 2: Carry the contents onto the order doc**

In `src/app/api/webhooks/stripe/route.ts`, inside `fulfil()` where the one-off
order doc is written, collect the per-bundle metadata (numeric order, so
`bundle_10` never sorts before `bundle_2`):

```ts
const bundles = Object.keys(full.metadata || {})
  .filter((k) => /^bundle_\d+$/.test(k))
  .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
  .map((k) => full.metadata![k]);
```

and add to the `orderRef.set({...})` payload:

```ts
...(bundles.length ? { bundles } : {}),
```

The sheet row needs no change: its item summary comes from
`metadata.itemSummary`, which now lists each bundle's contents inline. Stock
needs no change either: nothing in this webhook decrements a counter, because
none exists (the stage 4 inventory plan was never implemented); when it lands,
`bundles` on the order doc is the record it will need.

- [ ] **Step 3: Verify**

Run: `npm test` all passing, `npx tsc --noEmit` clean, `npm run lint` at exactly 3.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/checkout/route.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat: checkout re-prices the bundle, refuses tampering and stacking"
```

---

### Task 5: The Pick & Mix block on the Good Food page

**Files:**
- Create: `src/components/PickAndMixBuilder.tsx`
- Modify: `src/app/good-food/page.tsx`

**Interfaces:**
- Consumes: Task 3's `useCart().addBundle` and `useCart().catalogue`; Task 1's `BUNDLE_SIZES`, `bundlePool`, `drawBundle`, `priceBundle`, `summariseBundleContents`, `bundleLabel`, `BundleSize`; `gbp` from `@/lib/format`.

- [ ] **Step 1: Write the builder component**

Create `src/components/PickAndMixBuilder.tsx`:

```tsx
"use client";

import { useState } from "react";
import { gbp } from "@/lib/format";
import {
  BUNDLE_SIZES,
  bundleLabel,
  bundlePool,
  drawBundle,
  priceBundle,
  summariseBundleContents,
  type BundleSize,
} from "@/lib/pick-and-mix";
import { useCart } from "./CartProvider";

/**
 * The Pick & Mix builder (spec step E.2). The randomisation is the product:
 * pick a size, we draw the assortment, you see exactly what was drawn and
 * what it costs before it goes anywhere near the basket. The catalogue comes
 * from the cart context, so members see their early-access items in the pool
 * and nobody else ever receives them.
 */
export function PickAndMixBuilder() {
  const { catalogue, addBundle, setOpen } = useCart();
  const [size, setSize] = useState<BundleSize>(10);
  const [items, setItems] = useState<string[] | null>(null);
  const [added, setAdded] = useState(false);

  const pool = bundlePool(catalogue);
  if (pool.length === 0) return null;

  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const priced = items ? priceBundle(items, bySlug) : null;

  const draw = (s: BundleSize) => {
    setSize(s);
    setItems(drawBundle(pool.map((p) => p.slug), s));
    setAdded(false);
  };

  const add = () => {
    if (!items) return;
    addBundle(size, items);
    setItems(null);
    setAdded(true);
    setOpen(true);
  };

  return (
    <div className="pickmix">
      <div className="pickmix__sizes" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {BUNDLE_SIZES.map((s) => (
          <button
            key={s}
            className={`btn ${items && size === s ? "btn--solid-ink" : ""}`}
            onClick={() => draw(s)}
          >
            {s} items
          </button>
        ))}
      </div>

      {items && priced && (
        <div className="pickmix__result" style={{ marginTop: "1rem" }}>
          <p style={{ fontWeight: 600 }}>
            {bundleLabel(size)}: {gbp(priced.price)}
            <span style={{ fontWeight: 400 }}> (worth {gbp(priced.list)} bought singly, saves {gbp(priced.saving)})</span>
          </p>
          <p>{summariseBundleContents(items, bySlug)}</p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn--solid-ink" onClick={add}>
              Add this surprise to the basket
            </button>
            <button className="btn" onClick={() => draw(size)}>
              Draw again
            </button>
          </div>
          <p className="notice" style={{ marginTop: "0.5rem" }}>
            One parcel from us, packed by hand. Repeat orders and discount codes
            do not apply to a bundle; the saving is already in the price.
          </p>
        </div>
      )}

      {!items && added && (
        <p className="notice" style={{ marginTop: "1rem" }}>
          In the basket. Fancy another? Every draw is different.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the band to the Good Food page**

In `src/app/good-food/page.tsx`, import the builder and add a band after the
shelf section (before `</main>`):

```tsx
import { PickAndMixBuilder } from "@/components/PickAndMixBuilder";
```

```tsx
<section className="band band--paper" id="pick-and-mix">
  <div className="wrap wrap--tight">
    <div className="section-head">
      <p className="eyebrow">Pick &amp; Mix</p>
      <h2 className="display">Let us surprise your dog.</h2>
      <p>
        Choose 5, 10 or 20 items and we pick the assortment: a randomised
        spread of the good food above, packed by hand from our own shelf.
        You see exactly what was drawn, and what it saves, before you add
        it. Do not like the draw? Draw again.
      </p>
    </div>
    <PickAndMixBuilder />
  </div>
</section>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` clean, `npm run lint` at exactly 3, `npm test` all passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/PickAndMixBuilder.tsx src/app/good-food/page.tsx
git commit -m "feat: the pick and mix block, let us surprise your dog"
```

---

### Task 6: Full verification and the plan ticked through

- [ ] **Step 1: The full gate**

Run: `npm test` (390 baseline plus the new pick-and-mix tests, all passing),
`npx tsc --noEmit` (clean), `npm run lint` (exactly 3 pre-existing errors, in
CartProvider.tsx and thank-you/page.tsx, none new).

- [ ] **Step 2: Tick this plan through and commit**

Mark every checkbox above done, then:

```bash
git add docs/plans/2026-07-26-stage-17-pick-and-mix.md
git commit -m "docs: tick the stage 17 plan through, all six tasks executed"
```
