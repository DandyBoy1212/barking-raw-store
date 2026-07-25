# Wave 1 kickoff

Three tracks run at once. Tracks 1 and 2 are builds in their own worktrees. Track 3 is Liam at a
keyboard and needs no worktree.

Build order and wave plan: `docs/specs/2026-07-25-v1-launch-pillars-members-design.md` sections 15
and 15.1.

Every track branches from `feat/accounts-loyalty-admin`, not from `main`. `.claude/settings.json`
sets `worktree.baseRef` to `head` so the worktree tool does this automatically. If a session ever
opens on a branch that is missing the admin area or the login pages, that setting was not picked up
and the branch came off `main` by mistake. Stop and rebase rather than building on it.

## Track 1: A.1 product data

Plan: `docs/plans/2026-07-25-stage-7-product-data-pillars.md`. Nine tasks, TDD, commit per task.

This track must land before Wave 2 starts, because it touches nearly every shared file: the product
type, the products store, the admin form and its two API routes, the cart provider, the basket
drawer, the product card, the root layout and the checkout route.

## Track 2: B.2 About Us, B.4 legal and contact

Safe to run alongside Track 1 because it creates new pages and touches nothing Track 1 touches.

Paste this into a new session:

> Read `docs/specs/2026-07-25-v1-launch-pillars-members-design.md`, sections 3, 12, 15 and 16.
> Work in a worktree. Build steps B.2 and B.4 of the build order: the About Us page, and the terms,
> privacy, delivery, returns and cancellations, and contact pages.
>
> Section 4.5 has the researched returns position, which is the substance of the returns page.
> Barking Raw is the trader, so the policy states Michaela's own obligations, and the return address
> is "contact us and we will send you the return address" rather than one printed address, because
> supplier posted items go back to the supplier.
>
> House style: British spelling, no em dashes. Write the plan first using the writing-plans skill,
> then execute it.

Two things that track needs from a human and should ask for rather than invent:

- **A real business address and contact route** for the contact page. Stripe expects both before it
  will let her trade properly.
- **The About Us origin story.** Michaela's, not ours. It can be drafted from `README.md`, the
  landing page copy in `src/app/page.tsx` and `docs/research-dossier.md`, but it needs her sign off,
  and the TTouch and nutrition credentials must be stated accurately because they are the trust
  argument for the whole site.

## Track 3: step 0.2, Liam testing what already exists

Nothing in the 25 commits on this branch has been exercised by a human. This is half a day and it
de-risks everything stacked on top of it.

### Setup

Copy `.env.example` to `.env.local` and fill in at minimum:

- `FIREBASE_SERVICE_ACCOUNT`, the barking-raw service account JSON
- `FIREBASE_STORAGE_BUCKET`, needed for product image upload
- `STRIPE_SECRET_KEY`, a `sk_test_...` key
- `RESEND_API_KEY` and `EMAIL_FROM`, needed for the magic link email to arrive
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

Then:

```bash
npm install && npm run dev
```

Two dev-only helpers exist. Both are open when `SEED_SECRET` is unset and `NODE_ENV` is not
production, so they work locally and fail closed on Vercel.

```bash
curl -X POST http://localhost:3000/api/dev/make-staff -H "Content-Type: application/json" -d "{\"email\":\"LiamDand@businessautomationtoday.online\"}"
```

```bash
curl -X POST http://localhost:3000/api/dev/seed-products
```

### The checklist

Work as Michaela would, not as a developer. Anything that needs you to explain it is a fault.

**Login**

- [ ] Request a magic link at `/login`. The email arrives, and in reasonable time
- [ ] The link signs you in and lands somewhere sensible
- [ ] The link works only once, and an old link is refused
- [ ] Signing out actually signs you out, and the admin area is not reachable afterwards
- [ ] A non-staff account cannot reach `/admin`

**Products, the part Michaela owns**

- [ ] `/admin/products` lists the nine seeded products
- [ ] Create a product with a photo. It saves, the photo uploads, and it appears on the home page
- [ ] The same product appears in Stripe as a product with a price
- [ ] Edit its price. The Stripe price rolls over, and the new price is what checkout charges
- [ ] Edit its name. Check what happens to the slug on an existing product
- [ ] Archive a product. It disappears from the shop and stays in the admin
- [ ] Try to save a product with no photo, and with a silly price. The error is readable
- [ ] Leave the page open long enough for the session to lapse, then save. It should say so, not fail silently

**Buying**

- [ ] Add to basket, change quantities, remove a line
- [ ] Postcode DD5 gives free delivery. An EH postcode gives GBP 3.95. Over GBP 35 is free
- [ ] Checkout with Stripe test card `4242 4242 4242 4242`
- [ ] The order appears in Firestore `store_orders`
- [ ] A row is appended to the fulfilment Google Sheet
- [ ] The customer record is created, which is what grants membership

**Known fault, do not spend time diagnosing it**

A product you create in the admin will show as GBP 0.00 in the basket, and the basket drawer may
crash on it. `CartProvider` and `BasketDrawer` both read the static nine-product seed in
`src/data/products.ts` instead of the live catalogue. Track 1 fixes this in its Task 7. Note
anything else you find, but not this.

### What to do with what you find

Anything broken that is not the known fault above: write it down with what you did and what
happened. It either becomes a fix in Track 1's branch if it is in the shared files, or its own small
branch if it is not.
