# Stage 7: Product Data Layer (Pillars, Lead Time, Members Only, Fulfilment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every product the four fields the v1 launch spec needs (pillar, lead time, members only window, fulfilment path) and surface them honestly in the catalogue, the basket and the checkout.

**Architecture:** Extend the existing `Product` type in `src/data/products.ts`, keep every derived rule in pure, unit-testable modules (`src/lib/product-fields.ts`, `src/lib/shipping.ts`) mirroring the existing `shipping.ts` and `auth-helpers.ts` pattern, then wire those through the four layers that already exist: the Firestore store (`products-store.ts`), the admin validate-and-save path, the client basket, and the server-priced checkout. Members only visibility is enforced at read time on the server, never by hiding things in the client.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, Firebase Admin (Firestore), Stripe, Vitest (node environment).

## Global Constraints

Copied from `docs/specs/2026-07-25-v1-launch-pillars-members-design.md`. Every task's requirements implicitly include this section.

- British spelling throughout. **No em dashes anywhere**, in code, comments, copy or commit messages.
- The word "dropship", and the mechanism behind it, never appears in anything a customer reads (spec §4.4). Internally the field is named for what it is.
- Prices are GBP, stored as a plain number of pounds (for example `6.5`), never pence.
- Checkout never trusts a price, a postage amount or a product's visibility from the client. All four are recomputed server side from Firestore.
- No page per SKU (spec §3.1). Products are listed on their pillar page and the flat shop page only. Do not add `src/app/products/[slug]`.
- Firestore collections stay namespaced under `store_*` via `COLLECTIONS` in `src/lib/firebase-admin.ts`.
- This is **not** the Next.js in your training data (see `AGENTS.md`). Before writing or changing any route handler, page or layout, read the relevant guide in `node_modules/next/dist/docs/`.
- Tests are Vitest, node environment. Run with `npx vitest run <path>`. Task 1 adds an `npm test` script.
- Commit after every task. Conventional commit prefixes (`feat:`, `fix:`, `test:`, `chore:`), matching the existing history.

## Open assumptions this plan makes

Two things the spec does not settle. Both are implemented as stated here and both are cheap to reverse. Flag them to Liam before Task 6 ships.

1. **The free-postage threshold counts own-stock items only.** Spec §4.4 says supplier posted items carry "their own postage ... taken from the supplier rather than the site's rule". So the GBP 35 free-postage threshold and the DD1 to DD6 local rule are applied to the own-stock subtotal, not the basket subtotal. A basket of GBP 40 of supplier posted goods and GBP 5 of chews therefore still pays GBP 3.95 on the chews.
2. **Supplier postage is charged once per product line, not per unit.** Two of the same supplier posted item is one parcel and one postage charge. Two different supplier posted items is two parcels and two charges, which is what §4.4 describes as "two parcels, two arrival dates, and potentially two postage charges".

Assumption 2 is a **known approximation**, not a guess. Avasam research (spec §4.5) found that a supplier prices a shipping service as a fixed amount, or by order weight, or by order value, and may combine fixed with one of the other two. A single figure per product is exact for fixed price services and an approximation otherwise. Michaela enters a figure that does not under-recover. If the range she stocks turns out to be weight priced, revisit before it eats margin on heavy items.

Two things this plan now has that it did not when it was first written, both from spec §4.5:

- **Arrival ranges are real data, not guesses.** Avasam suppliers pick one of three standardised services: expedited tracked 1 to 2 days, standard tracked 2 to 4 days, standard 3 to 5 days. Those are the values Michaela puts in the two arrival day fields in Task 5.
- **Returns are researched and no longer block anything.** The customer's counterparty is Barking Raw, not the supplier, so the returns policy page states Michaela's own obligations under the Consumer Contracts Regulations 2013 and gives a "contact us for the return address" route rather than one printed address. Nothing in this plan changes as a result. It matters for build-order step B.4, the legal pages.

## File structure

| File | Responsibility |
|---|---|
| `src/data/products.ts` (modify) | The `Pillar` and `FulfilmentPath` types, their label maps, the extended `Product` interface, and the nine seed products with the new fields filled in |
| `src/lib/product-fields.ts` (create) | Pure derivations from a product: is it members only right now, what does its lead time read as, what does a supplier posted item's arrival note read as |
| `src/lib/products-store.ts` (modify) | Read and default the new fields off a Firestore doc, pass them through `toCatalogue`, and split a catalogue into public and members only |
| `src/lib/membership.ts` (create) | "Is the current visitor a member" as a single server-side question, so the layout, the pillar pages and the checkout all answer it the same way |
| `src/lib/product-admin.ts` (modify) | Validate the new fields on the way in from the admin form |
| `src/app/api/admin/products/route.ts`, `.../[slug]/route.ts` (modify) | Persist the new fields on create and update |
| `src/components/admin/ProductForm.tsx` (modify) | The pickers Michaela uses: required pillar, lead time, members only date, fulfilment path and its supplier fields |
| `src/lib/shipping.ts` (modify) | `computeBasketDelivery`: a basket becomes one own-stock parcel plus one parcel per supplier posted line |
| `src/components/CartProvider.tsx` (modify) | Take the live catalogue as a prop instead of importing the static seed, so admin-created products price correctly |
| `src/components/BasketDrawer.tsx` (modify) | Show the itemised parcels, their postage and their arrival notes before payment |
| `src/components/ProductCard.tsx` (modify) | Show the lead time note or the posts-separately note on the card |
| `src/app/layout.tsx` (modify) | Fetch the catalogue the visitor is allowed to see and hand it to `CartProvider` |
| `src/app/api/checkout/route.ts` (modify) | Recompute delivery server side, refuse members only products for non-members, record the breakdown in metadata |
| `scripts/backfill-product-fields.mjs` (create) | One-off backfill of the new fields onto the products already in Firestore |

---

### Task 1: Pillars, fulfilment paths and the extended product type

