# Stage 3: Admin Product Manager — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a UI under `/admin/products` to create, edit, and archive products, with image upload to Firebase Storage, each save mirrored to Stripe (creating a new Stripe Price on a price change), plus staff-invite-by-email.

**Architecture:** Staff-only Route Handlers (each calls `requireStaff`) own the mutations: create, update, archive, image upload, and staff invite. They reuse `stripe-sync` (extended here to update an existing product and roll its price) and the `products-store` reads. Pure helpers (`slugify`, input validation, the badge vocabulary) live in `src/lib/product-admin.ts` and are unit-tested. The admin pages are server components gated by `requireStaff`; a single client `ProductForm` drives create and edit.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Firestore + Storage), Stripe SDK, Vitest. Builds on Stage 1 (`products-store`, `stripe-sync`) and Stage 2 (`requireStaff`, `getAuthAdmin`, `sendEmail`, auth helpers).

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- `cookies()` is async in this Next build; guards come from `requireStaff()` (Stage 2), which already handles that. Route Handlers use named exports with `runtime = "nodejs"`.
- Every mutating Route Handler calls `requireStaff()` before doing anything; never trust the client for authorisation.
- Firestore collections stay namespaced `store_*`. Slugs are immutable once created (they are the doc id and appear in cart lines/URLs).
- Stripe Prices are immutable: a price change creates a NEW Price, sets it as `default_price`, and archives the old one.
- Modules needing Firebase degrade gracefully (return null) rather than throwing.
- Run tests with `npx vitest run <path>`.

## Prerequisites (manual, one-time)

- Enable Firebase Storage on the project and set `FIREBASE_STORAGE_BUCKET` (for example `gen-lang-client-0842620114.appspot.com`) in `.env.local` and Vercel.
- The Admin SDK must be initialised with the service-account cert (already the case via `FIREBASE_SERVICE_ACCOUNT`) so it can sign download URLs.

---

## File Structure

- **Create** `src/lib/product-admin.ts` — pure helpers: `slugify`, `validateProductInput`, `ALL_BADGES` re-export. Unit-tested.
- **Create** `src/lib/product-admin.test.ts` — tests for the above.
- **Modify** `src/lib/stripe-sync.ts` — add `priceChanged`, `applyStripeProductUpdate`, `archiveStripeProduct`.
- **Modify** `src/lib/stripe-sync.test.ts` — tests for the new sync functions (fake Stripe).
- **Modify** `src/data/products.ts` — export `ALL_BADGES`.
- **Modify** `src/lib/products-store.ts` — add `getAllStoredProducts` (admin, includes archived).
- **Create** `src/app/api/admin/products/route.ts` — POST create.
- **Create** `src/app/api/admin/products/[slug]/route.ts` — PATCH update.
- **Create** `src/app/api/admin/products/[slug]/archive/route.ts` — POST archive/unarchive.
- **Create** `src/app/api/admin/products/image/route.ts` — POST image upload.
- **Create** `src/app/api/admin/staff/invite/route.ts` — POST staff invite.
- **Create** `src/components/admin/ProductForm.tsx` — client form for create/edit.
- **Create** `src/app/admin/products/page.tsx` — list (server).
- **Create** `src/app/admin/products/new/page.tsx` — create (server shell + form).
- **Create** `src/app/admin/products/[slug]/page.tsx` — edit (server shell + form).

---

### Task 1: Pure admin helpers + badge vocabulary

**Files:**
- Modify: `src/data/products.ts`
- Create: `src/lib/product-admin.ts`
- Test: `src/lib/product-admin.test.ts`

**Interfaces:**
- Produces:
  - `ALL_BADGES: Badge[]` (from `@/data/products`)
  - `slugify(name: string): string`
  - `type ProductInput = { name: string; price: number; hook: string; description: string; badges: Badge[]; image: string; safetyNote?: string }`
  - `validateProductInput(input: Partial<ProductInput>): { ok: true; value: ProductInput } | { ok: false; errors: string[] }`

- [ ] **Step 1: Export the badge vocabulary**

In `src/data/products.ts`, after the `Badge` type, add:

