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
- **Stripe Checkout** (`src/app/api/checkout/route.ts`): server-priced line items (never trusts
  the client), shipping option, optional recovery discount, records the cart for recovery.
- **Webhook** (`src/app/api/webhooks/stripe/route.ts`): on payment, writes the order to Firestore,
  marks the cart converted, and appends a row to Michaela's Google Sheet (append-only).
- **Abandoned cart** (`src/app/api/cron/abandoned/route.ts`): email 1 after ~3h with a 10% code,
  email 2 after ~24h with a 15% code that expires in 24h.
- **Daily digest** (`src/app/api/cron/daily-digest/route.ts`): emails Michaela yesterday's order count.
- Vercel cron schedule in `vercel.json`.

## What YOU or Michaela must provide before it can take real money (the 5 things)

1. **Stripe keys** (Michaela's account) → set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   Start with test keys (`sk_test_…`). Until this is set, checkout shows a friendly "not switched
   on yet" message instead of erroring.
2. **Google Sheet** → create it, name the tab `Orders`, share it as Editor with the service-account
   email, and set `FULFILMENT_SHEET_ID`. Add your own `Packed` / `Posted` / `Returns` columns; we
   only ever append new rows and never touch yours.
3. **Real image files** → drop the actual **logo** into `public/brand/logo.png` and the real
   **whole sprats** photo into `public/products/whole-sprats.png` (currently a placeholder). Both
   were pasted into chat, so they're not on disk yet.
4. **Deploy + domain** → connect the repo to Vercel and point `barkingraw.dog` at it. Set
   `NEXT_PUBLIC_SITE_URL=https://barkingraw.dog`.
5. **Email sender** → a Resend API key (`RESEND_API_KEY`), a verified `EMAIL_FROM`, and your
   `OWNER_EMAIL` for the daily digest.

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

- Firebase reuses the existing `gen-lang-client` project, in `store_*` collections, so it never
  tangles with the dog-training app.
- The product photos for pure-meat-tit-bits and rabbit-feet were tidied onto the house white
  background with the Nano Banana image tool from the real product photos (not invented).