**Files:**
- Modify: `src/data/products.ts:4-39` (types), and every one of the nine seed entries
- Create: `src/lib/product-fields.ts`
- Test: `src/lib/product-fields.test.ts`
- Modify: `package.json` (add the missing `test` script)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Pillar = "good-food" | "comfy-walks" | "fun-and-games" | "cosy-sleep"`
  - `const ALL_PILLARS: Pillar[]`, `const PILLAR_LABELS: Record<Pillar, string>`, `const PILLAR_LINES: Record<Pillar, string>`
  - `type FulfilmentPath = "own-stock" | "supplier-posted"`, `const ALL_FULFILMENT_PATHS: FulfilmentPath[]`
  - `Product` gains required `pillar: Pillar`, required `leadTimeDays: number`, required `fulfilment: FulfilmentPath`, optional `membersOnlyUntil?: string`, `supplierPostage?: number`, `supplierArrivalMinDays?: number`, `supplierArrivalMaxDays?: number`
  - `isMembersOnly(p, now): boolean`, `leadTimeNote(p): string | null`, `supplierArrivalNote(p): string | null` from `@/lib/product-fields`

- [ ] **Step 1: Add the `test` script**

`package.json` has Vitest as a devDependency but no `test` script, so `npm test` (which `HANDOVER.md` tells people to run) fails. In `package.json`, add to `"scripts"`:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/product-fields.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isMembersOnly, leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";

describe("isMembersOnly", () => {
  it("is false when there is no window", () => {
    expect(isMembersOnly({}, new Date("2026-08-01T12:00:00Z"))).toBe(false);
  });

  it("is true before the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-01T12:00:00Z")),
    ).toBe(true);
  });

  it("is false on the day the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-10T00:00:00Z")),
    ).toBe(false);
  });

  it("is false when the date is unparseable, so a typo never hides a product forever", () => {
    expect(isMembersOnly({ membersOnlyUntil: "next tuesday" }, new Date("2026-08-01T12:00:00Z"))).toBe(
      false,
    );
  });
});

describe("leadTimeNote", () => {
  it("is null for stock on the shelf", () => {
    expect(leadTimeNote({ leadTimeDays: 0 })).toBeNull();
  });

  it("names the wait in days", () => {
    expect(leadTimeNote({ leadTimeDays: 14 })).toBe("Ordered in for you, dispatches in 14 days");
  });

  it("uses the singular for one day", () => {
    expect(leadTimeNote({ leadTimeDays: 1 })).toBe("Ordered in for you, dispatches in 1 day");
  });
});

describe("supplierArrivalNote", () => {
  it("is null for her own stock", () => {
    expect(supplierArrivalNote({ fulfilment: "own-stock" })).toBeNull();
  });

  it("gives a range when one is set", () => {
    expect(
      supplierArrivalNote({
        fulfilment: "supplier-posted",
        supplierArrivalMinDays: 3,
        supplierArrivalMaxDays: 5,
      }),
    ).toBe("Posts separately, arrives in 3 to 5 days");
  });

  it("collapses an equal range to a single number", () => {
    expect(
      supplierArrivalNote({
        fulfilment: "supplier-posted",
        supplierArrivalMinDays: 4,
        supplierArrivalMaxDays: 4,
      }),
    ).toBe("Posts separately, arrives in 4 days");
  });

  it("still discloses the separate parcel when no timing is known", () => {
    expect(supplierArrivalNote({ fulfilment: "supplier-posted" })).toBe("Posts separately");
  });

  it("never says dropship", () => {
    const note = supplierArrivalNote({
      fulfilment: "supplier-posted",
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    expect(note?.toLowerCase()).not.toContain("dropship");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/product-fields.test.ts`
Expected: FAIL, "Failed to resolve import @/lib/product-fields".

- [ ] **Step 4: Add the types and constants to `src/data/products.ts`**

Insert directly below the existing `ALL_BADGES` array, before `export interface Product`:

```ts
/** The four pillars from docs/specs/2026-07-25-v1-launch-pillars-members-design.md section 2. */
export type Pillar = "good-food" | "comfy-walks" | "fun-and-games" | "cosy-sleep";

export const ALL_PILLARS: Pillar[] = ["good-food", "comfy-walks", "fun-and-games", "cosy-sleep"];

export const PILLAR_LABELS: Record<Pillar, string> = {
  "good-food": "Good Food",
  "comfy-walks": "Comfy Walks",
  "fun-and-games": "Fun & Games",
  "cosy-sleep": "Cosy Sleep",
};

/** The line that sits under each pillar on the ring and at the top of its page. */
export const PILLAR_LINES: Record<Pillar, string> = {
  "good-food": "What goes in shows up in everything else",
  "comfy-walks":
    "A dog that's choking on a collar isn't enjoying the walk. You're just dragging it",
  "fun-and-games": "A bored dog will find his own fun. You won't like it",
  "cosy-sleep": "An overtired dog can't think straight",
};

/**
 * Where a product posts from. "own-stock" is Michaela's own shelf and the site's
 * postage rule. "supplier-posted" leaves the supplier directly and carries its own
 * postage and timing. Named internally for what it is; the customer is only ever
 * told the part that affects them (see supplierArrivalNote).
 */
export type FulfilmentPath = "own-stock" | "supplier-posted";

export const ALL_FULFILMENT_PATHS: FulfilmentPath[] = ["own-stock", "supplier-posted"];
```

- [ ] **Step 5: Extend the `Product` interface**

Replace the existing `export interface Product { ... }` block with:

```ts
export interface Product {
  slug: string;
  name: string;
  price: number; // GBP
  hook: string;
  description: string;
  badges: Badge[];
  image: string; // path under /public
  safetyNote?: string;
  /** Exactly one pillar. A product with no pillar appears on no page, so this is required. */
  pillar: Pillar;
  /** Days before dispatch. 0 means it goes out with everything else. */
  leadTimeDays: number;
  /** ISO date "YYYY-MM-DD". Before this date the product is buyable by members only. */
  membersOnlyUntil?: string;
  fulfilment: FulfilmentPath;
  /** GBP, charged once per line. Supplier posted products only. */
  supplierPostage?: number;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
  // Storage/sync fields (populated once a product lives in Firestore):
  active?: boolean;
  archived?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
}
```

- [ ] **Step 6: Fill the new fields on all nine seed products**

Every one of the nine existing entries in `products` is food off Michaela's own shelf. Add these three lines to each entry, after its `image` (or `safetyNote`) line:

```ts
    pillar: "good-food",
    leadTimeDays: 0,
    fulfilment: "own-stock",
```

Do not add `membersOnlyUntil`, `supplierPostage` or the arrival days to any seed entry. They are optional and absent means "not applicable".

- [ ] **Step 7: Write `src/lib/product-fields.ts`**

```ts
// Pure derivations from a product. No Firestore, no next/headers, no React,
// so this module is trivially unit-testable (mirrors shipping.ts and auth-helpers.ts).

import type { FulfilmentPath } from "@/data/products";

/**
 * True while a product is inside its members only window.
 *
 * The window is compared at UTC midnight on the named day, so "2026-08-10" means
 * "members only right up to the start of the 10th". An unparseable date returns
 * false: a typo in the admin must not hide a product from the shop forever.
 */
export function isMembersOnly(p: { membersOnlyUntil?: string }, now: Date): boolean {
  if (!p.membersOnlyUntil) return false;
  const until = Date.parse(`${p.membersOnlyUntil}T00:00:00Z`);
  if (!Number.isFinite(until)) return false;
  return now.getTime() < until;
}

/** Customer facing dispatch note for a product with a non-zero lead time, or null. */
export function leadTimeNote(p: { leadTimeDays?: number }): string | null {
  const days = Number(p.leadTimeDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  return `Ordered in for you, dispatches in ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Customer facing note for a product that posts from the supplier rather than from
 * Michaela. Tells the buyer the two things that affect them, that it comes separately
 * and roughly when, and nothing about the supply chain behind it.
 */