```ts
export const ALL_BADGES: Badge[] = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/product-admin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify, validateProductInput } from "./product-admin";

describe("slugify", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(slugify("Beef Trachea Rings")).toBe("beef-trachea-rings");
    expect(slugify("  Pure Meat Tit-bits!  ")).toBe("pure-meat-tit-bits");
    expect(slugify("Salmon   &   Sprats")).toBe("salmon-sprats");
  });
});

describe("validateProductInput", () => {
  const good = {
    name: "Chicken Feet",
    price: 6,
    hook: "crunchy",
    description: "single ingredient",
    badges: [],
    image: "/products/chicken-feet.png",
  };

  it("accepts a complete input and returns a normalised value", () => {
    const res = validateProductInput(good);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.price).toBe(6);
  });

  it("rejects missing name, non-positive price, and empty copy", () => {
    const res = validateProductInput({ ...good, name: "", price: 0, hook: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("Name is required.");
      expect(res.errors).toContain("Price must be greater than 0.");
      expect(res.errors).toContain("Hook is required.");
    }
  });

  it("coerces a numeric string price", () => {
    const res = validateProductInput({ ...good, price: "7.5" as unknown as number });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.price).toBe(7.5);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the implementation**

Create `src/lib/product-admin.ts`:

```ts
import { ALL_BADGES, type Badge } from "@/data/products";

export { ALL_BADGES };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProductInput = {
  name: string;
  price: number;
  hook: string;
  description: string;
  badges: Badge[];
  image: string;
  safetyNote?: string;
};

export function validateProductInput(
  input: Partial<ProductInput>,
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? "").trim();
  const price = Number(input.price ?? 0);
  const hook = String(input.hook ?? "").trim();
  const description = String(input.description ?? "").trim();
  const image = String(input.image ?? "").trim();
  const badges = Array.isArray(input.badges) ? (input.badges as Badge[]) : [];
  const safetyNote = input.safetyNote ? String(input.safetyNote).trim() : undefined;

  if (!name) errors.push("Name is required.");
  if (!(price > 0)) errors.push("Price must be greater than 0.");
  if (!hook) errors.push("Hook is required.");
  if (!description) errors.push("Description is required.");
  if (!image) errors.push("An image is required.");

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, price, hook, description, badges, image, safetyNote } };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/product-admin.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/products.ts src/lib/product-admin.ts src/lib/product-admin.test.ts
git commit -m "feat: product-admin pure helpers (slugify, validation, badges)"
```

---

### Task 2: Extend stripe-sync for edits and price rolls

**Files:**
- Modify: `src/lib/stripe-sync.ts`
- Modify: `src/lib/stripe-sync.test.ts`

**Interfaces:**
- Produces:
  - `priceChanged(prevPrice: number, nextPrice: number): boolean`
  - `applyStripeProductUpdate(stripe, existing: StoredProduct, next: StoredProduct, siteUrl?): Promise<{ stripeProductId: string; stripePriceId: string }>`
  - `archiveStripeProduct(stripe, stripeProductId: string): Promise<void>`

- [ ] **Step 1: Add the new tests**

Append to `src/lib/stripe-sync.test.ts` (keep the existing tests):

```ts
import { priceChanged, applyStripeProductUpdate, archiveStripeProduct } from "./stripe-sync";

describe("priceChanged", () => {
  it("compares in pence to avoid float noise", () => {
    expect(priceChanged(6.5, 6.5)).toBe(false);
    expect(priceChanged(6.5, 7)).toBe(true);
    expect(priceChanged(6.1, 6.10001)).toBe(false);
  });
});

describe("applyStripeProductUpdate", () => {
  const existing = {
    slug: "chicken-feet",
    name: "Chicken Feet",
    price: 6,
    hook: "h",
    description: "d",
    badges: [],
    image: "/products/chicken-feet.png",
    active: true,
    archived: false,
    stripeProductId: "prod_1",
    stripePriceId: "price_old",
  } as const;

  it("updates the product but keeps the price id when the price is unchanged", async () => {
    const calls: string[] = [];
    const fake = {
      products: {
        update: async (id: string) => { calls.push(`product.update:${id}`); return { id }; },
      },
      prices: {
        create: async () => { calls.push("price.create"); return { id: "price_new" }; },
        update: async () => { calls.push("price.update"); return { id: "price_old" }; },
      },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing }, "https://barkingraw.dog");
    expect(out).toEqual({ stripeProductId: "prod_1", stripePriceId: "price_old" });
    expect(calls).toEqual(["product.update:prod_1"]);
  });

  it("creates a new price, sets it default, and archives the old one on a price change", async () => {
    const calls: string[] = [];
    const fake = {
      products: {
        update: async (id: string, params: Record<string, unknown>) => {
          calls.push(`product.update:${id}:${params.default_price ?? "fields"}`);
          return { id };
        },
      },
      prices: {
        create: async () => { calls.push("price.create"); return { id: "price_new" }; },
        update: async (id: string, params: Record<string, unknown>) => {
          calls.push(`price.update:${id}:active=${params.active}`);
          return { id };
        },
      },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing, price: 7 }, "https://barkingraw.dog");
    expect(out).toEqual({ stripeProductId: "prod_1", stripePriceId: "price_new" });
    expect(calls).toEqual([
      "product.update:prod_1:fields",
      "price.create",
      "product.update:prod_1:price_new",
      "price.update:price_old:active=false",
    ]);
  });
});

