# Stage 5: Loyalty Points — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers earn points on paid orders (per-product earn rate, default 10 points per GBP), see and spend them (100 points = GBP 1, any amount up to the order value) at checkout, points expire 30 days after the order that earned them (oldest spent first), and a daily cron expires due points and emails customers whose points are about to lapse.

**Architecture:** An append-only `store_points_ledger` records `earn`, `redeem`, and `expire` entries; each `earn` batch carries its own `remaining` and `expiresAt`, plus a `neverExpires` flag reserved for future Subscribe and Save points. The customer doc keeps a denormalised `pointsBalance` for fast reads. Pure maths (earn calc, FIFO allocation, expiry selection, conversions) lives in `src/lib/loyalty.ts` and is unit-tested; `src/lib/points.ts` is the Firestore data-access layer. Points are earned in the Stripe webhook, redeemed as a one-off Stripe amount-off coupon (1 point = 1 penny) with the actual deduction committed in the webhook, and expired by a cron route.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Firestore transactions), Stripe (coupons), Vitest. Builds on Stages 1 to 4 (products-store, auth/`getSessionUser`, webhook, cart, admin form).

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- **Economy (fixed store-wide unless noted):** default earn `DEFAULT_EARN_RATE = 10` points per GBP spent (overridable per product); redemption `REDEEM_POINTS_PER_POUND = 100` (so 1 point = 1 penny); `EARN_EXPIRY_DAYS = 30`; remind when `EXPIRY_REMINDER_DAYS = 5` or fewer days remain.
- Points are always whole numbers. Redemption is capped at the order total and at the customer's balance.
- Points deduction is committed only when payment completes (in the webhook), never at checkout-session creation, so abandoned checkouts never burn points.
- Only signed-in customers can redeem. Earning happens for any paid order (the account is auto-provisioned in Stage 2).
- Firestore collections stay namespaced `store_*`. Server-only modules never imported by `"use client"` components.
- Cron routes reuse the existing `isAuthorised` bearer pattern (`CRON_SECRET`).
- Run tests with `npx vitest run <path>`.

## Out of scope (separate subsystem)

**Subscribe and Save** (recurring orders, standing discount, non-expiring subscriber points, subscription management) is its own stage and needs its own brainstorm and spec. This plan only leaves a hook for it: the `neverExpires` flag on earn batches. Do not build recurring billing here.

---

## File Structure

- **Create** `src/lib/loyalty.ts` — pure maths + constants. Unit-tested.
- **Create** `src/lib/loyalty.test.ts` — tests.
- **Create** `src/lib/points.ts` — Firestore data-access: balance, earn, redeem, expire/remind.
- **Modify** `src/data/products.ts` — add `pointsPerPound?` to `Product`.
- **Modify** `src/lib/products-store.ts` — parse/expose `pointsPerPound`.
- **Modify** `src/lib/firebase-admin.ts` — add `pointsLedger` collection.
- **Modify** `src/lib/auth.ts` — `ensureCustomer` returns the uid.
- **Modify** `src/app/api/webhooks/stripe/route.ts` — earn on order, redeem committed.
- **Create** `src/app/api/account/points/route.ts` — GET balance for the basket UI.
- **Modify** `src/app/api/checkout/route.ts` — accept and validate `redeemPoints`, apply amount-off.
- **Modify** `src/components/BasketDrawer.tsx` — points redemption UI.
- **Modify** `src/app/account/page.tsx` — balance + history.
- **Create** `src/app/api/cron/points-expiry/route.ts` — expire + remind.
- **Modify** `vercel.json` — schedule the expiry cron.
- **Modify** `src/components/admin/ProductForm.tsx`, `src/lib/product-admin.ts`, `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[slug]/route.ts` — per-product earn rate.

---

### Task 1: Loyalty pure maths + fields

**Files:**
- Modify: `src/data/products.ts`
- Modify: `src/lib/products-store.ts`
- Modify: `src/lib/firebase-admin.ts`
- Create: `src/lib/loyalty.ts`
- Test: `src/lib/loyalty.test.ts`

