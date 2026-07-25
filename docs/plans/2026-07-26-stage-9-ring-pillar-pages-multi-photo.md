# Stage 9: The Ring, Four Pillar Pages, Flat Shop, and Several Photos per Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build steps B.1 and B.5 of the v1 launch spec: the pillar ring as the home page's primary navigation, four indexable pillar pages that teach before they sell, a flat `/shop` page, and an ordered list of photos per product with one marked primary.

**Architecture:** B.5 first, because it changes the product data shape that every B.1 page renders. `Product` gains a required `images: ProductImage[]` list while keeping `image: string` as the derived primary URL, so every existing consumer (Stripe sync, basket drawer, legacy Firestore readers) keeps working while the card, the admin form and the migration move to the list. All list logic (normalisation, reorder, primary selection, gallery cycling) lives in a new pure module `src/lib/product-images.ts`, mirroring `product-fields.ts`. B.1 then adds a `RingHero` component mounted from `page.tsx` with one line (to minimise merge conflicts with the parallel email-capture track), four static pillar routes whose slugs are the `Pillar` ids themselves, a shared `PillarProducts` grid, and a `/shop` page.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, Firebase Admin (Firestore), Stripe, Vitest 4 (node environment).

## Global Constraints

- British spelling throughout. **No em dashes anywhere**: not in code, comments, copy, or commit messages.
- Every teaching claim on a pillar page is honesty-checked against `docs/research-dossier.md`. Where the dossier has nothing (walks, games, sleep), claims stay practical and observational: no statistics, no medical claims, no invented multipliers, no efficacy claims for calming products.
- The tile and the ring never carry the challenge; the page teaches (spec section 2.2).
- No page per SKU (spec section 3.1). Do not add `src/app/products/[slug]`.
- The primary image is what Stripe receives, and what the basket drawer and any fulfilment surface use.
- One wrapping rule for all four ring labels: a single line, never wrapped, sized so "Fun & Games" fits.
- This is not the Next.js in the training data (see `AGENTS.md`). The `export const metadata` and `export const dynamic = "force-dynamic"` patterns used below are confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` and the existing pages in this repo.
- Tests are Vitest, node environment, run with `npm test` or `npx vitest run <path>`. Baseline is 143 passing.
- Lint must stay at exactly 3 pre-existing errors (CartProvider.tsx, thank-you/page.tsx). New `<img>` tags carry the same `eslint-disable-next-line @next/next/no-img-element` comment the existing ones do.
- Commit after every task, lower-case descriptive style matching `git log`, body ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do not push, do not merge, do not touch `HANDOVER.md`.
- There is no `.env.local` here. Never run anything against live Firestore or Stripe; the migration script is built and unit-tested only.

## Decisions taken (recorded for the report)

1. **Slugs are the pillar ids:** `/good-food`, `/comfy-walks`, `/fun-and-games`, `/cosy-sleep`. They are already URL-safe, already the admin's stored values, and using them means no slug-to-pillar mapping table can drift.
2. **Image shape:** `Product.images: ProductImage[]` where `ProductImage = { url: string; primary: boolean }`, exactly one primary after normalisation (first marked wins, else the first image). `Product.image: string` stays on the type as the **derived** primary URL, kept because Stripe, the basket, older Firestore readers and the deployed site all read it; every write path derives it from `images`, so it cannot drift. Firestore docs get both fields; reads tolerate docs that only carry the legacy `image` string (same pattern as `docToStoredProduct` defaulting the A.1 fields).
3. **Ring placement:** a new full-width black band at the very top of the home page (hero copy from spec section 2, then the ring, then the four pillar lines). The existing "You've been lied to" hero and all long-form sections stay below it unchanged, except its `<h1>` is demoted to `<h2>` so the page keeps a single h1.
4. **Ring photos are placeholders.** Only product shots exist in `public/`; there are no walk, play or sleep photographs. Chosen per pillar for the least-wrong visual: Good Food = whole-sprats, Comfy Walks = duck-wings, Fun & Games = chicken-feet, Cosy Sleep = rabbit-ears. Michaela should swap the last three when she has real photos; the mapping is one record in `src/lib/pillars.ts`.
5. **Wrapping rule:** all four labels render on one line (`white-space: nowrap`), font size clamped so "Fun & Games" fits the wedge. Same rule on desktop wedges and mobile circles.
6. **Empty pillar shelves:** three of the four pillars have no products yet. Their pages render the teaching plus an honest "this shelf is being stocked" note linking to the shop, rather than a bare grid.
7. **Public pages show the public catalogue** (`getPublicProducts`), matching the home page: members-only drops stay invisible outside the members area.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/product-images.ts` (create) | Pure image-list logic: normalise, primary URL, set primary, move, remove, gallery cycling |
| `src/lib/product-images.test.ts` (create) | Tests for the above |
| `src/data/products.ts` (modify) | `ProductImage` type, `images` on `Product`, seed derives `images` from each `image` |
| `src/lib/products-store.ts` (modify) | `docToStoredProduct` normalises `images` tolerating legacy docs; `toCatalogue` passes it through |
| `src/lib/product-admin.ts` (modify) | Validate an incoming image list (or legacy single image), derive the primary `image` |
| `src/app/api/admin/products/route.ts`, `.../[slug]/route.ts`, `src/app/api/dev/seed-products/route.ts` (modify) | Persist `images` alongside the derived `image` |
| `src/lib/stripe-sync.ts` (modify) | Stripe receives the primary image explicitly |
| `src/components/ProductCard.tsx` (modify) | Gallery: primary by default, prev/next and dots when several |
| `src/components/admin/ProductForm.tsx` (modify) | Upload several, reorder, delete, set primary |
| `scripts/backfill-product-images.mjs` (create) | Fold the single `image` field into `images`. Dry-run default, `--apply`, idempotent |
| `scripts/backfill-product-images.test.mjs` (create) | Tests for the exported transform |
| `src/lib/pillars.ts` (create) | `filterByPillar`, ring photo map, pillar page metadata copy |
| `src/lib/pillars.test.ts` (create) | Tests for the above |
| `src/components/Ring.tsx` (create) | `RingHero`: hero copy, the ring (desktop wedges, mobile two-by-two), the four lines |
| `src/components/PillarProducts.tsx` (create) | Shared server component: a pillar's product grid or its empty-shelf note |
| `src/app/good-food/page.tsx`, `src/app/comfy-walks/page.tsx`, `src/app/fun-and-games/page.tsx`, `src/app/cosy-sleep/page.tsx` (create) | Teaching first, then `PillarProducts`, with real metadata |
| `src/app/shop/page.tsx` (create) | Flat grid of everything |
| `src/app/page.tsx` (modify) | Mount `RingHero` at the top, demote old hero h1 |
| `src/components/Header.tsx` (modify) | Nav row reaching the four pillars and the shop |
| `src/app/globals.css` (modify, append only) | Ring, gallery, header nav and pillar page styles |

---

### Task 1: The pure image-list module

