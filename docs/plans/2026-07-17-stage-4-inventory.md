# Stage 4: Inventory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track stock per product in Firestore, decrement it on each paid order, mark products sold out at zero (still shown, but not buyable), email staff to reorder when stock is low, and let staff set the count to restock.

**Architecture:** Products gain optional `stock` and `lowStockThreshold` fields. When `stock` is undefined a product is untracked and always buyable (nothing breaks for products created before this stage). The Stripe webhook decrements stock inside a Firestore transaction using the cart's stored line items, and emails staff when a line crosses the low-stock threshold. The shop shows a "Sold out" state; checkout refuses or clamps to available stock. Staff edit stock through the existing product form.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Firestore transactions), Vitest. Builds on Stages 1 to 3.

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- Firestore collections stay namespaced `store_*`. Server-only modules are never imported by `"use client"` components.
- Prices are GBP pounds; stock is a whole-number count.
- **Default low-stock threshold is 5** (a product alerts staff when its stock drops to 5 or below). This is the one tunable in this stage; change the `DEFAULT_LOW_STOCK_THRESHOLD` constant if you want a different default.
- Staff reorder alerts go to `STAFF_ALERT_EMAIL` (fall back to `EMAIL_FROM`, then `hello@barkingraw.dog`).
- Run tests with `npx vitest run <path>`.

---

## File Structure

- **Create** `src/lib/inventory.ts` — pure helpers: `isBuyable`, `isSoldOut`, `isLowStock`, `decrementStock`, `lowStockEmailHtml`, `DEFAULT_LOW_STOCK_THRESHOLD`. Unit-tested.
- **Create** `src/lib/inventory.test.ts` — tests for the above.
- **Modify** `src/lib/products-store.ts` — parse `stock`/`lowStockThreshold` in `docToStoredProduct`; include `stock`, `lowStockThreshold`, `soldOut` in `toCatalogue`.
- **Modify** `src/data/products.ts` — add `stock`, `lowStockThreshold`, `soldOut` to the `Product` type.
- **Modify** `src/components/ProductCard.tsx` — show "Sold out" and disable Add.
- **Modify** `src/app/api/checkout/route.ts` — skip sold-out lines, clamp quantity to available stock.
- **Modify** `src/app/api/webhooks/stripe/route.ts` — decrement stock + low-stock alert after fulfilment.
- **Modify** `src/components/admin/ProductForm.tsx` — stock + threshold fields.
- **Modify** `src/app/api/admin/products/route.ts` and `src/app/api/admin/products/[slug]/route.ts` — persist stock + threshold.
- **Modify** `src/lib/product-admin.ts` — carry `stock`/`lowStockThreshold` through validation.
- **Modify** `src/app/admin/products/page.tsx` — show stock in the list.

---

### Task 1: Inventory pure helpers + product fields

**Files:**
- Modify: `src/data/products.ts`
- Create: `src/lib/inventory.ts`
- Test: `src/lib/inventory.test.ts`
- Modify: `src/lib/products-store.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_LOW_STOCK_THRESHOLD = 5`
  - `isBuyable(p: { active: boolean; archived: boolean; stock?: number }): boolean`
  - `isSoldOut(p: { stock?: number }): boolean`
  - `isLowStock(stock: number, threshold: number): boolean`
  - `decrementStock(current: number, qty: number): number`
  - `lowStockEmailHtml(items: Array<{ name: string; stock: number }>): string`
- Adds to `Product`: `stock?: number`, `lowStockThreshold?: number`, `soldOut?: boolean`.

- [ ] **Step 1: Add fields to the Product type**

In `src/data/products.ts`, add to the `Product` interface (after `stripePriceId`):

