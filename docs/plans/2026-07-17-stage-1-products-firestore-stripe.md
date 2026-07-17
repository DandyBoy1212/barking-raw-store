# Stage 1: Products to Firestore + Stripe Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 9 products from a hardcoded file into Firestore as the source of truth, mirror each to a real Stripe Product + Price, and make the shop page and checkout read from Firestore, with no visible change for shoppers.

**Architecture:** A new `src/lib/products-store.ts` reads products from the `store_products` Firestore collection, falling back to the existing static seed when Firestore is unavailable (mirroring the existing `getDb()` returns-null pattern). A new `src/lib/stripe-sync.ts` holds the pure Stripe-mapping helpers plus an idempotent `syncProductToStripe`. A secret-guarded route `POST /api/dev/seed-products` (same bearer pattern as the cron routes) writes the seed into Firestore and creates the Stripe objects, reusing the TS helpers so nothing is duplicated. The shop page and checkout switch to the store module; checkout prefers the synced Stripe price id and falls back to server-side `price_data`.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Firestore), Stripe (`stripe` SDK), Vitest (colocated `*.test.ts`), CSS Modules.

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- Firestore collections stay namespaced under `store_*`.
- Never trust prices from the client; all pricing is computed server-side.
- Server-only code (anything importing `firebase-admin`) must never be imported by a `"use client"` component.
- Modules that need Firestore degrade gracefully (return null / fall back) rather than throwing, matching `getDb()`.
- Prices are GBP pounds as `number` (for example `6.5`); Stripe amounts are integer pence.
- Run tests with `npx vitest run <path>`.

---

## Boundary note (what Stage 1 does NOT touch)

The client-side cart (`src/components/CartProvider.tsx`, `src/components/BasketDrawer.tsx`, `src/app/thank-you/page.tsx`) keeps importing the static `products` array from `src/data/products.ts` for display. This is safe: the seed and Firestore are identical until the admin UI can edit products, which arrives in Stage 3. Checkout pricing is always server-side from Firestore, so no incorrect charge is possible. Feeding the client live product data is explicitly Stage 3 work. `src/app/api/cron/abandoned/route.ts` does not consume product data (its match was the `#products` URL fragment) and is not modified.

---

## File Structure

- **Create** `src/lib/products-store.ts` — Firestore-backed product reads + pure normaliser and catalogue mapper. Responsibility: be the single server-side way to get products.
- **Create** `src/lib/products-store.test.ts` — unit tests for the pure functions.
- **Create** `src/lib/stripe-sync.ts` — pure Stripe param builders, `priceToPence`, `buildCheckoutLineItem`, and idempotent `syncProductToStripe`. Responsibility: everything about mapping a product to Stripe.
- **Create** `src/lib/stripe-sync.test.ts` — unit tests for the pure functions and the sync using a fake Stripe.
- **Create** `src/app/api/dev/seed-products/route.ts` — one-off, secret-guarded seed of Firestore + Stripe.
- **Modify** `src/lib/firebase-admin.ts` — add `products` to `COLLECTIONS`.
- **Modify** `src/data/products.ts` — add the four storage fields to the `Product` type as optional (keeps the static array valid and the UI unchanged).
- **Modify** `src/app/page.tsx` — read products from the store module (async server component).
- **Modify** `src/app/api/checkout/route.ts` — price and line items from the store module + `buildCheckoutLineItem`.

---

### Task 1: Product store module — pure core (normaliser, seed mapper, catalogue mapper)

**Files:**
- Modify: `src/lib/firebase-admin.ts:35-39`
- Modify: `src/data/products.ts:14-23`
- Create: `src/lib/products-store.ts`
- Test: `src/lib/products-store.test.ts`

**Interfaces:**
- Consumes: `Product`, `products` (seed array) from `@/data/products`.
- Produces:
  - `type StoredProduct = Product & { active: boolean; archived: boolean; stripeProductId?: string; stripePriceId?: string }`
  - `docToStoredProduct(id: string, data: Record<string, unknown>): StoredProduct`
  - `seedAsStoredProducts(): StoredProduct[]`
  - `toCatalogue(sp: StoredProduct): Product`
  - `COLLECTIONS.products` (string `"store_products"`)

- [ ] **Step 1: Add the collection constant**