**Files:**
- Create: `src/lib/product-images.ts`
- Test: `src/lib/product-images.test.ts`

**Interfaces:**
- Produces: `type ProductImage = { url: string; primary: boolean }`; `normaliseImages(images: unknown, legacyImage?: unknown): ProductImage[]`; `primaryImageUrl(images: ProductImage[]): string`; `setPrimary(images, index): ProductImage[]`; `moveImage(images, from, to): ProductImage[]`; `removeImage(images, index): ProductImage[]`; `cycleIndex(current: number, delta: number, length: number): number`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/product-images.test.ts
import { describe, it, expect } from "vitest";
import {
  normaliseImages,
  primaryImageUrl,
  setPrimary,
  moveImage,
  removeImage,
  cycleIndex,
} from "@/lib/product-images";

describe("normaliseImages", () => {
  it("folds a legacy single image into a one-entry primary list", () => {
    expect(normaliseImages(undefined, "/products/a.png")).toEqual([
      { url: "/products/a.png", primary: true },
    ]);
  });

  it("returns an empty list when nothing is known", () => {
    expect(normaliseImages(undefined, undefined)).toEqual([]);
    expect(normaliseImages([], "")).toEqual([]);
    expect(normaliseImages("nonsense", 42)).toEqual([]);
  });

  it("marks the first image primary when none is marked", () => {
    expect(normaliseImages([{ url: "/a.png" }, { url: "/b.png" }])).toEqual([
      { url: "/a.png", primary: true },
      { url: "/b.png", primary: false },
    ]);
  });

  it("keeps the first marked primary and demotes any others", () => {
    expect(
      normaliseImages([
        { url: "/a.png" },
        { url: "/b.png", primary: true },
        { url: "/c.png", primary: true },
      ]),
    ).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
      { url: "/c.png", primary: false },
    ]);
  });

  it("tolerates plain string entries and drops junk", () => {
    expect(normaliseImages(["/a.png", { url: "  " }, null, { url: "/b.png" }])).toEqual([
      { url: "/a.png", primary: true },
      { url: "/b.png", primary: false },
    ]);
  });

  it("prefers the list over the legacy string when both exist", () => {
    expect(normaliseImages([{ url: "/new.png" }], "/old.png")).toEqual([
      { url: "/new.png", primary: true },
    ]);
  });
});

describe("primaryImageUrl", () => {
  it("returns the primary's url", () => {
    expect(
      primaryImageUrl([
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
      ]),
    ).toBe("/b.png");
  });

  it("falls back to the first image, then to an empty string", () => {
    expect(primaryImageUrl([{ url: "/a.png", primary: false }])).toBe("/a.png");
    expect(primaryImageUrl([])).toBe("");
  });
});

describe("setPrimary", () => {
  it("moves the primary flag to the given index", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(setPrimary(imgs, 1)).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
    ]);
  });

  it("ignores an out-of-range index", () => {
    const imgs = normaliseImages(["/a.png"]);
    expect(setPrimary(imgs, 5)).toEqual(imgs);
  });
});

describe("moveImage", () => {
  it("reorders without losing the primary flag", () => {
    const imgs = normaliseImages(["/a.png", "/b.png", "/c.png"]);
    expect(moveImage(imgs, 0, 2)).toEqual([
      { url: "/b.png", primary: false },
      { url: "/c.png", primary: false },
      { url: "/a.png", primary: true },
    ]);
  });

  it("ignores an out-of-range move", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(moveImage(imgs, 0, 9)).toEqual(imgs);
    expect(moveImage(imgs, -1, 1)).toEqual(imgs);
  });
});

describe("removeImage", () => {
  it("promotes the first remaining image when the primary is removed", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(removeImage(imgs, 0)).toEqual([{ url: "/b.png", primary: true }]);
  });

  it("keeps the primary when another image is removed", () => {
    const imgs = setPrimary(normaliseImages(["/a.png", "/b.png", "/c.png"]), 2);
    expect(removeImage(imgs, 0)).toEqual([
      { url: "/b.png", primary: false },
      { url: "/c.png", primary: true },
    ]);
  });

  it("returns an empty list when the last image is removed", () => {
    expect(removeImage(normaliseImages(["/a.png"]), 0)).toEqual([]);
  });
});