```ts
  stock?: number; // undefined = untracked (always buyable)
  lowStockThreshold?: number;
  soldOut?: boolean; // derived for the client; not stored
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/inventory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isBuyable, isSoldOut, isLowStock, decrementStock, lowStockEmailHtml } from "./inventory";

describe("isBuyable", () => {
  it("untracked products are always buyable when active and not archived", () => {
    expect(isBuyable({ active: true, archived: false })).toBe(true);
  });
  it("tracked products need stock above zero", () => {
    expect(isBuyable({ active: true, archived: false, stock: 3 })).toBe(true);
    expect(isBuyable({ active: true, archived: false, stock: 0 })).toBe(false);
  });
  it("archived or inactive is never buyable", () => {
    expect(isBuyable({ active: false, archived: false, stock: 5 })).toBe(false);
    expect(isBuyable({ active: true, archived: true, stock: 5 })).toBe(false);
  });
});

describe("isSoldOut", () => {
  it("is true only for tracked products at or below zero", () => {
    expect(isSoldOut({ stock: 0 })).toBe(true);
    expect(isSoldOut({ stock: 2 })).toBe(false);
    expect(isSoldOut({})).toBe(false);
  });
});

describe("isLowStock", () => {
  it("is true at or below the threshold", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe("decrementStock", () => {
  it("never goes below zero", () => {
    expect(decrementStock(3, 2)).toBe(1);
    expect(decrementStock(1, 5)).toBe(0);
  });
});

describe("lowStockEmailHtml", () => {
  it("lists each low item and its remaining count", () => {
    const html = lowStockEmailHtml([{ name: "Chicken Feet", stock: 2 }]);
    expect(html).toContain("Chicken Feet");
    expect(html).toContain("2");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/inventory.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the implementation**

Create `src/lib/inventory.ts`:

```ts
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function isSoldOut(p: { stock?: number }): boolean {
  return typeof p.stock === "number" && p.stock <= 0;
}

export function isBuyable(p: { active: boolean; archived: boolean; stock?: number }): boolean {
  if (!p.active || p.archived) return false;
  return !isSoldOut(p);
}

export function isLowStock(stock: number, threshold: number): boolean {
  return stock <= threshold;
}

export function decrementStock(current: number, qty: number): number {
  return Math.max(0, current - qty);
}

