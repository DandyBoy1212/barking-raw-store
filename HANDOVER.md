# Barking Raw Store — Handover & Status

Built 2026-07-15. This is the "you've been lied to" natural dog-treat store: a long-form
sales page, nine products, Stripe checkout, Firestore order records, Google-Sheet fulfilment,
and an abandoned-cart recovery engine. See `docs/specs/2026-07-15-barking-raw-store-design.md`
for the full design, and `docs/research-dossier.md` for the sourced facts behind every claim.

## What's built and working (verified locally)

- **Long-form landing page** (`src/app/page.tsx`) with the full "you've been lied to" copy,
  black/white banded sections, and the fading paw-print motif. All claims are honesty-checked
  against the research dossier (no "kills your dog", salmon flagged cooked-not-raw, tripe sold
  on protein not probiotics, rabbit "dewormer" myth dropped).
- **Nine products** (`src/data/products.ts`) with the standardised 1024x1024 photos, badges
  ("Most Popular", "Best for Big Dogs", "Gentle on Dodgy Tummies", etc.), prices, and safety notes.
- **Basket** (drawer) with quantity controls, postcode-based shipping, discount-code field,
  and localStorage persistence. Verified: add-to-cart, totals, and the shipping rule all work.
- **Shipping rule** (`src/lib/shipping.ts`, unit-tested): free DD1 to DD6, otherwise £3.95,
  free over £35.
- **Four product fields** (`src/data/products.ts`, `src/lib/product-fields.ts`, unit-tested):
  every product carries a pillar (Good Food, Comfy Walks, Fun & Games, Cosy Sleep), a lead time
  in days, an optional members-only window, and a fulfilment path. Michaela sets all four in
  the admin form. A pillar is required, because a product without one appears on no page.
- **Two delivery paths** (`computeBasketDelivery` in `src/lib/shipping.ts`, unit-tested): her own
  stock is one parcel under the site rule above; each supplier-posted line is its own parcel with
  its own postage and arrival range. The free-postage threshold counts the own-stock subtotal only,
  and supplier postage is charged once per line rather than per unit. The basket itemises every
  parcel before payment, and checkout recomputes the whole thing server side.
- **Members-only windows** are enforced on the server: filtered out of the catalogue at read time
  (`getPublicProducts`) and refused with a 403 at checkout, never merely hidden in the client.
- `scripts/backfill-product-fields.mjs` fills pillar, lead time and fulfilment onto products
  already in Firestore. **Not yet run** — it needs `FIREBASE_SERVICE_ACCOUNT`. Dry run it first
  (no flag), then `node scripts/backfill-product-fields.mjs --apply`. It is idempotent.
- **Stripe Checkout** (`src/app/api/checkout/route.ts`): server-priced line items (never trusts
  the client), shipping option, optional recovery discount, records the cart for recovery.
- **Webhook** (`src/app/api/webhooks/stripe/route.ts`): on payment, writes the order to Firestore,
  marks the cart converted, and appends a row to Michaela's Google Sheet (append-only).
- **Abandoned cart** (`src/app/api/cron/abandoned/route.ts`): email 1 after ~3h with a 10% code,
  email 2 after ~24h with a 15% code that expires in 24h.
- **Daily digest** (`src/app/api/cron/daily-digest/route.ts`): emails Michaela yesterday's order count.
- Vercel cron schedule in `vercel.json`.

## What YOU or Michaela must provide before it can take real money (the 4 things)

1. **Stripe keys** (Michaela's account) → set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   Start with test keys (`sk_test_…`). Until this is set, checkout shows a friendly "not switched
   on yet" message instead of erroring.
2. **Google Sheet** → create a blank Google Sheet (sheets.new), then click **Share** and add
   `firebase-adminsdk-fbsvc@barking-raw.iam.gserviceaccount.com` as an **Editor**. Copy the sheet
   ID from its URL (the long code between `/d/` and `/edit`) into `FULFILMENT_SHEET_ID`. That's it,
   the app auto-creates the header row and only ever appends new rows. Add your own notes in the
   Packed / Posted / Returns columns; we never touch them.
3. **Deploy + domain** → connect the repo to Vercel and point `barkingraw.dog` at it. Set
   `NEXT_PUBLIC_SITE_URL=https://barkingraw.dog`.
4. **Email sender** → a Resend API key (`RESEND_API_KEY`), a verified `EMAIL_FROM`, and your
   `OWNER_EMAIL` for the daily digest.

DONE (was on the list, now wired in): the real **logo** (`public/brand/logo.jpeg`, shown in the
hero) and the real **whole sprats** photo (`public/products/whole-sprats.png`).

All variables are documented in `.env.example`. Copy it to `.env.local` for local dev.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (shipping etc.)
```

## Deliberately Phase 2 (not built yet)

- Michaela's in-app orders page (view/tick Packed-Posted-Returns). The Firestore data and the
  Sheet already exist, so this is a small job.
- Optional 60 to 90s "you've been lied to" hero video at the top of the page.
- Weight-based postage tiers (only if order data ever shows heavy baskets).

## Notes

- Firebase reuses the existing **barking-raw** project (the same one the dog-training app uses),
  in `store_*` collections, so it never tangles with the training app's data. Provide that
  project's service-account JSON as `FIREBASE_SERVICE_ACCOUNT`.
- The product photos for pure-meat-tit-bits and rabbit-feet were tidied onto the house white
  background with the Nano Banana image tool from the real product photos (not invented).