export function supplierArrivalNote(p: {
  fulfilment?: FulfilmentPath;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
}): string | null {
  if (p.fulfilment !== "supplier-posted") return null;
  const min = Number(p.supplierArrivalMinDays ?? 0);
  const max = Number(p.supplierArrivalMaxDays ?? 0);
  if (!(min > 0) || !(max > 0)) return "Posts separately";
  if (min === max) return `Posts separately, arrives in ${min} ${min === 1 ? "day" : "days"}`;
  return `Posts separately, arrives in ${min} to ${max} days`;
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/lib/product-fields.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 9: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: errors only where `Product` objects are constructed without the new required fields. Those are `src/lib/products-store.ts` (`docToStoredProduct`, `toCatalogue`) and are fixed in Task 2. If anything else fails, fix it now by adding the same three defaults.

- [ ] **Step 10: Commit**

```bash
git add package.json src/data/products.ts src/lib/product-fields.ts src/lib/product-fields.test.ts
git commit -m "feat: product pillars, lead time, members only window and fulfilment path types"
```

---

### Task 2: Read, default and split the new fields in the products store

**Files:**
- Modify: `src/lib/products-store.ts:13-48` (`docToStoredProduct`, `toCatalogue`), and append the split helper
- Test: `src/lib/products-store.test.ts` (existing file, add cases)

**Interfaces:**
- Consumes: `Pillar`, `ALL_PILLARS`, `FulfilmentPath`, `Product` from Task 1; `isMembersOnly` from `@/lib/product-fields`.
- Produces: `splitByMembersOnly(all: StoredProduct[], now: Date): { open: StoredProduct[]; membersOnly: StoredProduct[] }`. `docToStoredProduct` and `toCatalogue` now carry the seven new fields.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/products-store.test.ts` (keep the existing imports, add `splitByMembersOnly` to the import from `@/lib/products-store`):

```ts
describe("docToStoredProduct new fields", () => {
  it("defaults a legacy doc with no new fields to good-food, no wait, own stock", () => {
    const p = docToStoredProduct("chicken-feet", { name: "Chicken Feet", price: 6 });
    expect(p.pillar).toBe("good-food");
    expect(p.leadTimeDays).toBe(0);
    expect(p.fulfilment).toBe("own-stock");
    expect(p.membersOnlyUntil).toBeUndefined();
  });

  it("rejects a pillar that is not one of the four", () => {
    const p = docToStoredProduct("x", { name: "X", price: 1, pillar: "out-and-about" });
    expect(p.pillar).toBe("good-food");
  });

  it("keeps a valid pillar", () => {
    const p = docToStoredProduct("x", { name: "X", price: 1, pillar: "cosy-sleep" });
    expect(p.pillar).toBe("cosy-sleep");
  });

  it("floors a fractional lead time and clamps a negative one to zero", () => {
    expect(docToStoredProduct("x", { leadTimeDays: 2.7 }).leadTimeDays).toBe(2);
    expect(docToStoredProduct("x", { leadTimeDays: -5 }).leadTimeDays).toBe(0);
    expect(docToStoredProduct("x", { leadTimeDays: "soon" }).leadTimeDays).toBe(0);
  });

  it("reads the supplier posted fields", () => {
    const p = docToStoredProduct("x", {
      fulfilment: "supplier-posted",
      supplierPostage: 4.5,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    expect(p.fulfilment).toBe("supplier-posted");
    expect(p.supplierPostage).toBe(4.5);
    expect(p.supplierArrivalMinDays).toBe(3);
    expect(p.supplierArrivalMaxDays).toBe(5);
  });

  it("drops supplier fields when the path is her own stock", () => {
    const p = docToStoredProduct("x", { fulfilment: "own-stock", supplierPostage: 4.5 });
    expect(p.supplierPostage).toBeUndefined();
  });
});

describe("toCatalogue", () => {
  it("carries the new fields through to the client shape", () => {
    const stored = docToStoredProduct("x", {
      name: "X",
      price: 1,
      pillar: "fun-and-games",
      leadTimeDays: 3,
      membersOnlyUntil: "2026-09-01",
      fulfilment: "supplier-posted",
      supplierPostage: 2.5,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    const c = toCatalogue(stored);
    expect(c.pillar).toBe("fun-and-games");
    expect(c.leadTimeDays).toBe(3);
    expect(c.membersOnlyUntil).toBe("2026-09-01");
    expect(c.fulfilment).toBe("supplier-posted");
    expect(c.supplierPostage).toBe(2.5);
    expect(c.supplierArrivalMinDays).toBe(3);
    expect(c.supplierArrivalMaxDays).toBe(5);
  });

  it("does not leak the Stripe ids to the client", () => {
    const stored = docToStoredProduct("x", { name: "X", price: 1, stripePriceId: "price_123" });
    expect(toCatalogue(stored)).not.toHaveProperty("stripePriceId");
  });
});

describe("splitByMembersOnly", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("puts an open product in open and an unexpired window in membersOnly", () => {
    const open = docToStoredProduct("a", { name: "A", price: 1 });
    const early = docToStoredProduct("b", { name: "B", price: 1, membersOnlyUntil: "2026-09-01" });
    const result = splitByMembersOnly([open, early], now);
    expect(result.open.map((p) => p.slug)).toEqual(["a"]);
    expect(result.membersOnly.map((p) => p.slug)).toEqual(["b"]);
  });

  it("releases a product with no manual step once its window has passed", () => {
    const past = docToStoredProduct("c", { name: "C", price: 1, membersOnlyUntil: "2026-07-01" });
    const result = splitByMembersOnly([past], now);
    expect(result.open.map((p) => p.slug)).toEqual(["c"]);
    expect(result.membersOnly).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: FAIL, `splitByMembersOnly` is not exported and `p.pillar` is undefined.

- [ ] **Step 3: Extend `docToStoredProduct`**

In `src/lib/products-store.ts`, change the imports at the top to:

```ts
import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  products as seed,
  ALL_PILLARS,
  type Product,
  type Badge,
  type Pillar,
  type FulfilmentPath,
} from "@/data/products";
import { isMembersOnly } from "@/lib/product-fields";
```

Then, inside `docToStoredProduct`, above the `return`, add:

```ts
  const rawPillar = String(data.pillar ?? "");
  // A legacy doc predates the pillar field. All nine originals are food, and a
  // product with no pillar would appear on no page at all, which looks like the
  // site working while the product is invisible. Default rather than drop.
  const pillar: Pillar = ALL_PILLARS.includes(rawPillar as Pillar)
    ? (rawPillar as Pillar)
    : "good-food";

  const rawLead = Number(data.leadTimeDays ?? 0);
  const leadTimeDays = Number.isFinite(rawLead) ? Math.max(0, Math.floor(rawLead)) : 0;

  const fulfilment: FulfilmentPath =
    data.fulfilment === "supplier-posted" ? "supplier-posted" : "own-stock";
  const supplier = fulfilment === "supplier-posted";
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
```

and add these entries to the returned object, after `safetyNote`:

```ts
    pillar,
    leadTimeDays,
    membersOnlyUntil: data.membersOnlyUntil ? String(data.membersOnlyUntil) : undefined,
    fulfilment,
    supplierPostage: supplier ? num(data.supplierPostage) : undefined,
    supplierArrivalMinDays: supplier ? num(data.supplierArrivalMinDays) : undefined,
    supplierArrivalMaxDays: supplier ? num(data.supplierArrivalMaxDays) : undefined,
```

- [ ] **Step 4: Extend `toCatalogue`**

Add the same seven fields to the object `toCatalogue` returns, after `safetyNote: sp.safetyNote,`:

```ts
    pillar: sp.pillar,
    leadTimeDays: sp.leadTimeDays,
    membersOnlyUntil: sp.membersOnlyUntil,
    fulfilment: sp.fulfilment,
    supplierPostage: sp.supplierPostage,
    supplierArrivalMinDays: sp.supplierArrivalMinDays,
    supplierArrivalMaxDays: sp.supplierArrivalMaxDays,
```

`toCatalogue` deliberately stays an explicit field list rather than a spread, so the Stripe ids never reach the client.

- [ ] **Step 5: Add the split helper**

Append to `src/lib/products-store.ts`:

```ts
/**
 * Split a catalogue into what anybody may see and what only members may see.
 *
 * Pure and synchronous so the caller decides which half to render. Members only
 * products are filtered out on the server, never hidden with CSS, because the
 * whole value of an early access window is that non-members cannot see it yet.
 */
export function splitByMembersOnly(
  all: StoredProduct[],
  now: Date,
): { open: StoredProduct[]; membersOnly: StoredProduct[] } {
  const open: StoredProduct[] = [];
  const membersOnly: StoredProduct[] = [];
  for (const p of all) (isMembersOnly(p, now) ? membersOnly : open).push(p);
  return { open, membersOnly };
}

/** Everything a signed-out visitor may see: buyable, minus anything still in its members window. */
export async function getPublicProducts(now: Date = new Date()): Promise<StoredProduct[]> {
  return splitByMembersOnly(await getStoredProducts(), now).open;
}

/** Everything a member may see and buy: the public catalogue plus the early access drops. */
export async function getMemberProducts(now: Date = new Date()): Promise<StoredProduct[]> {
  const { open, membersOnly } = splitByMembersOnly(await getStoredProducts(), now);
  return [...open, ...membersOnly];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/products-store.test.ts src/lib/products-store.fallback.test.ts`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. `seedAsStoredProducts` now typechecks because the seed entries carry the required fields from Task 1.

- [ ] **Step 8: Commit**

```bash
git add src/lib/products-store.ts src/lib/products-store.test.ts
git commit -m "feat: products store reads pillar, lead time, members window and fulfilment path"
```

---

### Task 3: Validate the new fields on the way in from the admin

**Files:**
- Modify: `src/lib/product-admin.ts`
- Test: `src/lib/product-admin.test.ts` (existing file, add cases)

**Interfaces:**
- Consumes: `Pillar`, `ALL_PILLARS`, `FulfilmentPath` from Task 1.
- Produces: `ProductInput` gains `pillar: Pillar`, `leadTimeDays: number`, `fulfilment: FulfilmentPath`, and optional `membersOnlyUntil`, `supplierPostage`, `supplierArrivalMinDays`, `supplierArrivalMaxDays`. `validateProductInput` rejects a missing or unknown pillar and rejects supplier posted products with no postage.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/product-admin.test.ts`:

```ts
const base = {
  name: "Rabbit Ears",
  price: 5,
  hook: "Crunchy",
  description: "A description",
  image: "/products/rabbit-ears.png",
  badges: [],
};

describe("validateProductInput pillar", () => {
  it("rejects a product with no pillar, because it would appear on no page", () => {
    const r = validateProductInput(base);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Choose which pillar this product belongs to.");
  });

  it("rejects a pillar that is not one of the four", () => {
    const r = validateProductInput({ ...base, pillar: "out-and-about" });
    expect(r.ok).toBe(false);
  });

  it("accepts one of the four", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.pillar).toBe("good-food");
  });
});

describe("validateProductInput lead time", () => {
  it("defaults to zero", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok && r.value.leadTimeDays).toBe(0);
  });

  it("rejects a negative lead time", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", leadTimeDays: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Lead time must be a whole number of days, 0 or more.");
  });

  it("rejects a fractional lead time", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", leadTimeDays: 2.5 });
    expect(r.ok).toBe(false);
  });
});

describe("validateProductInput members only window", () => {
  it("accepts an ISO date", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "2026-09-01" });
    expect(r.ok && r.value.membersOnlyUntil).toBe("2026-09-01");
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "01/09/2026" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Members only date must be in the form YYYY-MM-DD.");
  });

  it("treats an empty string as no window", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "" });
    expect(r.ok && r.value.membersOnlyUntil).toBeUndefined();
  });
});

