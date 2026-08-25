# Barking Raw Store, Shop Taxonomy and Foundations, Design Spec

Date: 2026-08-25. Status: shape agreed in brainstorm with Liam.

Supersedes the pillar model set out in `2026-07-25-v1-launch-pillars-members-design.md` sections 2
and 3. Where the two conflict, this one wins, and the conflicts are named explicitly in section 3.4
so nobody builds to the older version by accident.

House style, matching the earlier specs: British spelling, no em dashes anywhere.

## 1. What this is

The site is being simplified. Dropshipping goes away entirely. The four pillar pages go away. The
shop gains a real category structure with a landing page of category circles. Four treat boxes and
a small toy range join the shelf, sale pricing arrives, and a public blog is added.

That is far too much for one spec. It is decomposed into four phases, each with its own spec and
its own implementation plan, each shipping green.

### 1.1 The four phases

| Phase | Name | What it does | Visible to customers |
| --- | --- | --- | --- |
| 1 | Foundations | Category replaces pillar, supplier posted path removed, `wasPrice` added, Pick and Mix rehomed and given a new draw rule, nav swapped | Yes, navigation only, styling unchanged |
| 2 | The new site | Home rebuilt (logo, short explainer, four circles, Dogs of the Day), shop category pages styled, About rewritten to carry the message, Delivery and Contact refreshed, every named brand removed | Yes, the redesign |
| 3 | The shelf | Four box products, four toys, struck through sale pricing, the four for GBP 20 basket rule. Relaunch happens here. | Yes |
| 4 | Blog | A separate blog with its own editor, images and search metadata, leaving the members posts system untouched | Yes |

**This spec covers Phase 1 only.** Phases 2 to 4 are recorded in section 11 so the decisions taken
in the brainstorm are not lost, but they are not designed here.

### 1.2 Why Foundations comes first

Every later phase reads the product model. Changing that model underneath finished pages would mean
building the new pages twice, or carrying a compatibility shim that never gets removed. The riskiest
change, data surgery on the live catalogue, therefore happens while nothing customer facing depends
on it yet.

### 1.3 One correction to the phase boundary

Phase 1 was originally described as having no visible change. That is not achievable. `Ring.tsx`,
`Header.tsx` and the four pillar pages import the `Pillar` type directly, so the moment `pillar`
leaves the product model those files must change with it. Phase 1 therefore swaps the navigation
as well as the model. The restyle, the copy and the new home page layout remain in Phase 2.

## 2. Decisions taken in the brainstorm

| Decision | Choice | Consequence |
| --- | --- | --- |
| The four pillar pages | Deleted, message moves to About | Four indexed content pages lost, redirects required, welcome email series affected (section 5) |
| Home circles and shop circles | One taxonomy, home links into the shop categories | No duplicate category list, no second level of navigation |
| The categories | Treat Range, Treat Boxes, Pick and Mix, Toys | Pick and Mix is navigation only, not a product category (section 3.1) |
| The boxes | Four flat products, named exactly: Large Treats for Large Dogs, Ears Box, Mega Mystery Box, Mystery Bargain Box | No product variant model needed |
| Sale price source | A `wasPrice` typed per product in the admin | Full control, no derived maths, and a wrong number is possible (section 6.4) |
| Four for GBP 20 | A real basket rule, applied automatically | Basket level pricing logic and an adjusted Stripe total, Phase 3 |
| Dropshipping | Ripped out completely | Shipping simplifies, Pick and Mix loses its draw rule, live supplier posted products must be archived |
| Members, loyalty, badges, Stall, Dogs of the Day | All kept | Dogs of the Day moves onto the home page in Phase 2, staff administered |
| Members | Stays in the main nav | Nav is Home, About, Shop, Delivery, Contact, Members |
| Blog | Separate from the members posts system | A second editor, Phase 4 |
| Toys | Seeded now from supplied data | Four toy products, Phase 3 |

## 3. The taxonomy

### 3.1 Two types, not one

A product belongs to a shelf. Pick and Mix is not a shelf, it is a builder that draws from the
treat range. Modelling it as a product category would mean inventing phantom products, so the two
ideas are kept apart:

```ts
/** The shelf a product sits on. Every product has exactly one. */
export type ProductCategory = "treats" | "boxes" | "toys";

/** What the shop navigates by. Pick and Mix has no products of its own. */
export type ShopCategory = ProductCategory | "pick-and-mix";
```

`ALL_PRODUCT_CATEGORIES` and `ALL_SHOP_CATEGORIES` are exported alongside, replacing `ALL_PILLARS`.

### 3.2 Labels and routes

| Shop category | Label | Route |
| --- | --- | --- |
| `treats` | Treat Range | `/shop/treats` |
| `boxes` | Treat Boxes | `/shop/boxes` |
| `pick-and-mix` | Pick and Mix | `/shop/pick-and-mix` |
| `toys` | Toys | `/shop/toys` |

`CATEGORY_LABELS: Record<ShopCategory, string>` replaces `PILLAR_LABELS`. `PILLAR_LINES` has no
successor: the one line per pillar was positioning copy, and the positioning now lives on About.

`/shop` becomes the category landing page listing the four circles. The flat everything grid it
holds today is replaced by that landing page, because a flat grid and four categories are two
answers to the same question and the categories are the one the customer asked for.

### 3.3 Where each existing product lands

All ten seeded products carry `pillar: "good-food"` today.

| Product | New category |
| --- | --- |
| Beef Trachea Rings, Chicken Feet, Rabbit Ears, Rabbit Feet, Duck Wings, Tripe Sticks, Whole Sprats, Salmon Bites, Pure Meat Tit-bits | `treats` |
| International Dog Day Mystery Box | `boxes` |

The Dog Day box is a campaign product superseded by the Mega Mystery Box. It is mapped to `boxes`
here rather than archived, because archiving it is a merchandising decision that belongs with the
new boxes in Phase 3, not with a data migration.

### 3.4 What is deleted, and what conflicts with the older spec

Deleted outright:

- `src/lib/pillars.ts` and `src/lib/pillars.test.ts`, including `RING_PHOTOS` and `PILLAR_META`.
- `src/app/good-food/`, `src/app/comfy-walks/`, `src/app/fun-and-games/`, `src/app/cosy-sleep/`.
- `src/components/PillarProducts.tsx`, which exists only to fill a pillar page.
- `Pillar`, `ALL_PILLARS`, `PILLAR_LABELS`, `PILLAR_LINES` from `src/data/products.ts`.

This directly contradicts sections 2 and 3 of the 2026-07-25 spec, which made the pillars the
positioning layer and the pillar pages the only indexable content on the site. That model is
retired.

To be precise about what survives, because it is not the whole of it. The four pillar framing, "get
these four right and your dog will lap up training", is gone entirely and is not relocated anywhere.
Michaela is not telling that story. What survives is the honest labelling argument that sat under
Good Food, and it moves to About in Phase 2 as the spine of the page (section 11.1). Comfy Walks,
Fun and Games and Cosy Sleep have no successor content and are simply deleted.

`Ring.tsx` survives. Its four wedges are repointed at the four shop categories and its hub keeps
the logo. Its imagery is a Phase 2 concern, so Phase 1 leaves the current photos in place and
nothing renders empty.

## 4. Removing the supplier posted path

### 4.1 Fields removed from `Product`

`fulfilment`, `supplierPostage`, `supplierArrivalMinDays`, `supplierArrivalMaxDays`,
`leadTimeDays`, plus the `FulfilmentPath` type and `ALL_FULFILMENT_PATHS`.

Everything on the shelf is now Michaela's own stock, posted by her, dispatched with everything else.

### 4.2 The surface

A search for `fulfilment`, `supplierPostage`, `supplierArrival` and `leadTime` across `src`
currently returns 28 files. That list is a search surface, not a delete list: `sheet.ts` and
`order-earn.ts` use the word fulfilment in the ordinary sense of getting a parcel out of the door,
and must be read before being touched. The files that genuinely carry the supplier posted path are:

- `src/data/products.ts`, the type and the seed literals
- `src/lib/product-fields.ts`, `leadTimeNote` and `supplierArrivalNote`
- `src/lib/product-admin.ts`, validation of the supplier fields
- `src/lib/shipping.ts`, `DeliveryProduct` and the per line supplier postage
- `src/lib/products-store.ts`, read and write mapping
- `src/lib/subscriptions.ts`, `splitSubscribable`, which exists only to keep supplier
  posted lines out of a subscription and has nothing left to split afterwards
- `src/lib/pick-and-mix.ts`, the draw pool and `bundleDeliveryProduct`
- `src/app/api/admin/products/route.ts` and `src/app/api/admin/products/[slug]/route.ts`
- `src/app/api/dev/seed-products/route.ts`
- `src/components/admin/ProductForm.tsx`, the form fields
- `src/components/ProductCard.tsx` and `src/components/BasketDrawer.tsx`, the arrival notes

### 4.3 Shipping afterwards

`computeShipping` already implements the whole customer facing rule: free to DD1 to DD6, flat
GBP 3.95 elsewhere, free over GBP 35. Removal deletes the supplier postage that was added on top of
it per line, and shrinks `DeliveryProduct` to `slug`, `name` and `price`. `isLocalPostcode`,
`FREE_OVER`, `FLAT_RATE` and `amountToFreePostage` are unchanged.

`computeBasketDelivery` collapses with it. It exists to split a basket into several parcels, and
after the change there is only ever one, so its `parcels` array, `DeliveryParcel` type and
`ownStockSubtotal` go and it returns `{ cost, free, reason, amountToFreePostage }`. Its two
consumers, `src/app/api/checkout/route.ts` and `src/components/BasketDrawer.tsx`, reference the
fields only through this shape, which is why neither appears in the list above. Both lose their
"this order arrives in N separate parcels" copy, which can no longer happen.

### 4.4 Live data

Any product in Firestore with `fulfilment === "supplier-posted"` is archived by the migration
script before the fields are stripped, not silently converted to own stock. Converting would put a
product Michaela cannot post from her own shelf onto a shelf that promises she can. The script
reports what it archived so she can decide whether to restock any of it as her own.

## 5. The welcome email series

`src/lib/welcome-emails.ts` sends five emails: a code reminder plus one per pillar, each linking to
a pillar page. `src/lib/subscribers.ts` schedules them over a fortnight and types the action as
`{ type: "pillar"; index: 0 | 1 | 2 | 3 }`.

Deleting the pillar pages does not break these sends, because the redirects in section 7 keep every
link resolving. It does make them dishonest: an email promising a lesson would land on a shop.

**Decision:** Phase 1 leaves the series sending and untouched, relying on the redirects. Phase 2
replaces it.

Replaces, not rewrites. Three of the four pillar emails teach Comfy Walks, Fun and Games and Cosy
Sleep, and per section 3.4 that material is gone rather than moved, so there is nothing to repoint
them at. Phase 2 writes a shorter sequence drawn from the new About narrative, which is the one
argument Michaela is still making. The number of sends is a Phase 2 decision, not this one.

Leaving them running in the meantime is the lesser of two wrongs: cutting the series in Phase 1
would throw away a working fortnight of nurture weeks before its replacement exists, and the
redirects mean every link still resolves. It is reversible either way, because the schedule is one
array of day offsets in `subscribers.ts`.

## 6. Sale pricing: `wasPrice`

### 6.1 The field

```ts
/** GBP. The price shown struck through beside the real price. Optional. */
wasPrice?: number;
```

### 6.2 Validation

`validateProductInput` rejects a `wasPrice` that is not a positive number, and rejects one that is
less than or equal to `price`, with the sentence "The was price has to be higher than the price you
are charging." An absent or empty `wasPrice` is valid and means no sale.

### 6.3 What Phase 1 does not do

Rendering. The struck through price, the saving and the sale badge land in Phase 3 with the boxes,
which are the first products that need them. Phase 1 stores and validates the number and gives
Michaela a field to type it in, so the boxes in Phase 3 have somewhere to put GBP 24.

### 6.4 A note for Michaela, not a code requirement

