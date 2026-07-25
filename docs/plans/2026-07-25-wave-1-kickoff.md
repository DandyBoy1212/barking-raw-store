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

> **Updated late on 2026-07-25, after A.1 merged and Liam ran part of this by hand.** The checklist
> below is annotated rather than rewritten, so the original stays readable. Three things changed
> what is worth your time:
>
> 1. **Two blockers make whole sections untestable.** No Stripe key, so anything that reaches
>    Stripe returns 503. And no verified Resend domain, so the only address on earth that can
>    receive email from this site is `liam.dand@scoop-patrol.co.uk`. Both are Michaela's to fix.
>    Sections marked BLOCKED below cannot pass until they are.
> 2. **The "known fault" at the bottom is fixed.** Do not go looking for it.
> 3. **New surfaces exist that this list predates**: the legal pages, the account page with dog
>    profiles, and the restyled admin product form. Added at the end.

### Setup

Copy `.env.example` to `.env.local` and fill in at minimum:

- `FIREBASE_SERVICE_ACCOUNT`, the barking-raw service account JSON
- `FIREBASE_STORAGE_BUCKET`, needed for product image upload
- `STRIPE_SECRET_KEY`, a `sk_test_...` key. **Still absent as of 2026-07-25**
- `RESEND_API_KEY` and `EMAIL_FROM`, needed for the magic link email to arrive. **A key alone is
  not enough.** `EMAIL_FROM` is currently `onboarding@resend.dev`, Resend's shared test sender, and
  with no verified domain Resend delivers to the account owner's address and nobody else. Verify
  `barkingraw.dog` at resend.com/domains and move `EMAIL_FROM` onto it
- `NEXT_PUBLIC_SITE_URL`, and it must match the port you actually run on, or `/api/auth/link`
  returns a bare 403. `http://localhost:3000` for the shared checkout
- The four `NEXT_PUBLIC_FIREBASE_*` client variables, or the login pages throw
  `auth/invalid-api-key` before anything renders

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

**Login** — partly BLOCKED on the Resend domain

- [x] Request a magic link at `/login`. The email arrives, and in reasonable time.
      **Done 2026-07-25, and it exposed the email blocker.** It arrives only at
      `liam.dand@scoop-patrol.co.uk`. Every other address is refused by Resend with a 403 and no
      email is sent. Use that address for the rest of this list
- [ ] The link signs you in and lands somewhere sensible
- [ ] The link works only once, and an old link is refused
- [ ] Signing out actually signs you out, and the admin area is not reachable afterwards
- [ ] A non-staff account cannot reach `/admin`. **Note:** creating a second account needs an
      email that Resend will deliver to, so this one waits on the domain

**Products, the part Michaela owns** — BLOCKED on `STRIPE_SECRET_KEY`

Creating and editing both call `syncProductToStripe`, so without a key they return a 503 reading
"Service not configured." That is the missing key, not a bug. The list and archive still work.

- [ ] `/admin/products` lists the nine seeded products
- [ ] Create a product with a photo. It saves, the photo uploads, and it appears on the home page
- [ ] The same product appears in Stripe as a product with a price
- [ ] Edit its price. The Stripe price rolls over, and the new price is what checkout charges
- [ ] Edit its name. Check what happens to the slug on an existing product
- [ ] Archive a product. It disappears from the shop and stays in the admin
- [ ] Try to save a product with no photo, and with a silly price. The error is readable
- [ ] Leave the page open long enough for the session to lapse, then save. It should say so, not fail silently

Two known gaps to expect rather than report, both logged in `HANDOVER.md`: the dev seed route does
not write the A.1 fields, so a fresh seed needs `scripts/backfill-product-fields.mjs` after it, and
product order is alphabetical by slug rather than the curated order. Both are deliberately being
left until B.1 and B.5 land, because those rewrite the same files.

**Buying** — BLOCKED on `STRIPE_SECRET_KEY` from the checkout step down

- [ ] Add to basket, change quantities, remove a line
- [ ] Postcode DD5 gives free delivery. An EH postcode gives GBP 3.95. Over GBP 35 is free
- [ ] An order mixing own stock with a supplier posted item itemises as two parcels, with the free
      postage threshold counting the own stock subtotal only. **New since this list was written**
- [ ] Checkout with Stripe test card `4242 4242 4242 4242`
- [ ] The order appears in Firestore `store_orders`
- [ ] A row is appended to the fulfilment Google Sheet
- [ ] The customer record is created, which is what grants membership

**The account, new since this list was written**

- [ ] `/account` greets you as your dog's owner once you have added one, not by email address
- [ ] Add a dog with a photo. It appears with its life stage worked out from the date of birth
- [ ] Edit that dog, and remove it. Removing asks twice
- [ ] A dog with no date of birth shows no life stage rather than guessing one

**The legal pages, new since this list was written**

- [ ] `/terms`, `/privacy`, `/delivery`, `/returns` and `/contact` all load, and the footer reaches
      them from every page
- [ ] Each shows the red "not ready to publish" notice listing what Michaela still owes.
      **This is correct until `src/data/business.ts` is filled in.** If it is missing, that is the
      fault, not the other way round
- [ ] Read the returns page as Michaela. She is agreeing to it, so she has to recognise it

**Fixed since this list was written, do not go looking for it**

The original note here said a product created in the admin would price at GBP 0.00 in the basket
and might crash the basket drawer, because `CartProvider` and `BasketDrawer` read the static seed.
**A.1 Task 7 fixed it**, and `CartProvider` now takes a `catalogue` prop fed from the root layout.

### What to do with what you find

Anything broken that is not listed above as blocked or expected: write it down with what you did and
what happened. Wave 2 tracks are in flight in worktrees, so a fix in a shared file is likely to
collide. Report it rather than fixing it in the shared checkout, unless it is small and in a file
nobody is holding.