describe("validateProductInput fulfilment", () => {
  it("defaults to her own stock", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok && r.value.fulfilment).toBe("own-stock");
  });

  it("requires postage on a supplier posted product, so nobody is shipped it for free by accident", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", fulfilment: "supplier-posted" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Supplier posted products need their own postage amount.");
  });

  it("accepts a supplier posted product with postage and an arrival range", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "supplier-posted",
      supplierPostage: 4.5,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.supplierPostage).toBe(4.5);
      expect(r.value.supplierArrivalMaxDays).toBe(5);
    }
  });

  it("rejects an arrival range that runs backwards", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "supplier-posted",
      supplierPostage: 4.5,
      supplierArrivalMinDays: 7,
      supplierArrivalMaxDays: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Arrival range must run from the shorter time to the longer.");
  });

  it("drops supplier fields when the path is her own stock", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "own-stock",
      supplierPostage: 4.5,
    });
    expect(r.ok && r.value.supplierPostage).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: FAIL on the pillar cases first.

- [ ] **Step 3: Extend `ProductInput` and `validateProductInput`**

Replace the whole of `src/lib/product-admin.ts` below `slugify` with:

```ts
export type ProductInput = {
  name: string;
  price: number;
  hook: string;
  description: string;
  badges: Badge[];
  image: string;
  safetyNote?: string;
  pillar: Pillar;
  leadTimeDays: number;
  membersOnlyUntil?: string;
  fulfilment: FulfilmentPath;
  supplierPostage?: number;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateProductInput(
  input: Partial<ProductInput>,
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? "").trim();
  const price = Number(input.price ?? 0);
  const hook = String(input.hook ?? "").trim();
  const description = String(input.description ?? "").trim();
  const image = String(input.image ?? "").trim();
  const badges = Array.isArray(input.badges)
    ? input.badges.filter((b): b is Badge => ALL_BADGES.includes(b as Badge))
    : [];
  const safetyNote = input.safetyNote ? String(input.safetyNote).trim() : undefined;

  if (!name) errors.push("Name is required.");
  if (!(Number.isFinite(price) && price > 0)) errors.push("Price must be greater than 0.");
  if (!hook) errors.push("Hook is required.");
  if (!description) errors.push("Description is required.");
  if (!image) errors.push("An image is required.");

  // A product with no pillar appears on no page, which looks exactly like the site
  // working while the product is invisible. Required, never defaulted, on the way in.
  const rawPillar = String(input.pillar ?? "");
  const pillarOk = ALL_PILLARS.includes(rawPillar as Pillar);
  if (!pillarOk) errors.push("Choose which pillar this product belongs to.");
  const pillar = (pillarOk ? rawPillar : "good-food") as Pillar;

  const rawLead = input.leadTimeDays === undefined || input.leadTimeDays === null || String(input.leadTimeDays) === ""
    ? 0
    : Number(input.leadTimeDays);
  const leadOk = Number.isFinite(rawLead) && rawLead >= 0 && Number.isInteger(rawLead);
  if (!leadOk) errors.push("Lead time must be a whole number of days, 0 or more.");
  const leadTimeDays = leadOk ? rawLead : 0;

  const rawWindow = String(input.membersOnlyUntil ?? "").trim();
  let membersOnlyUntil: string | undefined;
  if (rawWindow) {
    if (!ISO_DATE.test(rawWindow) || !Number.isFinite(Date.parse(`${rawWindow}T00:00:00Z`))) {
      errors.push("Members only date must be in the form YYYY-MM-DD.");
    } else {
      membersOnlyUntil = rawWindow;
    }
  }

  const fulfilment: FulfilmentPath =
    input.fulfilment === "supplier-posted" ? "supplier-posted" : "own-stock";

  let supplierPostage: number | undefined;
  let supplierArrivalMinDays: number | undefined;
  let supplierArrivalMaxDays: number | undefined;

  if (fulfilment === "supplier-posted") {
    const postage = Number(input.supplierPostage ?? NaN);
    if (!(Number.isFinite(postage) && postage >= 0)) {
      errors.push("Supplier posted products need their own postage amount.");
    } else {
      supplierPostage = postage;
    }
    const min = Number(input.supplierArrivalMinDays ?? NaN);
    const max = Number(input.supplierArrivalMaxDays ?? NaN);
    const minOk = Number.isFinite(min) && min > 0 && Number.isInteger(min);
    const maxOk = Number.isFinite(max) && max > 0 && Number.isInteger(max);
    if (minOk !== maxOk) {
      errors.push("Give both ends of the arrival range, or neither.");
    } else if (minOk && maxOk) {
      if (min > max) {
        errors.push("Arrival range must run from the shorter time to the longer.");
      } else {
        supplierArrivalMinDays = min;
        supplierArrivalMaxDays = max;
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      price,
      hook,
      description,
      badges,
      image,
      safetyNote,
      pillar,
      leadTimeDays,
      membersOnlyUntil,
      fulfilment,
      supplierPostage,
      supplierArrivalMinDays,
      supplierArrivalMaxDays,
    },
  };
}
```

