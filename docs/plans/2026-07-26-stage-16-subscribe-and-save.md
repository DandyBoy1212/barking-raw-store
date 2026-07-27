# Stage 16: Subscribe and Save (E.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can turn their basket into a repeating order, every 2, 4 or 8 weeks, at 10% off, through Stripe subscription checkout, with every billing cycle writing an order to `store_orders` and the fulfilment sheet exactly like a one-off order.

**Architecture:** All pure logic (eligibility, frequency vocabulary, discount arithmetic, Stripe param builders, invoice-to-order mapping) lives in a new tested module `src/lib/subscriptions.ts`, plus small tested additions to `src/lib/stripe-sync.ts` and `src/lib/products-store.ts`. The checkout route grows a subscription branch; the webhook grows an `invoice.paid` handler; the account page grows a billing portal link; the basket drawer grows one self-contained block. Routes stay thin, matching the house pattern (no route tests exist in this codebase; the logic they call is what gets tested).

**Tech Stack:** Next.js App Router route handlers, Stripe node SDK v22 (fakes/stubs only, per `src/lib/stripe-sync.test.ts` patterns), Firestore via firebase-admin, Vitest.

## Global Constraints

- British spelling, NO em dashes, anywhere.
- Do NOT touch `ProductCard.tsx`, `/members`, `/stall`, `/join`, dogs-of-the-day, `HANDOVER.md`, `vercel.json`.
- Lint must stay at exactly 3 pre-existing errors (all in `CartProvider.tsx` and `thank-you/page.tsx`).
- Baseline 271 tests must keep passing; `npx tsc --noEmit` clean.
- No `.env.local`, no live Stripe; unit tests use hand-rolled fakes as in `src/lib/stripe-sync.test.ts`.
- Membership contract: membership is ONLY the explicit `member: true` flag, granted via `ensureCustomer` (`src/lib/auth.ts:101`). Recurring paid orders grant it the same way.
- Commit style per `git log --oneline -20`, body ending: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Do not push or merge.

---

## Design decisions (each one deliberate, argue with the reasons not the outcome)

### D1. Eligibility: own-stock only

Supplier-posted lines cannot sensibly recur (spec section 4.4):

- Their postage, dispatch time and availability belong to the supplier, not to us. A Stripe subscription bills automatically every cycle; a supplier item that goes out of stock or changes price at Avasam would keep charging the customer for something we can no longer fulfil at that price.
- Each supplier line is its own parcel with its own postage; a recurring version would need recurring supplier-postage lines whose real cost drifts under us.
- Returns route differently per path (section 4.5); an automatic recurring charge for an item with a supplier returns process is a complaint factory.

So eligibility is `fulfilment === "own-stock"`, decided by a pure function `splitSubscribable`.

### D2. Mixed baskets: subscribe is offered only when every line is eligible

Options considered: (a) split into a subscription checkout plus a second one-off checkout, (b) exclude ineligible lines from the subscription silently, (c) offer subscribe only when the whole basket is eligible, with a clear message otherwise.

Chosen: (c). Reasons: (a) is two payment flows from one click, and the thank-you page calls `clear()` on the whole basket (`src/app/thank-you/page.tsx:9`), so the remaining lines would be silently lost after the first checkout returns; (b) charges the customer for less than their basket shows, which is a trust failure. (c) never degrades the one-off flow, has no basket-clearing edge cases, and the customer is told exactly which items cannot repeat and why ("posts separately from a supplier"). The server enforces the same rule with a 400, because UI-only rules are not rules.

### D3. Frequency: basket-level, every 2, 4 or 8 weeks

Stripe recurring `{ interval: "week", interval_count: 2 | 4 | 8 }`. One frequency for the whole basket, because one basket is one parcel from Michaela's own stock. Raw meals are bought in bulk on a rhythm; 2/4/8 weeks covers small to large freezers without a combinatorial price explosion (each frequency needs its own Stripe Price per product).

### D4. Discount: full-price recurring Prices plus one reusable 10% Coupon

Chosen over 90%-priced recurring Prices. Reason: the brief for Michaela is that "the discount is priced in" stays visible in Stripe's dashboard. With a Coupon, every subscription and every invoice in the dashboard shows the full list price and an explicit "Subscribe and save 10%" discount line; with 90% prices she would see mystery numbers and nothing saying a discount exists. The coupon is `id: "subscribe-and-save-10"`, `percent_off: 10`, `duration: "forever"` (the spec: the 10% applies "only while a recurring order is active", which is exactly a forever coupon on the subscription). Created idempotently: retrieve by id, create on miss.