describe("cycleIndex", () => {
  it("wraps in both directions", () => {
    expect(cycleIndex(0, 1, 3)).toBe(1);
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(cycleIndex(0, -1, 3)).toBe(2);
  });

  it("stays at zero for a single image", () => {
    expect(cycleIndex(0, 1, 1)).toBe(0);
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/product-images.test.ts`
Expected: FAIL, cannot resolve `@/lib/product-images`.

- [ ] **Step 3: Implement**

```ts
// src/lib/product-images.ts
// Pure image-list logic for a product's photos. No Firestore, no React, so this
// module is trivially unit-testable (mirrors product-fields.ts).

/** One photo of a product. Exactly one entry in a normalised list is primary. */
export type ProductImage = { url: string; primary: boolean };

/**
 * Canonicalise whatever a Firestore doc, an admin payload or the seed carries
 * into an ordered list with exactly one primary.
 *
 * Tolerated inputs: a proper list of { url, primary? }, a list of plain strings,
 * or nothing at all plus the legacy single `image` string. The first entry marked
 * primary wins; if none is marked, the first image is primary. Junk entries are
 * dropped rather than thrown, because a half-broken doc must not hide a product.
 */
export function normaliseImages(images: unknown, legacyImage?: unknown): ProductImage[] {
  const cleaned: { url: string; primary: boolean }[] = [];
  if (Array.isArray(images)) {
    for (const entry of images) {
      const url =
        typeof entry === "string"
          ? entry.trim()
          : entry && typeof (entry as { url?: unknown }).url === "string"
            ? ((entry as { url: string }).url ?? "").trim()
            : "";
      if (!url) continue;
      const primary = (entry as { primary?: unknown })?.primary === true;
      cleaned.push({ url, primary });
    }
  }
  if (cleaned.length === 0) {
    const legacy = typeof legacyImage === "string" ? legacyImage.trim() : "";
    if (!legacy) return [];
    return [{ url: legacy, primary: true }];
  }
  const first = cleaned.findIndex((i) => i.primary);
  const primaryAt = first === -1 ? 0 : first;
  return cleaned.map((i, n) => ({ url: i.url, primary: n === primaryAt }));
}

/** The primary image's URL: what Stripe, the basket and the fulfilment row use. */
export function primaryImageUrl(images: ProductImage[]): string {
  return images.find((i) => i.primary)?.url ?? images[0]?.url ?? "";
}

/** Mark the image at `index` primary. Out of range leaves the list untouched. */
export function setPrimary(images: ProductImage[], index: number): ProductImage[] {
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return images;
  return images.map((i, n) => ({ url: i.url, primary: n === index }));
}

/** Move an image from one position to another, keeping the primary flag with it. */
export function moveImage(images: ProductImage[], from: number, to: number): ProductImage[] {
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < images.length;
  if (!inRange(from) || !inRange(to)) return images;
  const next = images.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Remove the image at `index`. Removing the primary promotes the first remaining. */
export function removeImage(images: ProductImage[], index: number): ProductImage[] {
  if (!Number.isInteger(index) || index < 0 || index >= images.length) return images;
  return normaliseImages(images.filter((_, n) => n !== index));
}

/** Step a gallery index by `delta`, wrapping at both ends. */
export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 1) return 0;
  return (((current + delta) % length) + length) % length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/product-images.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-images.ts src/lib/product-images.test.ts
git commit -m "feat: pure image list logic, one primary among several photos"
```

---

### Task 2: The product type and the store learn about image lists

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/products-store.ts`
- Test: `src/lib/products-store.test.ts` (extend)

**Interfaces:**
- Consumes: `normaliseImages`, `primaryImageUrl`, `ProductImage` from Task 1.
- Produces: `Product.images: ProductImage[]` (required); `Product.image: string` stays, documented as the derived primary; `docToStoredProduct` and `toCatalogue` carry `images`.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/products-store.test.ts`)

```ts
import { seedAsStoredProducts } from "@/lib/products-store"; // extend existing imports as needed

describe("docToStoredProduct images", () => {
  it("folds a legacy doc's single image into the images list", () => {
    const sp = docToStoredProduct("x", { name: "X", price: 1, hook: "h", description: "d", image: "/x.png" });
    expect(sp.images).toEqual([{ url: "/x.png", primary: true }]);
    expect(sp.image).toBe("/x.png");
  });

  it("respects a stored images list and derives image from its primary", () => {
    const sp = docToStoredProduct("x", {
      name: "X", price: 1, hook: "h", description: "d",
      image: "/stale.png",
      images: [{ url: "/a.png" }, { url: "/b.png", primary: true }],
    });
    expect(sp.images).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
    ]);
    expect(sp.image).toBe("/b.png");
  });

  it("passes images through toCatalogue", () => {
    const sp = docToStoredProduct("x", { name: "X", price: 1, hook: "h", description: "d", image: "/x.png" });
    expect(toCatalogue(sp).images).toEqual([{ url: "/x.png", primary: true }]);
  });
});

describe("seed images", () => {
  it("gives every seed product a one-entry primary list matching its image", () => {
    for (const sp of seedAsStoredProducts()) {
      expect(sp.images).toEqual([{ url: sp.image, primary: true }]);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: FAIL, `images` undefined.

- [ ] **Step 3: Implement**

In `src/data/products.ts`:

```ts
import { primaryImageUrl, type ProductImage } from "@/lib/product-images";

export type { ProductImage };
```

On the `Product` interface, replace the `image` comment and add `images`:

```ts
  /**
   * The photos, in display order, exactly one marked primary. The primary is what
   * Stripe receives, what the basket shows, and what any fulfilment surface uses.
   */
  images: ProductImage[];
  /** Derived: the primary image's URL. Kept because Stripe sync, the basket and
   *  legacy Firestore readers all read a single string. Never set independently. */
  image: string; // path under /public
```

The nine seed literals keep their single `image` line. At the bottom, derive the list once
(the literals are typed without `images`, then mapped):

```ts
type SeedProduct = Omit<Product, "images">;

const seedProducts: SeedProduct[] = [ /* the existing nine literals, unchanged */ ];

export const products: Product[] = seedProducts.map((p) => ({
  ...p,
  images: [{ url: p.image, primary: true }],
}));
```

In `src/lib/products-store.ts`, import and use the normaliser in `docToStoredProduct`:

```ts
import { normaliseImages, primaryImageUrl } from "@/lib/product-images";

  const images = normaliseImages(data.images, data.image);
  // then in the returned object, replacing the old image line:
    images,
    image: primaryImageUrl(images),
```

And `toCatalogue` gains `images: sp.images,`.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass (the compiler is the check that no consumer broke; `image` still exists so none should).

- [ ] **Step 5: Commit**

```bash
git add src/data/products.ts src/lib/products-store.ts src/lib/products-store.test.ts
git commit -m "feat: products carry an ordered photo list, reads tolerate the legacy single image"
```

---

### Task 3: Admin validation and persistence of the image list

**Files:**
- Modify: `src/lib/product-admin.ts`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[slug]/route.ts`
- Modify: `src/app/api/dev/seed-products/route.ts`
- Test: `src/lib/product-admin.test.ts` (extend)

**Interfaces:**
- Consumes: `normaliseImages`, `primaryImageUrl` from Task 1.
- Produces: `ProductInput.images: ProductImage[]`; `validateProductInput` accepts `images` (list) or legacy `image` (string) and returns both `images` and the derived `image`.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/product-admin.test.ts`; the existing valid-input fixture keeps working because a legacy `image` string still validates)

```ts
describe("validateProductInput images", () => {
  const base = {
    name: "Test", price: 5, hook: "h", description: "d",
    badges: [], pillar: "good-food", leadTimeDays: 0, fulfilment: "own-stock",
  } as const;

  it("accepts an images list and derives the primary image", () => {
    const r = validateProductInput({
      ...base,
      images: [{ url: "/a.png" }, { url: "/b.png", primary: true }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.images).toEqual([
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
      ]);
      expect(r.value.image).toBe("/b.png");
    }
  });

  it("folds a legacy single image into the list", () => {
    const r = validateProductInput({ ...base, image: "/a.png" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.images).toEqual([{ url: "/a.png", primary: true }]);
  });

  it("rejects a product with no photos at all", () => {
    const r = validateProductInput({ ...base, images: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("At least one photo is required.");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/lib/product-admin.ts`:

```ts
import { normaliseImages, primaryImageUrl, type ProductImage } from "@/lib/product-images";
```

`ProductInput` gains `images: ProductImage[];` (keep `image: string;`). In `validateProductInput`, replace

```ts
  const image = String(input.image ?? "").trim();
  // ...
  if (!image) errors.push("An image is required.");
```

with

```ts
  const images = normaliseImages(input.images, input.image);
  const image = primaryImageUrl(images);
  // ...
  if (images.length === 0) errors.push("At least one photo is required.");
```

and add `images,` next to `image,` in the returned value. Update the existing test that
asserted the old "An image is required." message if one exists.

In both admin routes, next to the existing `image: draft.image,` / `image: next.image,`
Firestore writes, add `images: draft.images,` / `images: next.images,`.

In `src/app/api/dev/seed-products/route.ts`, next to `image: seedSp.image,` add
`images: seedSp.images,`.

- [ ] **Step 4: Run suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-admin.ts src/lib/product-admin.test.ts src/app/api/admin/products/route.ts "src/app/api/admin/products/[slug]/route.ts" src/app/api/dev/seed-products/route.ts
git commit -m "feat: the admin validates and persists the photo list, primary derived on the way in"
```

---

### Task 4: Stripe explicitly receives the primary image

**Files:**
- Modify: `src/lib/stripe-sync.ts`
- Test: `src/lib/stripe-sync.test.ts` (extend)

**Interfaces:**
- Consumes: `primaryImageUrl` from Task 1.

- [ ] **Step 1: Write the failing test** (append)

```ts
it("sends the primary image to Stripe, not the first", () => {
  const sp = {
    ...baseProduct, // reuse the existing fixture in this file
    image: "/products/chicken-feet.png",
    images: [
      { url: "/products/other.png", primary: false },
      { url: "/products/primary.png", primary: true },
    ],
  };
  const params = buildStripeProductParams(sp as StoredProduct, "https://example.com");
  expect(params.images).toEqual(["https://example.com/products/primary.png"]);
});
```

(Adapt the fixture name to what the file actually uses; it builds a full product literal near the top.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/stripe-sync.test.ts`
Expected: FAIL (it currently uses `sp.image`, which the fixture leaves pointing elsewhere).

- [ ] **Step 3: Implement**

In `buildStripeProductParams`:

```ts
import { primaryImageUrl } from "@/lib/product-images";

  const img = absoluteImage(primaryImageUrl(sp.images) || sp.image, siteUrl);
```

The `|| sp.image` fallback keeps a doc that somehow lost its list from losing its Stripe image too.

- [ ] **Step 4: Run suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-sync.ts src/lib/stripe-sync.test.ts
git commit -m "feat: stripe receives the primary photo, whichever position it holds"
```

---

### Task 5: The product card becomes a gallery

**Files:**
- Modify: `src/components/ProductCard.tsx`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: `cycleIndex`, `primaryImageUrl` from Task 1; `product.images` from Task 2.

No unit test: the cycling arithmetic was tested in Task 1 and the vitest environment is node-only. The compiler and lint are the checks here.

- [ ] **Step 1: Implement the card**

Replace the single `<img>` in `ProductCard` with a gallery. The card is already a client component:

```tsx
import { useState } from "react";
import { cycleIndex } from "@/lib/product-images";

  // inside the component:
  const images = product.images.length
    ? product.images
    : [{ url: product.image, primary: true }];
  const [shown, setShown] = useState(() =>
    Math.max(0, images.findIndex((i) => i.primary)),
  );
```

and in the media div, after the badges:

```tsx
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[shown]?.url ?? product.image} alt={product.name} loading="lazy" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="card__navbtn card__navbtn--prev"
              aria-label="Previous photo"
              onClick={() => setShown((n) => cycleIndex(n, -1, images.length))}
            >
              &#8249;
            </button>
            <button
              type="button"
              className="card__navbtn card__navbtn--next"
              aria-label="Next photo"
              onClick={() => setShown((n) => cycleIndex(n, 1, images.length))}
            >
              &#8250;
            </button>
            <div className="card__dots" aria-hidden="true">
              {images.map((img, n) => (
                <span key={img.url} className={`card__dot${n === shown ? " card__dot--on" : ""}`} />
              ))}
            </div>
          </>
        )}
```

- [ ] **Step 2: Append the styles to globals.css**

```css
/* ---------- Product card gallery (B.5) ---------- */
.card__navbtn { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.92); color: var(--ink); font-size: 1.1rem; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.14s ease; }
.card__navbtn--prev { left: 0.6rem; }
.card__navbtn--next { right: 0.6rem; }
.card__media:hover .card__navbtn, .card__navbtn:focus-visible { opacity: 1; }
@media (hover: none) { .card__navbtn { opacity: 0.85; } }
.card__dots { position: absolute; bottom: 0.55rem; left: 0; right: 0; display: flex; justify-content: center; gap: 0.35rem; z-index: 2; }
.card__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--ink); opacity: 0.22; }
.card__dot--on { opacity: 0.9; }
```

- [ ] **Step 3: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, tsc clean, lint still exactly 3 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCard.tsx src/app/globals.css
git commit -m "feat: the product card cycles through its photos, primary first"
```