Update the import at the top of the file to:

```ts
import { ALL_BADGES, ALL_PILLARS, type Badge, type Pillar, type FulfilmentPath } from "@/data/products";

export { ALL_BADGES, ALL_PILLARS };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: PASS. Note that any pre-existing test in this file that calls `validateProductInput` with a valid payload now needs `pillar: "good-food"` added, because pillar is required. Add it to those payloads.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-admin.ts src/lib/product-admin.test.ts
git commit -m "feat: validate pillar, lead time, members window and supplier postage on product input"
```

---

### Task 4: Persist the new fields through the admin API routes

**Files:**
- Modify: `src/app/api/admin/products/route.ts:52-68` (the Firestore `create` payload)
- Modify: `src/app/api/admin/products/[slug]/route.ts:50-65` (the Firestore `set` payload)

**Interfaces:**
- Consumes: `validateProductInput` from Task 3, which now returns the new fields on `parsed.value`.
- Produces: nothing new. Firestore docs in `store_products` now carry `pillar`, `leadTimeDays`, `membersOnlyUntil`, `fulfilment`, `supplierPostage`, `supplierArrivalMinDays`, `supplierArrivalMaxDays`.

Read `node_modules/next/dist/docs/` on route handlers before editing these files.

- [ ] **Step 1: Add the fields to the create payload**

In `src/app/api/admin/products/route.ts`, inside the `db.collection(COLLECTIONS.products).doc(slug).create({ ... })` call, add after the `...(draft.safetyNote ? ... : {})` line:

```ts
      pillar: draft.pillar,
      leadTimeDays: draft.leadTimeDays,
      ...(draft.membersOnlyUntil ? { membersOnlyUntil: draft.membersOnlyUntil } : {}),
      fulfilment: draft.fulfilment,
      ...(draft.supplierPostage !== undefined ? { supplierPostage: draft.supplierPostage } : {}),
      ...(draft.supplierArrivalMinDays !== undefined
        ? { supplierArrivalMinDays: draft.supplierArrivalMinDays }
        : {}),
      ...(draft.supplierArrivalMaxDays !== undefined
        ? { supplierArrivalMaxDays: draft.supplierArrivalMaxDays }
        : {}),
```

`draft` is already `{ slug, ...parsed.value, active: true, archived: false }`, so it carries all seven.

- [ ] **Step 2: Add the fields to the update payload**

In `src/app/api/admin/products/[slug]/route.ts`, inside the `.set({ ... }, { merge: true })` call, add after the `safetyNote` line. Because this is a merge, a field cleared in the form must be explicitly deleted rather than simply omitted, or the old value survives:

```ts
        pillar: next.pillar,
        leadTimeDays: next.leadTimeDays,
        ...(next.membersOnlyUntil
          ? { membersOnlyUntil: next.membersOnlyUntil }
          : { membersOnlyUntil: FieldValue.delete() }),
        fulfilment: next.fulfilment,
        ...(next.supplierPostage !== undefined
          ? { supplierPostage: next.supplierPostage }
          : { supplierPostage: FieldValue.delete() }),
        ...(next.supplierArrivalMinDays !== undefined
          ? { supplierArrivalMinDays: next.supplierArrivalMinDays }
          : { supplierArrivalMinDays: FieldValue.delete() }),
        ...(next.supplierArrivalMaxDays !== undefined
          ? { supplierArrivalMaxDays: next.supplierArrivalMaxDays }
          : { supplierArrivalMaxDays: FieldValue.delete() }),
```

