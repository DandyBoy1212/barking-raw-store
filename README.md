# Barking Raw Store

The natural dog-treat store for **Barking Raw** (barkingraw.dog). A long-form "you've been lied
to" sales page selling nine honest, single-ingredient treats through Stripe, with Firestore order
records, Google-Sheet fulfilment, and an abandoned-cart recovery engine.

Built with Next.js (App Router) + React + TypeScript + Firebase, matching the sibling training app.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (see HANDOVER.md)
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run build                # production build
```

## Structure

- `src/app/page.tsx` — the long-form landing page (all copy).
- `src/data/products.ts` — the nine products, prices, badges, copy (single source of truth).
- `src/lib/shipping.ts` — postage rules (free DD1-DD6, £3.95 else, free over £35), unit-tested.
- `src/components/` — Header, ProductCard, Badge, PawTrail, CartProvider, BasketDrawer.
- `src/app/api/checkout` — creates the Stripe Checkout session (server-priced).
- `src/app/api/webhooks/stripe` — writes the order to Firestore + appends the fulfilment sheet.
- `src/app/api/cron/abandoned` — abandoned-cart recovery emails (10% then 15% expiring).
- `src/app/api/cron/daily-digest` — Michaela's daily order-count email.
- `docs/` — the design spec and the sourced research dossier.

## Going live

See **HANDOVER.md** for the five things needed before it can take real money
(Stripe keys, the Google Sheet, the logo + sprats images, Vercel deploy + DNS, an email sender).
