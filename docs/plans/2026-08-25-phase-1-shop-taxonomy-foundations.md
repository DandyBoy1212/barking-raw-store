# Phase 1, Shop Taxonomy and Foundations, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four pillar model with a four category shop taxonomy, remove the supplier posted (dropshipping) path from the codebase entirely, add a `wasPrice` sale field, and rehome Pick and Mix onto a URL of its own.

**Architecture:** Expand then contract. Tasks 1 to 3 add `category` alongside `pillar` and migrate the live data while both fields exist, so the site is green and deployable at every commit. Tasks 4 to 7 build the new shop pages and navigation on top of `category`. Task 8 then deletes `pillar` once nothing reads it. Tasks 9 to 11 remove the supplier posted path and add `wasPrice`. Task 12 verifies.

**Tech Stack:** Next.js 16.2.10 (App Router), React, TypeScript, Firestore via `firebase-admin`, Stripe, Vitest.

**Spec:** `docs/specs/2026-08-25-shop-taxonomy-foundations-design.md`

## Global Constraints

- **House style: British spelling, and no em dashes anywhere**, in code, comments, copy or commit messages. This is enforced by convention, not by a linter.
- **No other company is ever named** in any customer facing string. Not in this phase's copy, not in a placeholder.
- Currency in prose and comments is written `GBP 3.95`, not with a currency symbol, matching the existing specs.
- `npm test` (Vitest) and `npm run build` must both pass at the end of every task.
- Next.js in this repo has breaking changes from training data. Before using any Next API you are not certain of, read the relevant guide under `node_modules/next/dist/docs/`. See `AGENTS.md`.
- Comments in this codebase explain **why**, not what, and are written in full sentences. Match that. Do not add a comment restating the line below it.
- Never delete a Firestore field without the migration script in Task 3 having run first.

---

### Task 1: Add `category` to the product model

Adds the new taxonomy alongside the existing `pillar`, so nothing breaks. `pillar` is removed in Task 8.

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/products-store.ts:33-88` (`docToStoredProduct`), `:126-145` (`toCatalogue`)
- Test: `src/lib/products-store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProductCategory = "treats" | "boxes" | "toys"`, `ShopCategory = ProductCategory | "pick-and-mix"`, `ALL_PRODUCT_CATEGORIES: ProductCategory[]`, `ALL_SHOP_CATEGORIES: ShopCategory[]`, `CATEGORY_LABELS: Record<ShopCategory, string>`, and a required `category: ProductCategory` field on `Product`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/products-store.test.ts`:

```ts
describe("docToStoredProduct category", () => {
  it("reads the category from the doc", () => {
    const p = docToStoredProduct("ears-box", { name: "Ears Box", price: 12, category: "boxes" });
    expect(p.category).toBe("boxes");
  });

  it("defaults a doc written before the migration to treats", () => {
    const p = docToStoredProduct("chicken-feet", { name: "Chicken Feet", price: 6 });
    expect(p.category).toBe("treats");
  });

  it("defaults an unrecognised category to treats rather than dropping the product", () => {
    const p = docToStoredProduct("odd", { name: "Odd", price: 1, category: "sundries" });
    expect(p.category).toBe("treats");
  });

  it("carries the category through to the client catalogue", () => {
    const stored = docToStoredProduct("ears-box", { name: "Ears Box", price: 12, category: "boxes" });
    expect(toCatalogue(stored).category).toBe("boxes");
  });
});
```

Make sure `docToStoredProduct` and `toCatalogue` are both in the file's import list.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: FAIL, TypeScript reports `category` does not exist on the returned type.

- [ ] **Step 3: Add the types to `src/data/products.ts`**

Immediately after the existing `PILLAR_LINES` block, add:

```ts
/**
 * The shelf a product sits on. Every product has exactly one.
 *
 * Deliberately smaller than what the shop navigates by: Pick and Mix is a builder
 * that draws from the treat range, not a shelf, so making it a product category
 * would mean inventing products that do not exist. See ShopCategory.
 */
export type ProductCategory = "treats" | "boxes" | "toys";

export const ALL_PRODUCT_CATEGORIES: ProductCategory[] = ["treats", "boxes", "toys"];

/** What the shop navigates by: the three shelves plus the builder. */
export type ShopCategory = ProductCategory | "pick-and-mix";

export const ALL_SHOP_CATEGORIES: ShopCategory[] = [
  "treats",
  "boxes",
  "pick-and-mix",
  "toys",
];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  treats: "Treat Range",
  boxes: "Treat Boxes",
  "pick-and-mix": "Pick & Mix",
  toys: "Toys",
};
```

In the `Product` interface, directly below the `pillar` field, add:

```ts
  /** Which shelf this product sits on. Required: a product with no shelf is invisible. */
  category: ProductCategory;
```

- [ ] **Step 4: Give every seed product a category**

In `seedProducts`, add `category: "boxes",` to the `mystery-box` literal (directly below its `pillar` line) and `category: "treats",` to each of the other nine literals, in the same position.

- [ ] **Step 5: Read and map the field in the store**

In `src/lib/products-store.ts`, add `ALL_PRODUCT_CATEGORIES` and `type ProductCategory` to the existing import from `@/data/products`.

Inside `docToStoredProduct`, directly below the existing `pillar` block, add:

```ts
  const rawCategory = String(data.category ?? "");
  // A doc written before the category migration has no shelf. Everything on the
  // shelf at that point was a treat, and defaulting beats an invisible product,
  // so a deploy that lands before the script runs degrades to "all treats"
  // rather than to an empty shop.
  const category: ProductCategory = ALL_PRODUCT_CATEGORIES.includes(
    rawCategory as ProductCategory,
  )
    ? (rawCategory as ProductCategory)
    : "treats";
```

Add `category,` to the returned object, directly below `pillar,`. Add `category: sp.category,` to `toCatalogue`'s returned object, directly below `pillar: sp.pillar,`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the whole suite and the build**

Run: `npm test`
Expected: PASS. If another test constructs a `Product` literal, add `category: "treats"` to it.

Run: `npm run build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/data/products.ts src/lib/products-store.ts src/lib/products-store.test.ts
git commit -m "feat: category on the product model, alongside pillar"
```

---

### Task 2: Let the admin set a category

**Files:**
- Modify: `src/lib/product-admin.ts`
- Modify: `src/components/admin/ProductForm.tsx:7`, `:49`, `:120`, `:207-212`
- Modify: `src/app/api/admin/products/route.ts:65`
- Modify: `src/app/api/admin/products/[slug]/route.ts:67`
- Modify: `src/app/api/dev/seed-products/route.ts:52-55`
- Test: `src/lib/product-admin.test.ts`