**Interfaces:**
- Produces:
  - Constants: `DEFAULT_EARN_RATE`, `REDEEM_POINTS_PER_POUND`, `EARN_EXPIRY_DAYS`, `EXPIRY_REMINDER_DAYS`
  - `earnRateFor(p: { pointsPerPound?: number }): number`
  - `pointsForLine(p: { pointsPerPound?: number }, linePounds: number): number`
  - `pointsToPounds(points: number): number`
  - `maxRedeemablePoints(balance: number, orderPounds: number): number`
  - `allocateRedemption(batches: Array<{ id: string; remaining: number }>, requested: number): { allocations: Array<{ id: string; take: number }>; taken: number }`
  - `dueForExpiry(batches: Array<{ id: string; remaining: number; expiresAtMs: number | null }>, nowMs: number): Array<{ id: string; points: number }>`
  - `expiryReminderHtml(name: string, points: number, poundsValue: number): string`
- Adds `pointsPerPound?: number` to `Product`; `pointsLedger: "store_points_ledger"` to `COLLECTIONS`.

- [ ] **Step 1: Add fields**

In `src/data/products.ts`, add to the `Product` interface:

```ts
  pointsPerPound?: number; // per-product earn override; falls back to DEFAULT_EARN_RATE
```

In `src/lib/firebase-admin.ts`, add to `COLLECTIONS`:

```ts
  pointsLedger: "store_points_ledger",
```

In `src/lib/products-store.ts`, in `docToStoredProduct` add:

```ts
    pointsPerPound: data.pointsPerPound === undefined ? undefined : Number(data.pointsPerPound),
```

and in `toCatalogue` add:

```ts
    pointsPerPound: sp.pointsPerPound,
```

and widen `StoredProduct` with `pointsPerPound?: number;`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/loyalty.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  earnRateFor,
  pointsForLine,
  pointsToPounds,
  maxRedeemablePoints,
  allocateRedemption,
  dueForExpiry,
  expiryReminderHtml,
  DEFAULT_EARN_RATE,
} from "./loyalty";

describe("earnRateFor", () => {
  it("uses the default when unset and the override when present", () => {
    expect(earnRateFor({})).toBe(DEFAULT_EARN_RATE);
    expect(earnRateFor({ pointsPerPound: 25 })).toBe(25);
    expect(earnRateFor({ pointsPerPound: -1 })).toBe(DEFAULT_EARN_RATE);
  });
});

describe("pointsForLine", () => {
  it("multiplies the rate by the line pounds and rounds", () => {
    expect(pointsForLine({}, 6.5)).toBe(65); // 10 * 6.5
    expect(pointsForLine({ pointsPerPound: 20 }, 6)).toBe(120);
  });
});

describe("pointsToPounds", () => {
  it("100 points is one pound", () => {
    expect(pointsToPounds(100)).toBe(1);
    expect(pointsToPounds(250)).toBe(2.5);
  });
});

describe("maxRedeemablePoints", () => {
  it("caps at the balance and at the order value in points", () => {
    expect(maxRedeemablePoints(500, 3)).toBe(300); // order worth 300 pts
    expect(maxRedeemablePoints(120, 10)).toBe(120); // balance is the cap
    expect(maxRedeemablePoints(120, 0)).toBe(0);
  });
});

describe("allocateRedemption", () => {
  it("spends oldest batches first and stops at the requested amount", () => {
    const batches = [
      { id: "a", remaining: 30 },
      { id: "b", remaining: 50 },
      { id: "c", remaining: 100 },
    ];
    const res = allocateRedemption(batches, 70);
    expect(res.taken).toBe(70);
    expect(res.allocations).toEqual([
      { id: "a", take: 30 },
      { id: "b", take: 40 },
    ]);
  });
  it("takes only what is available when short", () => {
    const res = allocateRedemption([{ id: "a", remaining: 20 }], 50);
    expect(res.taken).toBe(20);
    expect(res.allocations).toEqual([{ id: "a", take: 20 }]);
  });
});

describe("dueForExpiry", () => {
  it("returns batches past their expiry with remaining points", () => {
    const now = 1_000_000;
    const batches = [
      { id: "a", remaining: 10, expiresAtMs: now - 1 },
      { id: "b", remaining: 5, expiresAtMs: now + 1000 },
      { id: "c", remaining: 0, expiresAtMs: now - 1 },
      { id: "d", remaining: 8, expiresAtMs: null },
    ];
    expect(dueForExpiry(batches, now)).toEqual([{ id: "a", points: 10 }]);
  });
});