describe("archiveStripeProduct", () => {
  it("sets the Stripe product inactive", async () => {
    let seen = "";
    const fake = {
      products: { update: async (id: string, p: Record<string, unknown>) => { seen = `${id}:${p.active}`; return { id }; } },
    } as unknown as import("stripe").default;
    await archiveStripeProduct(fake, "prod_9");
    expect(seen).toBe("prod_9:false");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/stripe-sync.test.ts`
Expected: FAIL (the three new functions are not exported yet).

- [ ] **Step 3: Implement the new functions**

Append to `src/lib/stripe-sync.ts`:

```ts
/** True when the two prices differ once rounded to pence. */
export function priceChanged(prevPrice: number, nextPrice: number): boolean {
  return priceToPence(prevPrice) !== priceToPence(nextPrice);
}

/**
 * Update an existing Stripe product to match `next`. Stripe Prices are immutable,
 * so when the price changes we create a new Price, make it the default, and archive
 * the old one. Returns the ids that should be stored on the product.
 */
export async function applyStripeProductUpdate(
  stripe: Stripe,
  existing: StoredProduct,
  next: StoredProduct,
  siteUrl = "https://barkingraw.dog",
): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const productId = existing.stripeProductId;
  const oldPriceId = existing.stripePriceId;
  if (!productId) {
    // No Stripe product yet (for example an item created before sync): create fresh.
    return syncProductToStripe(stripe, { ...next, stripeProductId: undefined, stripePriceId: undefined }, siteUrl);
  }

  await stripe.products.update(productId, buildStripeProductParams(next, siteUrl));

  if (!oldPriceId || priceChanged(existing.price, next.price)) {
    const price = await stripe.prices.create({
      product: productId,
      currency: "gbp",
      unit_amount: priceToPence(next.price),
    });
    await stripe.products.update(productId, { default_price: price.id });
    if (oldPriceId) await stripe.prices.update(oldPriceId, { active: false });
    return { stripeProductId: productId, stripePriceId: price.id };
  }

  return { stripeProductId: productId, stripePriceId: oldPriceId };
}

/** Archive a product in Stripe (hides it without deleting). */
export async function archiveStripeProduct(stripe: Stripe, stripeProductId: string): Promise<void> {
  await stripe.products.update(stripeProductId, { active: false });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stripe-sync.test.ts`
Expected: PASS (Stage 1 tests plus the three new blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-sync.ts src/lib/stripe-sync.test.ts
git commit -m "feat: stripe-sync update path with immutable-price rolling and archive"
```

---

### Task 3: Admin list read + create route

**Files:**
- Modify: `src/lib/products-store.ts`
- Create: `src/app/api/admin/products/route.ts`

**Interfaces:**
- Produces:
  - `getAllStoredProducts(): Promise<StoredProduct[]>` (admin view, includes archived/inactive)
  - Route `POST /api/admin/products` (body: `ProductInput`) returning `{ ok: true; slug: string } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Add the admin read to products-store**

In `src/lib/products-store.ts`, add near the other reads:

```ts
/** Every product including archived/inactive, for the admin list. Falls back to the seed. */
export async function getAllStoredProducts(): Promise<StoredProduct[]> {
  const db = getDb();
  if (!db) return seedAsStoredProducts();
  const snap = await db.collection(COLLECTIONS.products).get();
  const all = snap.docs.map((d) => docToStoredProduct(d.id, d.data() as Record<string, unknown>));
  return all.length ? all : seedAsStoredProducts();
}
```

- [ ] **Step 2: Create the create route**

Create `src/app/api/admin/products/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlug, type StoredProduct } from "@/lib/products-store";
import { slugify, validateProductInput } from "@/lib/product-admin";
import { syncProductToStripe } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireStaff();
  const secret = process.env.STRIPE_SECRET_KEY;
  const db = getDb();
  if (!secret || !db) return NextResponse.json({ ok: false, errors: ["Service not configured."] }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const parsed = validateProductInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const slug = slugify(parsed.value.name);
  if (!slug) return NextResponse.json({ ok: false, errors: ["Could not derive a slug from the name."] }, { status: 400 });
  if (await getStoredProductBySlug(slug)) {
    return NextResponse.json({ ok: false, errors: ["A product with this name already exists."] }, { status: 409 });
  }

  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const draft: StoredProduct = { slug, ...parsed.value, active: true, archived: false };
  const ids = await syncProductToStripe(stripe, draft, siteUrl);

  await db.collection(COLLECTIONS.products).doc(slug).set({
    name: draft.name,
    price: draft.price,
    hook: draft.hook,
    description: draft.description,
    badges: draft.badges,
    image: draft.image,
    ...(draft.safetyNote ? { safetyNote: draft.safetyNote } : {}),
    active: true,
    archived: false,
    stripeProductId: ids.stripeProductId,
    stripePriceId: ids.stripePriceId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, slug });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/products-store.ts src/app/api/admin/products/route.ts
git commit -m "feat: admin product list read and create route (staff-guarded, Stripe-synced)"
```

---

### Task 4: Update + archive routes

**Files:**
- Create: `src/app/api/admin/products/[slug]/route.ts`
- Create: `src/app/api/admin/products/[slug]/archive/route.ts`

**Interfaces:**
- Consumes: `requireStaff`, `getStoredProductBySlug`, `validateProductInput`, `applyStripeProductUpdate`, `archiveStripeProduct`.
- Produces: `PATCH /api/admin/products/[slug]` (body: `ProductInput`); `POST /api/admin/products/[slug]/archive` (body: `{ archived: boolean }`).

Note on route context typing in this Next build: dynamic params are async. The handler signature is `(req, ctx: { params: Promise<{ slug: string }> })` and you must `await ctx.params`.

- [ ] **Step 1: Create the update route**

Create `src/app/api/admin/products/[slug]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlug, type StoredProduct } from "@/lib/products-store";
import { validateProductInput } from "@/lib/product-admin";
import { applyStripeProductUpdate } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await ctx.params;
  const secret = process.env.STRIPE_SECRET_KEY;
  const db = getDb();
  if (!secret || !db) return NextResponse.json({ ok: false, errors: ["Service not configured."] }, { status: 503 });

  const existing = await getStoredProductBySlug(slug);
  if (!existing) return NextResponse.json({ ok: false, errors: ["Product not found."] }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }
  const parsed = validateProductInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const next: StoredProduct = { ...existing, ...parsed.value };
  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const ids = await applyStripeProductUpdate(stripe, existing, next, siteUrl);

  await db.collection(COLLECTIONS.products).doc(slug).set(
    {
      name: next.name,
      price: next.price,
      hook: next.hook,
      description: next.description,
      badges: next.badges,
      image: next.image,
      ...(next.safetyNote ? { safetyNote: next.safetyNote } : { safetyNote: FieldValue.delete() }),
      stripeProductId: ids.stripeProductId,
      stripePriceId: ids.stripePriceId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, slug });
}
```

- [ ] **Step 2: Create the archive route**

Create `src/app/api/admin/products/[slug]/archive/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlug } from "@/lib/products-store";
import { archiveStripeProduct } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await ctx.params;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { archived?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }
  const archived = Boolean(body.archived);

  const existing = await getStoredProductBySlug(slug);
  if (!existing) return NextResponse.json({ ok: false, errors: ["Product not found."] }, { status: 404 });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (secret && existing.stripeProductId) {
    const stripe = new Stripe(secret);
    // Archiving hides in Stripe; unarchiving reactivates.
    if (archived) {
      await archiveStripeProduct(stripe, existing.stripeProductId);
    } else {
      await stripe.products.update(existing.stripeProductId, { active: true });
    }
  }

  await db.collection(COLLECTIONS.products).doc(slug).set(
    { archived, active: !archived, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return NextResponse.json({ ok: true, slug, archived });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/products/[slug]/route.ts" "src/app/api/admin/products/[slug]/archive/route.ts"
git commit -m "feat: admin update and archive routes (Stripe price rolling + archive)"
```

---

### Task 5: Image upload route

**Files:**
- Modify: `src/lib/firebase-admin.ts`
- Create: `src/app/api/admin/products/image/route.ts`

**Interfaces:**
- Produces: `getBucket()` (Storage bucket or null); route `POST /api/admin/products/image` (multipart form field `file`) returning `{ ok: true; url: string }`.

- [ ] **Step 1: Add a Storage bucket accessor**

In `src/lib/firebase-admin.ts`, add:

```ts
import { getStorage } from "firebase-admin/storage";

/** The default Storage bucket, or null when Storage is not configured. */
export function getBucket() {
  if (!getDb()) return null;
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) return null;
  return getStorage().bucket(name);
}
```

- [ ] **Step 2: Create the upload route**

Create `src/app/api/admin/products/image/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireStaff } from "@/lib/auth";
import { getBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  await requireStaff();
  const bucket = getBucket();
  if (!bucket) return NextResponse.json({ ok: false, error: "storage not configured" }, { status: 503 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ ok: false, error: "unsupported type" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "file too large" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `products/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const gcsFile = bucket.file(path);
  await gcsFile.save(buffer, { contentType: file.type, resumable: false });

  // Long-lived signed read URL (works because the Admin SDK holds the service-account cert).
  const [url] = await gcsFile.getSignedUrl({ action: "read", expires: "2500-01-01" });
  return NextResponse.json({ ok: true, url });
}
```

- [ ] **Step 3: Typecheck and verify upload (manual)**

Run: `npx tsc --noEmit` (expected: no errors), then with `npm run dev` and signed in as staff:

```bash
curl -X POST http://localhost:3000/api/admin/products/image \
  -F "file=@public/products/chicken-feet.png;type=image/png" \
  --cookie "br_session=<paste your session cookie>"
```

Expected: `{ "ok": true, "url": "https://storage.googleapis.com/...signed..." }`, and opening the URL shows the image. (Easiest cookie source: sign in via the browser, copy the `br_session` cookie from dev tools.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase-admin.ts src/app/api/admin/products/image/route.ts
git commit -m "feat: staff-guarded product image upload to Firebase Storage"
```

---

### Task 6: Staff invite route

**Files:**
- Create: `src/app/api/admin/staff/invite/route.ts`

**Interfaces:**
- Consumes: `requireStaff`, `getAuthAdmin`, `getDb`, `COLLECTIONS`, `buildActionCodeSettings`, `signInEmailHtml`, `sendEmail`.
- Produces: `POST /api/admin/staff/invite` (body `{ email }`).

- [ ] **Step 1: Create the invite route**

Create `src/app/api/admin/staff/invite/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getAuthAdmin, getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { buildActionCodeSettings, signInEmailHtml } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const inviter = await requireStaff();
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });

  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email })).uid;
  }
  await auth.setCustomUserClaims(uid, { staff: true });
  await db.collection(COLLECTIONS.staff).doc(uid).set(
    { email, invitedBy: inviter.email, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const link = await auth.generateSignInWithEmailLink(email, buildActionCodeSettings(siteUrl));
  await sendEmail(email, "You have been added to Barking Raw admin", signInEmailHtml(link));

  return NextResponse.json({ ok: true, uid });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/staff/invite/route.ts
git commit -m "feat: staff invite route (grant claim + email a sign-in link)"
```

---

### Task 7: Admin UI (list, create, edit, form)

**Files:**
- Create: `src/components/admin/ProductForm.tsx`
- Create: `src/app/admin/products/page.tsx`
- Create: `src/app/admin/products/new/page.tsx`
- Create: `src/app/admin/products/[slug]/page.tsx`

**Interfaces:**
- Consumes: `requireStaff`, `getAllStoredProducts`, `getStoredProductBySlug`, `ALL_BADGES`, `toCatalogue`, the admin routes from Tasks 3 to 5.

- [ ] **Step 1: Build the shared form**

Create `src/components/admin/ProductForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_BADGES } from "@/lib/product-admin";
import type { Badge, Product } from "@/data/products";

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

export function ProductForm({ mode, initial }: { mode: Mode; initial?: Product }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [safetyNote, setSafetyNote] = useState(initial?.safetyNote ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [badges, setBadges] = useState<Badge[]>(initial?.badges ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleBadge(b: Badge) {
    setBadges((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }

  async function uploadImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/products/image", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) setImage(data.url);
    else setErrors([data.error || "Image upload failed."]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const payload = { name, price: Number(price), hook, description, safetyNote, image, badges };
    const url = mode.kind === "create" ? "/api/admin/products" : `/api/admin/products/${mode.slug}`;
    const method = mode.kind === "create" ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) router.push("/admin/products");
      else setErrors(data.errors || ["Save failed."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "1rem", maxWidth: 640 }}>
      {errors.length > 0 && (
        <ul style={{ color: "#a00" }}>
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      )}
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Price (GBP)
        <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Hook
        <input value={hook} onChange={(e) => setHook(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Safety note (optional)
        <input value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <fieldset>
        <legend>Badges</legend>
        {ALL_BADGES.map((b) => (
          <label key={b} style={{ display: "inline-flex", gap: "0.3rem", marginRight: "1rem" }}>
            <input type="checkbox" checked={badges.includes(b)} onChange={() => toggleBadge(b)} />
            {b}
          </label>
        ))}
      </fieldset>
      <label>
        Image
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files && uploadImage(e.target.files[0])} style={{ display: "block" }} />
      </label>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Product preview" style={{ maxWidth: 200 }} />
      )}
      <button className="btn btn--solid-ink" disabled={busy || !image} type="submit">
        {busy ? "Saving..." : mode.kind === "create" ? "Create product" : "Save changes"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Build the list page**

Create `src/app/admin/products/page.tsx`:

```tsx
import { requireStaff } from "@/lib/auth";
import { getAllStoredProducts } from "@/lib/products-store";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireStaff();
  const products = await getAllStoredProducts();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="display">Products</h1>
          <a className="btn btn--solid-ink" href="/admin/products/new">New product</a>
        </div>
        <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.slug} style={{ borderTop: "1px solid #ddd" }}>
                <td>{p.name}</td>
                <td>{gbp(p.price)}</td>
                <td>{p.archived ? "Archived" : p.active ? "Live" : "Hidden"}</td>
                <td><a href={`/admin/products/${p.slug}`}>Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build the create page**

Create `src/app/admin/products/new/page.tsx`:

```tsx
import { requireStaff } from "@/lib/auth";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <h1 className="display">New product</h1>
        <ProductForm mode={{ kind: "create" }} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Build the edit page**

Create `src/app/admin/products/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getStoredProductBySlug, toCatalogue } from "@/lib/products-store";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await params;
  const product = await getStoredProductBySlug(slug);
  if (!product) notFound();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <h1 className="display">Edit: {product.name}</h1>
        <ProductForm mode={{ kind: "edit", slug }} initial={toCatalogue(product)} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: End-to-end verification (manual)**

Run `npm run dev`, sign in as staff, and:
1. Go to `/admin/products` and confirm the 9 seeded products list.
2. Click New product, fill the form, upload an image, and create it. Confirm it appears in the list and on the public shop page `/`.
3. Buy it end to end in Stripe test mode (`4242 4242 4242 4242`) and confirm the correct price is charged.
4. Edit its price, save, and confirm the shop shows the new price and a fresh Stripe Price exists (old one archived) in the Stripe dashboard.
5. Confirm archiving (via the archive route, or add a button later) removes it from the shop while keeping the row in the admin list.

- [ ] **Step 6: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (shipping, products-store, stripe-sync, auth-helpers, product-admin).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ProductForm.tsx "src/app/admin/products/page.tsx" "src/app/admin/products/new/page.tsx" "src/app/admin/products/[slug]/page.tsx"
git commit -m "feat: admin product UI (list, create, edit with image upload)"
```

---

## Self-Review

**Spec coverage (Stage 3 section of the design spec):**
- `/admin/products` list, create, edit, archive — Tasks 3, 4, 7.
- Image upload via a staff-guarded server route to Firebase Storage — Task 5.
- Every save syncs Stripe, with a new Price created on a price change and the old one archived — Task 2 (`applyStripeProductUpdate`), used in Task 4.
- Staff invite by email (grant claim, record `store_staff`, send a sign-in link) — Task 6.
- Done-when (add a product with an uploaded image, see it live, buy it, edit its price, archive it) — verified in Task 7 step 5.

**Placeholder scan:** No TBD/TODO. Every code step is complete. Manual verification steps carry exact commands and expected output. (An archive button in the list UI is intentionally left to a small follow-up; the archive route is complete and testable via curl, and the list already shows archived status.)

**Type consistency:** `ProductInput` and `validateProductInput` (Task 1) are consumed unchanged by the create and update routes (Tasks 3, 4). `applyStripeProductUpdate`/`archiveStripeProduct`/`priceChanged` (Task 2) match their call sites. `StoredProduct` continues from Stage 1 unchanged. Routes reuse `requireStaff` (Stage 2) and `getStoredProductBySlug`/`getAllStoredProducts`/`toCatalogue` (Stage 1) with identical signatures. Dynamic route params use the async `await params` / `await ctx.params` form required by this Next build.
