# Stage 6: Admin Orders & Customers View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff read-only lists of recent orders and of customer accounts (with points balances) inside `/admin`, without changing anything about how the Google Sheet is populated.

**Architecture:** Two server components under `/admin`, each gated by `requireStaff`, read from `store_orders` and `store_customers`. Pure mappers turn raw Firestore docs into display rows and are unit-tested; the pages render simple tables. Nothing writes; the fulfilment Sheet keeps receiving rows from the webhook exactly as before.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Firestore reads), Vitest. Builds on Stage 2 (`requireStaff`) and Stage 5 (`pointsBalance`).

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- Read-only: no mutations, no new writes to Firestore or the Sheet.
- Staff-gated: every page calls `requireStaff()` first.
- Firestore collections stay namespaced `store_*`.
- Run tests with `npx vitest run <path>`.

---

## File Structure

- **Create** `src/lib/admin-data.ts` — pure row mappers + Firestore reads for orders and customers. Mappers unit-tested.
- **Create** `src/lib/admin-data.test.ts` — tests for the mappers.
- **Create** `src/app/admin/orders/page.tsx` — orders list (server).
- **Create** `src/app/admin/customers/page.tsx` — customers list (server).
- **Modify** `src/app/admin/page.tsx` — add navigation to the three admin areas.

---

### Task 1: Admin data mappers + reads + orders page

**Files:**
- Create: `src/lib/admin-data.ts`
- Test: `src/lib/admin-data.test.ts`
- Create: `src/app/admin/orders/page.tsx`

**Interfaces:**
- Produces:
  - `type OrderRow = { id: string; name: string; email: string; total: number; local: boolean; summary: string; createdAtMs: number | null }`
  - `type CustomerRow = { uid: string; email: string; name: string; points: number; lastActivityMs: number | null }`
  - `orderToRow(id: string, data: Record<string, unknown>): OrderRow`
  - `customerToRow(id: string, data: Record<string, unknown>): CustomerRow`
  - `getRecentOrders(limit?: number): Promise<OrderRow[]>`
  - `getCustomers(limit?: number): Promise<CustomerRow[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin-data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { orderToRow, customerToRow } from "./admin-data";

const ts = (ms: number) => ({ toMillis: () => ms });

describe("orderToRow", () => {
  it("pulls customer fields, totals, and a summary with defaults", () => {
    const row = orderToRow("sess_1", {
      customer: { name: "Sam", email: "sam@x.com" },
      total: 24.5,
      local: true,
      items: [{ name: "Chicken Feet", qty: 2 }, { name: "Duck Wings", qty: 1 }],
      createdAt: ts(1000),
    });
    expect(row).toEqual({
      id: "sess_1",
      name: "Sam",
      email: "sam@x.com",
      total: 24.5,
      local: true,
      summary: "2 x Chicken Feet, 1 x Duck Wings",
      createdAtMs: 1000,
    });
  });

  it("tolerates missing fields", () => {
    const row = orderToRow("sess_2", {});
    expect(row).toEqual({
      id: "sess_2",
      name: "",
      email: "",
      total: 0,
      local: false,
      summary: "",
      createdAtMs: null,
    });
  });
});

describe("customerToRow", () => {
  it("maps email, name, points and last activity", () => {
    const row = customerToRow("uid_1", {
      email: "a@b.com",
      name: "Sam",
      pointsBalance: 320,
      lastActivityAt: ts(2000),
    });
    expect(row).toEqual({ uid: "uid_1", email: "a@b.com", name: "Sam", points: 320, lastActivityMs: 2000 });
  });

  it("defaults points to 0 and activity to null", () => {
    expect(customerToRow("uid_2", { email: "c@d.com" })).toEqual({
      uid: "uid_2",
      email: "c@d.com",
      name: "",
      points: 0,
      lastActivityMs: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/admin-data.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin-data.ts`:

```ts
import "server-only";
import { type Timestamp } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";

export type OrderRow = {
  id: string;
  name: string;
  email: string;
  total: number;
  local: boolean;
  summary: string;
  createdAtMs: number | null;
};

export type CustomerRow = {
  uid: string;
  email: string;
  name: string;
  points: number;
  lastActivityMs: number | null;
};

function toMs(v: unknown): number | null {
  const ts = v as Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

export function orderToRow(id: string, data: Record<string, unknown>): OrderRow {
  const customer = (data.customer ?? {}) as { name?: string; email?: string };
  const items = (data.items ?? []) as Array<{ name?: string; qty?: number }>;
  const summary = items.map((i) => `${i.qty ?? 1} x ${i.name ?? ""}`).join(", ");
  return {
    id,
    name: customer.name ?? "",
    email: customer.email ?? "",
    total: Number(data.total ?? 0),
    local: Boolean(data.local ?? false),
    summary,
    createdAtMs: toMs(data.createdAt),
  };
}

export function customerToRow(id: string, data: Record<string, unknown>): CustomerRow {
  return {
    uid: id,
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    points: Number(data.pointsBalance ?? 0),
    lastActivityMs: toMs(data.lastActivityAt),
  };
}

export async function getRecentOrders(limit = 100): Promise<OrderRow[]> {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.orders).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => orderToRow(d.id, d.data() as Record<string, unknown>));
}

export async function getCustomers(limit = 200): Promise<CustomerRow[]> {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection(COLLECTIONS.customers).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => customerToRow(d.id, d.data() as Record<string, unknown>));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/admin-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the orders page**

Create `src/app/admin/orders/page.tsx`:

```tsx
import { requireStaff } from "@/lib/auth";
import { getRecentOrders } from "@/lib/admin-data";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireStaff();
  const orders = await getRecentOrders();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <h1 className="display">Orders</h1>
        <p style={{ opacity: 0.7 }}>Latest {orders.length} orders. The fulfilment sheet is still the packing list.</p>
        <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid #ddd" }}>
                <td>{o.createdAtMs ? new Date(o.createdAtMs).toLocaleDateString("en-GB") : ""}</td>
                <td>{o.name || o.email}<br /><span style={{ opacity: 0.6 }}>{o.email}</span></td>
                <td>{o.summary}</td>
                <td>{gbp(o.total)}</td>
                <td>{o.local ? "Local" : "Post"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin-data.ts src/lib/admin-data.test.ts src/app/admin/orders/page.tsx
git commit -m "feat: admin orders view (read-only) with tested row mappers"
```

---

### Task 2: Customers page + admin navigation

**Files:**
- Create: `src/app/admin/customers/page.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `requireStaff`, `getCustomers`; `pointsToPounds` from `@/lib/loyalty`.

- [ ] **Step 1: Build the customers page**

Create `src/app/admin/customers/page.tsx`:

```tsx
import { requireStaff } from "@/lib/auth";
import { getCustomers } from "@/lib/admin-data";
import { pointsToPounds } from "@/lib/loyalty";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireStaff();
  const customers = await getCustomers();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <h1 className="display">Customers</h1>
        <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Email</th>
              <th>Points</th>
              <th>Value</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.uid} style={{ borderTop: "1px solid #ddd" }}>
                <td>{c.name || "-"}</td>
                <td>{c.email}</td>
                <td>{c.points}</td>
                <td>{gbp(pointsToPounds(c.points))}</td>
                <td>{c.lastActivityMs ? new Date(c.lastActivityMs).toLocaleDateString("en-GB") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add navigation to the admin home**

Replace the body of `src/app/admin/page.tsx` so it links to the three areas:

```tsx
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <h1 className="display">Admin</h1>
        <p>Signed in as {user.email} (staff).</p>
        <nav style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <a className="btn btn--solid-ink" href="/admin/products">Products</a>
          <a className="btn btn--solid-ink" href="/admin/orders">Orders</a>
          <a className="btn btn--solid-ink" href="/admin/customers">Customers</a>
        </nav>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + verify (manual)**

Run `npx tsc --noEmit` (expected: no errors), then `npm run dev`, sign in as staff, and confirm `/admin` links to Products, Orders, and Customers; Orders lists recent orders; Customers lists accounts with points balances and their GBP value. Confirm a non-staff user is redirected away from all three.

- [ ] **Step 4: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (shipping, products-store, stripe-sync, auth-helpers, product-admin, inventory, loyalty, admin-data).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/customers/page.tsx src/app/admin/page.tsx
git commit -m "feat: admin customers view and admin navigation"
```

---

## Self-Review

**Spec coverage (Stage 6 section of the design spec):**
- Read-only orders list in `/admin` — Task 1.
- Read-only customers list with points balances — Task 2.
- Google Sheet still receives rows as now — nothing in this stage touches the webhook or Sheet (confirmed by the read-only file list).

**Placeholder scan:** No TBD/TODO; all code shown. Manual verification carries concrete expectations.

**Type consistency:** `OrderRow`/`CustomerRow` and their mappers are defined once (Task 1) and consumed unchanged by both pages. Reads reuse `requireStaff` (Stage 2), `COLLECTIONS` (Stage 1/2), and `pointsToPounds` (Stage 5) with identical signatures. `orderBy("createdAt", ...)` on `store_customers` assumes the `createdAt` written by `ensureCustomer` (Stage 2); Firestore may prompt for a single-field index the first time, created from the logged link.