In `src/lib/firebase-admin.ts`, extend the `COLLECTIONS` object:

```ts
export const COLLECTIONS = {
  carts: "store_carts",
  orders: "store_orders",
  discountCodes: "store_discount_codes",
  products: "store_products",
} as const;
```

- [ ] **Step 2: Widen the Product type with optional storage fields**

In `src/data/products.ts`, change the `Product` interface to add four optional fields (the static seed array stays valid because they are optional):

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
  // Storage/sync fields (populated once a product lives in Firestore):
  active?: boolean;
  archived?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
}
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/products-store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { docToStoredProduct, seedAsStoredProducts, toCatalogue } from "./products-store";

describe("docToStoredProduct", () => {
  it("applies defaults for a minimal doc", () => {
    const sp = docToStoredProduct("chicken-feet", {
      name: "Chicken Feet",
      price: 6,
      hook: "h",
      description: "d",
      image: "/products/chicken-feet.png",
    });
    expect(sp).toMatchObject({
      slug: "chicken-feet",
      name: "Chicken Feet",
      price: 6,
      badges: [],
      active: true,
      archived: false,
    });
    expect(sp.stripeProductId).toBeUndefined();
  });

  it("preserves explicit flags, ids, badges and coerces price to a number", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: "7.5",
      hook: "h",
      description: "d",
      image: "/x.png",
      badges: ["Most Popular"],
      active: false,
      archived: true,
      stripeProductId: "prod_1",
      stripePriceId: "price_1",
      safetyNote: "care",
    });
    expect(sp.price).toBe(7.5);
    expect(sp.badges).toEqual(["Most Popular"]);
    expect(sp.active).toBe(false);
    expect(sp.archived).toBe(true);
    expect(sp.stripeProductId).toBe("prod_1");
    expect(sp.stripePriceId).toBe("price_1");
    expect(sp.safetyNote).toBe("care");
  });
});

describe("seedAsStoredProducts", () => {
  it("maps all 9 seed products to active, non-archived stored products", () => {
    const all = seedAsStoredProducts();
    expect(all).toHaveLength(9);
    expect(all.every((p) => p.active && !p.archived)).toBe(true);
    expect(all.every((p) => p.stripePriceId === undefined)).toBe(true);
  });
});