`FieldValue` is already imported in this file.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/products/route.ts "src/app/api/admin/products/[slug]/route.ts"
git commit -m "feat: admin product routes persist pillar, lead time, members window and fulfilment"
```

---

### Task 5: The admin pickers Michaela uses

**Files:**
- Modify: `src/components/admin/ProductForm.tsx`

**Interfaces:**
- Consumes: `ALL_PILLARS`, `PILLAR_LABELS`, `ALL_FULFILMENT_PATHS`, `Pillar`, `FulfilmentPath` from Task 1; the validation error strings from Task 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the state**

In `src/components/admin/ProductForm.tsx`, extend the imports:

```ts
import { ALL_BADGES, ALL_PILLARS } from "@/lib/product-admin";
import { PILLAR_LABELS, ALL_FULFILMENT_PATHS } from "@/data/products";
import type { Badge, Product, Pillar, FulfilmentPath } from "@/data/products";
```

and add below the existing `useState` calls:

```ts
  const [pillar, setPillar] = useState<Pillar | "">(initial?.pillar ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(String(initial?.leadTimeDays ?? 0));
  const [membersOnlyUntil, setMembersOnlyUntil] = useState(initial?.membersOnlyUntil ?? "");
  const [fulfilment, setFulfilment] = useState<FulfilmentPath>(initial?.fulfilment ?? "own-stock");
  const [supplierPostage, setSupplierPostage] = useState(
    initial?.supplierPostage === undefined ? "" : String(initial.supplierPostage),
  );
  const [supplierArrivalMinDays, setSupplierArrivalMinDays] = useState(
    initial?.supplierArrivalMinDays === undefined ? "" : String(initial.supplierArrivalMinDays),
  );
  const [supplierArrivalMaxDays, setSupplierArrivalMaxDays] = useState(
    initial?.supplierArrivalMaxDays === undefined ? "" : String(initial.supplierArrivalMaxDays),
  );
```

- [ ] **Step 2: Send them in the payload**

Replace the `payload` line inside `submit` with:

```ts
    const payload = {
      name,
      price: Number(price),
      hook,
      description,
      safetyNote,
      image,
      badges,
      pillar,
      leadTimeDays: Number(leadTimeDays || 0),
      membersOnlyUntil,
      fulfilment,
      supplierPostage: supplierPostage === "" ? undefined : Number(supplierPostage),
      supplierArrivalMinDays:
        supplierArrivalMinDays === "" ? undefined : Number(supplierArrivalMinDays),
      supplierArrivalMaxDays:
        supplierArrivalMaxDays === "" ? undefined : Number(supplierArrivalMaxDays),
    };
```

- [ ] **Step 3: Add the pillar picker**

Insert directly above the existing `<fieldset><legend>Badges</legend>` block:

```tsx
      <label>
        Pillar (which of the four pages this appears on)
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value as Pillar)}
          required
          style={{ display: "block", width: "100%" }}
        >
          <option value="">Choose a pillar...</option>
          {ALL_PILLARS.map((p) => (
            <option key={p} value={p}>
              {PILLAR_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
```

- [ ] **Step 4: Add the lead time, members window and fulfilment fields**

Insert directly below the badges fieldset, above the `Image` label:

```tsx
      <label>
        Lead time in days (0 if it is on the shelf and posts straight away)
        <input
          type="number"
          step="1"
          min="0"
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <label>
        Members only until (optional). Before this date only members can see and buy it
        <input
          type="date"
          value={membersOnlyUntil}
          onChange={(e) => setMembersOnlyUntil(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <fieldset>
        <legend>Who posts it</legend>
        {ALL_FULFILMENT_PATHS.map((f) => (
          <label key={f} style={{ display: "inline-flex", gap: "0.3rem", marginRight: "1rem" }}>
            <input
              type="radio"
              name="fulfilment"
              value={f}
              checked={fulfilment === f}
              onChange={() => setFulfilment(f)}
            />
            {f === "own-stock" ? "From my own stock" : "Posted by the supplier"}
          </label>
        ))}
      </fieldset>
      {fulfilment === "supplier-posted" && (
        <fieldset>
          <legend>Supplier postage and timing</legend>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            The customer is shown this as a separate delivery line, for example &quot;Posts
            separately, arrives in 3 to 5 days&quot;.
          </p>
          <label>
            Postage charged for this item (GBP)
            <input
              type="number"
              step="0.01"
              min="0"
              value={supplierPostage}
              onChange={(e) => setSupplierPostage(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Arrives in, from (days)
            <input
              type="number"
              step="1"
              min="1"
              value={supplierArrivalMinDays}
              onChange={(e) => setSupplierArrivalMinDays(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Arrives in, to (days)
            <input
              type="number"
              step="1"
              min="1"
              value={supplierArrivalMaxDays}
              onChange={(e) => setSupplierArrivalMaxDays(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </fieldset>
      )}
```

- [ ] **Step 5: Verify in the browser**

Start the dev server via the preview tooling (not `npm run dev` in a shell), sign in as staff, and open `/admin/products/new`.

Check by hand:
1. Saving with no pillar chosen shows "Choose which pillar this product belongs to." rather than saving silently.
2. Choosing "Posted by the supplier" reveals the postage and arrival fields, and saving without postage shows "Supplier posted products need their own postage amount."
3. Editing an existing product loads its current pillar, lead time and fulfilment path in the form.
4. Clearing the members only date on an existing product and saving removes the window rather than leaving the old date.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ProductForm.tsx
git commit -m "feat: admin product form picks pillar, lead time, members window and fulfilment"
```

---

### Task 6: Two fulfilment paths in the shipping rule

**Files:**
- Modify: `src/lib/shipping.ts` (append, do not change the existing exports)
- Test: `src/lib/shipping.test.ts` (existing file, add cases)

**Interfaces:**
- Consumes: `FulfilmentPath` from Task 1, `leadTimeNote` and `supplierArrivalNote` from `@/lib/product-fields`, the existing `computeShipping`.
- Produces:
  - `type DeliveryProduct = { slug: string; name: string; price: number; fulfilment: FulfilmentPath; leadTimeDays: number; supplierPostage?: number; supplierArrivalMinDays?: number; supplierArrivalMaxDays?: number }`
  - `type DeliveryParcel = { key: string; label: string; cost: number; note: string | null }`
  - `type BasketDelivery = { parcels: DeliveryParcel[]; total: number; ownStockSubtotal: number; amountToFreePostage: number }`
  - `computeBasketDelivery(items: { product: DeliveryProduct; qty: number }[], postcode: string): BasketDelivery`

The two assumptions this encodes are recorded at the top of this plan. Confirm them with Liam before this task ships.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/shipping.test.ts` (add `computeBasketDelivery` to the import from `@/lib/shipping`):

```ts
const chew = {
  slug: "chicken-feet",
  name: "Chicken Feet",
  price: 6,
  fulfilment: "own-stock" as const,
  leadTimeDays: 0,
};

const bed = {
  slug: "orthopaedic-bed",
  name: "Orthopaedic Bed",
  price: 45,
  fulfilment: "supplier-posted" as const,
  leadTimeDays: 0,
  supplierPostage: 5.99,
  supplierArrivalMinDays: 3,
  supplierArrivalMaxDays: 5,
};

const mat = {
  slug: "snuffle-mat",
  name: "Snuffle Mat",
  price: 18,
  fulfilment: "supplier-posted" as const,
  leadTimeDays: 0,
  supplierPostage: 3.5,
  supplierArrivalMinDays: 2,
  supplierArrivalMaxDays: 4,
};

describe("computeBasketDelivery", () => {
  it("an own stock only basket behaves exactly as the old flat rule", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 2 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.total).toBe(3.95);
    expect(d.parcels[0].label).toBe("From Barking Raw");
  });

  it("keeps free local delivery for DD1 to DD6", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 1 }], "DD5 1AB");
    expect(d.total).toBe(0);
  });

  it("gives each supplier posted line its own parcel and its own postage", () => {
    const d = computeBasketDelivery(
      [{ product: bed, qty: 1 }, { product: mat, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels).toHaveLength(2);
    expect(d.total).toBeCloseTo(9.49, 2);
  });

  it("charges supplier postage once per line, not per unit", () => {
    const d = computeBasketDelivery([{ product: bed, qty: 3 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.total).toBeCloseTo(5.99, 2);
  });

  it("a mixed basket is two parcels with two arrival notes", () => {
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: bed, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels).toHaveLength(2);
    expect(d.parcels[1].note).toBe("Posts separately, arrives in 3 to 5 days");
  });

  it("applies the free over GBP 35 threshold to the own stock subtotal only", () => {
    // GBP 45 of supplier posted goods must not buy free postage on a GBP 6 chew.
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: bed, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.ownStockSubtotal).toBe(6);
    expect(d.parcels[0].cost).toBe(3.95);
  });

  it("frees the own stock parcel once its own subtotal passes GBP 35", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 6 }], "EH1 1AA");
    expect(d.parcels[0].cost).toBe(0);
    expect(d.amountToFreePostage).toBe(0);
  });

  it("carries the longest own stock lead time as the parcel note", () => {
    const kibble = { ...chew, slug: "kibble-15kg", name: "Kibble 15kg", leadTimeDays: 14 };
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: kibble, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels[0].note).toBe("Ordered in for you, dispatches in 14 days");
  });

  it("produces no own stock parcel when the basket is supplier posted only", () => {
    const d = computeBasketDelivery([{ product: bed, qty: 1 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.parcels[0].label).toBe("Orthopaedic Bed");
  });

  it("an empty basket costs nothing and has no parcels", () => {
    const d = computeBasketDelivery([], "EH1 1AA");
    expect(d.parcels).toEqual([]);
    expect(d.total).toBe(0);
  });

  it("treats a supplier posted product with no postage set as free rather than NaN", () => {
    const unknown = { ...bed, supplierPostage: undefined };
    const d = computeBasketDelivery([{ product: unknown, qty: 1 }], "EH1 1AA");
    expect(d.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/shipping.test.ts`
Expected: FAIL, `computeBasketDelivery` is not exported.

- [ ] **Step 3: Implement `computeBasketDelivery`**

Append to `src/lib/shipping.ts`:

```ts
import type { FulfilmentPath } from "@/data/products";
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";

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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/shipping.test.ts`
Expected: PASS, including all the pre-existing `computeShipping` and `isLocalPostcode` cases, which are untouched.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shipping.ts src/lib/shipping.test.ts
git commit -m "feat: basket delivery splits own stock and supplier posted parcels"
```

---

### Task 7: The basket tells the truth before payment

**Files:**
- Create: `src/lib/membership.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/CartProvider.tsx`
- Modify: `src/components/BasketDrawer.tsx`
- Modify: `src/components/ProductCard.tsx`
- Modify: `src/app/page.tsx:9`

**Interfaces:**
- Consumes: `computeBasketDelivery`, `DeliveryProduct` from Task 6; `getPublicProducts`, `getMemberProducts`, `toCatalogue` from Task 2; `leadTimeNote`, `supplierArrivalNote` from Task 1.
- Produces:
  - `currentUserIsMember(): Promise<boolean>` and `isMemberUid(uid: string): Promise<boolean>` from `@/lib/membership`
  - `CartProvider` now requires a `catalogue: Product[]` prop
  - `useCart()` gains `catalogue: Product[]` and `delivery(postcode: string): BasketDelivery`

This task fixes a live bug on the way past: `CartProvider` and `BasketDrawer` both import the static nine-product seed from `@/data/products`, so any product Michaela creates in the admin currently prices as GBP 0 in the basket and crashes the drawer's `detail()` lookup with a non-null assertion on `undefined`.

Read `node_modules/next/dist/docs/` on layouts and server components before editing `layout.tsx`.

- [ ] **Step 1: Write `src/lib/membership.ts`**

```ts
import "server-only";
import { getSessionUser } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";

/**
 * Membership is granted by an online purchase or by signing up at the stall, both of
 * which write a store_customers doc. It is deliberately not granted by the home page
 * email form, so "members see the new stuff first" stays true (spec section 10.1).
 */
export async function isMemberUid(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db || !uid) return false;
  try {
    const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
    return doc.exists;
  } catch (err) {
    console.error("[membership] customer lookup failed, treating as non-member:", err);
    return false;
  }
}

/** Whether the current visitor may see and buy products inside a members only window. */
export async function currentUserIsMember(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.staff) return true; // Michaela must be able to check the drop before it lands.
  return isMemberUid(user.uid);
}
```

- [ ] **Step 2: Feed the live catalogue into `CartProvider`**

Replace `src/app/layout.tsx`'s `RootLayout` with an async server component that resolves the catalogue the visitor may see:

```tsx
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Members see their early access drops in the basket; everyone else must not even
  // receive them in the page payload, since an unreleased product is the whole perk.
  const isMember = await currentUserIsMember();
  const catalogue = ((await (isMember ? getMemberProducts() : getPublicProducts())) ?? []).map(
    toCatalogue,
  );

  return (
    <html lang="en-GB" className={geistSans.variable}>
      <body id="top">
        <CartProvider catalogue={catalogue}>
          <Header />
          {children}
          <BasketDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
```

with these imports added at the top:

```tsx
import { getPublicProducts, getMemberProducts, toCatalogue } from "@/lib/products-store";
import { currentUserIsMember } from "@/lib/membership";
```

Note the consequence and accept it: reading the session cookie makes the root layout dynamic, so the whole app renders per request. It already effectively does, because `page.tsx` reads Firestore on every render.

- [ ] **Step 3: Make `CartProvider` use the catalogue**

In `src/components/CartProvider.tsx`, delete `import { products } from "@/data/products";` and replace it with:

```ts
import type { Product } from "@/data/products";
import { computeBasketDelivery, type BasketDelivery } from "@/lib/shipping";
```

Extend the context type:

```ts
interface CartCtx {
  lines: CartLine[];
  catalogue: Product[];
  count: number;
  subtotal: number;
  add: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  delivery: (postcode: string) => BasketDelivery;
}
```

Change the signature and the two derived values:

```tsx
export function CartProvider({
  catalogue,
  children,
}: {
  catalogue: Product[];
  children: ReactNode;
}) {
```

```ts
  const bySlug = useMemo(() => new Map(catalogue.map((p) => [p.slug, p])), [catalogue]);

  const subtotal = useMemo(
    () =>
      lines.reduce((s, l) => {
        const p = bySlug.get(l.slug);
        return s + (p ? p.price * l.qty : 0);
      }, 0),
    [lines, bySlug],
  );

  const delivery = (postcode: string) =>
    computeBasketDelivery(
      lines
        .map((l) => ({ product: bySlug.get(l.slug), qty: l.qty }))
        .filter((i): i is { product: Product; qty: number } => Boolean(i.product)),
      postcode,
    );
```

and add `catalogue` and `delivery` to the provider's `value`.

- [ ] **Step 4: Show the parcels in the drawer**

In `src/components/BasketDrawer.tsx`:

Replace the imports of `products` and the old shipping helpers:

```ts
import { gbp } from "@/lib/format";
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";
import { useCart } from "./CartProvider";
```

Replace the destructure and the derived values:

```ts
  const { lines, open, setOpen, subtotal, setQty, remove, count, catalogue, delivery } = useCart();
```

```ts
  const deliveryPlan = delivery(postcode);
  const total = subtotal + deliveryPlan.total;
  const validEmail = /.+@.+\..+/.test(email);

  // A line whose product has vanished from the catalogue (archived, or now inside a
  // members only window) is skipped rather than crashing the drawer.
  const detail = (slug: string) => catalogue.find((p) => p.slug === slug);
```

Guard the line renderer, replacing `const p = detail(l.slug);` with:

```tsx
                const p = detail(l.slug);
                if (!p) return null;
```

and add the per-line note directly under the existing `line-item__meta` div:

```tsx
                      {(leadTimeNote(p) || supplierArrivalNote(p)) && (
                        <div className="line-item__meta" style={{ fontStyle: "italic" }}>
                          {supplierArrivalNote(p) ?? leadTimeNote(p)}
                        </div>
                      )}
```

Replace the two nudge lines with ones driven by the new delivery result:

```tsx
              {deliveryPlan.amountToFreePostage > 0 && (
                <div className="nudge">
                  Add {gbp(deliveryPlan.amountToFreePostage)} more for free postage.
                </div>
              )}
```

Delete the `shipping.reason === "local"` nudge; the own-stock parcel row below now shows "Free" and carries the same information without a second place to keep in sync.

Replace the single Postage summary row with the itemised parcels:

```tsx
              {deliveryPlan.parcels.map((parcel) => (
                <div className="summary-row" key={parcel.key}>
                  <span>
                    Delivery: {parcel.label}
                    {parcel.note && (
                      <em style={{ display: "block", fontSize: "0.8em" }}>{parcel.note}</em>
                    )}
                  </span>
                  <span>{parcel.cost === 0 ? "Free" : gbp(parcel.cost)}</span>
                </div>
              ))}
              {deliveryPlan.parcels.length > 1 && (
                <p className="notice">
                  This order arrives in {deliveryPlan.parcels.length} separate parcels, so they may
                  not turn up on the same day.
                </p>
              )}
```

- [ ] **Step 5: Show the notes on the product card**

In `src/components/ProductCard.tsx`, add the import:

```ts
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";
```

and insert directly below the `safetyNote` line:

```tsx
        {(supplierArrivalNote(product) ?? leadTimeNote(product)) && (
          <p className="card__lead">{supplierArrivalNote(product) ?? leadTimeNote(product)}</p>
        )}
```

Add a matching `.card__lead` rule to `src/app/globals.css`, alongside the existing `.card__safety` rule and styled the same way but without the warning colour.

- [ ] **Step 6: Stop the home page listing members only products**

In `src/app/page.tsx:9`, change:

```ts
  const products = (await getStoredProducts()).map(toCatalogue);
```

to:

```ts
  const products = (await getPublicProducts()).map(toCatalogue);
```

and update the import on line 2 to pull `getPublicProducts` instead of `getStoredProducts`.

- [ ] **Step 7: Typecheck, lint and run the whole suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean, all tests pass.

- [ ] **Step 8: Verify in the browser**

Start the dev server via the preview tooling. Then:
1. Home page lists products and none of them is inside a members only window.
2. Add two items, open the basket, and confirm the subtotal is right for an admin-created product (this is the bug being fixed, so create one in the admin first if none exists).
3. Set a product to supplier posted with GBP 5.99 postage and a 3 to 5 day range, add it alongside a chew, and confirm the basket shows two delivery rows, two notes, and a total that includes both.
4. Enter a DD5 postcode and confirm the own-stock row reads Free while the supplier row still charges.

Take a screenshot of the mixed basket as the proof.

- [ ] **Step 9: Commit**

```bash
git add src/lib/membership.ts src/app/layout.tsx src/app/page.tsx src/components/CartProvider.tsx src/components/BasketDrawer.tsx src/components/ProductCard.tsx src/app/globals.css
git commit -m "feat: basket prices from the live catalogue and itemises both delivery paths"
```

---

### Task 8: Checkout enforces the rules server side

**Files:**
- Modify: `src/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `computeBasketDelivery` from Task 6, `currentUserIsMember` from Task 7, `isMembersOnly` from Task 1, `getStoredProducts` from `@/lib/products-store`.
- Produces: nothing consumed by later tasks.

The client can be edited. Everything the basket displays must be re-derived here from Firestore, including which products the buyer is allowed to have.

Read `node_modules/next/dist/docs/` on route handlers before editing.

- [ ] **Step 1: Refuse members only products to non-members**

In `src/app/api/checkout/route.ts`, add the imports:

```ts
import { computeBasketDelivery } from "@/lib/shipping";
import { isMembersOnly } from "@/lib/product-fields";
import { currentUserIsMember } from "@/lib/membership";
```

and delete the `computeShipping` import.

Directly above the `for (const l of lines)` loop, add:

```ts
  const isMember = await currentUserIsMember();
  const now = new Date();
```

Inside the loop, replace `if (!p || !p.active || p.archived) continue;` with:

```ts
    if (!p || !p.active || p.archived) continue;
    // Early access is the members area's strongest perk, so it is enforced here and
    // not only by hiding the product. A hand-built request must not get through.
    if (!isMember && isMembersOnly(p, now)) {
      return NextResponse.json(
        { error: `${p.name} is available to members only just now.` },
        { status: 403 },
      );
    }
```

- [ ] **Step 2: Recompute delivery across both paths**

Build the delivery input inside the same loop. Add above the loop:

```ts
  const deliveryItems: { product: StoredProduct; qty: number }[] = [];
```

(and add `type StoredProduct` to the existing `@/lib/products-store` import), then inside the loop after `line_items.push(...)`:

```ts
    deliveryItems.push({ product: p, qty });
```

Replace `const shipping = computeShipping(postcode, subtotal);` with:

```ts
  const delivery = computeBasketDelivery(deliveryItems, postcode);
```

- [ ] **Step 3: Present the delivery total to Stripe**

Replace the `shipping_options` block with:

```ts
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name:
            delivery.total === 0
              ? "Free delivery"
              : delivery.parcels.length > 1
                ? `Delivery (${delivery.parcels.length} parcels)`
                : "UK postage",
          fixed_amount: { amount: Math.round(delivery.total * 100), currency: "gbp" },
        },
      },
    ],
```

Stripe takes one delivery total. The itemised breakdown the customer needs is shown in the basket before they get here (Task 7) and is recorded in metadata below, so nothing material is hidden and nothing is invented at the till.

- [ ] **Step 4: Record the breakdown in metadata**

Replace the `metadata` line with:

```ts
    metadata: {
      cartId,
      postcode,
      itemSummary: summary.join(", "),
      // Stripe metadata values are strings and capped at 500 characters, so this is a
      // short breakdown for reconciliation, not a full record.
      deliveryBreakdown: delivery.parcels
        .map((p) => `${p.label}: ${p.cost.toFixed(2)}`)
        .join("; ")
        .slice(0, 480),
      parcelCount: String(delivery.parcels.length),
    },
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Verify against Stripe test mode**

With `STRIPE_SECRET_KEY` set to a `sk_test_...` key, run the dev server via the preview tooling and:
1. Buy a chew to a non-DD postcode. Stripe's page shows GBP 3.95 delivery.
2. Buy a chew plus a supplier posted item. Stripe's delivery line equals the sum shown in the basket, and the session metadata in the Stripe dashboard shows both parcels.
3. Signed out, take the slug of a members only product, POST it directly to `/api/checkout` with `curl`, and confirm a 403 rather than a checkout URL.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: checkout prices both delivery paths and refuses members only products to non-members"
```

---

### Task 9: Backfill the products already in Firestore

**Files:**
- Create: `scripts/backfill-product-fields.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime. It writes the same field names Task 2 reads.
- Produces: nothing.

`docToStoredProduct` defaults a legacy doc safely, so nothing is broken without this. But a doc with no `pillar` field silently defaults to Good Food, and Michaela should be looking at real values in the admin rather than at a default she never chose.

- [ ] **Step 1: Write the script**

Create `scripts/backfill-product-fields.mjs`, following the pattern of the existing `scripts/check-sheet.mjs`:

```js
// One-off backfill: give every product already in store_products the fields added by
// docs/plans/2026-07-25-stage-7-product-data-pillars.md. Idempotent, and it never
// overwrites a value that is already set.
//
// Dry run:  node scripts/backfill-product-fields.mjs
// Apply:    node scripts/backfill-product-fields.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const COLLECTION = "store_products";

const json = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!json) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT before running this.");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(json)) });
const db = getFirestore();

const snap = await db.collection(COLLECTION).get();
let touched = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const patch = {};
  if (data.pillar === undefined) patch.pillar = "good-food";
  if (data.leadTimeDays === undefined) patch.leadTimeDays = 0;
  if (data.fulfilment === undefined) patch.fulfilment = "own-stock";
  if (Object.keys(patch).length === 0) continue;
  touched += 1;
  console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, patch);
  if (APPLY) await doc.ref.set(patch, { merge: true });
}

console.log(
  `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
process.exit(0);
```

- [ ] **Step 2: Dry run it**

Run: `node scripts/backfill-product-fields.mjs`
Expected: it lists each product it would patch and writes nothing.

- [ ] **Step 3: Apply it**

Run: `node scripts/backfill-product-fields.mjs --apply`
Expected: the same list, then written. Running it a second time reports 0 to patch, which is the idempotency check.

- [ ] **Step 4: Confirm in the admin**

Open `/admin/products`, edit any product, and confirm the pillar picker shows Good Food rather than the empty "Choose a pillar..." placeholder.

- [ ] **Step 5: Update the handover notes**

In `HANDOVER.md`, under "What's built and working", add a line recording the four new product fields and the two delivery paths, and note that `node scripts/backfill-product-fields.mjs --apply` has been run.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-product-fields.mjs HANDOVER.md
git commit -m "chore: backfill pillar, lead time and fulfilment onto existing products"
```

---

## What this plan deliberately does not do

Each of these is the next plan, not a gap in this one.

This plan is **step A.1** of the build order in spec §15, which was rewritten on 2026-07-25 after an
audit found the original nine-step order missed work the spec's own body requires. Step references
below use the new phase lettering.

| Not here | Where it goes |
|---|---|
| The customer and dog data model, one account many dogs | Step A.2. The other half of the data foundation, and the one that blocks the stall form |
| The ring, the four pillar pages, the flat shop page | Step B.1. This plan gives them the `pillar` field they need to exist |
| About Us | Step B.2 |
| Dog-profile-driven badge ribbons over product cards, and "Loki's Mum" | Step B.3 |
| Legal pages and contact | Step B.4. The returns policy content is now researched in spec §4.5 |
| Email capture, segmentation, the four email welcome sequence | Steps C.1 and C.2 |
| The members area page, and the posts section in the admin | Step C.3. This plan gives it `currentUserIsMember()` and the members only product split |
| Loyalty outstanding-balance reporting | Step C.5 |
| The stall: signup form, offline sync, staff PIN, QR fallback, stall sale recorder, dogs of the day | Steps D.1 to D.6 |
| Subscribe and save; pick and mix bundles | Steps E.1 and E.2, both **awaiting a decision from Liam** before anyone starts them |
| Pushing orders to Avasam automatically via the Seller API | Spec §4.5. V1 is manual order entry in Avasam, which needs no build at all |
| Repricing by dividing the bottom price by 0.9 | Spec §6.1. A commercial decision for Michaela, made against a competitor comparison that has not been run yet (spec §16) |