**Interfaces:**
- Consumes: `ProductCategory`, `ALL_PRODUCT_CATEGORIES`, `CATEGORY_LABELS` from Task 1.
- Produces: `ProductInput.category: ProductCategory`, and `ALL_PRODUCT_CATEGORIES` re-exported from `product-admin.ts` alongside the existing `ALL_BADGES` and `ALL_PILLARS` re-exports.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/product-admin.test.ts`. Reuse whatever valid-input helper the file already has; if it builds an object inline, copy that shape and add `category`.

```ts
describe("validateProductInput category", () => {
  it("accepts a valid category", () => {
    const res = validateProductInput(validInput({ category: "boxes" }), ALL_BADGES);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.category).toBe("boxes");
  });

  it("rejects a missing category with a sentence she can act on", () => {
    const res = validateProductInput(validInput({ category: undefined }), ALL_BADGES);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toContain("Choose which part of the shop this product belongs to.");
  });

  it("rejects an invented category", () => {
    const res = validateProductInput(validInput({ category: "sundries" }), ALL_BADGES);
    expect(res.ok).toBe(false);
  });

  it("rejects pick-and-mix, which is a builder rather than a shelf", () => {
    const res = validateProductInput(validInput({ category: "pick-and-mix" }), ALL_BADGES);
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: FAIL, `category` is not on `ProductInput`.

- [ ] **Step 3: Validate it**

In `src/lib/product-admin.ts`, add `ALL_PRODUCT_CATEGORIES` and `type ProductCategory` to the import from `@/data/products`, and add `ALL_PRODUCT_CATEGORIES` to the `export { ... }` line.

Add to `ProductInput`, directly below `pillar: Pillar;`:

```ts
  category: ProductCategory;
```

Directly below the existing pillar validation block, add:

```ts
  // Same reasoning as the pillar above: a product on no shelf appears nowhere,
  // which looks exactly like the site working while the product is invisible.
  // Required, never defaulted, on the way in.
  const rawCategory = String(input.category ?? "");
  const categoryOk = ALL_PRODUCT_CATEGORIES.includes(rawCategory as ProductCategory);
  if (!categoryOk) errors.push("Choose which part of the shop this product belongs to.");
  const category = (categoryOk ? rawCategory : "treats") as ProductCategory;
```

Add `category,` to the returned `value` object, directly below `pillar,`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the form control**

In `src/components/admin/ProductForm.tsx`, add `ProductCategory` and `CATEGORY_LABELS` and `ALL_PRODUCT_CATEGORIES` to the imports from `@/data/products`.

Below the existing `pillar` state on line 49, add:

```tsx
  const [category, setCategory] = useState<ProductCategory | "">(initial?.category ?? "");
```

Add `category,` to the submitted payload object, directly below `pillar,` on line 120.

Directly below the existing Pillar `<label>` block (lines 207 to 212), add:

```tsx
        <label>
          <span>Part of the shop</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            required
          >
            <option value="">Choose a section...</option>
            {ALL_PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
```

- [ ] **Step 6: Persist it**

In `src/app/api/admin/products/route.ts`, add `category: draft.category,` directly below the `pillar: draft.pillar,` line.

In `src/app/api/admin/products/[slug]/route.ts`, add `category: next.category,` directly below the `pillar: next.pillar,` line.

In `src/app/api/dev/seed-products/route.ts`, add `category: seedSp.category,` directly below the `pillar: seedSp.pillar,` line.

- [ ] **Step 7: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/product-admin.ts src/lib/product-admin.test.ts src/components/admin/ProductForm.tsx src/app/api/admin/products/route.ts "src/app/api/admin/products/[slug]/route.ts" src/app/api/dev/seed-products/route.ts
git commit -m "feat: choose a shop section when adding or editing a product"
```

---

### Task 3: The Firestore migration script

Mirrors `scripts/backfill-product-images.mjs`: the decision is a pure exported function so it can be unit tested, and the script around it is a thin dry-run/apply wrapper.

**Files:**
- Create: `scripts/backfill-product-categories.mjs`
- Create: `scripts/backfill-product-categories.test.mjs`

**Interfaces:**
- Consumes: nothing at runtime. The category names must match `ProductCategory` from Task 1.
- Produces: `planCategoryPatch(doc)`, returning `{ patch, archive }` where `patch` is a Firestore merge object (possibly containing `FieldValue.delete()` sentinels supplied by the caller) and `archive` is a boolean, or `null` when the doc needs no write.

- [ ] **Step 1: Write the failing test**

Create `scripts/backfill-product-categories.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { planCategoryPatch, DELETE } from "./backfill-product-categories.mjs";

describe("planCategoryPatch", () => {
  it("maps the Dog Day mystery box onto the boxes shelf", () => {
    const plan = planCategoryPatch("mystery-box", { pillar: "good-food", fulfilment: "own-stock" });
    expect(plan.patch.category).toBe("boxes");
    expect(plan.archive).toBe(false);
  });

  it("maps every other product onto the treat range", () => {
    const plan = planCategoryPatch("chicken-feet", { pillar: "good-food", fulfilment: "own-stock" });
    expect(plan.patch.category).toBe("treats");
  });

  it("deletes every retired field", () => {
    const plan = planCategoryPatch("chicken-feet", {
      pillar: "good-food",
      fulfilment: "own-stock",
      leadTimeDays: 0,
      supplierPostage: 2,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    for (const field of [
      "pillar",
      "fulfilment",
      "leadTimeDays",
      "supplierPostage",
      "supplierArrivalMinDays",
      "supplierArrivalMaxDays",
    ]) {
      expect(plan.patch[field]).toBe(DELETE);
    }
  });

  it("archives a supplier posted product rather than passing it off as own stock", () => {
    const plan = planCategoryPatch("someone-elses-thing", { fulfilment: "supplier-posted" });
    expect(plan.archive).toBe(true);
    expect(plan.patch.archived).toBe(true);
  });

  it("is idempotent: an already migrated doc plans no write", () => {
    expect(planCategoryPatch("chicken-feet", { category: "treats" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/backfill-product-categories.test.mjs`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the script**

Create `scripts/backfill-product-categories.mjs`:

```js
// One-off migration for docs/specs/2026-08-25-shop-taxonomy-foundations-design.md
// section 8: put every product on a shelf, archive anything the supplier used to
// post, and delete the retired pillar and dropshipping fields.
//
// Idempotent, and it makes no Stripe calls, because none of these fields reach Stripe.
//
// Dry run:  node scripts/backfill-product-categories.mjs
// Apply:    node scripts/backfill-product-categories.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const COLLECTION = "store_products";

/**
 * The sentinel meaning "remove this field". Injected rather than imported into the
 * planner so the planner stays a pure function the tests can assert against.
 */
export const DELETE = "__delete__";

/** The retired fields, deleted from every doc the migration touches. */
const RETIRED = [
  "pillar",
  "fulfilment",
  "leadTimeDays",
  "supplierPostage",
  "supplierArrivalMinDays",
  "supplierArrivalMaxDays",
];

/**
 * The shelf a slug lands on. Everything on the shelf today is a treat except the
 * Dog Day mystery box, which is a box. Anything unrecognised is a treat, matching
 * the same default in docToStoredProduct, so a new product added between writing
 * this and running it is never left invisible.
 */
function shelfFor(slug) {
  return slug === "mystery-box" ? "boxes" : "treats";
}

/**
 * What to write for one product doc, or null if it is already migrated.
 *
 * A supplier posted product is archived rather than converted, because converting
 * it would put a product Michaela cannot post from her own shelf onto a shelf that
 * promises she can.
 */
export function planCategoryPatch(slug, data) {
  const alreadyDone =
    typeof data.category === "string" && RETIRED.every((f) => data[f] === undefined);
  if (alreadyDone) return null;

  const archive = data.fulfilment === "supplier-posted";
  const patch = { category: data.category ?? shelfFor(slug) };
  if (archive) patch.archived = true;
  for (const field of RETIRED) {
    if (data[field] !== undefined) patch[field] = DELETE;
  }
  return { patch, archive };
}

/** Swap the sentinels for the real Firestore delete, just before writing. */
function toFirestorePatch(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[k] = v === DELETE ? FieldValue.delete() : v;
  return out;
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) {
    console.error("Set FIREBASE_SERVICE_ACCOUNT before running this.");
    process.exit(1);
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(json)) });
  const db = getFirestore();

  const snap = await db.collection(COLLECTION).get();
  let touched = 0;
  let archived = 0;

  for (const doc of snap.docs) {
    const plan = planCategoryPatch(doc.id, doc.data());
    if (!plan) continue;
    touched += 1;
    if (plan.archive) {
      archived += 1;
      console.log(`${APPLY ? "archiving" : "would archive"} ${doc.id} (was supplier posted)`);
    }
    console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, plan.patch);
    if (APPLY) await doc.ref.set(toFirestorePatch(plan.patch), { merge: true });
  }

  console.log(
    `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}, ` +
      `${archived} ${APPLY ? "archived" : "would be archived"}.` +
      (APPLY ? "" : " Re-run with --apply to write."),
  );
  process.exit(0);
}

// Only connect to Firestore when run as a script, so importing it in a test does not.
if (process.argv[1] && process.argv[1].endsWith("backfill-product-categories.mjs")) {
  await main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/backfill-product-categories.test.mjs`
Expected: PASS, five tests.

- [ ] **Step 5: Dry run against live Firestore**

Run: `node scripts/backfill-product-categories.mjs`
Expected: a list of "would patch" lines and a summary. **Do not pass `--apply` yet.** Applying happens in Task 12, after the code that reads `category` is merged, so a rollback never leaves the live site reading fields that are gone.

Paste the dry run output into the commit message body.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-product-categories.mjs scripts/backfill-product-categories.test.mjs
git commit -m "feat: migration putting every product on a shelf and retiring the dropship fields"
```

---

### Task 4: Pick and Mix moves to its own page

Doing this before the pillar pages are deleted means the feature is never absent from the site.

**Files:**
- Modify: `src/lib/pick-and-mix.ts:44-52` (`bundlePool`)
- Modify: `src/components/PickAndMixBuilder.tsx:29-30`, `:48`
- Create: `src/app/shop/pick-and-mix/page.tsx`
- Modify: `src/app/good-food/page.tsx:98-111`
- Test: `src/lib/pick-and-mix.test.ts`

**Interfaces:**
- Consumes: `ProductCategory` from Task 1.
- Produces: `bundlePool<T extends { category: ProductCategory }>(products: T[]): T[]`. Note the narrowed constraint: callers no longer need to supply `fulfilment` or `leadTimeDays`.

- [ ] **Step 1: Write the failing test**

Replace the existing `bundlePool` describe block in `src/lib/pick-and-mix.test.ts` with:

```ts
describe("bundlePool", () => {
  const catalogue = [
    { slug: "chicken-feet", category: "treats" },
    { slug: "rabbit-ears", category: "treats" },
    { slug: "ears-box", category: "boxes" },
    { slug: "squeaky-tennis-ball", category: "toys" },
  ];

  it("draws from the treat range", () => {
    expect(bundlePool(catalogue).map((p) => p.slug)).toEqual(["chicken-feet", "rabbit-ears"]);
  });

  it("never draws a box, because a box inside a bundle is a box inside a box", () => {
    expect(bundlePool(catalogue).some((p) => p.category === "boxes")).toBe(false);
  });

  it("never draws a toy, because the bundle is priced and sold as treats", () => {
    expect(bundlePool(catalogue).some((p) => p.category === "toys")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: FAIL, the objects do not satisfy the old constraint requiring `pillar` and `fulfilment`.

- [ ] **Step 3: Rewrite the pool**

In `src/lib/pick-and-mix.ts`, replace the `FulfilmentPath, Pillar` import from `@/data/products` with `type ProductCategory`, and replace `bundlePool` and its doc comment with:

```ts
/**
 * The products a bundle may draw from: the treat range only.
 *
 * Boxes are excluded because a mystery box inside a pick and mix is a box inside a
 * box, and toys because the bundle is priced and sold as treats. Callers pass the
 * viewer's catalogue, which is already filtered to active, unarchived and members
 * window respecting products, so none of that is repeated here.
 */
export function bundlePool<T extends { category: ProductCategory }>(products: T[]): T[] {
  return products.filter((p) => p.category === "treats");
}
```

Leave `BUNDLE_SIZES` and `BUNDLE_PERCENT` alone. `bundleDeliveryProduct` still sets `fulfilment` and `leadTimeDays`; that is removed in Task 9, not here.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/pick-and-mix.test.ts`
Expected: PASS.

- [ ] **Step 5: Fold the heading into the component**

The heading currently lives in the page while the builder returns `null` on an empty pool, so an empty pool renders a heading with nothing under it and no error. Move it inside.

In `src/components/PickAndMixBuilder.tsx`, replace lines 29 and 30:

```tsx
  const pool = bundlePool(catalogue);
  if (pool.length === 0) return null;
```

with:

```tsx
  const pool = bundlePool(catalogue);
```

Then replace the opening `<div className="pickmix">` on line 48 with:

```tsx
    <div className="pickmix">
      <div className="section-head">
        <p className="eyebrow">Pick &amp; Mix</p>
        <h2 className="display">Let us surprise your dog.</h2>
        <p>
          Choose 5, 10 or 20 items and we pick the assortment: a randomised spread of
          the treat range, packed by hand from our own shelf. You see exactly what was
          drawn, and what it saves, before you add it. Do not like the draw? Draw again.
        </p>
      </div>
```

Directly after that `section-head` block, add:

```tsx
      {pool.length === 0 ? (
        <p className="notice">Back in stock soon. The treat range is being restocked.</p>
      ) : (
```

and close it with `)}` immediately before the component's final `</div>`. Every existing child between them stays exactly as it is.

- [ ] **Step 6: Create the page**

Create `src/app/shop/pick-and-mix/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PickAndMixBuilder } from "@/components/PickAndMixBuilder";

export const metadata: Metadata = {
  title: "Pick & Mix | Barking Raw",
  description:
    "Choose 5, 10 or 20 items and we pick the assortment: a randomised spread of natural single ingredient treats, packed by hand and posted to your door.",
};

/**
 * Pick and Mix, which until now was the last section of a pillar page nobody
 * reached the bottom of. The heading lives in the builder rather than here, so an
 * empty pool cannot render a headless section.
 */
export default function PickAndMixPage() {
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <PickAndMixBuilder />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Strip the duplicate heading from the pillar page**

In `src/app/good-food/page.tsx`, delete the `<div className="section-head">` block inside the `id="pick-and-mix"` section (its eyebrow, heading and paragraph), leaving `<PickAndMixBuilder />` as the section's only child. The page is deleted in Task 7; this stops it double-printing the heading in the meantime.

- [ ] **Step 8: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 9: Verify by eye**

Run: `npm run dev`, open `http://localhost:3000/shop/pick-and-mix`.
Expected: the heading, the three size buttons, and a working draw that prices a bundle.

- [ ] **Step 10: Commit**

```bash
git add src/lib/pick-and-mix.ts src/lib/pick-and-mix.test.ts src/components/PickAndMixBuilder.tsx src/app/shop/pick-and-mix/page.tsx src/app/good-food/page.tsx
git commit -m "feat: pick and mix gets a URL of its own, and draws from the treat range"
```

---

### Task 5: The shop category pages

**Files:**
- Create: `src/lib/categories.ts`
- Create: `src/lib/categories.test.ts`
- Create: `src/app/shop/[category]/page.tsx`
- Modify: `src/app/shop/page.tsx` (replace wholesale)

**Interfaces:**
- Consumes: `ShopCategory`, `ProductCategory`, `ALL_SHOP_CATEGORIES`, `CATEGORY_LABELS` from Task 1; `getPublicProducts`, `toCatalogue` from `@/lib/products-store`; `getViewerDogs` from `@/lib/viewer-dogs`; `ProductCard` from `@/components/ProductCard`.
- Produces: `filterByCategory<T extends { category: ProductCategory }>(items: T[], category: ProductCategory): T[]`, `isProductCategory(value: string): value is ProductCategory`, `CATEGORY_META: Record<ShopCategory, { title: string; description: string }>`, `CATEGORY_IMAGES: Record<ShopCategory, string>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterByCategory, isProductCategory, CATEGORY_META, CATEGORY_IMAGES } from "@/lib/categories";
import { ALL_SHOP_CATEGORIES } from "@/data/products";

describe("filterByCategory", () => {
  const items = [
    { slug: "chicken-feet", category: "treats" as const },
    { slug: "ears-box", category: "boxes" as const },
    { slug: "rope", category: "toys" as const },
  ];

  it("returns only the shelf asked for, in catalogue order", () => {
    expect(filterByCategory(items, "treats").map((i) => i.slug)).toEqual(["chicken-feet"]);
  });

  it("returns an empty list for a shelf with nothing on it", () => {
    expect(filterByCategory([], "toys")).toEqual([]);
  });
});

describe("isProductCategory", () => {
  it("accepts the three shelves", () => {
    expect(isProductCategory("treats")).toBe(true);
    expect(isProductCategory("boxes")).toBe(true);
    expect(isProductCategory("toys")).toBe(true);
  });

  it("rejects pick-and-mix, which has its own page rather than a product list", () => {
    expect(isProductCategory("pick-and-mix")).toBe(false);
  });

  it("rejects anything invented", () => {
    expect(isProductCategory("sundries")).toBe(false);
  });
});

describe("category presentation", () => {
  it("gives every shop category a title, a description and an image", () => {
    for (const c of ALL_SHOP_CATEGORIES) {
      expect(CATEGORY_META[c].title).toBeTruthy();
      expect(CATEGORY_META[c].description).toBeTruthy();
      expect(CATEGORY_IMAGES[c]).toMatch(/^\//);
    }
  });

  it("names no other company anywhere in the copy", () => {
    const copy = Object.values(CATEGORY_META)
      .map((m) => `${m.title} ${m.description}`)
      .join(" ")
      .toLowerCase();
    for (const brand of ["pedigree", "bakers", "dentastix", "markies", "jumbone", "purina", "wagg"]) {
      expect(copy).not.toContain(brand);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/categories.test.ts`
Expected: FAIL, `@/lib/categories` does not exist.

- [ ] **Step 3: Write the module**

Create `src/lib/categories.ts`. This replaces the deleted `src/lib/pillars.ts` and keeps the same shape: a pure filter, the circle photos, and the search metadata, all unit testable.

```ts
// The shop's category data: which products belong to a shelf, which photo fills
// each circle, and each category's search metadata. Pure, so the filter and the
// photo paths are unit-testable. Replaces the deleted pillars.ts.

import {
  ALL_PRODUCT_CATEGORIES,
  type ProductCategory,
  type ShopCategory,
} from "@/data/products";

/** The products on one shelf, in catalogue order. */
export function filterByCategory<T extends { category: ProductCategory }>(
  items: T[],
  category: ProductCategory,
): T[] {
  return items.filter((p) => p.category === category);
}

/**
 * True for the three shelves only. Pick and Mix is deliberately excluded: it has
 * its own page and no products of its own, so /shop/pick-and-mix must not be
 * served by the generic category route.
 */
export function isProductCategory(value: string): value is ProductCategory {
  return ALL_PRODUCT_CATEGORIES.includes(value as ProductCategory);
}

/**
 * The photo inside each circle. PLACEHOLDERS for the treat, box and toy circles:
 * only the old product shots exist in public/ today. Michaela swaps these here,
 * one line each, when the three new circle photos arrive (spec section 11.2).
 */
export const CATEGORY_IMAGES: Record<ShopCategory, string> = {
  treats: "/products/whole-sprats.png",
  boxes: "/products/mystery-box.png",
  "pick-and-mix": "/products/chicken-feet.png",
  toys: "/products/rabbit-ears.png",
};

/** Search metadata for the shop and its category pages. Names no other company. */
export const CATEGORY_META: Record<ShopCategory, { title: string; description: string }> = {
  treats: {
    title: "Treat Range | Barking Raw",
    description:
      "Natural single ingredient dog treats, named in full on the pack and posted to your door. Free local delivery, free over GBP 35.",
  },
  boxes: {
    title: "Treat Boxes | Barking Raw",
    description:
      "Hand packed boxes of natural dog treats, chosen for your dog rather than pulled off a shelf.",
  },
  "pick-and-mix": {
    title: "Pick & Mix | Barking Raw",
    description:
      "Choose 5, 10 or 20 items and we pick the assortment. A randomised spread of the treat range, packed by hand.",
  },
  toys: {
    title: "Toys | Barking Raw",
    description: "Ropes, balls and treat dispensers for dogs who would rather play than chew.",
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the shop page with the category landing page**

Replace the whole of `src/app/shop/page.tsx` with:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ALL_SHOP_CATEGORIES, CATEGORY_LABELS } from "@/data/products";
import { CATEGORY_IMAGES } from "@/lib/categories";
import { EmailCapture } from "@/components/EmailCapture";

export const metadata: Metadata = {
  title: "Shop | Barking Raw",
  description:
    "Natural dog treats, hand packed boxes, pick and mix, and toys. Named in full and posted to your door. Free local delivery, free over GBP 35.",
};

/**
 * The shop landing page: four circles, one per category. Replaces the flat
 * everything-grid, because a flat grid and four categories are two answers to
 * the same question and the categories are the one the customer asked for.
 */
export default function ShopPage() {
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <p className="eyebrow">The shop</p>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              What are you after?
            </h1>
          </div>
          <div className="ring">
            {ALL_SHOP_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/shop/${category}`}
                className={`ring__wedge ring__wedge--${category}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CATEGORY_IMAGES[category]} alt="" />
                <span className="ring__label">{CATEGORY_LABELS[category]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <EmailCapture
        source="shop"
        heading="10% off your first order"
        sub="Pop your email in, tick the box, and the code lands in your inbox."
      />
    </main>
  );
}
```

The four `ring__wedge--*` modifier classes in `src/app/globals.css` are still named after the pillars. Rename them there: `--good-food` becomes `--treats`, `--comfy-walks` becomes `--boxes`, `--fun-and-games` becomes `--pick-and-mix`, `--cosy-sleep` becomes `--toys`. Change only the selector names, not the rules.

- [ ] **Step 6: Create the category page**

Create `src/app/shop/[category]/page.tsx`. In Next 16 `params` is a Promise and must be awaited; check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/` if you need to confirm the signature.

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_LABELS, type ProductCategory } from "@/data/products";
import { CATEGORY_META, filterByCategory, isProductCategory } from "@/lib/categories";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { getViewerDogs } from "@/lib/viewer-dogs";
import { ProductCard } from "@/components/ProductCard";
import { EmailCapture } from "@/components/EmailCapture";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category } = await params;
  if (!isProductCategory(category)) return {};
  return CATEGORY_META[category];
}

/**
 * One shelf. Pick and Mix never reaches here: it is not a product category, and
 * its own route at /shop/pick-and-mix wins over this dynamic segment.
 */
export default async function CategoryPage({ params }: Params) {
  const { category } = await params;
  if (!isProductCategory(category)) notFound();
  const shelf = category as ProductCategory;

  const [products, dogs] = await Promise.all([
    getPublicProducts().then((list) => list.map(toCatalogue)),
    getViewerDogs(),
  ]);
  const shown = filterByCategory(products, shelf);

  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <p className="eyebrow">The shop</p>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              {CATEGORY_LABELS[shelf]}
            </h1>
          </div>
          {shown.length === 0 ? (
            <p className="notice">Nothing on this shelf just yet. Check back shortly.</p>
          ) : (
            <div className="grid">
              {shown.map((p) => (
                <ProductCard key={p.slug} product={p} dogs={dogs} />
              ))}
            </div>
          )}
        </div>
      </section>
      <EmailCapture
        source="shop"
        heading="10% off your first order"
        sub="Pop your email in, tick the box, and the code lands in your inbox."
      />
    </main>
  );
}
```

- [ ] **Step 7: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 8: Verify by eye**

Run: `npm run dev`. Check:
- `/shop` shows four circles.
- `/shop/treats` lists the nine treats.
- `/shop/boxes` lists the Dog Day mystery box only.
- `/shop/toys` shows the empty shelf notice, not a blank page.
- `/shop/pick-and-mix` still shows the builder, not a 404, confirming the static route beats the dynamic one.
- `/shop/sundries` returns a 404.

- [ ] **Step 9: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts src/app/shop/page.tsx "src/app/shop/[category]/page.tsx" src/app/globals.css
git commit -m "feat: shop category landing page and per-shelf pages"
```

---

### Task 6: Navigation and the home ring point at categories

**Files:**
- Modify: `src/components/Header.tsx:5`, `:36-46`
- Modify: `src/components/Ring.tsx` (replace wholesale)

**Interfaces:**
- Consumes: `ALL_SHOP_CATEGORIES`, `CATEGORY_LABELS` from Task 1; `CATEGORY_IMAGES` from Task 5.
- Produces: nothing new.

- [ ] **Step 1: Repoint the nav**

In `src/components/Header.tsx`, replace the `ALL_PILLARS, PILLAR_LABELS` import from `@/data/products` with nothing (the nav becomes a static list), and replace the whole `<nav>` block with:

```tsx
      {/* The five pages plus Members, reachable from every page. Scrolls sideways
          on phones rather than wrapping. */}
      <nav className="header__nav" aria-label="Main">
        <Link href="/">Home</Link>
        <Link href="/about">About us</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/delivery">Delivery</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/members">Members</Link>
      </nav>
```

- [ ] **Step 2: Repoint the ring**

Replace the whole of `src/components/Ring.tsx` with:

```tsx
import Link from "next/link";
import { ALL_SHOP_CATEGORIES, CATEGORY_LABELS } from "@/data/products";
import { CATEGORY_IMAGES } from "@/lib/categories";

/**
 * The ring: the home page's primary navigation. Desktop is one circle in four
 * photo wedges around a logo hub; mobile is a two by two grid of circular tiles.
 * Both are this one markup, switched in CSS, so they cannot drift.
 *
 * The wedges were the four pillars and are now the four shop categories. The
 * layout and copy are rebuilt in phase 2; this is the repoint only.
 */
export function RingHero() {
  return (
    <section className="band ring-hero" style={{ background: "#000", color: "#fff" }}>
      <div className="wrap">
        <div className="ring-hero__copy">
          <h1 className="display">Real food, honestly labelled.</h1>
          <p className="hero__sub">
            One honest ingredient, named in full, posted to your door.
          </p>
        </div>
        <div className="ring">
          {ALL_SHOP_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/shop/${category}`}
              className={`ring__wedge ring__wedge--${category}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CATEGORY_IMAGES[category]} alt="" />
              <span className="ring__label">{CATEGORY_LABELS[category]}</span>
            </Link>
          ))}
          <span className="ring__hub" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpeg" alt="" />
          </span>
        </div>
      </div>
    </section>
  );
}
```

The `pillar-lines` block is deleted with it: those four lines were the pillar positioning, which per spec section 3.4 is retired rather than relocated. Leave the now-unused `.pillar-lines` rules in `globals.css`; Phase 2 rewrites that stylesheet.

- [ ] **Step 3: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Verify by eye**

Run: `npm run dev`, open `/`. The nav reads Home, About us, Shop, Delivery, Contact, Members. The four ring circles read Treat Range, Treat Boxes, Pick & Mix, Toys and each one lands on its page.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Ring.tsx
git commit -m "feat: nav and home ring point at the four shop categories"
```

---

### Task 7: Delete the pillar pages and redirect their URLs

**Files:**
- Delete: `src/app/good-food/`, `src/app/comfy-walks/`, `src/app/fun-and-games/`, `src/app/cosy-sleep/`
- Delete: `src/components/PillarProducts.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Add the redirects first**

Redirects go in before the pages go, so the URLs are never dead even for one commit. In `src/../next.config.ts`, add to `nextConfig`, after `transpilePackages`:

```ts
  /**
   * The four pillar pages are gone (spec section 3.4). Permanent, which Next
   * serves as a 308 and which preserves the request method. Good Food and Fun
   * and Games have honest successor shelves; Comfy Walks and Cosy Sleep have
   * none, so they go to the shop rather than to a category that would
   * misrepresent what the visitor clicked.
   */
  async redirects() {
    return [
      { source: "/good-food", destination: "/shop/treats", permanent: true },
      { source: "/comfy-walks", destination: "/shop", permanent: true },
      { source: "/fun-and-games", destination: "/shop/toys", permanent: true },
      { source: "/cosy-sleep", destination: "/shop", permanent: true },
    ];
  },
```

- [ ] **Step 2: Delete the pages**

```bash
git rm -r src/app/good-food src/app/comfy-walks src/app/fun-and-games src/app/cosy-sleep src/components/PillarProducts.tsx
```

- [ ] **Step 3: Run the build to find every broken import**

Run: `npm run build`
Expected: clean. If anything still imports `PillarProducts`, remove that import; nothing outside the deleted pages should.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verify the redirects**

Run: `npm run dev`, then:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/good-food
```

Expected: `308 http://localhost:3000/shop/treats`. Repeat for the other three.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts
git commit -m "feat: pillar pages deleted, their URLs 308 to the shop"
```

---

### Task 8: Remove `pillar` from the model

Nothing reads it after Tasks 4 to 7. This is the contract half of expand-then-contract.

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/products-store.ts`
- Modify: `src/lib/product-admin.ts`
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/admin/products/page.tsx:53`, `:68`
- Modify: `src/app/admin/page.tsx:11`, `:21`
- Modify: `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[slug]/route.ts`, `src/app/api/dev/seed-products/route.ts`
- Delete: `src/lib/pillars.ts`, `src/lib/pillars.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `Product` with no `pillar`, and `ProductInput` with no `pillar`.

- [ ] **Step 1: Delete the module and its test**

```bash
git rm src/lib/pillars.ts src/lib/pillars.test.ts
```

- [ ] **Step 2: Remove the type and its data**

From `src/data/products.ts` delete: the `Pillar` type, `ALL_PILLARS`, `PILLAR_LABELS`, `PILLAR_LINES`, the `pillar` field on `Product`, and the `pillar:` line from all ten seed literals.

- [ ] **Step 3: Remove it everywhere else**

- `src/lib/products-store.ts`: drop `ALL_PILLARS` and `type Pillar` from the import, delete the `rawPillar`/`pillar` block in `docToStoredProduct`, and the `pillar,` and `pillar: sp.pillar,` lines.
- `src/lib/product-admin.ts`: drop `ALL_PILLARS` and `type Pillar` from the import and from the `export { ... }` line, delete the `rawPillar`/`pillarOk`/`pillar` block, the `pillar: Pillar;` field, and `pillar,` from the returned value.
- `src/components/admin/ProductForm.tsx`: drop `Pillar` from the import, the `pillar` state, `pillar,` from the payload, and the whole Pillar `<label>` block. On line 231 change "shop and pillar pages" to "shop".
- `src/app/admin/products/page.tsx`: delete the `Pillar` `<th>` and its `<td>`, and drop `PILLAR_LABELS` from the import.
- `src/app/admin/page.tsx`: line 11, change "set which pillar it belongs to" to "set which part of the shop it belongs to". Line 21, change "the weekly pillar post" to "the weekly post".
- The three API routes: delete their `pillar:` lines.

- [ ] **Step 4: Run the build to catch the rest**

Run: `npm run build`
Expected: clean. TypeScript will name any file still referencing `Pillar`. Fix each one the same way.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS. Remove `pillar` from any product literal a test still builds.

- [ ] **Step 6: Verify nothing is left**

Run: `grep -rn "pillar\|Pillar" src`
Expected: matches only in `src/lib/welcome-emails.ts` and `src/lib/subscribers.ts` (and their tests), which spec section 5 leaves running until Phase 2.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "refactor: pillar removed from the product model"
```

---

### Task 9: Remove the supplier posted path

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/product-fields.ts:4`, `:21-26`, `:28-43`
- Modify: `src/lib/product-admin.ts`
- Modify: `src/lib/products-store.ts`
- Modify: `src/lib/pick-and-mix.ts` (`bundleDeliveryProduct`)
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/components/ProductCard.tsx:8`, `:86-88`
- Modify: `src/app/admin/products/page.tsx:5`, `:64`, `:74`
- Modify: `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[slug]/route.ts`, `src/app/api/dev/seed-products/route.ts`
- Delete: `src/lib/subscriptions.ts` `splitSubscribable` only
- Test: `src/lib/product-fields.test.ts`, `src/lib/product-admin.test.ts`, `src/lib/subscriptions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `Product` and `ProductInput` with no `fulfilment`, `supplierPostage`, `supplierArrivalMinDays`, `supplierArrivalMaxDays` or `leadTimeDays`.

- [ ] **Step 1: Delete the tests for the behaviour being removed**

In `src/lib/product-fields.test.ts`, delete the `leadTimeNote` and `supplierArrivalNote` describe blocks and drop both from the import.

In `src/lib/product-admin.test.ts`, delete every test asserting supplier postage or arrival range validation.

In `src/lib/subscriptions.test.ts`, delete the `splitSubscribable` describe block and drop it from the import.

- [ ] **Step 2: Run the suite to confirm it is green before the surgery**

Run: `npm test`
Expected: PASS. Deleting tests cannot break the build; this is the checkpoint that nothing else depended on them.

- [ ] **Step 3: Remove the type and fields**

From `src/data/products.ts` delete: `FulfilmentPath`, `ALL_FULFILMENT_PATHS` and their doc comment, and the `leadTimeDays`, `fulfilment`, `supplierPostage`, `supplierArrivalMinDays` and `supplierArrivalMaxDays` fields on `Product`. Delete the `leadTimeDays:` and `fulfilment:` lines from all ten seed literals.

From `src/lib/product-fields.ts` delete `leadTimeNote`, `supplierArrivalNote` and the `FulfilmentPath` import. `isMembersOnly` and `packSizeLabel` stay.

From `src/lib/product-admin.ts` delete: `FulfilmentPath` from the import, the five fields from `ProductInput`, the `rawLead`/`leadOk`/`leadTimeDays` block, the whole `fulfilment` and `if (fulfilment === "supplier-posted")` block, and all five names from the returned value.

From `src/lib/products-store.ts` delete: `FulfilmentPath` from the import, the `rawLead`/`leadTimeDays`, `fulfilment`, `supplier` and `num`-guarded supplier lines from `docToStoredProduct`, and all five names from both the returned object and `toCatalogue`. Keep the `num` helper: `packWeightGrams`, `stock`, `pointsPerPound` and `sortOrder` all still use it.

In `src/lib/pick-and-mix.ts`, delete the `fulfilment: "own-stock",` and `leadTimeDays: 0,` lines from `bundleDeliveryProduct`'s returned object.

In `src/lib/subscriptions.ts`, delete `splitSubscribable` and its `FulfilmentPath` import. Everything from Michaela's own shelf is subscribable now, so there is nothing left to split.

- [ ] **Step 4: Remove the UI**

- `src/components/admin/ProductForm.tsx`: drop `FulfilmentPath` from the import, the `fulfilment`, `supplierPostage`, `supplierArrivalMinDays` and `supplierArrivalMaxDays` state, all five names from the payload, the lead time `<label>`, the fulfilment toggle buttons, and the whole `{fulfilment === "supplier-posted" && ( ... )}` block.
- `src/components/ProductCard.tsx`: drop `leadTimeNote` and `supplierArrivalNote` from the import and delete the two-line block at 86 to 88 that renders `card__lead`.
- `src/app/admin/products/page.tsx`: drop `leadTimeNote` from the import, delete the `const lead = ...` line and whatever renders it, and replace the `p.fulfilment === "supplier-posted" ? ... : ...` expression with the plain string `"From your stock"` (or delete that column entirely, since it now says the same thing on every row; deleting is preferred).
- The three API routes: delete every `leadTimeDays`, `fulfilment`, `supplierPostage`, `supplierArrivalMinDays` and `supplierArrivalMaxDays` line, including the `FieldValue.delete()` branches in `[slug]/route.ts`.

- [ ] **Step 5: Run the build to catch the rest**

Run: `npm run build`
Expected: clean. `src/lib/shipping.ts` will still fail here because it imports `FulfilmentPath` and calls the deleted note helpers. That is Task 10. To keep this task green on its own, do Step 6 now.

- [ ] **Step 6: Stub shipping so this task ends green**

In `src/lib/shipping.ts`, delete the `FulfilmentPath` import and the `leadTimeNote, supplierArrivalNote` import, remove the five retired fields from `DeliveryProduct` leaving `slug`, `name` and `price`, and inside `computeBasketDelivery` replace the `own`/`supplier` split with:

```ts
  const ownStockSubtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const parcels: DeliveryParcel[] = [];
  if (items.length > 0) {
    const shipping = computeShipping(postcode, ownStockSubtotal);
    parcels.push({ key: "own-stock", label: "From Barking Raw", cost: shipping.cost, note: null });
  }
```

deleting the `for (const i of supplier)` loop. The shape is unchanged, so no consumer breaks. Task 10 collapses the shape itself.

- [ ] **Step 7: Run the suite and the build**

Run: `npm test`
Expected: PASS. Remove the retired fields from any product literal a test still builds.

Run: `npm run build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor: supplier posted path removed, everything posts from our own shelf"
```

---

### Task 10: Collapse the basket delivery shape

`computeBasketDelivery` exists to split a basket into several parcels. There is only ever one now, so the split goes.

**Files:**
- Modify: `src/lib/shipping.ts`
- Modify: `src/app/api/checkout/route.ts:174`, `:281-303`
- Modify: `src/components/BasketDrawer.tsx:240-255`
- Test: `src/lib/shipping.test.ts`

**Interfaces:**
- Consumes: `computeShipping`, `amountToFreePostage` from `src/lib/shipping.ts`.
- Produces: `computeBasketDelivery(items, postcode): { cost: number; free: boolean; reason: ShippingReason; amountToFreePostage: number }`. `DeliveryParcel` and `BasketDelivery.parcels` are gone.

- [ ] **Step 1: Write the failing test**

Replace the `computeBasketDelivery` describe block in `src/lib/shipping.test.ts` with:

```ts
describe("computeBasketDelivery", () => {
  const item = (price: number, qty = 1) => ({
    product: { slug: "chicken-feet", name: "Chicken Feet", price },
    qty,
  });

  it("is free to a local postcode whatever the subtotal", () => {
    const d = computeBasketDelivery([item(6)], "DD3 8QW");
    expect(d.cost).toBe(0);
    expect(d.free).toBe(true);
    expect(d.reason).toBe("local");
  });

  it("charges the flat rate elsewhere under the threshold", () => {
    const d = computeBasketDelivery([item(6)], "EH1 1AA");
    expect(d.cost).toBe(3.95);
    expect(d.free).toBe(false);
  });

  it("is free over the threshold", () => {
    const d = computeBasketDelivery([item(20, 2)], "EH1 1AA");
    expect(d.cost).toBe(0);
    expect(d.reason).toBe("threshold");
  });

  it("reports what is left to spend for free postage", () => {
    expect(computeBasketDelivery([item(30)], "EH1 1AA").amountToFreePostage).toBe(5);
  });

  it("charges nothing for an empty basket", () => {
    const d = computeBasketDelivery([], "EH1 1AA");
    expect(d.cost).toBe(0);
    expect(d.amountToFreePostage).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/shipping.test.ts`
Expected: FAIL, `cost` does not exist on the returned type.

- [ ] **Step 3: Collapse the shape**

In `src/lib/shipping.ts`, delete the `DeliveryParcel` interface, and replace `BasketDelivery` and `computeBasketDelivery` with:

```ts
export interface BasketDelivery {
  cost: number;
  free: boolean;
  reason: ShippingReason;
  amountToFreePostage: number;
}

/**
 * Postage for a whole basket. One parcel, always, since everything posts from
 * Michaela's own shelf. This used to split a basket into several parcels with
 * their own postage, which was the supplier posted path and is gone.
 */
export function computeBasketDelivery(
  items: { product: DeliveryProduct; qty: number }[],
  postcode: string,
): BasketDelivery {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  if (items.length === 0) {
    return { cost: 0, free: true, reason: "threshold", amountToFreePostage: 0 };
  }
  const shipping = computeShipping(postcode, subtotal);
  return { ...shipping, amountToFreePostage: amountToFreePostage(postcode, subtotal) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/shipping.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the two consumers**

In `src/app/api/checkout/route.ts`, replace the delivery line's label expression (the `delivery.parcels.length > 1 ? ... : ...` ternary around line 281) with the plain string `"Delivery"`, use `delivery.cost` wherever the total was summed from parcels, and delete the `deliveryBreakdown` and `parcelCount` metadata entries.

In `src/components/BasketDrawer.tsx`, replace the `deliveryPlan.parcels.map(...)` block and the `deliveryPlan.parcels.length > 1 && ...` notice with a single line rendering `deliveryPlan.cost` (free shows as "Free"), keeping the existing `amountToFreePostage` prompt exactly as it is.

- [ ] **Step 6: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 7: Verify by eye**

Run: `npm run dev`. Add a treat to the basket, open the drawer, enter `DD3 8QW` and then `EH1 1AA`. Expected: free, then GBP 3.95, and one delivery line either way.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shipping.ts src/lib/shipping.test.ts src/app/api/checkout/route.ts src/components/BasketDrawer.tsx
git commit -m "refactor: one basket, one parcel, one postage line"
```

---

### Task 11: `wasPrice`

Stored and validated here. Rendering lands in Phase 3 with the boxes, which are the first products that need it.

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/product-admin.ts`
- Modify: `src/lib/products-store.ts`
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[slug]/route.ts`
- Test: `src/lib/product-admin.test.ts`

**Interfaces:**
- Consumes: `validateProductInput` from Task 2.
- Produces: `wasPrice?: number` on `Product`, `ProductInput` and `StoredProduct`, carried through `toCatalogue`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/product-admin.test.ts`:

```ts
describe("validateProductInput wasPrice", () => {
  it("accepts a was price above the real price", () => {
    const res = validateProductInput(validInput({ price: 15, wasPrice: 24 }), ALL_BADGES);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.wasPrice).toBe(24);
  });

  it("treats a blank was price as no sale", () => {
    const res = validateProductInput(validInput({ price: 15, wasPrice: "" }), ALL_BADGES);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.wasPrice).toBeUndefined();
  });

  it("rejects a was price at or below the real price", () => {
    const res = validateProductInput(validInput({ price: 15, wasPrice: 15 }), ALL_BADGES);
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.errors).toContain("The was price has to be higher than the price you are charging.");
  });

  it("rejects a was price that is not a number", () => {
    expect(validateProductInput(validInput({ price: 15, wasPrice: "lots" }), ALL_BADGES).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: FAIL, `wasPrice` is not on `ProductInput`.

- [ ] **Step 3: Add the field**

In `src/data/products.ts`, add to `Product` directly below `price`:

```ts
  /** GBP. The price shown struck through beside the real price. Absent means no sale. */
  wasPrice?: number;
```

In `src/lib/product-admin.ts`, add `wasPrice?: number;` to `ProductInput` below `price`, and after the existing price validation add:

```ts
  // Blank means no sale, which is the common case, so an empty box is valid.
  // A was price at or below the real price is not a sale, it is a mistake that
  // would render as a strike through the same number.
  let wasPrice: number | undefined;
  const rawWas = input.wasPrice;
  if (!(rawWas === undefined || rawWas === null || String(rawWas).trim() === "")) {
    const n = Number(rawWas);
    if (!(Number.isFinite(n) && n > 0)) {
      errors.push("The was price must be a number, or left blank.");
    } else if (!(n > price)) {
      errors.push("The was price has to be higher than the price you are charging.");
    } else {
      wasPrice = n;
    }
  }
```

Add `wasPrice,` to the returned value.

In `src/lib/products-store.ts`, add `wasPrice: num(data.wasPrice),` to `docToStoredProduct`'s returned object below `price`, and `wasPrice: sp.wasPrice,` to `toCatalogue` below `price`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the form field**

In `src/components/admin/ProductForm.tsx`, add beside the existing price state:

```tsx
  const [wasPrice, setWasPrice] = useState(
    initial?.wasPrice === undefined ? "" : String(initial.wasPrice),
  );
```

Add `wasPrice: wasPrice === "" ? undefined : Number(wasPrice),` to the payload, and directly after the Price `<label>` add:

```tsx
        <label>
          <span>Was price (optional)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={wasPrice}
            onChange={(e) => setWasPrice(e.target.value)}
          />
          <small>
            Leave blank unless this is on sale. Shown struck through beside the real price.
            It has to be a price you genuinely charged.
          </small>
        </label>
```

- [ ] **Step 6: Persist it**

In both `src/app/api/admin/products/route.ts` and `src/app/api/admin/products/[slug]/route.ts`, write `wasPrice` alongside `price`. In `[slug]/route.ts` follow the existing pattern for optional fields so clearing the box removes it:

```ts
        ...(next.wasPrice !== undefined
          ? { wasPrice: next.wasPrice }
          : { wasPrice: FieldValue.delete() }),
```

- [ ] **Step 7: Run the suite and the build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat: wasPrice on a product, stored and validated"
```

---

### Task 12: Verify and migrate the live data

**Files:**
- Modify: `docs/specs/2026-08-25-shop-taxonomy-foundations-design.md` (record the migration output)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Confirm nothing retired is left**

Run: `grep -rn "supplierPostage\|supplierArrival\|leadTime\|FulfilmentPath" src`
Expected: no matches at all.

Run: `grep -rn "fulfilment" src`
Expected: matches only in comments where the word means getting a parcel out of the door: `src/lib/sheet.ts`, `src/lib/order-earn.ts`, `src/lib/auth.ts`, `src/data/customers.ts`, `src/app/api/webhooks/stripe/route.ts`.

Run: `grep -rn "pillar\|Pillar" src`
Expected: matches only in `src/lib/welcome-emails.ts`, `src/lib/subscribers.ts` and their tests, per spec section 5.

- [ ] **Step 2: Confirm no other company is named**

Run: `grep -rni "pedigree\|bakers\|dentastix\|markies\|jumbone\|purina\|wagg" src`
Expected: matches only in `src/app/page.tsx`, which Phase 2 rewrites. Record the count. If anything appears in a file this phase created, remove it now.

- [ ] **Step 3: Full green**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: clean.

Run: `npx eslint .`
Expected: clean.

- [ ] **Step 4: Dry run the migration again**

Run: `node scripts/backfill-product-categories.mjs`
Expected: a "would patch" line per product and a summary. Read every line. If a product would be archived, confirm with Liam before applying.

- [ ] **Step 5: Apply it**

Run: `node scripts/backfill-product-categories.mjs --apply`
Expected: the same lines, written. Save the output.

- [ ] **Step 6: Verify against the live data**

Run: `npm run dev` and check `/shop/treats` shows nine products, `/shop/boxes` shows the mystery box, `/shop/toys` shows the empty shelf notice, and `/shop/pick-and-mix` draws a bundle.

- [ ] **Step 7: Record the migration in the spec**

Append to section 8 of `docs/specs/2026-08-25-shop-taxonomy-foundations-design.md`:

```markdown
**Run on 2026-XX-XX.** N products read, N categorised, N archived. Output kept in the
commit message for this change.
```

Replace the date and the three counts with the real ones from Step 5.

- [ ] **Step 8: Commit**

```bash
git add docs/specs/2026-08-25-shop-taxonomy-foundations-design.md
git commit -m "docs: category migration run against live Firestore"
```

- [ ] **Step 9: Check the spec's done-means list**

Open section 12 of the spec and confirm all eight items. Item 8, buying one product end to end, needs a real Stripe test order at the right postage. Do that before this branch merges.