export function lowStockEmailHtml(items: Array<{ name: string; stock: number }>): string {
  const rows = items
    .map((i) => `<li><b>${i.name}</b>: ${i.stock} left</li>`)
    .join("");
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Time to reorder</h1>
    <p>These products are running low at Barking Raw:</p>
    <ul>${rows}</ul>
    <p style="color:#6b6b6b;font-size:13px">Update the counts in the admin once new stock arrives.</p>
  </div>`;
}
```

- [ ] **Step 5: Parse and expose the new fields in products-store**

In `src/lib/products-store.ts`, inside `docToStoredProduct`, add before the closing `}` of the returned object:

```ts
    stock: data.stock === undefined ? undefined : Number(data.stock),
    lowStockThreshold: data.lowStockThreshold === undefined ? undefined : Number(data.lowStockThreshold),
```

And in `toCatalogue`, add `stock`, `lowStockThreshold`, and a derived `soldOut` to the returned object:

```ts
    stock: sp.stock,
    lowStockThreshold: sp.lowStockThreshold,
    soldOut: typeof sp.stock === "number" && sp.stock <= 0,
```

Also widen the `StoredProduct` type to include the new fields:

```ts
export type StoredProduct = Product & {
  active: boolean;
  archived: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
  stock?: number;
  lowStockThreshold?: number;
};
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/inventory.test.ts` (expected: PASS), then `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 7: Commit**

```bash
git add src/data/products.ts src/lib/inventory.ts src/lib/inventory.test.ts src/lib/products-store.ts
git commit -m "feat: inventory helpers and stock fields on products"
```

---

### Task 2: Shop shows sold out + checkout respects stock

**Files:**
- Modify: `src/components/ProductCard.tsx:31-38`
- Modify: `src/app/api/checkout/route.ts` (line-item loop)

**Interfaces:**
- Consumes: `Product.soldOut`; `StoredProduct.stock`.

- [ ] **Step 1: Show sold out on the card**

In `src/components/ProductCard.tsx`, replace the `card__foot` block:

```tsx
        <div className="card__foot">
          <span className="card__price">{gbp(product.price)}</span>
          {product.soldOut ? (
            <button className="btn" disabled aria-disabled="true">Sold out</button>
          ) : (
            <button className="btn btn--solid-ink" onClick={onAdd}>Add</button>
          )}
        </div>
```

- [ ] **Step 2: Respect stock in checkout**

In `src/app/api/checkout/route.ts`, update the line-item loop so tracked stock caps the quantity and sold-out items are skipped. Replace the loop body from Stage 1 with:

```ts
  for (const l of lines) {
    const p = bySlug.get(l.slug);
    if (!p || !p.active || p.archived) continue;
    let qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    if (typeof p.stock === "number") {
      if (p.stock <= 0) continue; // sold out
      qty = Math.min(qty, p.stock); // never sell more than we hold
    }
    subtotal += p.price * qty;
    summary.push(`${qty} x ${p.name}`);
    line_items.push(buildCheckoutLineItem(p, qty));
  }
```

- [ ] **Step 3: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors). With a product's `stock` set to 0 in Firestore, confirm the shop shows "Sold out" and the item cannot be added/checked out; set it to 2 and confirm you cannot check out a quantity above 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCard.tsx src/app/api/checkout/route.ts
git commit -m "feat: sold-out UI and stock-capped checkout"
```

---

### Task 3: Decrement stock + low-stock alert on paid orders

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `decrementStock`, `isLowStock`, `lowStockEmailHtml`, `DEFAULT_LOW_STOCK_THRESHOLD`; `sendEmail`; the cart's stored `items`.

- [ ] **Step 1: Add a stock-adjustment helper to the webhook module**

In `src/app/api/webhooks/stripe/route.ts`, add these imports at the top:

```ts
import { decrementStock, isLowStock, lowStockEmailHtml, DEFAULT_LOW_STOCK_THRESHOLD } from "@/lib/inventory";
```

Then add this function at the bottom of the file:

```ts
async function adjustStock(
  db: FirebaseFirestore.Firestore,
  cartId: string | undefined,
): Promise<void> {
  if (!cartId) return;
  const cartSnap = await db.collection(COLLECTIONS.carts).doc(cartId).get();
  const items = (cartSnap.data()?.items ?? []) as Array<{ slug: string; qty: number }>;
  const low: Array<{ name: string; stock: number }> = [];

  for (const item of items) {
    if (!item?.slug) continue;
    const ref = db.collection(COLLECTIONS.products).doc(item.slug);
    const crossed = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.data();
      if (!data || typeof data.stock !== "number") return null; // untracked
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const nextStock = decrementStock(data.stock, qty);
      tx.update(ref, { stock: nextStock });
      const threshold = typeof data.lowStockThreshold === "number" ? data.lowStockThreshold : DEFAULT_LOW_STOCK_THRESHOLD;
      const wasAbove = !isLowStock(data.stock, threshold);
      const nowLow = isLowStock(nextStock, threshold);
      return wasAbove && nowLow ? { name: String(data.name ?? item.slug), stock: nextStock } : null;
    });
    if (crossed) low.push(crossed);
  }

  if (low.length) {
    const to = process.env.STAFF_ALERT_EMAIL || process.env.EMAIL_FROM || "hello@barkingraw.dog";
    await sendEmail(to, "Barking Raw: products running low", lowStockEmailHtml(low));
  }
}
```

- [ ] **Step 2: Call it from fulfil**

In `fulfil`, inside the `if (db) { ... }` block, after the `ensureCustomer(...)` call added in Stage 2, add:

```ts
    await adjustStock(db, full.metadata?.cartId).catch((err) => {
      console.error("[webhook] adjustStock failed:", err);
    });
```

- [ ] **Step 3: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors). Set a product's `stock` to 6 and `lowStockThreshold` to 5, buy 2 in test mode, and confirm the stock becomes 4 in Firestore and a "running low" email is sent (needs `RESEND_API_KEY`). Buy again and confirm it keeps decrementing and hits sold out at zero.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: decrement stock and email staff on low stock after paid orders"
```

---

### Task 4: Staff edit stock in the admin

**Files:**
- Modify: `src/lib/product-admin.ts`
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[slug]/route.ts`
- Modify: `src/app/admin/products/page.tsx`

**Interfaces:**
- Extends `ProductInput` with optional `stock?: number` and `lowStockThreshold?: number` carried through `validateProductInput`.

- [ ] **Step 1: Carry stock through validation**

In `src/lib/product-admin.ts`, extend `ProductInput` and `validateProductInput` to pass stock fields through (they are optional; blank means untracked). Add to the `ProductInput` type:

```ts
  stock?: number;
  lowStockThreshold?: number;
```

And in `validateProductInput`, before the `return { ok: true, ... }`, compute:

```ts
  const stock =
    input.stock === undefined || input.stock === null || (input.stock as unknown) === ""
      ? undefined
      : Math.max(0, Math.floor(Number(input.stock)));
  const lowStockThreshold =
    input.lowStockThreshold === undefined || input.lowStockThreshold === null || (input.lowStockThreshold as unknown) === ""
      ? undefined
      : Math.max(0, Math.floor(Number(input.lowStockThreshold)));
```