describe("toCatalogue", () => {
  it("strips server-only fields, keeping the UI shape", () => {
    const [sp] = seedAsStoredProducts();
    const cat = toCatalogue({ ...sp, stripeProductId: "prod_1", stripePriceId: "price_1" });
    expect(cat).not.toHaveProperty("stripeProductId");
    expect(cat).not.toHaveProperty("stripePriceId");
    expect(cat.slug).toBe(sp.slug);
    expect(cat.price).toBe(sp.price);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: FAIL with a module-not-found or "is not a function" error (`products-store` not created yet).

- [ ] **Step 5: Write the minimal implementation**

Create `src/lib/products-store.ts`:

```ts
import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { products as seed, type Product, type Badge } from "@/data/products";

export type StoredProduct = Product & {
  active: boolean;
  archived: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
};

/** Normalise a raw Firestore doc into a StoredProduct, applying defaults. */
export function docToStoredProduct(id: string, data: Record<string, unknown>): StoredProduct {
  return {
    slug: id,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    hook: String(data.hook ?? ""),
    description: String(data.description ?? ""),
    badges: Array.isArray(data.badges) ? (data.badges as Badge[]) : [],
    image: String(data.image ?? ""),
    safetyNote: data.safetyNote ? String(data.safetyNote) : undefined,
    active: data.active === undefined ? true : Boolean(data.active),
    archived: Boolean(data.archived ?? false),
    stripeProductId: data.stripeProductId ? String(data.stripeProductId) : undefined,
    stripePriceId: data.stripePriceId ? String(data.stripePriceId) : undefined,
  };
}

/** The static seed, expressed as StoredProducts (used as the fallback catalogue). */
export function seedAsStoredProducts(): StoredProduct[] {
  return seed.map((p) => ({ ...p, active: true, archived: false }));
}

/** Reduce a StoredProduct to the plain catalogue shape safe to pass to client components. */
export function toCatalogue(sp: StoredProduct): Product {
  return {
    slug: sp.slug,
    name: sp.name,
    price: sp.price,
    hook: sp.hook,
    description: sp.description,
    badges: sp.badges,
    image: sp.image,
    safetyNote: sp.safetyNote,
  };
}

/** All buyable products (active, not archived). Falls back to the seed if Firestore is down. */
export async function getStoredProducts(): Promise<StoredProduct[]> {
  const db = getDb();
  if (!db) return seedAsStoredProducts().filter((p) => p.active && !p.archived);
  const snap = await db.collection(COLLECTIONS.products).get();
  const all = snap.docs.map((d) => docToStoredProduct(d.id, d.data() as Record<string, unknown>));
  const live = all.filter((p) => p.active && !p.archived);
  return live.length ? live : seedAsStoredProducts().filter((p) => p.active && !p.archived);
}

/** A single product by slug (its Firestore doc id). Falls back to the seed. */
export async function getStoredProductBySlug(slug: string): Promise<StoredProduct | null> {
  const db = getDb();
  if (!db) return seedAsStoredProducts().find((p) => p.slug === slug) ?? null;
  const doc = await db.collection(COLLECTIONS.products).doc(slug).get();
  if (!doc.exists) return seedAsStoredProducts().find((p) => p.slug === slug) ?? null;
  return docToStoredProduct(doc.id, doc.data() as Record<string, unknown>);
}
```

Note: `import "server-only"` requires the `server-only` package, which ships with Next.js; if the build reports it missing, run `npm install server-only`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/products-store.test.ts`
Expected: PASS (5 assertions across 3 describe blocks).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/firebase-admin.ts src/data/products.ts src/lib/products-store.ts src/lib/products-store.test.ts
git commit -m "feat: products-store module reading store_products with seed fallback"
```

---

### Task 2: Stripe sync helpers (pure builders + idempotent sync)

**Files:**
- Create: `src/lib/stripe-sync.ts`
- Test: `src/lib/stripe-sync.test.ts`

**Interfaces:**
- Consumes: `StoredProduct` from `@/lib/products-store`, `Stripe` types from `stripe`.
- Produces:
  - `priceToPence(price: number): number`
  - `buildStripeProductParams(sp: StoredProduct): { name: string; description: string; images: string[]; metadata: { slug: string } }`
  - `buildCheckoutLineItem(sp: StoredProduct, qty: number): Stripe.Checkout.SessionCreateParams.LineItem`
  - `syncProductToStripe(stripe: Stripe, sp: StoredProduct, siteUrl: string): Promise<{ stripeProductId: string; stripePriceId: string }>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stripe-sync.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  priceToPence,
  buildStripeProductParams,
  buildCheckoutLineItem,
  syncProductToStripe,
} from "./stripe-sync";
import type { StoredProduct } from "./products-store";

const base: StoredProduct = {
  slug: "chicken-feet",
  name: "Chicken Feet",
  price: 6,
  hook: "crunchy",
  description: "single ingredient",
  badges: [],
  image: "/products/chicken-feet.png",
  active: true,
  archived: false,
};

describe("priceToPence", () => {
  it("converts pounds to integer pence without float drift", () => {
    expect(priceToPence(6.5)).toBe(650);
    expect(priceToPence(7.55)).toBe(755);
  });
});

describe("buildStripeProductParams", () => {
  it("maps name, description, absolute image and slug metadata", () => {
    const params = buildStripeProductParams(base);
    expect(params.name).toBe("Chicken Feet");
    expect(params.description).toBe("single ingredient");
    expect(params.images).toEqual(["https://barkingraw.dog/products/chicken-feet.png"]);
    expect(params.metadata).toEqual({ slug: "chicken-feet" });
  });
});

describe("buildCheckoutLineItem", () => {
  it("uses the synced Stripe price id when present", () => {
    const item = buildCheckoutLineItem({ ...base, stripePriceId: "price_123" }, 3);
    expect(item).toEqual({ price: "price_123", quantity: 3 });
  });

  it("falls back to server-side price_data when no price id", () => {
    const item = buildCheckoutLineItem(base, 2);
    expect(item).toEqual({
      quantity: 2,
      price_data: {
        currency: "gbp",
        unit_amount: 600,
        product_data: { name: "Chicken Feet" },
      },
    });
  });

  it("clamps quantity to 1..50", () => {
    expect(buildCheckoutLineItem({ ...base, stripePriceId: "p" }, 0).quantity).toBe(1);
    expect(buildCheckoutLineItem({ ...base, stripePriceId: "p" }, 999).quantity).toBe(50);
  });
});

describe("syncProductToStripe", () => {
  it("returns existing ids unchanged (idempotent) without calling Stripe", async () => {
    let calls = 0;
    const fake = {
      products: { create: async () => { calls++; return { id: "x" }; } },
      prices: { create: async () => { calls++; return { id: "y" }; } },
    } as unknown as import("stripe").default;
    const out = await syncProductToStripe(
      fake,
      { ...base, stripeProductId: "prod_1", stripePriceId: "price_1" },
      "https://barkingraw.dog",
    );
    expect(out).toEqual({ stripeProductId: "prod_1", stripePriceId: "price_1" });
    expect(calls).toBe(0);
  });

  it("creates a product then a price when ids are missing", async () => {
    const seen: { productParams?: unknown; priceParams?: unknown } = {};
    const fake = {
      products: {
        create: async (p: unknown) => { seen.productParams = p; return { id: "prod_new" }; },
      },
      prices: {
        create: async (p: unknown) => { seen.priceParams = p; return { id: "price_new" }; },
      },
    } as unknown as import("stripe").default;
    const out = await syncProductToStripe(fake, base, "https://barkingraw.dog");
    expect(out).toEqual({ stripeProductId: "prod_new", stripePriceId: "price_new" });
    expect(seen.priceParams).toEqual({
      product: "prod_new",
      currency: "gbp",
      unit_amount: 600,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/stripe-sync.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/stripe-sync.ts`:

```ts
import type Stripe from "stripe";
import type { StoredProduct } from "@/lib/products-store";

/** Pounds to integer pence, rounded, avoiding float drift. */
export function priceToPence(price: number): number {
  return Math.round(price * 100);
}

/** Turn a relative /public image path into an absolute URL Stripe can fetch. */
function absoluteImage(image: string, siteUrl: string): string {
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  return `${siteUrl.replace(/\/$/, "")}${image.startsWith("/") ? "" : "/"}${image}`;
}

export function buildStripeProductParams(sp: StoredProduct, siteUrl = "https://barkingraw.dog") {
  const img = absoluteImage(sp.image, siteUrl);
  return {
    name: sp.name,
    description: sp.description,
    images: img ? [img] : [],
    metadata: { slug: sp.slug },
  };
}

/** Prefer the synced Stripe price id; fall back to a server-computed price_data line. */
export function buildCheckoutLineItem(
  sp: StoredProduct,
  qty: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  const quantity = Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
  if (sp.stripePriceId) {
    return { price: sp.stripePriceId, quantity };
  }
  return {
    quantity,
    price_data: {
      currency: "gbp",
      unit_amount: priceToPence(sp.price),
      product_data: { name: sp.name },
    },
  };
}

/**
 * Ensure a Stripe Product + Price exist for this product. Idempotent: if both ids
 * are already set, returns them untouched. Otherwise creates the Product then the Price.
 * (Editing an existing product's price is Stage 3 work.)
 */
export async function syncProductToStripe(
  stripe: Stripe,
  sp: StoredProduct,
  siteUrl = "https://barkingraw.dog",
): Promise<{ stripeProductId: string; stripePriceId: string }> {
  if (sp.stripeProductId && sp.stripePriceId) {
    return { stripeProductId: sp.stripeProductId, stripePriceId: sp.stripePriceId };
  }
  const product = await stripe.products.create(buildStripeProductParams(sp, siteUrl));
  const price = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: priceToPence(sp.price),
  });
  return { stripeProductId: product.id, stripePriceId: price.id };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/stripe-sync.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe-sync.ts src/lib/stripe-sync.test.ts
git commit -m "feat: stripe-sync helpers (price mapping, line items, idempotent product sync)"
```

---

### Task 3: Seed route — write Firestore + create Stripe objects

**Files:**
- Create: `src/app/api/dev/seed-products/route.ts`

**Interfaces:**
- Consumes: `getDb`, `COLLECTIONS`; `seedAsStoredProducts`, `docToStoredProduct` from `@/lib/products-store`; `syncProductToStripe` from `@/lib/stripe-sync`.
- Produces: `POST /api/dev/seed-products` returning `{ seeded: number, products: Array<{ slug, stripeProductId, stripePriceId }> }`.

This task's deliverable is integration wiring, so it is verified by running it against the test-mode Stripe key and Firestore rather than by a unit test.

- [ ] **Step 1: Write the route**

Create `src/app/api/dev/seed-products/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { seedAsStoredProducts, docToStoredProduct } from "@/lib/products-store";
import { syncProductToStripe } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same bearer pattern as the cron routes: no secret set means allow (dev only).
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.SEED_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "no stripe key" }, { status: 503 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "no db" }, { status: 503 });

  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const out: Array<{ slug: string; stripeProductId: string; stripePriceId: string }> = [];

  for (const seedSp of seedAsStoredProducts()) {
    const ref = db.collection(COLLECTIONS.products).doc(seedSp.slug);
    // Re-read any existing doc so a re-run stays idempotent (keeps existing Stripe ids).
    const existing = await ref.get();
    const current = existing.exists
      ? docToStoredProduct(existing.id, existing.data() as Record<string, unknown>)
      : seedSp;

    const ids = await syncProductToStripe(stripe, current, siteUrl);

    await ref.set(
      {
        name: seedSp.name,
        price: seedSp.price,
        hook: seedSp.hook,
        description: seedSp.description,
        badges: seedSp.badges,
        image: seedSp.image,
        ...(seedSp.safetyNote ? { safetyNote: seedSp.safetyNote } : {}),
        active: true,
        archived: false,
        stripeProductId: ids.stripeProductId,
        stripePriceId: ids.stripePriceId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
    out.push({ slug: seedSp.slug, ...ids });
  }

  return NextResponse.json({ seeded: out.length, products: out });
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify against Firestore + Stripe test mode (manual)**

Ensure `.env.local` has `STRIPE_SECRET_KEY` (test-mode `sk_test_...`) and Firebase credentials (`FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS`). Then:

```bash
npm run dev
# in a second terminal:
curl -X POST http://localhost:3000/api/dev/seed-products
```

Expected: JSON `{ "seeded": 9, "products": [ { "slug": "beef-trachea-rings", "stripeProductId": "prod_...", "stripePriceId": "price_..." }, ... ] }`.
Then confirm in the Firebase console that `store_products` has 9 docs each carrying `stripeProductId` and `stripePriceId`, and in the Stripe dashboard (test mode) that 9 Products with GBP prices now exist.

- [ ] **Step 4: Verify idempotency (manual)**

Run the same `curl` again. Expected: the same 9 `stripeProductId`/`stripePriceId` values (no new Stripe products created), because `syncProductToStripe` short-circuits when ids are present.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dev/seed-products/route.ts
git commit -m "feat: guarded seed route to populate store_products and Stripe"
```

---

### Task 4: Shop page reads products from Firestore

**Files:**
- Modify: `src/app/page.tsx:1-8` (imports + component signature), `src/app/page.tsx:175-180` (product grid)

**Interfaces:**
- Consumes: `getStoredProducts`, `toCatalogue` from `@/lib/products-store`.
- Produces: no new exports; the page renders live products.

- [ ] **Step 1: Switch imports and make the component async**

In `src/app/page.tsx`, replace the top import of the static array and the component signature. Change:

```ts
import { products } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { PawTrail } from "@/components/PawTrail";

export default function Home() {
```

to:

```ts
import { getStoredProducts, toCatalogue } from "@/lib/products-store";
import { ProductCard } from "@/components/ProductCard";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = (await getStoredProducts()).map(toCatalogue);
```

The existing `<div className="grid">{products.map(...)}` block stays exactly as it is (it now maps the fetched catalogue list).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify the shop renders identically (manual)**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: all 9 product cards render with the same names, prices, badges, and images as before. With Firestore seeded (Task 3) they come from `store_products`; if Firestore is unavailable the page still shows the 9 via the seed fallback.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: shop page reads products from Firestore via products-store"
```

---

### Task 5: Checkout prices from Firestore and uses Stripe price ids

**Files:**
- Modify: `src/app/api/checkout/route.ts:1-11` (imports), `src/app/api/checkout/route.ts:38-59` (line-item build loop)

**Interfaces:**
- Consumes: `getStoredProducts` from `@/lib/products-store`; `buildCheckoutLineItem` from `@/lib/stripe-sync`.
- Produces: no new exports; checkout behaviour unchanged for shoppers.

- [ ] **Step 1: Update imports**

In `src/app/api/checkout/route.ts`, replace:

```ts
import { products } from "@/data/products";
import { computeShipping } from "@/lib/shipping";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
```

with:

```ts
import { computeShipping } from "@/lib/shipping";
import { getStoredProducts } from "@/lib/products-store";
import { buildCheckoutLineItem } from "@/lib/stripe-sync";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
```

- [ ] **Step 2: Replace the line-item build loop**

Replace the current loop (the block from `const line_items ...` through the closing brace before `if (line_items.length === 0)`):

```ts
  // Build line items from SERVER-SIDE prices. Never trust prices from the client.
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  const summary: string[] = [];
  for (const l of lines) {
    const p = products.find((pr) => pr.slug === l.slug);
    if (!p) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    subtotal += p.price * qty;
    summary.push(`${qty} x ${p.name}`);
    line_items.push({
      quantity: qty,
      price_data: {
        currency: "gbp",
        unit_amount: Math.round(p.price * 100),
        product_data: { name: p.name },
      },
    });
  }
```

with:

```ts
  // Build line items from SERVER-SIDE products. Never trust prices from the client.
  const catalogue = await getStoredProducts();
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  const summary: string[] = [];
  for (const l of lines) {
    const p = bySlug.get(l.slug);
    if (!p || !p.active || p.archived) continue;
    const qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    subtotal += p.price * qty;
    summary.push(`${qty} x ${p.name}`);
    line_items.push(buildCheckoutLineItem(p, qty));
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `products` import is gone and no longer referenced).

- [ ] **Step 4: Verify a full test-mode checkout (manual)**

With `npm run dev` running and the seed applied, add items to the basket on the site and start checkout. Expected: Stripe Checkout opens with the correct product names and GBP prices, shipping applied per postcode, and a test-card payment (`4242 4242 4242 4242`) completes to the thank-you page. Because seeded products have `stripePriceId`, the session uses `{ price: ... }` line items; if a product somehow lacked an id, it would fall back to `price_data` at the same price.

- [ ] **Step 5: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (shipping, products-store, stripe-sync tests all green).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: checkout reads products from Firestore and uses synced Stripe prices"
```

---

## Self-Review

**Spec coverage (Stage 1 section of the design spec):**
- `store_products` becomes the source of truth — Tasks 1, 3.
- New product fields `active`, `archived`, `stripeProductId`, `stripePriceId` — Task 1 (type), Task 3 (populated).
- Seed script writing the 9 products and creating Stripe Product + Price — Task 3 (as a guarded route reusing tested TS helpers, chosen over a standalone `.mjs` so the Stripe logic is unit-tested and not duplicated).
- `src/lib/products-store.ts` data-access with seed fallback — Task 1.
- Shop page reads from the module — Task 4.
- Checkout reads from the module and uses `stripePriceId` line items, rejecting inactive products — Task 5.
- "No visible change to shoppers" — verified manually in Tasks 4 and 5.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the two integration tasks (3 and 5 step 4) use explicit manual verification with exact commands and expected output rather than vague instructions.

**Type consistency:** `StoredProduct` is defined once in Task 1 and consumed with the same shape in Tasks 2, 3, 5. `buildCheckoutLineItem(sp, qty)`, `syncProductToStripe(stripe, sp, siteUrl)`, `getStoredProducts()`, `toCatalogue(sp)` are named and called identically across tasks. `priceToPence` centralises the pounds-to-pence conversion that checkout previously inlined.

**Deviation recorded:** The spec describes a `scripts/seed-products.mjs`. This plan implements the seed as a secret-guarded route instead, because a standalone `.mjs` cannot import the TypeScript `stripe-sync` helpers and would duplicate the Stripe logic. The route reuses the unit-tested helpers and follows the existing `isAuthorised` bearer pattern. Net behaviour is identical: run once, Firestore + Stripe populated.