---

### Task 6: The admin form uploads several, reorders, deletes, sets primary

**Files:**
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: `normaliseImages`, `setPrimary`, `moveImage`, `removeImage`, `ProductImage` from Task 1; the existing single-file upload endpoint `/api/admin/products/image` (called once per file).

- [ ] **Step 1: Implement the form changes**

Replace the `image` state with a list, keeping the existing upload endpoint and error handling:

```tsx
import { normaliseImages, setPrimary, moveImage, removeImage, type ProductImage } from "@/lib/product-images";

  const [images, setImages] = useState<ProductImage[]>(
    normaliseImages(initial?.images, initial?.image),
  );
```

`uploadImage` becomes `uploadImages`, looping the chosen files sequentially through the
same endpoint and appending each URL (first ever image becomes primary via normalise):

```tsx
  async function uploadImages(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/products/image", { method: "POST", body: fd });
        if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
          throw new Error("Non-JSON response (likely redirected to login).");
        }
        const data = await res.json();
        if (!data.ok) {
          setErrors([data.error || "Photo upload failed."]);
          return;
        }
        setImages((cur) => normaliseImages([...cur, { url: data.url as string }]));
      }
    } catch {
      setErrors(["Photo upload failed. You may need to sign in again."]);
    } finally {
      setUploading(false);
    }
  }
```

The submit payload sends `images` (drop the `image` key; the server derives it):

```tsx
      images,
```

The Photo panel becomes a Photos panel listing every image with its controls:

```tsx
      <div className="panel">
        <p className="panel__title">Photos</p>
        {images.length === 0 ? (
          <div className="photo-pick">
            <span className="photo-pick__empty" aria-hidden="true">
              <Paw size={34} />
            </span>
          </div>
        ) : (
          <ul className="photo-list">
            {images.map((img, n) => (
              <li key={img.url} className="photo-list__row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="photo-pick__preview" src={img.url} alt={`Photo ${n + 1}`} />
                <div className="photo-list__ctl">
                  {img.primary ? (
                    <span className="badge badge--star">Primary</span>
                  ) : (
                    <button type="button" className="chip" onClick={() => setImages(setPrimary(images, n))}>
                      Make primary
                    </button>
                  )}
                  <button
                    type="button" className="chip" aria-label={`Move photo ${n + 1} earlier`}
                    disabled={n === 0}
                    onClick={() => setImages(moveImage(images, n, n - 1))}
                  >
                    Up
                  </button>
                  <button
                    type="button" className="chip" aria-label={`Move photo ${n + 1} later`}
                    disabled={n === images.length - 1}
                    onClick={() => setImages(moveImage(images, n, n + 1))}
                  >
                    Down
                  </button>
                  <button type="button" className="chip" onClick={() => setImages(removeImage(images, n))}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: "0.9rem" }}>
          <label className="btn btn--solid-ink" style={{ cursor: "pointer" }}>
            {uploading ? "Uploading..." : images.length ? "Add more photos" : "Choose photos"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => e.target.files && uploadImages(e.target.files)}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          <span className="field__hint">
            At least one is required. The primary photo is the one Stripe and the basket show.
          </span>
        </div>
      </div>
```