UK pricing guidance expects a "was" price to have genuinely been charged for a reasonable period
before it is struck through. A number typed purely to make a discount look bigger is the practice
that guidance exists to stop. The field gives her the control she asked for, and using it honestly
is hers to do. Phase 3 will offer "worth GBP 24" wording as an alternative presentation for boxes
whose contents justify a value but which never sold at that price.

## 7. Redirects

Added to `next.config.ts` as permanent, which Next 16 serves as 308 and which preserves the request
method:

```ts
async redirects() {
  return [
    { source: "/good-food", destination: "/shop/treats", permanent: true },
    { source: "/comfy-walks", destination: "/shop", permanent: true },
    { source: "/fun-and-games", destination: "/shop/toys", permanent: true },
    { source: "/cosy-sleep", destination: "/shop", permanent: true },
  ];
}
```

Good Food goes to the treat range and Fun and Games to toys, because those are the honest
successors. Comfy Walks and Cosy Sleep have no successor shelf, so they go to the shop landing page
rather than to a category that would misrepresent what the visitor clicked.

## 8. Data migration

One script, `scripts/backfill-product-categories.mjs`, modelled on the existing
`scripts/backfill-product-fields.mjs`. In order:

1. Read every product document.
2. Archive any with `fulfilment === "supplier-posted"`, printing slug and name.
3. Set `category` from the mapping in section 3.3, defaulting anything unrecognised to `treats`.
4. Delete `pillar`, `fulfilment`, `supplierPostage`, `supplierArrivalMinDays`,
   `supplierArrivalMaxDays` and `leadTimeDays`.
5. Print a summary: products read, archived, categorised.

The script is idempotent, so running it twice is harmless, and it makes no Stripe calls, because
none of these fields reach Stripe.

`getPublicProducts` tolerates a document written before the migration by defaulting a missing
`category` to `treats`, in the same spirit as `docToPost` tolerating every shape ever written. A
deploy that lands before the script runs therefore degrades to "everything is a treat" rather than
to an empty shop.

## 9. Pick and Mix after the change

Confirmed live on 2026-08-25: the builder renders and works at `/good-food#pick-and-mix`, three size
buttons above the footer. It is not broken, it is unfindable. Nothing links to it, there is no URL
of its own, and it is the last section of a page nobody reaches the bottom of. Moving it to a
category circle is the whole point of the change.

Three things need doing, and all three are done here.

**Its home.** The builder is mounted only on `/good-food`, which is being deleted. It moves to
`/shop/pick-and-mix`, which is also the fourth category circle. Deleting the pillar page without
this step would remove the feature.

**Its pool.** `bundlePool` currently filters on `fulfilment === "own-stock"`, `pillar ===
"good-food"` and no lead time. All three disappear. The replacement:

```ts
export function bundlePool<T extends { category: ProductCategory }>(products: T[]): T[] {
  return products.filter((p) => p.category === "treats");
}
```

Callers already pass a catalogue filtered to active, unarchived and members window respecting
products, so those conditions are not repeated. Boxes are excluded because a mystery box inside a
pick and mix is a box inside a box, and toys are excluded because the bundle is priced and sold as
treats. `BUNDLE_SIZES` and `BUNDLE_PERCENT` are unchanged.

**Its headless heading.** `PickAndMixBuilder` returns `null` when the pool is empty, but the "Pick
and Mix, let us surprise your dog" heading lives in the page around it, not in the component. An
empty pool therefore renders a heading with nothing underneath and no error anywhere. The heading
moves inside the component, so the section is one thing that either renders whole or not at all.
On the new `/shop/pick-and-mix` page, an empty pool renders a plain "back in stock soon" line
rather than a blank page.

## 10. Testing

`npm test` is Vitest and must be green at the end of Phase 1.

Rewritten:

- `pick-and-mix.test.ts`, for the new pool rule in section 9.
- `product-fields.test.ts`, dropping the supplier and lead time note cases.
- `product-admin.test.ts`, dropping supplier validation, adding the `wasPrice` cases.
- `shipping.test.ts`, dropping supplier postage, keeping every postcode and threshold case.
- `products-store.test.ts` and `products-store.fallback.test.ts`, for `category` and the missing
  category default.