Then include `stock` and `lowStockThreshold` in the returned `value` object. Update the Task 1 (Stage 3) test expectation if it deep-equals the whole value: the good-input result now also carries `stock: undefined, lowStockThreshold: undefined`, so prefer `toMatchObject` over `toEqual` there, or extend the expectation. (Add a quick test: `validateProductInput({ ...good, stock: 4 })` yields `value.stock === 4`.)

- [ ] **Step 2: Add stock fields to the form**

In `src/components/admin/ProductForm.tsx`, add state and inputs. After the `safetyNote` state, add:

```tsx
  const [stock, setStock] = useState(initial?.stock === undefined ? "" : String(initial.stock));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initial?.lowStockThreshold === undefined ? "" : String(initial.lowStockThreshold),
  );
```

In the payload inside `submit`, add:

```tsx
      stock: stock === "" ? undefined : Number(stock),
      lowStockThreshold: lowStockThreshold === "" ? undefined : Number(lowStockThreshold),
```

And add inputs before the Badges fieldset:

```tsx
      <label>
        Stock (leave blank for untracked)
        <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Low-stock alert threshold
        <input type="number" min="0" step="1" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
```

- [ ] **Step 3: Persist stock in the create route**

In `src/app/api/admin/products/route.ts`, add to the `db.collection(...).doc(slug).set({ ... })` object:

```ts
    ...(parsed.value.stock === undefined ? {} : { stock: parsed.value.stock }),
    ...(parsed.value.lowStockThreshold === undefined ? {} : { lowStockThreshold: parsed.value.lowStockThreshold }),
```

- [ ] **Step 4: Persist stock in the update route**

In `src/app/api/admin/products/[slug]/route.ts`, add to the `set({ ... }, { merge: true })` object:

```ts
    ...(parsed.value.stock === undefined ? {} : { stock: parsed.value.stock }),
    ...(parsed.value.lowStockThreshold === undefined ? {} : { lowStockThreshold: parsed.value.lowStockThreshold }),
```

(A blank field leaves the existing value untouched under merge; to explicitly untrack, a follow-up "untrack" control can set `stock: FieldValue.delete()`, out of scope here.)

- [ ] **Step 5: Show stock in the admin list**

In `src/app/admin/products/page.tsx`, add a Stock column. In the `<thead>` row add `<th>Stock</th>` before the empty `<th></th>`, and in the body row add before the Edit cell:

```tsx
                <td>{typeof p.stock === "number" ? p.stock : "untracked"}</td>
```

- [ ] **Step 6: Test + typecheck + verify (manual)**

Run `npx vitest run` (expected: PASS, including the updated product-admin test) and `npx tsc --noEmit` (expected: no errors). In the admin, edit a product to set stock to 3, confirm the shop shows it buyable, buy all 3, and confirm it flips to "Sold out"; then set stock to 10 in the admin and confirm it returns to the shop.

- [ ] **Step 7: Commit**

```bash
git add src/lib/product-admin.ts src/components/admin/ProductForm.tsx src/app/api/admin/products/route.ts "src/app/api/admin/products/[slug]/route.ts" src/app/admin/products/page.tsx
git commit -m "feat: staff manage stock levels and low-stock thresholds"
```

---

## Self-Review

**Spec coverage (Stage 4 section of the design spec):**
- Quantity tracked in Firestore — Tasks 1, 4.
- Decrement on each paid order — Task 3 (transactional, from the cart's line items).
- Low-stock reorder email to staff — Task 3 (`lowStockEmailHtml`, threshold crossing).
- Auto sold out at zero — Tasks 1, 2 (`isSoldOut`/`isBuyable`, sold-out UI, checkout refusal).
- Manual restock by typing the new count — Task 4.
- Checkout refuses sold-out / insufficient stock — Task 2.

**Placeholder scan:** No TBD/TODO; all code shown. Manual verification steps carry concrete stock numbers and expected outcomes.

**Type consistency:** `stock`/`lowStockThreshold` added once to `Product` (Task 1) and `StoredProduct` (Task 1), carried through `validateProductInput`/`ProductInput` (Task 4) and persisted by both routes with identical shapes. The pure predicates (`isBuyable`, `isSoldOut`, `isLowStock`, `decrementStock`) are defined once and reused by checkout, the webhook, and the UI derivation. `DEFAULT_LOW_STOCK_THRESHOLD` centralises the one tunable.

**Note on the Stage 3 test:** extending `validateProductInput`'s returned `value` means the Stage 3 exact-equality test on the good input must become `toMatchObject` (or add the two new undefined fields). Flagged in Task 4 Step 1 so it is fixed, not discovered later.
