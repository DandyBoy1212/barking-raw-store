# Barking Raw Store — Accounts, Loyalty & Admin — Design Spec (v1)

Date: 2026-07-17. Status: shape approved in brainstorm ("yeah looks great"). Build order
agreed: full spine first (Stage 1, then 2, then 3), with Inventory, Loyalty and Admin views
following in dependency order. This document records every decision from the brainstorm, then
details the spine we build now. Stages 4 to 6 are captured as an agreed roadmap and get their
own specs when we reach them.

House style, matching the v1 store spec: British spelling, no em dashes anywhere.

## 1. What this is

Three connected upgrades to the existing single-page Barking Raw store:

1. **Client accounts** with a loyalty-points scheme (points are money off, they expire, and
   expiry is a reason to email people back).
2. **Staff accounts** that unlock an **admin area** for managing products without editing code.
3. Moving products from a hardcoded file into the database, with each product mirrored to a
   real Stripe Product and Price so the admin UI can create them through the Stripe API.

The current store (guest checkout, Stripe Checkout, Firestore `store_*` collections, Google
Sheet fulfilment, Vercel + cron) stays exactly as it is. This work sits on top.

## 2. Decisions locked in the brainstorm

- **Login model:** email magic-link (passwordless), one mechanism for both roles.
- **Two roles:** customers and staff. Staff is a flag on the same identity system.
- **Account creation is invisible:** buying is signing up. A first order creates or matches a
  customer account from the details the order already collects (name, email, address). No extra
  step, no extra fields. Login (magic link) is only ever needed to *come back* and see or spend
  points.
- **Guest checkout stays** (lowest friction to buy); the auto-created account is what ties the
  order to loyalty.
- **Points = money off**, redeemable value.
- **Earn rate is per product:** each product carries its own points-per-GBP setting (default 10),
  so staff can run promotions (double points, bonus items). Redemption is a flat store-wide
  conversion of 100 points to GBP 1 (so 1 point = 1 penny).