describe("expiryReminderHtml", () => {
  it("mentions the points, their value, and greets by name", () => {
    const html = expiryReminderHtml("Sam", 300, 3);
    expect(html).toContain("Sam");
    expect(html).toContain("300");
    expect(html).toContain("3");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/loyalty.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the implementation**

Create `src/lib/loyalty.ts`:

```ts
export const DEFAULT_EARN_RATE = 10; // points earned per GBP spent
export const REDEEM_POINTS_PER_POUND = 100; // 100 points = GBP 1 (1 point = 1 penny)
export const EARN_EXPIRY_DAYS = 30;
export const EXPIRY_REMINDER_DAYS = 5;

export function earnRateFor(p: { pointsPerPound?: number }): number {
  return typeof p.pointsPerPound === "number" && p.pointsPerPound >= 0 ? p.pointsPerPound : DEFAULT_EARN_RATE;
}

export function pointsForLine(p: { pointsPerPound?: number }, linePounds: number): number {
  return Math.round(earnRateFor(p) * linePounds);
}

export function pointsToPounds(points: number): number {
  return points / REDEEM_POINTS_PER_POUND;
}

/** Most points a customer may spend on this order: capped by balance and order value. */
export function maxRedeemablePoints(balance: number, orderPounds: number): number {
  const orderPoints = Math.floor(orderPounds * REDEEM_POINTS_PER_POUND);
  return Math.max(0, Math.min(Math.floor(balance), orderPoints));
}

/** FIFO allocation across earn batches (oldest first). Caller passes batches in age order. */
export function allocateRedemption(
  batches: Array<{ id: string; remaining: number }>,
  requested: number,
): { allocations: Array<{ id: string; take: number }>; taken: number } {
  let left = Math.max(0, Math.floor(requested));
  const allocations: Array<{ id: string; take: number }> = [];
  let taken = 0;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.remaining, left);
    if (take > 0) {
      allocations.push({ id: b.id, take });
      left -= take;
      taken += take;
    }
  }
  return { allocations, taken };
}

/** Which batches have lapsed (past expiry, still holding points). */
export function dueForExpiry(
  batches: Array<{ id: string; remaining: number; expiresAtMs: number | null }>,
  nowMs: number,
): Array<{ id: string; points: number }> {
  return batches
    .filter((b) => b.expiresAtMs !== null && b.expiresAtMs <= nowMs && b.remaining > 0)
    .map((b) => ({ id: b.id, points: b.remaining }));
}

export function expiryReminderHtml(name: string, points: number, poundsValue: number): string {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Your points are about to expire</h1>
    <p>${hi}</p>
    <p>You have <b>${points} points</b> (worth <b>£${poundsValue.toFixed(2)}</b>) that expire soon. Use them on your next order of honest, single-ingredient treats.</p>
    <p><a href="https://barkingraw.dog/#products" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Spend your points</a></p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
  </div>`;
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/loyalty.test.ts` (expected: PASS), then `npx tsc --noEmit` (expected: no errors).

- [ ] **Step 6: Commit**

```bash
git add src/data/products.ts src/lib/products-store.ts src/lib/firebase-admin.ts src/lib/loyalty.ts src/lib/loyalty.test.ts
git commit -m "feat: loyalty maths, constants, and per-product earn field"
```

---

### Task 2: Points data-access layer

**Files:**
- Create: `src/lib/points.ts`
- Modify: `src/lib/auth.ts` (make `ensureCustomer` return the uid)

**Interfaces:**
- Produces:
  - `getPointsBalance(uid: string): Promise<number>`
  - `earnPoints(uid: string, points: number, orderId: string): Promise<void>`
  - `redeemPoints(uid: string, requested: number, orderId: string): Promise<number>` (returns points actually taken)
  - `recentLedger(uid: string, limit?: number): Promise<Array<{ type: string; points: number; createdAtMs: number | null }>>`
  - `expireAndRemind(): Promise<{ expired: number; reminded: number }>`
- Changes: `ensureCustomer(...)` now returns `Promise<string | null>` (the uid).

- [ ] **Step 1: Make ensureCustomer return the uid**

In `src/lib/auth.ts`, change the `ensureCustomer` signature and add a return:

```ts
export async function ensureCustomer(input: {
  email: string;
  name?: string;
  postcode?: string;
}): Promise<string | null> {
  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db || !input.email) return null;
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(input.email)).uid;
  } catch {
    uid = (await auth.createUser({ email: input.email, displayName: input.name || undefined })).uid;
  }
  await db
    .collection(COLLECTIONS.customers)
    .doc(uid)
    .set(
      { ...buildCustomerDoc(input), updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  return uid;
}
```

- [ ] **Step 2: Write the data-access module**

Create `src/lib/points.ts`:

```ts
import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb, getAuthAdmin, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import {
  allocateRedemption,
  dueForExpiry,
  pointsToPounds,
  expiryReminderHtml,
  EARN_EXPIRY_DAYS,
  EXPIRY_REMINDER_DAYS,
} from "@/lib/loyalty";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getPointsBalance(uid: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
  return Number(doc.data()?.pointsBalance ?? 0);
}

/** Record an earn batch (expires in 30 days) and bump the denormalised balance. */
export async function earnPoints(uid: string, points: number, orderId: string): Promise<void> {
  const db = getDb();
  if (!db || points <= 0) return;
  const now = Date.now();
  const batch = db.batch();
  const ledgerRef = db.collection(COLLECTIONS.pointsLedger).doc();
  batch.set(ledgerRef, {
    uid,
    type: "earn",
    points,
    remaining: points,
    orderId,
    neverExpires: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + EARN_EXPIRY_DAYS * DAY_MS),
    reminderSentAt: null,
  });
  batch.set(
    db.collection(COLLECTIONS.customers).doc(uid),
    { pointsBalance: FieldValue.increment(points), lastActivityAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await batch.commit();
}

/** Spend points FIFO across unexpired batches. Returns points actually taken. */
export async function redeemPoints(uid: string, requested: number, orderId: string): Promise<number> {
  const db = getDb();
  if (!db || requested <= 0) return 0;
  const now = Timestamp.now();
  const snap = await db
    .collection(COLLECTIONS.pointsLedger)
    .where("uid", "==", uid)
    .where("type", "==", "earn")
    .where("remaining", ">", 0)
    .get();

  const batches = snap.docs
    .map((d) => ({ id: d.id, remaining: Number(d.data().remaining), expiresAt: d.data().expiresAt as Timestamp | null }))
    .filter((b) => !b.expiresAt || b.expiresAt.toMillis() > now.toMillis())
    .sort((a, b) => (a.expiresAt?.toMillis() ?? 0) - (b.expiresAt?.toMillis() ?? 0));

  const { allocations, taken } = allocateRedemption(batches, requested);
  if (taken <= 0) return 0;

  const writer = db.batch();
  for (const a of allocations) {
    writer.update(db.collection(COLLECTIONS.pointsLedger).doc(a.id), {
      remaining: FieldValue.increment(-a.take),
    });
  }
  writer.set(db.collection(COLLECTIONS.pointsLedger).doc(), {
    uid,
    type: "redeem",
    points: taken,
    orderId,
    createdAt: FieldValue.serverTimestamp(),
  });
  writer.set(
    db.collection(COLLECTIONS.customers).doc(uid),
    { pointsBalance: FieldValue.increment(-taken), lastActivityAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await writer.commit();
  return taken;
}

export async function recentLedger(
  uid: string,
  limit = 20,
): Promise<Array<{ type: string; points: number; createdAtMs: number | null }>> {
  const db = getDb();
  if (!db) return [];
  const snap = await db
    .collection(COLLECTIONS.pointsLedger)
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    const created = data.createdAt as Timestamp | undefined;
    return { type: String(data.type), points: Number(data.points ?? 0), createdAtMs: created ? created.toMillis() : null };
  });
}

/** Cron worker: expire lapsed batches and email customers close to expiry. */
export async function expireAndRemind(): Promise<{ expired: number; reminded: number }> {
  const db = getDb();
  const auth = getAuthAdmin();
  if (!db) return { expired: 0, reminded: 0 };
  const now = Date.now();

  // 1. Expire: batches past expiry that still hold points.
  const earnSnap = await db
    .collection(COLLECTIONS.pointsLedger)
    .where("type", "==", "earn")
    .where("remaining", ">", 0)
    .get();

  const rows = earnSnap.docs.map((d) => {
    const data = d.data();
    const exp = data.expiresAt as Timestamp | null;
    return {
      id: d.id,
      uid: String(data.uid),
      remaining: Number(data.remaining),
      neverExpires: Boolean(data.neverExpires),
      expiresAtMs: data.neverExpires || !exp ? null : exp.toMillis(),
      reminderSentAt: data.reminderSentAt as Timestamp | null,
    };
  });

  const due = dueForExpiry(rows.map((r) => ({ id: r.id, remaining: r.remaining, expiresAtMs: r.expiresAtMs })), now);
  let expired = 0;
  for (const d of due) {
    const row = rows.find((r) => r.id === d.id)!;
    const writer = db.batch();
    writer.update(db.collection(COLLECTIONS.pointsLedger).doc(d.id), { remaining: 0 });
    writer.set(db.collection(COLLECTIONS.pointsLedger).doc(), {
      uid: row.uid,
      type: "expire",
      points: d.points,
      sourceBatchId: d.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    writer.set(
      db.collection(COLLECTIONS.customers).doc(row.uid),
      { pointsBalance: FieldValue.increment(-d.points) },
      { merge: true },
    );
    await writer.commit();
    expired += d.points;
  }

  // 2. Remind: batches expiring within the reminder window, not yet reminded.
  const soon = now + EXPIRY_REMINDER_DAYS * DAY_MS;
  const toRemind = rows.filter(
    (r) => r.expiresAtMs !== null && r.expiresAtMs > now && r.expiresAtMs <= soon && !r.reminderSentAt && r.remaining > 0,
  );
  let reminded = 0;
  for (const r of toRemind) {
    let email = "";
    let name = "";
    try {
      const custDoc = await db.collection(COLLECTIONS.customers).doc(r.uid).get();
      email = String(custDoc.data()?.email ?? "");
      name = String(custDoc.data()?.name ?? "");
      if (!email && auth) email = (await auth.getUser(r.uid)).email ?? "";
    } catch {
      /* skip */
    }
    if (email) {
      await sendEmail(email, "Your Barking Raw points expire soon", expiryReminderHtml(name, r.remaining, pointsToPounds(r.remaining)));
      reminded += 1;
    }
    await db.collection(COLLECTIONS.pointsLedger).doc(r.id).update({ reminderSentAt: FieldValue.serverTimestamp() });
  }

  return { expired, reminded };
}
```

Note: the `redeem` and `expire` queries combine `where` filters that Firestore may ask you to back with a composite index. On first run, the server logs a link that creates the index in one click. Create it before relying on the cron in production.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/points.ts src/lib/auth.ts
git commit -m "feat: points data-access (balance, earn, redeem FIFO, expire/remind)"
```

---

### Task 3: Earn points on paid orders

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `ensureCustomer` (now returns uid), `earnPoints`, `redeemPoints`; `pointsForLine`; `getStoredProductBySlug`.

- [ ] **Step 1: Add imports**

In `src/app/api/webhooks/stripe/route.ts`, add:

```ts
import { earnPoints, redeemPoints } from "@/lib/points";
import { pointsForLine } from "@/lib/loyalty";
import { getStoredProductBySlug } from "@/lib/products-store";
```

- [ ] **Step 2: Earn (and commit any redemption) after fulfilment**

In `fulfil`, replace the Stage 2 `ensureCustomer(...)` call with a block that captures the uid, commits any redemption from metadata, and awards earn points from the cart's lines:

```ts
    // Invisible account + loyalty.
    const uid = await ensureCustomer({ email: customerEmail, name: customerName, postcode }).catch((err) => {
      console.error("[webhook] ensureCustomer failed:", err);
      return null;
    });

    if (uid) {
      // Commit any points the customer chose to spend on this order.
      const redeem = Number(full.metadata?.redeemPoints ?? 0);
      if (redeem > 0) {
        await redeemPoints(uid, redeem, full.id).catch((err) => console.error("[webhook] redeem failed:", err));
      }
      // Award earn points from the cart's stored lines (server prices, per-product rate).
      const cartId = full.metadata?.cartId;
      if (cartId) {
        const cartSnap = await db.collection(COLLECTIONS.carts).doc(cartId).get();
        const cartItems = (cartSnap.data()?.items ?? []) as Array<{ slug: string; qty: number }>;
        let earned = 0;
        for (const item of cartItems) {
          const p = await getStoredProductBySlug(item.slug);
          if (!p) continue;
          const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
          earned += pointsForLine(p, p.price * qty);
        }
        if (earned > 0) await earnPoints(uid, earned, full.id).catch((err) => console.error("[webhook] earn failed:", err));
      }
    }
```

(The Stage 4 `adjustStock(db, full.metadata?.cartId)` call stays after this block.)

- [ ] **Step 3: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors). Buy in test mode, then check the buyer's `store_customers` doc has `pointsBalance` equal to 10 x the subtotal in pounds (for default-rate products), and a `store_points_ledger` `earn` doc exists with a 30-day `expiresAt`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: earn and commit-redeem loyalty points on paid orders"
```

---

### Task 4: Redemption at checkout + basket UI

**Files:**
- Create: `src/app/api/account/points/route.ts`
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/components/BasketDrawer.tsx`

**Interfaces:**
- Produces: `GET /api/account/points` returning `{ signedIn: boolean; balance: number }`; checkout accepts `redeemPoints`.
- Consumes: `getSessionUser`, `getPointsBalance`; `maxRedeemablePoints`, `pointsToPounds`.

- [ ] **Step 1: Balance endpoint**

Create `src/app/api/account/points/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPointsBalance } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ signedIn: false, balance: 0 });
  const balance = await getPointsBalance(user.uid);
  return NextResponse.json({ signedIn: true, balance });
}
```

- [ ] **Step 2: Apply redemption in checkout**

In `src/app/api/checkout/route.ts`, add imports:

```ts
import { getSessionUser } from "@/lib/auth";
import { getPointsBalance } from "@/lib/points";
import { maxRedeemablePoints } from "@/lib/loyalty";
```

Extend the destructured body to include `redeemPoints`:

```ts
  const { lines = [], name = "", email = "", postcode = "", discountCode = "", redeemPoints = 0 } = body;
```

(Also add `redeemPoints?: number` to the `body` type annotation.)

Then, after `const shipping = computeShipping(postcode, subtotal);` and before building the Stripe session, compute the redemption. Replace the existing discount block so that points redemption takes precedence over a recovery code:

```ts
  const db = getDb();
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
  const orderTotal = subtotal + shipping.cost;

  // Points redemption (signed-in customers only). Committed later in the webhook.
  let appliedPoints = 0;
  const sessionUser = await getSessionUser();
  if (sessionUser && Number(redeemPoints) > 0) {
    const balance = await getPointsBalance(sessionUser.uid);
    appliedPoints = maxRedeemablePoints(balance, orderTotal);
    appliedPoints = Math.min(appliedPoints, Math.floor(Number(redeemPoints)));
    if (appliedPoints > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: appliedPoints, // 1 point = 1 penny
        currency: "gbp",
        duration: "once",
        name: `Barking Raw points (£${(appliedPoints / 100).toFixed(2)})`,
      });
      discounts.push({ coupon: coupon.id });
    }
  }

  // Recovery discount code, only when not redeeming points.
  if (!appliedPoints && discountCode && db) {
    const snap = await db.collection(COLLECTIONS.discountCodes).doc(discountCode.toUpperCase()).get();
    const data = snap.data();
    const valid =
      snap.exists && data && !data.used && (!data.expiresAt || data.expiresAt.toMillis() > Date.now());
    if (valid) {
      const coupon = await stripe.coupons.create({
        percent_off: data!.percent,
        duration: "once",
        name: `Barking Raw ${data!.percent}% welcome back`,
      });
      discounts.push({ coupon: coupon.id });
    }
  }
```

Then extend the cart record and the session metadata to carry the redemption:

```ts
    const ref = await db.collection(COLLECTIONS.carts).add({
      items: lines,
      name,
      email,
      postcode,
      subtotal,
      redeemPoints: appliedPoints,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
```

and in `stripe.checkout.sessions.create({ ... })` set:

```ts
    metadata: {
      cartId,
      postcode,
      itemSummary: summary.join(", "),
      redeemPoints: String(appliedPoints),
      uid: sessionUser?.uid ?? "",
    },
```

Remove the old standalone discount block that this replaces, and keep the existing `...(discounts.length ? { discounts } : { allow_promotion_codes: true })` spread as is.

- [ ] **Step 3: Basket redemption UI**

In `src/components/BasketDrawer.tsx`, add points state and load the balance when the drawer opens. Add near the other `useState` calls:

```tsx
  const [points, setPoints] = useState<{ signedIn: boolean; balance: number }>({ signedIn: false, balance: 0 });
  const [redeem, setRedeem] = useState(0);
```

Add an effect (import `useEffect`):

```tsx
  useEffect(() => {
    if (!open) return;
    fetch("/api/account/points")
      .then((r) => r.json())
      .then((d) => setPoints({ signedIn: !!d.signedIn, balance: Number(d.balance || 0) }))
      .catch(() => {});
  }, [open]);
```

Compute the redemption cap and value near the other derived values:

```tsx
  const maxRedeem = Math.min(points.balance, Math.floor(total * 100));
  const redeemApplied = Math.min(redeem, maxRedeem);
  const redeemValue = redeemApplied / 100;
```

Add the redemption control inside the `drawer__body`, after the discount-code field, shown only to signed-in customers with a balance:

```tsx
              {points.signedIn && points.balance > 0 && (
                <div className="field">
                  <label htmlFor="pts">
                    Use points (you have {points.balance}, worth {gbp(points.balance / 100)})
                  </label>
                  <input
                    id="pts"
                    type="number"
                    min={0}
                    max={maxRedeem}
                    step={1}
                    value={redeem || ""}
                    onChange={(e) => setRedeem(Math.max(0, Math.min(maxRedeem, Math.floor(Number(e.target.value) || 0))))}
                    placeholder={`Up to ${maxRedeem}`}
                  />
                </div>
              )}
```

Show the discount in the summary, before the total row:

```tsx
              {redeemApplied > 0 && (
                <div className="summary-row">
                  <span>Points</span>
                  <span>-{gbp(redeemValue)}</span>
                </div>
              )}
```

Update the total shown to subtract the redemption:

```tsx
              <div className="summary-row summary-row--total">
                <span>Total</span>
                <span>{gbp(Math.max(0, total - redeemValue))}</span>
              </div>
```

And include `redeemPoints` in the checkout request body:

```tsx
        body: JSON.stringify({ lines, name, email, postcode, discountCode, redeemPoints: redeemApplied }),
```

- [ ] **Step 4: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors). Signed in as a customer with points, open the basket, apply points, and confirm the total drops and Stripe Checkout shows the discount. Complete payment and confirm the balance decreased by exactly the applied points and a `redeem` ledger entry exists. As a signed-out visitor, confirm no points control appears and checkout still works.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/points/route.ts src/app/api/checkout/route.ts src/components/BasketDrawer.tsx
git commit -m "feat: redeem points at checkout with basket UI"
```

---

### Task 5: Points on the account page

**Files:**
- Modify: `src/app/account/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `getPointsBalance`, `recentLedger`; `pointsToPounds`.

- [ ] **Step 1: Show balance + history**

Replace `src/app/account/page.tsx` body with:

```tsx
import { requireUser } from "@/lib/auth";
import { getPointsBalance, recentLedger } from "@/lib/points";
import { pointsToPounds } from "@/lib/loyalty";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { earn: "Earned", redeem: "Spent", expire: "Expired" };

export default async function AccountPage() {
  const user = await requireUser();
  const balance = await getPointsBalance(user.uid);
  const history = await recentLedger(user.uid);
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 620 }}>
        <h1 className="display">Your account</h1>
        <p>Signed in as {user.email}.</p>
        <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>
          {balance} points <span style={{ opacity: 0.7 }}>(worth {gbp(pointsToPounds(balance))})</span>
        </p>
        <h2 style={{ marginTop: "2rem" }}>Recent activity</h2>
        {history.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No points activity yet.</p>
        ) : (
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                {LABELS[h.type] ?? h.type}: {h.type === "earn" ? "+" : "-"}
                {h.points} points
                {h.createdAtMs ? ` on ${new Date(h.createdAtMs).toLocaleDateString("en-GB")}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify (manual)**

Run `npm run dev`, sign in, and confirm `/account` shows the balance and a list with earn/redeem/expire entries.

- [ ] **Step 3: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "feat: show points balance and history on the account page"
```

---

### Task 6: Expiry + reminder cron

**Files:**
- Create: `src/app/api/cron/points-expiry/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `expireAndRemind`.

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/points-expiry/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { expireAndRemind } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const result = await expireAndRemind();
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Schedule it**

In `vercel.json`, add to the `crons` array:

```json
    { "path": "/api/cron/points-expiry", "schedule": "0 9 * * *" }
```

(Daily is sufficient for 30-day expiry; unlike the abandoned-cart job it needs no sub-daily GitHub Action.)

- [ ] **Step 3: Verify (manual)**

With `npm run dev`, create a `store_points_ledger` earn doc whose `expiresAt` is in the past and `remaining > 0`, then:

```bash
curl http://localhost:3000/api/cron/points-expiry
```

Expected: `{ "expired": <points>, "reminded": <n> }`, the batch's `remaining` becomes 0, an `expire` ledger entry is written, and the customer's `pointsBalance` drops by that amount. Set another batch's `expiresAt` to two days out and confirm a reminder email is sent once and `reminderSentAt` is stamped.

- [ ] **Step 4: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (shipping, products-store, stripe-sync, auth-helpers, product-admin, inventory, loyalty).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/points-expiry/route.ts vercel.json
git commit -m "feat: daily cron to expire points and remind customers"
```

---

### Task 7: Per-product earn rate in the admin

**Files:**
- Modify: `src/lib/product-admin.ts`
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[slug]/route.ts`

**Interfaces:**
- Extends `ProductInput` with `pointsPerPound?: number`.

- [ ] **Step 1: Carry pointsPerPound through validation**

In `src/lib/product-admin.ts`, add `pointsPerPound?: number` to `ProductInput`, and in `validateProductInput` compute (near the stock parsing from Stage 4):

```ts
  const pointsPerPound =
    input.pointsPerPound === undefined || input.pointsPerPound === null || (input.pointsPerPound as unknown) === ""
      ? undefined
      : Math.max(0, Number(input.pointsPerPound));
```

and include `pointsPerPound` in the returned `value`.

- [ ] **Step 2: Add the field to the form**

In `src/components/admin/ProductForm.tsx`, add state:

```tsx
  const [pointsPerPound, setPointsPerPound] = useState(
    initial?.pointsPerPound === undefined ? "" : String(initial.pointsPerPound),
  );
```

Add to the payload:

```tsx
      pointsPerPound: pointsPerPound === "" ? undefined : Number(pointsPerPound),
```

Add an input near the stock fields:

```tsx
      <label>
        Points per £1 (blank uses the default of 10)
        <input type="number" min="0" step="1" value={pointsPerPound} onChange={(e) => setPointsPerPound(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
```

- [ ] **Step 3: Persist in both routes**

In `src/app/api/admin/products/route.ts` (create) and `src/app/api/admin/products/[slug]/route.ts` (update), add to the Firestore `set` object:

```ts
    ...(parsed.value.pointsPerPound === undefined ? {} : { pointsPerPound: parsed.value.pointsPerPound }),
```

- [ ] **Step 4: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors). Set a product's points per £1 to 20 in the admin, buy it, and confirm the earn points reflect the higher rate.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-admin.ts src/components/admin/ProductForm.tsx src/app/api/admin/products/route.ts "src/app/api/admin/products/[slug]/route.ts"
git commit -m "feat: per-product points earn rate in the admin"
```

---

## Self-Review

**Spec coverage (Stage 5 section of the design spec, as amended):**
- Earn on paid orders, per-product rate, into the account matched by email — Tasks 1, 3, 7.
- Balance and history on `/account` — Task 5.
- Redeem as money off at checkout when logged in, any amount up to order value — Task 4.
- 30-day per-batch (FIFO) expiry — Tasks 1, 2 (`allocateRedemption`, `dueForExpiry`, `expiresAt`).
- Expiry cron + reminder email — Task 6.
- `neverExpires` hook left for Subscribe and Save — Task 2 (earn batch field), respected by `expireAndRemind`.

**Placeholder scan:** No TBD/TODO. All code shown. Manual verification steps carry concrete inputs and expected outputs. The Firestore composite-index requirement is called out in Task 2 rather than left to fail silently.

**Type consistency:** loyalty constants and pure functions defined once (Task 1) and reused by `points.ts` (Task 2), the webhook (Task 3), checkout (Task 4), and the account page (Task 5). `ensureCustomer` returning `Promise<string | null>` (Task 2) matches its new use in the webhook (Task 3); its earlier callers ignored the return, so they remain valid. `pointsPerPound` flows Product to StoredProduct to ProductInput to Firestore with one shape. Redemption uses 1 point = 1 penny consistently (coupon `amount_off = appliedPoints`).

**Decision record:** points redemption and a recovery discount code are mutually exclusive in one order (points take precedence), because Stripe Checkout applies a single discount. Noted in Task 4.