- `stripe-sync.test.ts` and `subscriptions.test.ts`, wherever they construct a product literal.

Deleted: `pillars.test.ts`.

New: a test that the pre migration default in section 8 turns a document with no `category` into a
treat, because that is the behaviour protecting a deploy that lands before the script runs.

## 11. Recorded for later phases

Not designed here. Kept so the brainstorm is not lost.

### 11.1 Phase 2, the new site

Home is the logo, a short explainer, the four category circles and a Dogs of the Day section. It is
deliberately short: the long form argument that lives there today moves wholesale to About.

**About is the piece of writing this phase turns on.** It is not a company biography, it is the
journey the reader is taken on, and it has a shape:

1. Land them in it. What is actually going on in dog food, told plainly enough to be unsettling.
2. Build the case. The additives, the sugar, the cereal, in ascending order of how bad it reads.
3. Reach the climax. The point where the evidence stops being a list and becomes a realisation.
4. Turn it on the reader. This is where we were blown away, and by now so are you.
5. Land it. That is why we started this. The website is the answer to what you have just read.

The reader should arrive at step 4 already feeling it, so the line does not announce the emotion,
it names the one the reader is already having. Step 5 is the only place the shop is mentioned.

**Absolute constraint from Michaela: no other company is named anywhere on the site.** Not once, not
in passing, not in a caption. The current home page names Pedigree Jumbone, Pedigree Markies,
Pedigree Dentastix and Bakers, and quotes their declared percentages. Every one of those goes. The
ingredient facts stay, because they are true and they are the argument, attributed to "the popular
brands", "the big brands" and "supermarket treats". A fact that cannot survive losing its brand
name is cut rather than reworded into a recognisable hint.

Delivery and Contact are refreshed. Phase 2 also replaces the welcome email series per section 5.

### 11.2 Phase 3, the shelf

Four boxes: Large Treats for Large Dogs, Ears Box, Mega Mystery Box at GBP 15, Mystery Bargain Box
at GBP 7.50. The last two show a struck through higher price.

Four toys, supplied by Liam on 2026-08-25:

| Toy | Price |
| --- | --- |
| Rope Toy, medium to large | GBP 4.00 |
| Rope Toy, XS to small | GBP 2.00 |
| Glow in the dark treat dispenser ball | GBP 2.50 |
| Squeaky tennis ball | GBP 2.00 |

The two rope sizes are two products, because the variant model was ruled out in section 2.

Four for GBP 20, as a real basket rule that repeats every four items and sends an adjusted total to
Stripe.

**It applies only to the pre-packaged treat range**, meaning the products already on the shelf
today. Boxes are explicitly excluded, and so are toys. A Pick and Mix bundle is one basket line at
its own bundle price, so it neither counts towards a group of four nor receives the offer. Stated
here because "any four" is the obvious reading of the offer and it is the wrong one: a Mystery
Bargain Box at GBP 7.50 falling into a four for GBP 20 group would sell it at GBP 5.

Still owed by Michaela or Liam before Phase 3 can be specced: the contents and struck through price
for each of the four boxes, photographs for the four toys, and the three category circle images (a
packet shot, a box shot and a pick and mix shot).

### 11.3 Phase 4, the blog

A public blog at `/blog` with its own editor supporting images, headings and search metadata. The
members posts system in `posts.ts` and on `/members` is left exactly as it is.

## 12. Done means

1. `npm test` green and `npm run build` clean.
2. No occurrence of `pillar`, `fulfilment`, `supplierPostage`, `supplierArrival` or `leadTime` left
   in `src`, except where `fulfilment` means getting a parcel out of the door.
3. The nav reads Home, About, Shop, Delivery, Contact, Members.
4. `/shop` lists four category circles, and each of `/shop/treats`, `/shop/boxes`, `/shop/toys` and
   `/shop/pick-and-mix` renders.
5. Pick and Mix builds a bundle from `/shop/pick-and-mix`.
6. The four old pillar URLs 308 to their successors.
7. The migration script has been run against live Firestore and its summary recorded.
8. Buying one product end to end still works, at the right postage.
