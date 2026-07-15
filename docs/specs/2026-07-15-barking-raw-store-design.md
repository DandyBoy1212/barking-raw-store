# Barking Raw Store — Design Spec (v1)

Date: 2026-07-15. Status: approved to build ("go wild and build it"). This is the record of
what we agreed across the brainstorm, plus the calls made while the client was out.

## 1. What it is
A single, high-end, long-form e-commerce page for **Barking Raw** (barkingraw.dog), selling
nine natural dog-treat products through Stripe. Positioning: **"You've been lied to."** Honest,
righteous education about how deceptive mainstream supermarket treats are (real label facts) and
how dogs are built for meat not ultra-processed cereal filler, flowing into the nine honest
products. Aggression aimed at the deception and the biology, NOT at unprovable "these kill your
dog" claims (see research dossier honesty flags).

## 2. Brand & design language
- Black-and-white banded sections (alternating black and white full-width bands).
- On white bands: faded black paw-prints, like a dog walked through ink, trailing and fading.
- Logo: paw-print with dog silhouette + "BARKING RAW / NATURAL DOG FOOD" (client-supplied file
  needed in `public/brand/`).
- Premium, confident, a bit cheeky. Big product imagery. British spelling. NO em dashes anywhere.

## 3. Stack (mirrors the sibling training app `barking-raw`)
- Next.js 16 (App Router) + React 19 + TypeScript, `src/` dir, CSS Modules (no Tailwind).
- Firebase: **reuse the existing `gen-lang-client-0842620114` project**, in its own collections
  namespaced `store_*`. `firebase-admin` server-side, Zod for validation, Vitest for tests.
- Payments: **Stripe Checkout** (hosted). We never touch card data. Build in test mode; client
  pastes live keys later.
- Hosting: **Vercel**. Abandoned-cart + daily-digest via **Vercel Cron** hitting API routes.

## 4. Products (9 SKUs, retail prices)
| slug | name | price |
|---|---|---|
| beef-trachea-rings | Beef Trachea Rings | 6.50 |
| chicken-feet | Chicken Feet | 6.00 |
| rabbit-ears | Rabbit Ears | 6.50 |
| rabbit-feet | Rabbit Feet | 6.00 |
| duck-wings | Duck Wings | 7.50 |
| tripe-sticks | Tripe Sticks | 5.50 |
| whole-sprats | Whole Sprats | 6.50 |
| salmon-bites | Salmon Bites | 6.00 |
| pure-meat-tit-bits | Pure Meat Tit-bits | 6.00 |

Prices are per pack. Product copy + badges from the copy draft + research dossier.

## 5. Badges (client request)
Per-product overlay tags, editable in product data. Vocabulary: "Most Popular" (star),
"Best for Big Dogs", "Gentle on Dodgy Tummies", "Best for Skin & Coat", "Great for Training",
"Natural Joint Support", "Single Ingredient", "Novel Protein". 1 to 2 per product.

## 6. Data model (Firestore, `store_*` collections)
- `store_products` — OR static config in-repo (products rarely change; start static in
  `src/lib/products.ts`, Zod-validated, single source of truth). Fields: slug, name, price,
  hook, description, badges[], image, safetyNote.
- `store_carts/{cartId}` — { items[], email, name, subtotal, postcode, shippingBand, status
  (open|recovered|converted|abandoned), createdAt, updatedAt, reminder1SentAt, reminder2SentAt }.
- `store_orders/{orderId}` — { stripeSessionId, items[], customer{name,email,address,postcode},
  subtotal, shipping, total, local(bool), createdAt, sheetAppended(bool) }.
- `store_discount_codes/{code}` — { percent, expiresAt, cartId, used(bool) } for recovery codes.

## 7. Buying flow
1. Customer browses long-form page, adds treats to basket (client-side cart, persisted to
   `store_carts` with a cookie cartId once they enter email).
2. Basket → enter name + email + delivery postcode. Email captured here powers abandoned-cart.
3. Shipping computed (see §8) and shown.
4. "Checkout" creates a Stripe Checkout Session (server route) with line items + shipping as a
   line/shipping option, `metadata.cartId`. Redirect to Stripe.
5. Stripe handles card. On success → `checkout.session.completed` webhook:
   - write `store_orders` doc,
   - mark cart `converted`,
   - append a row to Michaela's Google Sheet (append-only),
   - (Stripe also emails Michaela + customer receipts).
6. Thank-you page.

## 8. Shipping rule
- Free for postcodes **DD1 to DD6** (prefix check on the outward code).
- Otherwise **GBP 3.95** flat.
- **Free over GBP 35** subtotal (any postcode).
Implemented as a pure function `computeShipping(postcode, subtotal)` with unit tests.

## 9. Fulfilment — Google Sheet (Michaela's master)
On each paid order, append ONE row via Google Sheets API using the existing service account
(`service-account.json`). Sheet must be shared with the service-account email (handover item).
Columns we fill: Order #, Date, Customer, Address, Postcode, Items, Qty, Subtotal, Postage,
Total, Local?. Her columns (created once, never overwritten): Packed, Posted, Returns/Notes.
**Append-only. Never edit existing rows.**

## 10. Abandoned cart + digest (Vercel Cron)
- Cron (hourly) → `/api/cron/abandoned`: find open carts with an email, not converted:
  - if `updatedAt` older than ~3h and no reminder1 → send email 1 with a **10%** code, set
    reminder1SentAt.
  - if older than ~24h and reminder1 sent and no reminder2 → send email 2 with a **15%** code
    that **expires in 24h**, set reminder2SentAt.
- Cron (daily, morning) → `/api/cron/daily-digest`: email Michaela "X new orders yesterday."
- Email transport: start with a simple provider (Resend or SMTP); env-keyed. Placeholder until
  client provides a sender.

## 11. Pages / components
- `/` long-form landing: Hero, "what's really in them", "your dog wasn't built for it", "so we
  did the digging", product grid (with badges), trust strip, FAQ, closing CTA, footer.
- `/basket` (or slide-over drawer) cart + details form.
- `/api/checkout` create session. `/api/webhooks/stripe` fulfilment. `/api/cron/*`.
- `/thank-you` post-payment.
- Components: Header (logo), PawPrintField (decor), ProductCard (+ BadgeOverlay), Basket,
  CheckoutForm, Section wrappers.

## 12. Copy
Full long-form page copy + nine product descriptions drafted from the research dossier in the
"you've been lied to" voice, honesty-flag compliant, no em dashes. Client + Michaela edit.

## 13. Phasing
- **v1 (this build):** everything above except Michaela's orders page.
- **Phase 2:** Michaela's orders page (view/tick Packed-Posted-Returns in-app), optional 60 to
  90s hero hook-video, weight-based postage tiers if ever needed.

## 14. Handover items (only client/Michaela can provide)
1. Michaela's Stripe keys (publishable + secret + webhook signing) — build uses test mode.
2. Google Sheet created + shared with the service-account email.
3. Real files for **logo** and **whole-sprats** photo (both pasted in chat, not on disk).
4. Vercel deploy + barkingraw.dog DNS.
5. Email sender (Resend/SMTP) for recovery + digest emails.

## 15. Testing
- Unit: `computeShipping`, discount code validity, cart totals, product schema.
- Integration (emulator): webhook → order write + cart convert.
- Manual: dev server, add to basket, checkout in Stripe test mode, verify thank-you + order doc.