Known trade-off, documented not hidden: a percent coupon discounts the whole invoice, including the recurring postage line when one exists. Worst case is 10% of GBP 3.95, about 40p per cycle, and only for non-local baskets under the GBP 35 free-postage threshold. Accepted for v1 rather than complicating the price model.

### D5. Recurring Prices: created on demand, stored on the product doc

`stripeRecurringPriceIds: { "2": "price_x", "4": "price_y", "8": "price_z" }` on the product document, alongside the existing `stripePriceId`. Created the first time a subscription checkout needs that (product, frequency) pair, then reused. When the price changes in admin, `applyStripeProductUpdate` deactivates the stored recurring prices and clears the map, so the next subscription checkout mints fresh ones at the new price. Existing subscriptions keep the price they signed up at (Stripe keeps billing a deactivated price that is already on a subscription): that is deliberate grandfathering, consistent with spec 6.1's "existing customers should be grandfathered or told". A product with no `stripeProductId` yet falls back to inline `price_data` with `recurring`, mirroring `buildCheckoutLineItem`.

### D6. Postage on subscriptions: a recurring line item

Subscription mode cannot reuse the one-off `shipping_options` machinery for every cycle, so postage becomes a recurring line item named "UK postage" at the same interval, priced by the existing `computeBasketDelivery` over the (all own-stock) basket. Local (DD1 to DD6) or over the GBP 35 threshold means no postage line at all. The postage amount and the postcode it was computed from are stamped into the subscription metadata so every invoice can be unpicked later.

### D7. Every cycle writes an order: `invoice.paid`, idempotent on the invoice id