- **Points expire 30 days after the order that earned them** (per-batch, oldest spent first).
  Expiry drives a reminder email a few days before ("your points expire soon, they are worth
  GBP X"). This supersedes the earlier rolling-inactivity idea: a customer who had funds to buy
  once is likelier to buy again around 30 days later, so the shorter window is deliberate.
- **Subscribe and Save is a separate, later subsystem** (recurring orders, a standing discount,
  non-expiring subscriber points). It is not built with loyalty; the loyalty ledger only leaves a
  `neverExpires` flag so subscriber points slot in later. See Stage 7.
- **Products move to Firestore** as the single source of truth, mirrored to Stripe Product +
  Price on save. Shop page and checkout read from Firestore.
- **Admin product manager:** staff can add, edit and archive products. Archiving hides without
  deleting.
- **Product images:** uploaded through the admin UI (to Firebase Storage), not hand-dropped in
  `/public`.
- **Inventory:** quantity tracked in Firestore, decremented on each paid order. Below a threshold
  it emails staff to reorder (alert only, no supplier automation). At zero it auto-marks the
  product sold out. Staff type the new count to restock and it goes back on sale.
- **Admin sees orders and customers** (read-only, including points balances). The Google Sheet
  still receives its rows exactly as now.
- **Staff:** a few people, able to invite other staff by email.

## 3. Architecture spine (the load-bearing decisions)

### 3.1 Identity — Firebase Auth, email-link

Use **Firebase Auth passwordless email-link** sign-in. We already run `firebase-admin`, so this
is the natural fit and Google owns the security-sensitive parts (link tokens, session lifetime).

- **Sessions:** client completes the email-link sign-in and gets an ID token, then POSTs it to a
  server route that mints an httpOnly **session cookie** via the Admin SDK. A matching route
  clears it on logout. Route and page guards verify the cookie server-side.
- **Roles:** staff carry a custom claim `staff: true`. `/admin/*` requires that claim;
  `/account/*` requires any signed-in user. Guards live server-side; the claim is never trusted
  from the client.
- **Invisible customer provisioning:** the Stripe webhook that fulfils an order also upserts a
  Firebase Auth user by email (created with email only, no password if absent) and a
  `store_customers/{uid}` document. The customer never has to click anything to *have* an
  account. To log back in they request a magic link.

Alternatives considered and rejected: NextAuth (extra dependency, no benefit over Firebase here)
and a hand-rolled magic-link table (we would own all the auth-security bugs).

### 3.2 Products — Firestore is the truth, Stripe is mirrored

Today `src/data/products.ts` is the source of truth and checkout builds each price inline with
`price_data`. That moves:

- **`store_products/{slug}`** in Firestore becomes the single source of truth. `slug` is the
  document id and is immutable once created (it is used in cart lines and URLs).
- A **server data-access module** (`src/lib/products-store.ts`) reads products from Firestore,
  with a graceful fallback to the seed list if Firestore is unavailable, mirroring the existing
  `getDb()` returns-null pattern. The shop page and checkout call this module.
- `src/data/products.ts` is kept as the **type definitions and the one-off seed source**, not as
  the runtime source.
- **Stripe mirroring on save:** creating a product creates a Stripe Product and Price and stores
  their ids on the document. Editing updates the Stripe Product (name, description, images).
  Because Stripe Prices are immutable, a price change creates a **new** Price, sets it as the
  product's `default_price`, and archives the old Price. Archiving a product sets the Stripe
  Product to `active: false`.
- **Checkout switches** from inline `price_data` to line items that reference the synced Stripe
  price (`{ price: stripePriceId, quantity }`), and validates that each product is active (and,
  from Stage 4, in stock) before creating the session. Shipping and discount-code logic are
  untouched.

## 4. Data model (Firestore additions, `store_*` namespace)

Existing collections (`store_carts`, `store_orders`, `store_discount_codes`) are unchanged. New
and extended:

- **`store_products/{slug}`** (new as a collection; seeded from the current 9):
  `slug, name, price (GBP), hook, description, badges[], image, safetyNote?, active(bool),
  archived(bool), stripeProductId, stripePriceId, createdAt, updatedAt`.
  Stage 4 adds: `stock(number), lowStockThreshold(number), soldOut(bool)`.
- **`store_customers/{uid}`** (new): `email, name, lastPostcode?, createdAt`.
  Stage 5 adds: `pointsBalance(number), lastActivityAt(timestamp)`.
- **`store_staff/{uid}`** (new): `email, invitedBy, createdAt`.
- **`store_points_ledger/{id}`** (new, Stage 5): append-only entries
  `{ uid, type(earn|redeem|expire), points, orderId?, createdAt }` so a balance is always
  reconstructable and auditable.

## 5. Stage detail

### Stage 1 — Products to Firestore + Stripe sync (build first)

Goal: move the truth without changing anything a shopper sees.

- Add `active`, `archived`, `stripeProductId`, `stripePriceId` to the product shape.
- One-off **seed script** (`scripts/seed-products.mjs`, sibling to the existing `scripts/*.mjs`)
  that writes the 9 current products into `store_products` and creates each one's Stripe Product
  and Price, storing the ids.
- `src/lib/products-store.ts` data-access module (read all active, read by slug), with fallback
  to the seed list.
- Shop page (`src/app/page.tsx`) reads from the module.
- Checkout (`src/app/api/checkout/route.ts`) reads from the module and uses `stripePriceId` line
  items; rejects inactive products.
- Done when: the shop and checkout behave identically to today but are driven by Firestore, and a
  product edited directly in Firestore-plus-Stripe shows up correctly.

### Stage 2 — Auth foundation

Goal: login exists, roles exist, accounts appear automatically.

- Firebase Auth email-link sign-in, session-cookie routes (`/api/auth/session` set and clear),
  server-side guards.
- `staff` custom-claim plumbing and an initial staff account for Michaela (claim set by script).
- Protected shells: `/account` (any signed-in customer) and `/admin` (staff only), no real
  content yet beyond "you are logged in as ...".
- Webhook provisioning: on `checkout.session.completed`, upsert the Firebase Auth user and
  `store_customers/{uid}` from the order email and details.
- Done when: a returning customer can request a link and land on `/account`; a non-staff user is
  refused at `/admin`; a fresh purchase creates a customer record.

### Stage 3 — Admin product manager

Goal: staff manage products through a UI, changes sync to Stripe.

- `/admin/products`: list, create, edit, archive.
- Image upload through a **server route** that checks the staff session and writes to Firebase
  Storage via the Admin SDK (so Storage stays locked down), returning the stored URL.
- Every save runs the Stripe mirroring from 3.2.
- Staff invite by email: a staff-only route creates or updates a Firebase Auth user with the
  `staff` claim, records `store_staff/{uid}`, and sends them a login link.
- Done when: Michaela can add a new product with an uploaded image, see it live on the shop, buy
  it end to end in Stripe test mode, edit its price, and archive it.

### Stage 4 — Inventory (roadmap)

Quantity per product, decrement in the Stripe webhook on each paid order, low-stock reorder email
to staff (reusing `src/lib/email.ts`), auto `soldOut` at zero, manual restock in admin. Checkout
refuses sold-out or insufficient stock. Numbers to set when specced: default low-stock threshold.

### Stage 5 — Loyalty points (planned)

Earn on paid orders (append-only `store_points_ledger` batch, denormalised `pointsBalance` on the
customer), per-product earn rate (default 10 points per GBP), balance and history on `/account`,
redeem as money off at checkout when signed in (any amount up to the order value; 100 points to
GBP 1), 30-day per-batch FIFO expiry, and a daily cron that expires due batches and emails
customers whose points lapse within 5 days. See `docs/plans/2026-07-17-stage-5-loyalty-points.md`.

### Stage 6 — Admin orders and customers view (roadmap)

Read-only lists of orders and customer accounts with points balances, inside `/admin`. The Google
Sheet still receives rows as now.

### Stage 7 — Subscribe and Save (roadmap, needs its own brainstorm)

Recurring orders via Stripe subscriptions, a standing subscriber discount, non-expiring loyalty
points for subscribers, and subscription management in `/account`. This is a distinct subsystem
(recurring billing, delivery cadence, dunning) and gets its own spec and plan. Numbers and
mechanics to decide when specced: delivery cadence options, discount percentage, and how
subscriber points interact with the loyalty ledger's `neverExpires` flag.

## 6. Tunable numbers (now decided)

- Low-stock threshold default: 5 (Stage 4).
- Earn rate: 10 points per GBP by default, overridable per product (Stage 5).
- Redemption value: 100 points = GBP 1 (1 point = 1 penny) (Stage 5).
- Point expiry: 30 days after the earning order, per batch (Stage 5).
- Expiry-reminder lead time: 5 days before a batch lapses (Stage 5).

## 7. Non-goals (YAGNI)

- No passwords (magic-link only).
- No supplier auto-ordering (low-stock is an alert to a human).
- No quantity-tiered or per-customer pricing, no multi-currency.
- No customer-facing account beyond points, order history and login (no saved cards, no
  wishlists) in this scope.
- No recurring billing in the loyalty work; Subscribe and Save (Stage 7) is a separate subsystem.
