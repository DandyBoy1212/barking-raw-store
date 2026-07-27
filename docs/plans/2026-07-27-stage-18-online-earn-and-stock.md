# Online Orders Earn Points and Decrement Stock, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the HANDOVER's biggest stated gap: a paid online order (one-off checkout and every subscription invoice) earns loyalty points and decrements tracked stock exactly as a stall sale does, and Michaela can set a product's stock and points rate in the admin.

**Architecture:** A pure module, `order-earn.ts`, joins three sources: cart lines (slugs and quantities, read from the `store_carts` doc whose id already rides in session metadata), Stripe's paid line items (names and post-discount amounts), and the product docs (rates and stock, via the stall's `docToSaleProduct`). Points earn on the amount actually paid, so discount codes and the subscribe-and-save 10% never over-award. The webhook applies the outcome in one Firestore transaction gated on the order doc not existing, which is what makes Stripe's retries and concurrent deliveries safe.

**Tech Stack:** Next.js 16 route handler (existing webhook), TypeScript, Firebase Admin SDK (Firestore transactions), Vitest.

## Global Constraints

- **British spelling, no em dashes**, in code, comments, copy and commit messages.
- **TDD, one commit per task.**
- **Rates come from `loyalty.ts` and are never restated** (its own header requires this).
- **Absent stock means untracked** (stage 4's rule, already live in the stall path): the product sells without a count and nothing is written back. Stock clamps at zero, never negative.
- **Points earn on money paid, not shelf price.** Spec 6.1's warning about unpriced discounts applies to points too: 10 points per pound on a pound never actually taken is margin given twice.
- **The webhook returns 200 on handled failure** (existing policy), and the earn/stock apply must be idempotent: Stripe redelivers.
- **Nothing here can be verified end to end without `STRIPE_SECRET_KEY`**, which is still absent. Pure logic is unit-tested; the webhook wiring is review-only until test mode exists. Say so in the commit, never "verified" without it.

## Decisions that need stating (reversible, each in one place)

1. **Pick-and-mix bundle lines neither earn points nor touch stock in this pass.** A bundle's Stripe line does not match a product name, and its drawn contents live only as capped metadata text. Parsing prose to mutate stock is how counts go quietly wrong. The order doc already records bundle contents for a future pass; unmatched lines are logged. Bundles are also already 5% discounted, so zero points is the conservative direction.
2. **Line items join to products by name.** Names originate from our own product docs (Stripe's copy is synced from ours), so the join is reliable at fulfilment time; a rename in the seconds between session and webhook degrades to "no points for that line", which is the safe direction.
3. **Subscription invoices earn and decrement too**, through the same outcome builder: `invoiceToOrder` already yields `{name, qty, amount}` items, and quantities join to slugs the same way.

---

### Task 1: The pure outcome builder

**Files:**
- Create: `src/lib/order-earn.ts`
- Test: `src/lib/order-earn.test.ts`

**Interfaces:**
- Consumes: `earnRateFor`, `earnedPoints` from `@/lib/loyalty`; `docToSaleProduct`, `type SaleProduct` from `@/lib/stall-sale`.
- Produces: `buildOrderOutcome(cartLines: {slug: string; qty: number}[], paidItems: {name: string; qty: number; amount: number}[], products: Map<string, SaleProduct>): OrderOutcome` where `OrderOutcome = { points: number; pointItems: {slug: string; name: string; amount: number; points: number}[]; stockChanges: {slug: string; stock: number}[]; unmatched: string[] }`.

Rules the tests pin:

- Points per paid item: join by exact name to a product, earn `earnedPoints(amount, earnRateFor(product))` on the **paid** amount. Unmatched names collect in `unmatched` and earn nothing.
- Stock changes come from **cart lines** (slug and qty are exact there), only for tracked products, clamped at zero. Cart lines whose slug is not a product (bundle pseudo-lines) are ignored.
- Empty inputs produce an empty outcome, never a throw. Junk quantities and negative amounts contribute nothing.

- [ ] Step 1: write the failing tests (name-join earn on discounted amount; zero-rate product honoured; unmatched bundle line collects and earns nothing; stock decrements and clamps; untracked product writes nothing; empty everything)
- [ ] Step 2: watch them fail
- [ ] Step 3: implement
- [ ] Step 4: watch them pass, full suite
- [ ] Step 5: commit `feat: pure outcome for what an online order earns and depletes`

### Task 2: `ensureCustomer` returns the uid

**Files:**
- Modify: `src/lib/auth.ts` (`ensureCustomer` returns `Promise<string | null>` instead of `Promise<void>`)

The webhook knows the buyer's email; points live on `store_customers/{uid}`. `ensureCustomer` already resolves or creates that uid and every caller ignores its return, so returning the uid is additive. tsc guards the change.

- [ ] Step 1: change the return type and return `uid` (null on the guard path)
- [ ] Step 2: `npx tsc --noEmit` clean, full suite green
- [ ] Step 3: commit `feat: ensureCustomer hands back the uid it resolved`

### Task 3: The webhook applies the outcome

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts` (`fulfil` and `fulfilRecurring`)

Shape, identical in both handlers:

1. `ensureCustomer` first (outside the transaction, it touches Firebase Auth), keeping the uid.
2. Read the cart lines (one-off only: `store_carts/{metadata.cartId}.items`, tolerantly, absent cart means no stock changes) and all product docs via one collection read into `docToSaleProduct`.
3. `buildOrderOutcome`, log `unmatched` when non-empty.
4. One transaction: read the order ref, abort if it exists (moves the existing idempotency guard inside the transaction, closing the concurrent-delivery race), then write the order doc (now also carrying `points` and `pointItems`), the stock decrements, and `pointsBalance: FieldValue.increment(points)` on the customer doc when uid and points are both real.
5. Sheet append stays outside, after, unchanged.

Firestore transactions demand all reads before writes: order ref read happens inside, product reads happen before (their staleness only risks a stale stock clamp, which the stall path accepts too... no. **Correction, and the tests must pin this:** stock reads move inside the transaction for the lines being decremented, so two simultaneous orders for the last bag cannot both write `stock: 0` from the same snapshot and lose a decrement. Product docs for the *outcome maths* may be the outside read; the transaction re-reads only the docs it will write.)

- [ ] Step 1: restructure `fulfil` per the shape, keeping subscription-mode early-return behaviour identical
- [ ] Step 2: same for `fulfilRecurring`
- [ ] Step 3: tsc clean, full suite, lint at 3
- [ ] Step 4: commit `feat: online orders earn points and deplete stock, idempotently` with an honest "wiring is review-only until a Stripe key exists" note

### Task 4: Michaela can set stock and a points rate

**Files:**
- Modify: `src/lib/product-admin.ts` (+ tests): `stock` (whole number ≥ 0, blank means untracked, and **blank clears**, distinct from 0 which means sold out and tracked) and `pointsPerPound` (number ≥ 0, blank means default rate; 0 is a deliberate no-points setting)
- Modify: both product routes to write/delete the two fields (the `[slug]` PATCH route uses the `FieldValue.delete()` pattern already there)
- Modify: `src/components/admin/ProductForm.tsx`: a "Stock and points" panel with the two fields and hints saying exactly what blank means

- [ ] Step 1: failing validation tests (accepts blank/0/positive; rejects negative and fractional stock; blank distinct from 0)
- [ ] Step 2: implement validation, wire routes, add the form panel
- [ ] Step 3: tsc, suite, lint; render check of the form with a staff session
- [ ] Step 4: commit `feat: stock and points rate are Michaela's to set per product`

### Task 5: HANDOVER tells the truth again

- [ ] Update the "known gaps" paragraph: online earn/stock now built (pure logic tested; webhook wiring awaits a Stripe key to exercise), bundle limitation stated, admin fields exist.
- [ ] Commit `docs: the online earn and stock gap is closed, with its one bundle caveat`