- `invoice.paid` fires for the first cycle and every renewal. The handler only acts on subscription invoices (`invoice.parent.type === "subscription_details"` in Stripe SDK v22). The order doc id is the invoice id, and an existing doc short-circuits, exactly the existing session-id pattern. Sheet row appended after the Firestore guard, same as one-off orders (same column shape, so Michaela's sheet does not fork).
- `checkout.session.completed` with `mode === "subscription"` marks the cart converted and runs `ensureCustomer` but does NOT write an order or a sheet row; otherwise the first cycle would be recorded twice (once by session id, once by invoice id).
- `ensureCustomer` runs on every paid invoice: paid subscription orders grant `member: true` through the same path as one-off orders (membership contract). It gains an optional `stripeCustomerId`, stored on the customer doc, which is what the billing portal route needs.

### D8. Managing the subscription: Stripe customer billing portal, no custom UI

One route, `POST /api/account/billing-portal`, creates a portal session for the signed-in customer's stored `stripeCustomerId` and returns the URL. The account page shows a "Manage your repeating order" button only when a `stripeCustomerId` exists. **Michaela must configure the Customer Portal once in the Stripe dashboard** (Settings, Billing, Customer portal: enable it, allow cancelling subscriptions and updating payment methods). Until she does, live portal session creation fails with a Stripe error; the route surfaces a friendly message.

### D9. UI: one self-contained block in the basket drawer

A "Repeat this order?" block between the discount code field and the totals: a radio list defaulting to "One-off order" (zero change for customers who ignore it), plus the three frequencies, each showing the 10% price. Choosing a frequency swaps the displayed goods subtotal for the discounted one and relabels the button. Ineligible baskets show a short static message instead of the radios. The one-off request body is byte-identical to today's when no frequency is chosen.

### D10. Discount arithmetic

`discounted(amount)` = `Math.round(priceToPence(amount) * 0.9) / 100`, pence-safe. The divide-by-0.9 list-price rule in spec 6.1 is Michaela's repricing decision and is NOT implemented here; we only ever take 10% off whatever the list price is.

---

## File structure

- Create: `src/lib/subscriptions.ts` (all pure subscribe-and-save logic) and `src/lib/subscriptions.test.ts`
- Modify: `src/lib/stripe-sync.ts` (+ tests): recurring price params, ensureRecurringPrice, price-change archiving
- Modify: `src/lib/products-store.ts` (+ tests): `stripeRecurringPriceIds` parsing, `saveRecurringPriceId`
- Modify: `src/app/api/checkout/route.ts`: subscription branch
- Modify: `src/app/api/webhooks/stripe/route.ts`: `invoice.paid` handler, subscription-mode skip
- Modify: `src/lib/auth.ts`: `ensureCustomer` optional `stripeCustomerId`
- Modify: `src/app/api/admin/products/[slug]/route.ts`: persist cleared recurring price map
- Create: `src/app/api/account/billing-portal/route.ts`
- Create: `src/components/account/ManageSubscriptionButton.tsx`; Modify: `src/app/account/page.tsx`
- Modify: `src/components/BasketDrawer.tsx` (careful: shares a file boundary with CartProvider's known lint errors; do not add any)

---

### Task 1: Frequency vocabulary, eligibility split, discount arithmetic

**Files:**
- Create: `src/lib/subscriptions.ts`
- Test: `src/lib/subscriptions.test.ts`

**Interfaces:**
- Produces: `SUBSCRIBE_PERCENT: 10`, `type FrequencyWeeks = 2 | 4 | 8`, `SUBSCRIBE_FREQUENCIES: { weeks: FrequencyWeeks; label: string }[]`, `parseFrequencyWeeks(v: unknown): FrequencyWeeks | null`, `splitSubscribable<T extends { fulfilment: FulfilmentPath }>(items: { product: T; qty: number }[]): { eligible: typeof items; ineligible: typeof items }`, `discounted(amount: number): number`

- [x] **Step 1: Write the failing tests** in `src/lib/subscriptions.test.ts`: parseFrequencyWeeks accepts 2/4/8 (number or numeric string) and rejects 0, 3, "weekly", null; SUBSCRIBE_FREQUENCIES has three entries with British labels ("Every 2 weeks" etc.); splitSubscribable puts own-stock lines in eligible, supplier-posted in ineligible, preserves qty; discounted(6) is 5.4, discounted(11.11) is 10 (the spec 6.1 round trip), discounted(0.1) has no float drift.
- [x] **Step 2: Run** `npm test -- subscriptions` and confirm it fails (module not found).
- [x] **Step 3: Implement** the module with a header comment naming the design decisions (own-stock only per spec 4.4, 10% reserved per section 6). `discounted` uses `priceToPence` from `stripe-sync`.
- [x] **Step 4: Run** `npm test -- subscriptions`, expect pass; run the full suite.
- [x] **Step 5: Commit** `feat: the subscribe and save vocabulary, eligibility and arithmetic`.

### Task 2: Stripe builders: recurring line items, postage line, coupon, subscription metadata

**Files:**
- Modify: `src/lib/subscriptions.ts`
- Test: `src/lib/subscriptions.test.ts`

**Interfaces:**
- Consumes: `priceToPence`, `StoredProduct`
- Produces: `SUBSCRIBE_COUPON_ID = "subscribe-and-save-10"`, `ensureSubscribeCoupon(stripe): Promise<string>`, `buildSubscriptionLineItem(sp, qty, weeks, recurringPriceId?): Stripe.Checkout.SessionCreateParams.LineItem`, `POSTAGE_LINE_NAME = "UK postage"`, `buildPostageLineItem(cost, weeks): LineItem | null`, `subscriptionMetadata(input: { weeks; postcode; itemSummary; postagePence }): Record<string, string>` (keys `br_frequency_weeks`, `br_postcode`, `br_item_summary` capped at 480 chars, `br_postage_pence`)

- [x] **Step 1: Failing tests:** line item uses `{ price: id, quantity }` when a recurring price id is given, else inline `price_data` with `recurring: { interval: "week", interval_count: weeks }` and the pence amount; quantity clamped 1..50; postage line null at cost 0, correct pence and name at 3.95; `ensureSubscribeCoupon` returns the id without creating when retrieve succeeds (fake counts calls), creates with `{ id, percent_off: 10, duration: "forever", name }` when retrieve throws; metadata builder stringifies and caps.
- [x] **Step 2: Run, confirm fail.**
- [x] **Step 3: Implement** (fakes as in `stripe-sync.test.ts`, `as unknown as import("stripe").default`).
- [x] **Step 4: Full suite green.**
- [x] **Step 5: Commit** `feat: the Stripe builders for recurring lines, postage and the 10% coupon`.

### Task 3: Invoice-to-order mapping (pure)

**Files:**
- Modify: `src/lib/subscriptions.ts`
- Test: `src/lib/subscriptions.test.ts`

**Interfaces:**
- Produces: `interface SubscriptionInvoiceLike` (structural: `id`, `parent`, `lines.data[]` with `description/quantity/amount`, `customer` (string or `{ id }`), `customer_name/email/address/shipping`, `subtotal`, `total`) and `invoiceToOrder(inv: SubscriptionInvoiceLike): SubscriptionOrder | null` where `SubscriptionOrder = { invoiceId; subscriptionId; stripeCustomerId; frequencyWeeks; items: { name; qty; amount }[]; customer: { name; email; address; postcode }; subtotal; shipping; total; itemSummary }`

- [x] **Step 1: Failing tests:** returns null when `parent` is null or not subscription type; maps a two-line invoice plus a "UK postage" line: postage excluded from items, `shipping` = `br_postage_pence`/100, `subtotal` = (invoice.subtotal - postagePence)/100, `total` = invoice.total/100; postcode prefers `customer_shipping.address.postal_code`, then `customer_address`, then `br_postcode` metadata; address joined comma-style like the webhook does; itemSummary prefers `br_item_summary` metadata, falls back to "qty x name" join; subscription id accepted as string or expanded object; frequencyWeeks parsed from metadata, null-safe.
- [x] **Step 2: Run, confirm fail.** **Step 3: Implement.** **Step 4: Full suite green.**
- [x] **Step 5: Commit** `feat: a recurring invoice maps to the same order shape as a one-off`.

### Task 4: stripe-sync and products-store: recurring prices on the product

**Files:**
- Modify: `src/lib/stripe-sync.ts`, `src/lib/products-store.ts`
- Test: `src/lib/stripe-sync.test.ts`, `src/lib/products-store.test.ts`

**Interfaces:**
- Produces: `StoredProduct.stripeRecurringPriceIds?: Record<string, string>`; `buildRecurringPriceParams(sp, weeks)`; `ensureRecurringPrice(stripe, sp, weeks): Promise<string | null>` (stored id if present, null when no `stripeProductId`, else creates and returns); `applyStripeProductUpdate` return gains `stripeRecurringPriceIds: Record<string, string>` (cleared `{}` on price change after deactivating each old id, otherwise passed through); `saveRecurringPriceId(slug, weeks, priceId): Promise<void>` in products-store (merge-set `stripeRecurringPriceIds.<weeks>`).
- Also modify `src/app/api/admin/products/[slug]/route.ts` to persist the returned `stripeRecurringPriceIds` alongside the existing ids (fold into the existing `set`).

- [x] **Step 1: Failing tests:** `docToStoredProduct` parses a string map and drops non-string values; `ensureRecurringPrice` returns the stored id without calling Stripe, creates with recurring params when missing, returns null without a product id; `applyStripeProductUpdate` deactivates recurring ids on price change and clears the map, leaves them untouched when the price is unchanged.
- [x] **Step 2: Run, confirm fail.** **Step 3: Implement, including the admin route persist.** **Step 4: Full suite, tsc, lint.**
- [x] **Step 5: Commit** `feat: recurring prices live beside the one-off price and die with it`.

### Task 5: Checkout route: the subscription branch

**Files:**
- Modify: `src/app/api/checkout/route.ts`

Body gains optional `frequencyWeeks`. After the existing line-item loop (which stays untouched for one-off), when `parseFrequencyWeeks` yields a value:
- If any basket product is supplier-posted, 400: "Repeat orders cover items posted from Barking Raw only. Remove the items that post separately, or choose a one-off order."
- Build subscription line items via `ensureRecurringPrice` + `buildSubscriptionLineItem`, persisting new ids with `saveRecurringPriceId` (failures logged, non-fatal).
- Postage via existing `computeBasketDelivery` + `buildPostageLineItem`.
- `ensureSubscribeCoupon`, session `mode: "subscription"`, `discounts: [{ coupon }]`, `shipping_address_collection`, `subscription_data: { metadata: subscriptionMetadata(...) }`, session metadata keeps `cartId`, same success/cancel URLs. No `allow_promotion_codes` (the 10% is the deal; stacking a welcome code on top of the reserved discount is exactly what section 6 forbids).
- The members-only 403 and server-side pricing paths are shared and unchanged. The cart doc records `subscribeWeeks` for abandoned-cart context.

- [x] **Step 1: Implement.** **Step 2:** Full suite, tsc, lint (3). **Step 3: Commit** `feat: the basket can check out as a Stripe subscription at 10% off`.

### Task 6: Webhook: every cycle writes an order

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`, `src/lib/auth.ts`

- `ensureCustomer` gains optional `stripeCustomerId?: string`, merged into the customer doc only when non-empty (`buildCustomerDoc` untouched; the field is spread in the `set`).
- In `fulfil`: if `full.mode === "subscription"`, mark the cart converted and `ensureCustomer({ email, name, postcode, stripeCustomerId: full.customer as string })`, then return before the order write and sheet append (D7).
- New `event.type === "invoice.paid"` branch calling `fulfilRecurring(stripe, invoice)`: map with `invoiceToOrder` (return early on null); idempotency guard on `store_orders` doc id = invoice id; write `{ stripeInvoiceId, stripeSubscriptionId, subscription: true, frequencyWeeks, items, customer, subtotal, shipping, total, local, createdAt }`; `ensureCustomer` with the invoice's email, name, postcode and `stripeCustomerId`; append the same 11-column sheet row (id = invoice id slice(-8)). Errors caught and logged, 200 returned, same policy as the session handler.

- [x] **Step 1: Implement.** **Step 2:** Full suite, tsc, lint. **Step 3: Commit** `feat: every subscription cycle lands in store_orders and the sheet`.

### Task 7: Billing portal route and the account page link

**Files:**
- Create: `src/app/api/account/billing-portal/route.ts`
- Create: `src/components/account/ManageSubscriptionButton.tsx`
- Modify: `src/app/account/page.tsx`; check `src/lib/customers-store.ts` exposes `stripeCustomerId` on the customer read (add to its type/mapping if needed)

Route: POST, `runtime = "nodejs"`, `dynamic = "force-dynamic"`; 503 without `STRIPE_SECRET_KEY` or db; `getSessionUser()` (401 if none, do not redirect from an API route); read `stripeCustomerId` from the customer doc; 404 "No repeating order on this account yet." when absent; `stripe.billingPortal.sessions.create({ customer, return_url: origin + "/account" })`; return `{ url }`; catch Stripe errors with a friendly 502 mentioning the portal may not be switched on yet.
Button: small client component that POSTs and follows `url`, with busy/error states, styled like existing buttons. Rendered from the server page only when the customer doc has a `stripeCustomerId`, under a "Your repeating order" panel line.

- [x] **Step 1: Implement.** **Step 2:** Full suite, tsc, lint. **Step 3: Commit** `feat: manage the repeating order through Stripe's own portal`.

### Task 8: The basket drawer block

**Files:**
- Modify: `src/components/BasketDrawer.tsx`

State `frequencyWeeks: FrequencyWeeks | null` (default null = one-off). Eligibility from the catalogue lines via `splitSubscribable`. All-eligible baskets render the block (radio list: one-off default plus the three frequencies with `discounted(subtotal)` shown); mixed or supplier-only baskets render one static line: "Repeat orders are not available for items that post separately from a supplier." When a frequency is chosen: subtotal row shows the discounted goods figure with the saving, total recomputed, button reads "Subscribe securely", and the fetch body includes `frequencyWeeks`. When null, the body is exactly today's. No new lint errors: hooks stay top-level, no conditional hooks.

- [x] **Step 1: Implement.** **Step 2:** Full suite, tsc, lint stays at 3. **Step 3: Commit** `feat: the basket offers the repeat order without touching the one-off flow`.

### Task 9: Verification and plan tick-through

- [x] Full `npm test` (271 + new), `npx tsc --noEmit`, `npm run lint` (exactly 3 errors), `git status` clean.
- [x] Tick the checkboxes in this plan, commit `docs: tick the stage 16 plan through`.

---

## For the handover (do not edit HANDOVER.md from this branch; the merger carries these)

- Michaela must enable and configure the **Stripe Customer Portal** (dashboard: Settings, Billing, Customer portal) before "Manage your repeating order" works in live mode: enable cancellation and payment-method updates at minimum.
- The coupon `subscribe-and-save-10` is created automatically on the first subscription checkout; nothing to do, but it will appear in her Products, Coupons list, named "Subscribe and save 10%".
- Spec 6.1's divide-by-0.9 repricing is HER decision and is not implemented; until she reprices, the 10% comes out of margin, exactly as the spec warns.
- The 10% coupon also discounts the GBP 3.95 postage line on non-local, under-threshold subscriptions (about 40p a cycle); accepted for v1, see D4.
- Webhook events to enable on the Stripe endpoint: `checkout.session.completed` (already) plus `invoice.paid`.
