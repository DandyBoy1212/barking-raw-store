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
  already in Firestore. **Run against barking-raw on 2026-07-25**: 9 products patched, and a
  re-run reported 0 to patch, which is the idempotency check. Dry run it first (no flag), then
  `node scripts/backfill-product-fields.mjs --apply`.
- **Stripe Checkout** (`src/app/api/checkout/route.ts`): server-priced line items (never trusts
  the client), shipping option, optional recovery discount, records the cart for recovery.
- **Webhook** (`src/app/api/webhooks/stripe/route.ts`): on payment, writes the order to Firestore,
  marks the cart converted, and appends a row to Michaela's Google Sheet (append-only).
- **Abandoned cart** (`src/app/api/cron/abandoned/route.ts`): email 1 after ~3h with a 10% code,
  email 2 after ~24h with a 15% code that expires in 24h.
- **Daily digest** (`src/app/api/cron/daily-digest/route.ts`): emails Michaela yesterday's order count.
- Vercel cron schedule in `vercel.json`.

## Added on the evening of 2026-07-25: A.1 merged, then B.4 and A.2

- **A.1 is merged** into `feat/accounts-loyalty-admin`. Gated on 107 tests, a clean
  `tsc --noEmit`, and lint at the 3 pre-existing errors below.
- **The legal pages** (`/terms`, `/privacy`, `/delivery`, `/returns`, `/contact`), step B.4, plus a
  footer in the root layout that reaches them. Michaela's real business details are **not invented**:
  they sit as `PENDING` in `src/data/business.ts`, and every page renders a red "not ready to
  publish" notice listing what is still missing. Filling that one file in clears the notices
  everywhere. What she has to supply is in `docs/legal-details-for-michaela.md`.
- **A.2, the customer and dog data model**, built to `docs/plans/2026-07-25-stage-8-customer-dog-model.md`.
  Dogs are an ordered array on `store_customers/{uid}`, each with a stable id. `/account` lists them
  and can add one. Age is stored as an approximate date of birth rather than a number of years, so
  the puppy, adult and senior filtering cannot go stale.
- `scripts/backfill-customer-fields.mjs`, same shape as the product backfill. **Verified against a
  deliberately legacy-shaped doc**, not just against already-migrated data.

Three things worth knowing before touching this:

- **`buildCustomerDoc` no longer writes blank fields.** The Stripe webhook merges it into the
  customer doc on every order, and it used to write `name: ""`, which would have silently wiped a
  name the customer set on the account page the next time they ordered.
- **`isBrowserSameOrigin` is new, and `isAllowedOrigin` is unchanged.** The old helper deliberately
  allows a request that states neither Origin nor Referer, for curl and server-to-server callers,
  and the login routes rely on that. The account routes have no such caller, so they use the
  stricter one. Do not "tidy" these into one.
- **There are two test dogs, Loki and Bear, on Liam's own customer record** in the live project,
  left there deliberately so the feature can be seen working. Delete them whenever.

Still open from this work: the account page can add a dog but not yet edit or delete one from the
UI, though the routes for both exist and were verified by hand. The stall form (D.1) is the real
collection surface.

## No email reaches anybody except one address, and this is a launch blocker

Found 2026-07-25 when the sign-in link never arrived. Not a code fault. The Resend account
has **no verified domain**, and `EMAIL_FROM` is `Barking Raw <onboarding@resend.dev>`, Resend's
shared test sender. In that state Resend refuses every recipient except the account owner's own
address with a 403:

> You can only send testing emails to your own email address (liam.dand@scoop-patrol.co.uk). To
> send emails to other recipients, please verify a domain at resend.com/domains, and change the
> `from` address to an email using this domain.

So today the only address that can receive anything is **liam.dand@scoop-patrol.co.uk**. Everything
else fails silently. That takes out the sign-in link, the staff invite, both abandoned cart emails,
and the daily digest, whose `OWNER_EMAIL` is currently an address Resend will not deliver to.

**The fix is Michaela's DNS, not code:** verify `barkingraw.dog` at resend.com/domains, then set
`EMAIL_FROM` to something on that domain, for example `Barking Raw <hello@barkingraw.dog>`.

`/api/auth/link` used to return `{ok: true}` whether or not the send worked, on the reasoning that a
uniform response avoids revealing whether an address is registered. That reasoning holds for the
registration question but hid a total configuration failure for an evening. It now returns 503 with
a readable message when the send fails, which leaks nothing: neither link generation nor delivery
depends on whether the address is registered. The three cron and invite senders still only log.

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

## The dev origin allowlist is pinned to port 3000

`LOCALHOST_DEV_ORIGIN` in `src/lib/auth-helpers.ts` is the literal string
`http://localhost:3000`, and `isAllowedOrigin` accepts only that or the origin of
`NEXT_PUBLIC_SITE_URL`. A dev server on any other port therefore gets a flat 403 from
`/api/auth/link` with no logging, which reads as "the email system is broken" when it is
really a CORS-style origin check. Setting `NEXT_PUBLIC_SITE_URL` to the port the server
actually runs on is the fix, and it must be set per worktree, since each parallel worktree
needs its own port. Worth making the dev allowance derive from the port rather than being
hardcoded, before Wave 2 runs several worktrees at once.

Also note `/api/auth/link` throttles to 3 requests per email per 15 minutes and returns
`{ok: true}` when throttled, so a fourth attempt looks successful but sends nothing.

## Two things found while wiring the live Firebase project (2026-07-25)

Neither is caused by the A.1 work. Both are worth a decision before launch.

- **The dev seed route does not write the A.1 fields.** `src/app/api/dev/seed-products/route.ts`
  writes name, price, copy, badges, image and the Stripe ids, but not `pillar`, `leadTimeDays`
  or `fulfilment`. So a freshly seeded catalogue always needs the backfill script run after it.
  `docToStoredProduct` defaults them safely, so nothing breaks, but the route should really
  write them itself.
- **Product display order is now alphabetical by slug.** The nine seed entries in
  `src/data/products.ts` are in a deliberate order (Beef Trachea Rings first, Pure Meat
  Tit-bits last). Reading from Firestore returns them in document-id order instead, so the
  shop now leads with Beef Trachea Rings and Chicken Feet by accident rather than by choice.
  Michaela has no way to set the order. Wants a `sortOrder` field, or an explicit order by
  something meaningful.

## Known lint debt (pre-dates A.1, deliberately not fixed here)

`npm run lint` reports 3 errors. All pre-date the A.1 product-data work, confirmed by stashing
that work and re-running. None are worth bundling into an already large diff, but they should
be cleared before launch:

- `src/components/CartProvider.tsx` - `react-hooks/set-state-in-effect` on the localStorage
  cart hydration. The genuine one. Fixing it changes how the basket restores on first paint,
  so it wants its own change and its own test, not a drive-by.
- `src/app/thank-you/page.tsx` - 1 error.

Was 4. The `admin/products/page.tsx` one was cleared in 49975a2, which converted that `<a>`
to `next/link` while rewriting the line anyway.

## Notes

- Firebase reuses the existing **barking-raw** project (the same one the dog-training app uses),
  in `store_*` collections, so it never tangles with the training app's data. Provide that
  project's service-account JSON as `FIREBASE_SERVICE_ACCOUNT`.
- The product photos for pure-meat-tit-bits and rabbit-feet were tidied onto the house white
  background with the Nano Banana image tool from the real product photos (not invented).