The save button's guard changes from `!image` to `images.length === 0`:

```tsx
        <button className="btn btn--solid-ink btn--block" disabled={busy || images.length === 0} type="submit">
```

- [ ] **Step 2: Append the styles**

```css
/* ---------- Admin photo list (B.5) ---------- */
.photo-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.8rem; }
.photo-list__row { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
.photo-list__ctl { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.photo-list__ctl .chip:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
```

- [ ] **Step 3: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, tsc clean, lint at 3.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ProductForm.tsx src/app/globals.css
git commit -m "feat: the product form takes several photos, reorder, remove, and a chosen primary"
```

---

### Task 7: The migration script

**Files:**
- Create: `scripts/backfill-product-images.mjs`
- Test: `scripts/backfill-product-images.test.mjs`

**Interfaces:**
- Produces: exported `planImagePatch(data)` returning `{ images, image } | null`. `null` means nothing to write. The script never runs Firestore work on import (main is guarded), so the test can import it. Do NOT run the script against anything; there is no env here.

- [ ] **Step 1: Write the failing tests**

```js
// scripts/backfill-product-images.test.mjs
import { describe, it, expect } from "vitest";
import { planImagePatch } from "./backfill-product-images.mjs";

describe("planImagePatch", () => {
  it("folds a legacy single image into the list", () => {
    expect(planImagePatch({ image: "/a.png" })).toEqual({
      images: [{ url: "/a.png", primary: true }],
      image: "/a.png",
    });
  });

  it("is idempotent: an already-migrated doc plans no write", () => {
    const doc = { image: "/a.png", images: [{ url: "/a.png", primary: true }] };
    expect(planImagePatch(doc)).toBeNull();
  });

  it("repairs a list with no primary and realigns the derived image", () => {
    expect(
      planImagePatch({ image: "/stale.png", images: [{ url: "/a.png" }, { url: "/b.png" }] }),
    ).toEqual({
      images: [
        { url: "/a.png", primary: true },
        { url: "/b.png", primary: false },
      ],
      image: "/a.png",
    });
  });

  it("keeps the first marked primary and demotes the rest", () => {
    expect(
      planImagePatch({
        image: "/b.png",
        images: [
          { url: "/a.png", primary: false },
          { url: "/b.png", primary: true },
          { url: "/c.png", primary: true },
        ],
      }),
    ).toEqual({
      images: [
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
        { url: "/c.png", primary: false },
      ],
      image: "/b.png",
    });
  });

  it("plans nothing for a doc with no image data at all", () => {
    expect(planImagePatch({})).toBeNull();
    expect(planImagePatch({ image: "  " })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run scripts/backfill-product-images.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the script**

```js
// scripts/backfill-product-images.mjs
// One-off backfill for B.5: fold each product's single `image` string into the
// `images` list (ordered, one primary) and realign the derived `image` field.
// Idempotent: a doc already in shape plans no write. Mirrors backfill-product-fields.mjs.
//
// Dry run:  node scripts/backfill-product-images.mjs
// Apply:    node scripts/backfill-product-images.mjs --apply

import { pathToFileURL } from "node:url";

const COLLECTION = "store_products";

/**
 * Decide what, if anything, this doc needs written. Returns { images, image }
 * or null when the doc is already in shape (or has no image data to fold).
 * Kept pure and exported so scripts/backfill-product-images.test.mjs can test it
 * without Firestore. Mirrors normaliseImages in src/lib/product-images.ts, which
 * node cannot import from an .mjs script because it is TypeScript.
 */
export function planImagePatch(data) {
  const cleaned = [];
  if (Array.isArray(data.images)) {
    for (const entry of data.images) {
      const url =
        typeof entry === "string"
          ? entry.trim()
          : entry && typeof entry.url === "string"
            ? entry.url.trim()
            : "";
      if (!url) continue;
      cleaned.push({ url, primary: entry?.primary === true });
    }
  }
  let images = cleaned;
  if (images.length === 0) {
    const legacy = typeof data.image === "string" ? data.image.trim() : "";
    if (!legacy) return null;
    images = [{ url: legacy, primary: true }];
  }
  const first = images.findIndex((i) => i.primary);
  const primaryAt = first === -1 ? 0 : first;
  images = images.map((i, n) => ({ url: i.url, primary: n === primaryAt }));
  const image = images[primaryAt].url;

  const already =
    Array.isArray(data.images) &&
    data.images.length === images.length &&
    data.images.every(
      (e, n) => e && e.url === images[n].url && e.primary === images[n].primary,
    ) &&
    data.image === image;
  return already ? null : { images, image };
}

async function main() {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

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

  for (const doc of snap.docs) {
    const patch = planImagePatch(doc.data());
    if (!patch) continue;
    touched += 1;
    console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, JSON.stringify(patch));
    if (APPLY) await doc.ref.set(patch, { merge: true });
  }

  console.log(
    `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}.` +
      (APPLY ? "" : " Re-run with --apply to write."),
  );
  process.exit(0);
}

// Only run against Firestore when invoked directly, never on import (the tests import this).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 4: Run suite**

Run: `npm test`
Expected: PASS, including the new .mjs test file.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-product-images.mjs scripts/backfill-product-images.test.mjs
git commit -m "feat: a backfill folds the single image field into the photo list, dry run by default"
```

---

### Task 8: The pillars module

**Files:**
- Create: `src/lib/pillars.ts`
- Test: `src/lib/pillars.test.ts`

**Interfaces:**
- Consumes: `Pillar`, `ALL_PILLARS` from `@/data/products`.
- Produces: `filterByPillar<T extends { pillar: Pillar }>(items: T[], pillar: Pillar): T[]`; `RING_PHOTOS: Record<Pillar, string>`; `PILLAR_META: Record<Pillar, { title: string; description: string }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/pillars.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_PILLARS } from "@/data/products";
import { filterByPillar, RING_PHOTOS, PILLAR_META } from "@/lib/pillars";

describe("filterByPillar", () => {
  const items = [
    { slug: "a", pillar: "good-food" },
    { slug: "b", pillar: "cosy-sleep" },
    { slug: "c", pillar: "good-food" },
  ] as const;

  it("keeps only the pillar's products, in order", () => {
    expect(filterByPillar([...items], "good-food").map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("returns an empty list for an unstocked pillar", () => {
    expect(filterByPillar([...items], "comfy-walks")).toEqual([]);
  });
});

describe("RING_PHOTOS", () => {
  it("names an existing file under public/ for every pillar", () => {
    for (const pillar of ALL_PILLARS) {
      const rel = RING_PHOTOS[pillar];
      expect(rel.startsWith("/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", rel))).toBe(true);
    }
  });
});

describe("PILLAR_META", () => {
  it("gives every pillar a title and description, with no em dashes", () => {
    for (const pillar of ALL_PILLARS) {
      const meta = PILLAR_META[pillar];
      expect(meta.title.length).toBeGreaterThan(10);
      expect(meta.description.length).toBeGreaterThan(50);
      expect(meta.title).not.toMatch(/—/);
      expect(meta.description).not.toMatch(/—/);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/pillars.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/pillars.ts
// The four pillar pages' shared data: which products belong to a page, which
// photo fills each ring wedge, and each page's search metadata. Pure, so the
// filter and the photo paths are unit-testable (mirrors product-fields.ts).

import type { Pillar } from "@/data/products";

/** The products that belong on a pillar page, in catalogue order. */
export function filterByPillar<T extends { pillar: Pillar }>(items: T[], pillar: Pillar): T[] {
  return items.filter((p) => p.pillar === pillar);
}

/**
 * The photo behind each ring wedge. PLACEHOLDERS: only product shots exist in
 * public/, and there are no walk, play or sleep photographs yet, so the last
 * three are the least-wrong stand-ins. Michaela swaps these here, one line each.
 */
export const RING_PHOTOS: Record<Pillar, string> = {
  "good-food": "/products/whole-sprats.png",
  "comfy-walks": "/products/duck-wings.png",
  "fun-and-games": "/products/chicken-feet.png",
  "cosy-sleep": "/products/rabbit-ears.png",
};

/**
 * Search metadata for the four pillar pages, the only indexable content pages
 * on the site (spec section 3). Written to earn the click, not to challenge:
 * the ad challenges, the tile confirms, the page teaches (section 2.2).
 */
export const PILLAR_META: Record<Pillar, { title: string; description: string }> = {
  "good-food": {
    title: "Good Food for Dogs | Barking Raw",
    description:
      "What goes in shows up in everything else. How to read a UK dog treat label, what the law lets brands hide, and honest single-ingredient treats named in full.",
  },
  "comfy-walks": {
    title: "Comfy Walks | Barking Raw",
    description:
      "A dog that's choking on a collar isn't enjoying the walk. How a well fitted harness changes the walk, what to check before you clip on, and the kit worth carrying.",
  },
  "fun-and-games": {
    title: "Fun & Games for Dogs | Barking Raw",
    description:
      "A bored dog will find his own fun, and you won't like it. Why every dog needs a job, and how snuffle mats, lickimats and scentwork give them one.",
  },
  "cosy-sleep": {
    title: "Cosy Sleep for Dogs | Barking Raw",
    description:
      "An overtired dog can't think straight. Why proper rest sits underneath every other pillar, and how to give your dog a spot that's genuinely theirs.",
  },
};
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/pillars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pillars.ts src/lib/pillars.test.ts
git commit -m "feat: the pillar filter, the ring photo map, and the four pages' metadata"
```

---

### Task 9: The ring, and its place at the top of the home page

**Files:**
- Create: `src/components/Ring.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: `ALL_PILLARS`, `PILLAR_LABELS`, `PILLAR_LINES` from `@/data/products`; `RING_PHOTOS` from Task 8.
- Produces: `RingHero` server component, mounted from `page.tsx` with a single line (own file, to keep the parallel email-capture track's home page edits conflict-free).

No unit test: markup and CSS. The compiler, lint, and the pillar photo existence test from Task 8 are the checks.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/Ring.tsx
import Link from "next/link";
import { ALL_PILLARS, PILLAR_LABELS, PILLAR_LINES } from "@/data/products";
import { RING_PHOTOS } from "@/lib/pillars";

/**
 * The ring: the home page's primary navigation (spec section 3.2). Desktop is one
 * circle in four photo wedges around a logo hub; mobile is a two by two grid of
 * circular tiles. Both are this one markup, switched in CSS, so they cannot drift.
 * The tiles stay plain and unprovocative: the ad challenges, the page teaches.
 */
export function RingHero() {
  return (
    <section className="band ring-hero" style={{ background: "#000", color: "#fff" }}>
      <div className="wrap">
        <div className="ring-hero__copy">
          <h1 className="display">Get these four right and your dog will lap up training.</h1>
          <p className="hero__sub">
            Most people start with training. That&apos;s the last bit, not the first.
          </p>
        </div>
        <div className="ring">
          {ALL_PILLARS.map((pillar) => (
            <Link
              key={pillar}
              href={`/${pillar}`}
              className={`ring__wedge ring__wedge--${pillar}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={RING_PHOTOS[pillar]} alt="" />
              <span className="ring__label">{PILLAR_LABELS[pillar]}</span>
            </Link>
          ))}
          <span className="ring__hub" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpeg" alt="" />
          </span>
        </div>
        <div className="pillar-lines">
          {ALL_PILLARS.map((pillar) => (
            <div className="pillar-lines__item" key={pillar}>
              <b>{PILLAR_LABELS[pillar]}</b>
              <p>{PILLAR_LINES[pillar]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount it and demote the old hero heading**

In `src/app/page.tsx`: add `import { RingHero } from "@/components/Ring";` and `<RingHero />`
as the first child of `<main>`. In the old hero section, change `<h1 className="display">You've been lied to.</h1>`
to `<h2 className="display">You've been lied to.</h2>` so the page keeps one h1 (the ring hero's).

- [ ] **Step 3: Append the styles**

Mobile-first: the grid of circles is the default, the pie takes over at 720px.

```css
/* ---------- The ring (B.1) ---------- */
.ring-hero__copy { text-align: center; max-width: 60ch; margin: 0 auto 2.6rem; }
.ring-hero__copy h1 { font-size: clamp(2rem, 1.3rem + 3.4vw, 4rem); margin-bottom: 1rem; }
.ring-hero__copy .hero__sub { margin: 0 auto; }

/* Mobile and up: a two by two grid of circular tiles. */
.ring { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; max-width: 420px; margin: 0 auto; }
.ring__wedge { position: relative; display: block; aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: #111; }
.ring__wedge img { width: 100%; height: 100%; object-fit: cover; }
/* A quiet scrim so the label reads over any photo. */
.ring__wedge::after { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,0.38); transition: background 0.15s ease; }
.ring__wedge:hover::after, .ring__wedge:focus-visible::after { background: rgba(0,0,0,0.2); }
/* One wrapping rule for all four labels: a single line, sized to fit Fun & Games. */
.ring__label { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; color: #fff; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: clamp(0.78rem, 0.5rem + 1.3vw, 1.15rem); white-space: nowrap; text-shadow: 0 1px 8px rgba(0,0,0,0.55); }
.ring__hub { display: none; }

/* Desktop: one circle in four photo wedges around a logo hub. */
@media (min-width: 720px) {
  .ring { display: block; position: relative; width: min(520px, 60vw); max-width: none; aspect-ratio: 1; border-radius: 50%; overflow: hidden; border: 4px solid rgba(255,255,255,0.14); }
  .ring__wedge { position: absolute; width: 50%; height: 50%; border-radius: 0; }
  .ring__wedge--good-food { top: 0; left: 0; }
  .ring__wedge--comfy-walks { top: 0; right: 0; }
  .ring__wedge--fun-and-games { bottom: 0; left: 0; }
  .ring__wedge--cosy-sleep { bottom: 0; right: 0; }
  /* Push each label out of the hub's way, toward its wedge's outer half. */
  .ring__wedge--good-food .ring__label,
  .ring__wedge--comfy-walks .ring__label { top: 42%; }
  .ring__wedge--fun-and-games .ring__label,
  .ring__wedge--cosy-sleep .ring__label { top: 58%; }
  .ring__hub { display: flex; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 34%; aspect-ratio: 1; border-radius: 50%; background: #000; border: 4px solid rgba(255,255,255,0.14); z-index: 3; align-items: center; justify-content: center; overflow: hidden; }
  .ring__hub img { width: 78%; height: 78%; object-fit: contain; }
}

/* The four lines beneath the ring (spec section 2). */
.pillar-lines { display: grid; gap: 1.2rem; grid-template-columns: 1fr; margin-top: 2.6rem; }
@media (min-width: 720px) { .pillar-lines { grid-template-columns: repeat(4, 1fr); } }
.pillar-lines__item b { display: block; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.85rem; margin-bottom: 0.3rem; }
.pillar-lines__item p { color: rgba(255,255,255,0.72); font-size: 0.92rem; }
```

Note the desktop `.ring` uses `display: block`; the wedges position absolutely inside it.
Centre it: add `margin: 0 auto;` inside the desktop block too (the mobile rule's margin
is overridden by the media query redefinition, so restate it).

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, tsc clean, lint at 3.

- [ ] **Step 5: Commit**

```bash
git add src/components/Ring.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: the ring leads the home page, wedges on desktop, circles on phones"
```

---

### Task 10: The shared pillar grid and the four pillar pages

**Files:**
- Create: `src/components/PillarProducts.tsx`
- Create: `src/app/good-food/page.tsx`
- Create: `src/app/comfy-walks/page.tsx`
- Create: `src/app/fun-and-games/page.tsx`
- Create: `src/app/cosy-sleep/page.tsx`
- Modify: `src/app/globals.css` (append, one small block)

**Interfaces:**
- Consumes: `filterByPillar`, `PILLAR_META` from Task 8; `getPublicProducts`, `toCatalogue` from the store; `ProductCard`.
- Produces: `PillarProducts({ pillar })` async server component used by all four pages.

Teaching copy rules, honesty-checked against `docs/research-dossier.md`:
- Good Food claims are all dossier-sourced (label law, group terms, percentage rules, adaptable meat-first biology, treats around 10% of daily calories, omega-3 for sprats and salmon, chewing helps teeth but never replaces vet care).
- Comfy Walks, Fun & Games and Cosy Sleep have no dossier entries, so their pages carry practical, observational guidance only: no statistics, no injury claims, no "sniffing equals exercise" multipliers, no calming-product efficacy claims.

- [ ] **Step 1: The shared grid**

```tsx
// src/components/PillarProducts.tsx
import Link from "next/link";
import type { Pillar } from "@/data/products";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { filterByPillar } from "@/lib/pillars";
import { ProductCard } from "@/components/ProductCard";

/**
 * A pillar page's shelf: the public catalogue filtered to that pillar. Three of
 * the four pillars launch unstocked, so the empty state is honest rather than a
 * bare grid that looks broken.
 */
export async function PillarProducts({ pillar }: { pillar: Pillar }) {
  const products = filterByPillar((await getPublicProducts()).map(toCatalogue), pillar);
  if (products.length === 0) {
    return (
      <div className="shelf-empty">
        <p>
          We are stocking this shelf now. In the meantime, everything we sell today lives in{" "}
          <Link href="/shop">the shop</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="grid">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  );
}
```

CSS (append):

```css
/* ---------- Pillar pages (B.1) ---------- */
.shelf-empty { color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; padding: 1.8rem 1.4rem; text-align: center; }
.shelf-empty a { text-decoration: underline; font-weight: 700; }
```

- [ ] **Step 2: The Good Food page**

```tsx
// src/app/good-food/page.tsx
/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["good-food"].title,
  description: PILLAR_META["good-food"].description,
};

export default function GoodFoodPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar one</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Good Food</h1>
          <p className="hero__sub">{PILLAR_LINES["good-food"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Learn to read the label. It takes two minutes.</h2>
            <p>
              UK and EU law lets a pet food brand declare its ingredients by category. "Meat and
              animal derivatives" can be any fleshy part of any warm blooded land animal, with no
              need to name the species or the cut. "Cereals" can be any grain, in any amount.
              "Various sugars" is added sugar with no obligation to say which, or how much. All of
              it is legal, and none of it tells you what your dog is actually eating.
            </p>
            <p>
              The percentages have rules too, and they are worth knowing by heart. "Beef flavour"
              can mean under 4% beef. "With beef" means at least 4%. "Rich in beef" means at least
              14%. Only "beef dinner" or "beef meal" has to reach 26%. So a bag with a steak on the
              front can be mostly cereal, sweetened, with a beef presence measured in flavouring.
            </p>
            <p>
              The opposite of all that is an open declaration: every ingredient named in full. That
              is what we sell. If it says beef trachea, the list reads "beef trachea", and the list
              ends there.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <h2 className="display">What a dog is actually built for.</h2>
            <p>
              Your dog is not a wolf. Dogs evolved alongside us and can digest some starch, more
              than wolves can, so this is not about banning every carbohydrate. It is about what
              the animal in front of you is built for: shearing teeth made to tear meat rather than
              grind grain, a short simple gut suited to meat rather than long plant fermentation,
              and a strongly acidic stomach that handles raw and dried meat with ease. Studies
              suggest dogs do well on meat rich, minimally processed food, with firmer stools one
              of the more consistent findings.
            </p>
            <p>
              Two honest rules of thumb from us. Keep treats to roughly a tenth of the day's food,
              because even good treats are extras. And chewing helps keep teeth cleaner, but it is
              not a substitute for brushing or for your vet. Anyone who tells you a chew replaces
              dental care is selling you a chew.
            </p>
            <p>
              Where we can point at real evidence, we do. The omega 3 in whole sprats and salmon,
              EPA and DHA, is backed by genuine veterinary trials for skin, coat and joints, which
              is why the fish treats are the ones we hand to a dog with a dull coat first.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The good food.</h2>
            </div>
          </div>
          <PillarProducts pillar="good-food" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: The Comfy Walks page**

```tsx
// src/app/comfy-walks/page.tsx
/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["comfy-walks"].title,
  description: PILLAR_META["comfy-walks"].description,
};

export default function ComfyWalksPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar two</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Comfy Walks</h1>
          <p className="hero__sub">{PILLAR_LINES["comfy-walks"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">The walk is for the dog. Kit it out that way.</h2>
            <p>
              Watch a dog straining at a collar: front feet skittering, breath rasping, eyes fixed
              anywhere but on you. That is not a dog enjoying a walk, it is a dog being dragged
              somewhere slowly. A well fitted harness moves the pressure off the throat and spreads
              it across the chest, and the change in the dog is usually visible on the first walk.
            </p>
            <p>
              Fit is the whole job. You should get two flat fingers under every strap, nothing
              should rub behind the elbows, and the harness should not shift sideways when the lead
              goes tight. Ten minutes with a tape measure before you buy beats a month of a dog
              flinching from the thing that means walkies.
            </p>
            <p>
              And when you can, let the walk belong to the nose. A long line in a safe field gives
              a dog room to range, sniff and choose a direction, which is the dog's version of
              reading the news. The boring kit matters too: poo bags you will not run out of, and
              water on any warm day. None of this is complicated. It is just usually skipped.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The walking kit.</h2>
            </div>
          </div>
          <PillarProducts pillar="comfy-walks" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: The Fun & Games page**

```tsx
// src/app/fun-and-games/page.tsx
/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["fun-and-games"].title,
  description: PILLAR_META["fun-and-games"].description,
};

export default function FunAndGamesPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar three</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Fun & Games</h1>
          <p className="hero__sub">{PILLAR_LINES["fun-and-games"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Every dog was bred for a job. Give yours one.</h2>
            <p>
              Collies were bred to herd, spaniels to flush, terriers to dig things out of holes.
              Most dogs now get a job description of "lie there until further notice", and a dog
              with nothing to do writes its own to-do list: the skirting board, the post, the bin.
              The fix is not a telling off. It is a better job.
            </p>
            <p>
              The easiest jobs use the nose, a dog's strongest sense. A snuffle mat turns a bowl of
              food into a search. A scatter feed in the garden does the same for free. Puzzle
              feeders make the dog work out how the food comes out, and as a bonus they slow down a
              dog that inhales dinner. Scentwork, even the kitchen table version where you hide a
              treat under one of three cups, gives a dog the rarest thing in its week: a problem.
            </p>
            <p>
              Licking and chewing are jobs too. Load a lickimat and watch a busy dog become an
              absorbed one; the frantic edge tends to go. Ten minutes of work like this will not
              replace the walk, and nobody honest will tell you it does, but it fills the hours
              around the walk with something better than boredom.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The toy box.</h2>
            </div>
          </div>
          <PillarProducts pillar="fun-and-games" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: The Cosy Sleep page**

```tsx
// src/app/cosy-sleep/page.tsx
/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["cosy-sleep"].title,
  description: PILLAR_META["cosy-sleep"].description,
};

export default function CosySleepPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar four</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Cosy Sleep</h1>
          <p className="hero__sub">{PILLAR_LINES["cosy-sleep"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Rest is the pillar nobody brags about.</h2>
            <p>
              Dogs sleep far more of the day than we do, and they need to. Ask anyone who has
              raised a puppy: an overtired pup does not wind down, it winds up. The zoomies at ten
              at night, the nipping, the sudden deafness to a name it knew this morning. Plenty of
              "naughty" evenings are just a dog that missed its nap.
            </p>
            <p>
              What a dog needs from you is a spot that is genuinely its own. A proper bed, away
              from the busiest walkway, where a snoozing dog is left alone, by visitors and by
              children especially. If the dog takes itself to bed, that is the pillar working. It
              is not sulking, it is clocking off.
            </p>
            <p>
              A dog that has rested properly has something to give the other three pillars: an
              appetite for its food, legs for the walk, and a head for the game. Get the sleep
              right and the rest of the week gets easier. That is the whole argument.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The bedroom.</h2>
            </div>
          </div>
          <PillarProducts pillar="cosy-sleep" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, tsc clean, lint at 3.

- [ ] **Step 7: Commit**

```bash
git add src/components/PillarProducts.tsx src/app/good-food src/app/comfy-walks src/app/fun-and-games src/app/cosy-sleep src/app/globals.css
git commit -m "feat: four pillar pages that teach first, with a shared shelf component"
```

---

### Task 11: The flat shop page

**Files:**
- Create: `src/app/shop/page.tsx`

**Interfaces:**
- Consumes: `getPublicProducts`, `toCatalogue`, `ProductCard`.

- [ ] **Step 1: Implement**

```tsx
// src/app/shop/page.tsx
import type { Metadata } from "next";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop | Barking Raw",
  description:
    "Everything we sell, in one place: honest single-ingredient natural dog treats, named in full and posted to your door. Free local delivery, free over £35.",
};

/**
 * The flat shop: everything, a plain grid, for people who arrived ready to buy
 * (spec section 3). The teaching lives on the pillar pages; none of it is
 * repeated here on purpose.
 */
export default async function ShopPage() {
  const products = (await getPublicProducts()).map(toCatalogue);
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shop</p>
              <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
                Everything, in one place.
              </h1>
            </div>
          </div>
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, lint at 3.

- [ ] **Step 3: Commit**

```bash
git add src/app/shop/page.tsx
git commit -m "feat: a flat shop page for anyone who arrived ready to buy"
```

---

### Task 12: The header reaches the pillars and the shop

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/app/globals.css` (append)

**Interfaces:**
- Consumes: `ALL_PILLARS`, `PILLAR_LABELS` from `@/data/products` (safe in a client component: it is plain data, no server imports).

- [ ] **Step 1: Implement**

In `Header.tsx`, add the imports and a nav row under the existing `header__inner` (inside
`<header className="header">`):

```tsx
import { ALL_PILLARS, PILLAR_LABELS } from "@/data/products";

      <nav className="header__nav" aria-label="Shop by pillar">
        {ALL_PILLARS.map((pillar) => (
          <Link key={pillar} href={`/${pillar}`}>
            {PILLAR_LABELS[pillar]}
          </Link>
        ))}
        <Link href="/shop">Shop</Link>
      </nav>
```

- [ ] **Step 2: Append the styles**

```css
/* ---------- Header nav (B.1) ---------- */
.header__nav { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--pad) 0.55rem; display: flex; gap: 1.4rem; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.header__nav::-webkit-scrollbar { display: none; }
.header__nav a { font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; transition: opacity 0.12s ease; }
.header__nav a:hover { opacity: 1; }
```

- [ ] **Step 3: Final verification for the whole stage**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all tests pass (143 baseline plus everything added), tsc clean, lint at exactly 3 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.tsx src/app/globals.css
git commit -m "feat: the header reaches the four pillars and the shop"
```

---

## Self-review notes

- Spec coverage: section 2 hero copy and pillar lines (Task 9), 2.2 tiles-do-not-challenge (Tasks 8 to 10 copy), 3 shop page and nav (Tasks 11, 12), 3.1 no SKU pages (no such route added), 3.2 ring both layouts one markup (Task 9), 3.3 several photos with primary to Stripe and basket (Tasks 1 to 7), 12.3 claims checked (Task 10 copy rules), 15 B.1 with B.5 together (this plan).
- The `image` string never drifts from `images` because every boundary (store read, admin validate, migration) derives it via the same normalisation rules.
- `PillarProducts` and `RingHero` are new files; `page.tsx` gains two lines; `globals.css` changes are append-only. That is the minimum conflict surface for the parallel tracks.
