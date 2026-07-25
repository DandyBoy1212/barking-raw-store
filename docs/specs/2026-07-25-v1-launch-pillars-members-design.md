# Barking Raw Store, V1 Launch: Pillars, Pages and Members Area, Design Spec

Date: 2026-07-25. Status: shape agreed in brainstorm with Liam. Supersedes the page list in the
working brainstorm document where the two conflict, and records the conflicts explicitly so
nobody builds to the older version by accident.

House style, matching the earlier specs: British spelling, no em dashes anywhere.

## 1. What this is

The store already exists: a long form landing page, nine products, Stripe Checkout, Firestore
order records, Google Sheet fulfilment and abandoned cart recovery, all live on `main`. A further
25 commits on `feat/accounts-loyalty-admin` move products into Firestore with real Stripe product
and price syncing, add magic link login for customers and staff, and give Michaela a staff admin
area for creating and editing products. None of that newer work has been exercised by a human yet.

This spec covers what turns that into a launchable shop that Michaela runs herself:

1. A positioning layer built on four pillars, expressed as a ring on the home page.
2. Four pillar pages plus a flat shop page, replacing the single long landing page as the
   navigation model.
3. Product data changes the pillars require: category, lead time, members only windows.
4. Email capture with segmentation.
5. A members area, which is content only and deliberately not a discussion forum.
6. The discount structure, so three overlapping discounts do not fight each other.
7. Go live requirements: Michaela owning Stripe, and the legal pages.

## 2. Positioning: the four pillars

The argument: a dog needs four things provided for it before a bond can grow and before training
will be lapped up. Most people start with training, which is the last bit rather than the first.

Hero copy:

> **Get these four right and your dog will lap up training.**
> Most people start with training. That's the last bit, not the first.

The four pillars, and the line that sits under each:

| Pillar | Line | Shelf behind it |
|---|---|---|
| Good Food | What goes in shows up in everything else | Chews, treats, tripe, sprats, broths, kibble. Gut, skin and coat, joints as filters |
| Comfy Walks | A dog that's choking on a collar isn't enjoying the walk. You're just dragging it | Fitted harnesses, long lines, leads, poo bags, scoop kit, water bottles |
| Fun & Games | A bored dog will find his own fun. You won't like it | Lickimats, snuffle mats, puzzle feeders, scentwork |
| Cosy Sleep | An overtired dog can't think straight | Beds, blankets, natural calming |

### 2.1 The naming rules, so future additions stay consistent

Three tests. A candidate earns a pillar only if it passes all three.

1. **It completes the sentence "I need to get ___ right."** The hero frames the pillars as four
   things a person provides. "Out and about" fails this test, which is why it was rejected. "Good
   food" passes.
2. **It is a state of the dog, not a benefit or an ingredient.** Skin and coat, joints, gut health
   and chewing are outcomes of a pillar. They become filters inside a pillar page, never pillars.
3. **It cannot be scored and passed by the owner.** Any pillar phrased as a quantity ("lots of
   exercise") invites the owner to tick it off and leave. Quality words ("good", "comfy") keep the
   question open, and Michaela is the one who defines what good means.

Rejected and why, recorded so it is not relitigated:

- Hydration: one or two SKUs, and nobody browses for hydration. Folds into Good Food.
- Chewing, gut health, skin and coat, joints and mobility: outcomes, not states. Filters inside
  Good Food. The existing product badges already cover most of them.
- Training and communication: splits across Fun & Games and the teaching layer.
- Touch and handling: a thing the owner does, not a state of the dog. It is Michaela's Tellington
  TTouch qualification, so it belongs in About Us and the teaching, where it earns trust rather
  than competing with four product shelves.
- Out and About, Good Walks, Lots of Exercise: all failed test 1 or test 3. See 2.1.

### 2.2 Where the challenging happens

The ad challenges. The tile confirms. The page teaches.

By the time somebody reaches the ring they have already been told, in the ad, that supermarket
treats are junk. So the tiles can be plain and unprovocative and still work. Never put the
challenge in the tile.

Reference ad copy, subject to the claim check in section 12.3:

> Do you buy your dog's treats from the supermarket?
> Most of them are sugar, cereal and "meat derivatives" with a picture of a steak on the bag.
> We're on a mission to get UK dogs better treats and better care.
> Click to learn what you should actually be feeding your dog, and why.

## 3. Site structure

| Page | Purpose |
|---|---|
| Home | The ring. Positioning first, navigation second |
| Good Food | Teaching, then the products that serve it. Treats and the pick and mix bundle builder live here |
| Comfy Walks | Teaching, then the products |
| Fun & Games | Teaching, then the products |
| Cosy Sleep | Teaching, then the products |
| Shop | Flat list of everything, obvious in the nav, for people who did not come to be taught |
| About Us | Origin story, the mission, and the TTouch and nutrition credentials |
| Members | Gated. See section 7 |
| Dogs of the Day | Public. See section 10.2 |
| Account | Existing. Profile, dogs, points balance |
| Contact | Required |
| Terms, Privacy, Delivery and Returns | Required. See section 12 |

The four pillar pages are the only pages that can be found on Google, because the members area is
gated and gated content earns nothing in search. So each pillar page carries real teaching, not
just a product grid. Public teaching does the finding. The members area does the depth.

### 3.1 No page per SKU

Decided: products do not get individual pages. They are listed on their pillar page and on the
flat shop page.

Recorded cost, so it is a known trade rather than an oversight: without a page per product, the
site cannot rank for buying intent searches like "rabbit ears for dogs", which is what somebody
types when they are ready to spend. If this is revisited, the cheap version is a plain
auto generated page per product built from the description Michaela already types into the admin.
No extra work for her, nothing new in the nav, but it exists for search engines to find.

### 3.2 The ring

- Desktop: one large circle split into four equal wedges, a photo per wedge with the pillar name
  over it, and the logo in a hub in the centre. The four lines from section 2 sit beneath the ring.
- Mobile: the ring collapses to a two by two grid of circular tiles. Same four photos, same names.
  A pie does not survive a phone screen and most traffic will be phones, so both layouts are built
  once rather than retrofitted.
- Wedge label wrapping: label lengths differ, since Good Food, Comfy Walks and Cosy Sleep are two
  words while Fun & Games is three. Set one wrapping behaviour for all four so the ring stays
  symmetrical, decided at build time against the real photos rather than guessed now.

Primary call to action on the home page: the pillar wedges. The email capture sits below the ring.
The shop is in the nav for anyone who arrived ready to buy.

### 3.3 Several photos per product

Requested by Liam on 2026-07-25, after using the admin for the first time. Not in v1 as
originally scoped, and recorded here rather than built immediately because it is larger than it
looks.

`Product.image` is a single string. It is read by the product card, the basket drawer, the admin
form, the admin list, the Stripe sync and the fulfilment sheet row. Supporting several means:

- an ordered list of images rather than one, with one of them marked primary;
- a gallery on the card or the pillar page, and a decision about whether the basket and the
  fulfilment sheet follow the primary image or the first;
- upload, reorder and delete in the admin, which is more UI than the current single file input;
- a migration for the products already in Firestore, which carry the single field.

The primary image stays the one Stripe receives, because a Stripe product takes one image and
that is what shows on the payment page.

Worth doing with B.1, since that is when the catalogue gets its proper presentation, rather than
as a separate pass over the same files.

### 3.4 Michaela adds her own badges

Requested by Liam on 2026-07-25. Today the eight badges are a TypeScript union in
`src/data/products.ts`, compiled into the app, and `validateProductInput` rejects anything
outside that list. So a new badge is a code change and a deploy, which is exactly the kind of
thing she should not have to ask for.

The change is to move badges into Firestore as their own small collection, with an admin screen
to add, rename and retire one, and to relax validation from a fixed union to "exists in the
badge collection". Retire rather than delete, so a badge coming off the list does not silently
vanish from the products already carrying it.

Note the overlap with section 8.2: the allergy and sensitivity ribbons in step B.3 are also badge
shaped but are derived from dog profiles rather than set by hand. These stay separate. One is
Michaela describing the product, the other is the site reacting to the dog looking at it.

## 4. Product data changes

Products currently carry `slug, name, price, hook, description, badges, image, safetyNote`, plus
the storage and Stripe sync fields. Three additions are needed.

### 4.1 Category

There is no category field anywhere in the codebase today. Without one the ring has nothing to
navigate to.

- Every product belongs to exactly one pillar.
- The admin product form gets a required category picker. Without it Michaela can save a product
  that belongs to no page and silently never appears anywhere, which is the worst possible failure
  because it looks like the site is working.
- Existing badges stay and become the within pillar filters. `Gentle on Dodgy Tummies`,
  `Best for Skin & Coat` and `Natural Joint Support` already map onto the Good Food sub shelves.

### 4.2 Lead time

Michaela can sell 1kg bags of high protein kibble but cannot afford to hold stock of the larger
bags, so they carry a longer lead time than the chews.

- A product carries a lead time in days, defaulting to zero.
- Any non zero lead time is shown on the product and again in the basket, so a mixed basket does
  not quietly become a three week wait for somebody who also ordered chews.
- Where the whole basket is affected, the checkout states the dispatch expectation before payment.

### 4.3 Members only window

Early access is the members area's strongest perk and it costs nothing.

- A product can carry a "members only until" date.
- Before that date it appears in the members area and is buyable by members. It does not appear on
  the pillar page, the shop page, or in search.
- After that date it behaves as any other product, with no manual step.

### 4.4 Two fulfilment paths, and how postage is presented

Some products post from Michaela's own stock. Others come from a supplier and post direct from
them. The current shipping rule (free to DD1 to DD6, otherwise GBP 3.95, free over GBP 35) assumes
one parcel from one place and will not survive the second path.

- A product carries a fulfilment path: her own stock, or supplier posted.
- Her own stock keeps the existing rule and continues to land in the Google Sheet.
- Supplier posted items carry their own postage and their own dispatch time, taken from the
  supplier rather than the site's rule.
- A basket containing both is two parcels, two arrival dates, and potentially two postage charges.
  The basket and the checkout both show this before payment, itemised, so nobody discovers it after
  paying.

**Customer facing language.** The word dropship, and the mechanism behind it, never appears in
anything a customer reads. What the customer is told is the part that affects them: that the item
posts separately, when it will arrive, and what its postage costs. Wording along the lines of
"Posts separately, arrives in 3 to 5 days" on the product, and a separate itemised delivery line in
the basket. That is full disclosure of everything material to the buyer without narrating the
supply chain.

Internally the field is named for what it is, so nobody maintaining the code is guessing.

Returns need a route per path, since a supplier posted item does not come back to Michaela's house.
Researched on 2026-07-25 against Avasam's own documentation. See section 4.5.

### 4.5 Avasam: how it connects, what it exposes, and how returns actually work

Researched 2026-07-25 from Avasam's knowledge base and pricing pages. This resolves most of open
assumption 5, and it is good news: the shape designed in 4.4 survives contact with the real thing.

**What Avasam gives us for free, that 4.4 needed.** Suppliers must pick one of three standardised
shipping services, and each carries a stated window: expedited tracked 1 to 2 days, standard tracked
2 to 4 days, standard 3 to 5 days. That maps directly onto the arrival range the product carries, and
the example wording in 4.4, "arrives in 3 to 5 days", turns out to be Avasam's standard service word
for word. Each product's shipping cost is shown on its listing page in Avasam, so the postage figure
is real data Michaela can copy in rather than a guess.

**One thing 4.4 got slightly wrong.** Supplier shipping is not always a fixed amount per item. A
supplier can price a service as a fixed amount, or by order weight, or by order value, and can
combine fixed with one of the other two. A single postage number per product is therefore correct
for fixed price services and an approximation for the others. For v1 the site holds a fixed figure
per product, entered by Michaela from the Avasam listing, and she picks a figure that does not
under-recover. If the range she ends up stocking is weight priced, this needs revisiting before it
quietly eats margin on heavy items.

**Connecting.** Avasam's channel integrations are TikTok Shop, Shopify, eBay, ShopWired,
BigCommerce, Amazon, WooCommerce, EKM, OnBuy, Wix, Linnworks and Wish. A bespoke Next.js site is not
on that list, so there is no plug and play route. Two real options:

1. **Manual order entry, and this is the v1 choice.** Avasam supports creating an order by hand:
   Orders, Add order, enter the recipient's details and the items. It also supports importing orders
   from a file. No build, no API keys, nothing to break, and it works from day one. The cost is
   Michaela's time and the risk of mistyping an address, which is real but small at launch volumes.
2. **The Seller API, once volume justifies it.** Base URL `https://app.avasam.com/api/` with a
   second path at `/apiseeker/`. A consumer key and secret are generated in Settings, User
   management, API keys, and exchanged at a request token endpoint for an `access_token` with an
   `expires_at` to refresh against. The endpoints that matter are `SellerStockList` and
   `GetInventoryListWithFilter` for stock, `CreateSellerOrder` or `AddNewOrder` to place an order,
   and `GetProcessOrderList` for status and tracking. There are no returns endpoints, though order
   statuses include `RETURN_REQUEST` and `RETURN`. Nothing built for the manual route is wasted,
   because the product fields and the two parcel model are identical either way.

Linnworks as middleware is a third option and is rejected: it is a second subscription to solve a
problem the manual route already solves at this volume.

**Money.** Michaela pays Avasam per order, automatically, on a stored card, and an order is not
dispatched until it is paid. That is a separate rail from the Stripe money coming in, so a supplier
posted sale means money out on her card before the Stripe payout lands. Cashflow, not code, but she
should know it before the first order.

**Returns, and the gap that matters.** Avasam's returns process governs Michaela and the supplier.
It does not govern what Michaela owes her customer, and the two run on different clocks.

Michaela to supplier, per Avasam:

- She has 30 days from the date of shipping to request a return.
- The supplier has 48 hours, or 2 working days, to inspect and accept or reject it.
- A refund takes up to 5 working days and lands in her Avasam account balance, not her bank.
- Change of mind: the customer, or Michaela, pays the return postage. Faulty, wrong or not received:
  the supplier covers reasonable return postage, sometimes as a downloadable label.
- The return must go back on a tracked service. If tracking does not show delivery within 30 days
  she is liable for the value of the item.
- Some categories are excluded on sanitary grounds.
- Avasam will mediate if a supplier will not play.

Customer to Michaela, per UK law, and this is the part the returns policy page must state:

- **Barking Raw is the trader.** The customer's rights are against Michaela, not against Avasam and
  not against the supplier. She cannot point a customer at a supplier's policy.
- The Consumer Contracts Regulations 2013 give 14 days from delivery to cancel, 14 further days to
  send the goods back, and require her to refund within 14 days of receiving them or of proof of
  return. The refund includes the original basic delivery cost.
- **Her clock is shorter than her supply chain's.** Supplier inspection plus refund processing can
  run past the point where she legally owes her customer the money, and when it does arrive it
  arrives as Avasam balance rather than cash. She will sometimes refund out of her own pocket first.
  Budget for it rather than discover it.
- **The return address differs per item**, because supplier posted goods go back to the supplier and
  her own stock comes back to her. So the returns page says "contact us and we will send you the
  return address" rather than printing one address, which would misroute half the returns.

## 5. Email capture and segmentation

Two forms, two offers, one list.

| Placement | Offer | Grants membership |
|---|---|---|
| Home page, under the ring | Free hints and tips from each pillar | No |
| Shop page | 10% off your first order | No |
| Stall iPad, with QR as fallback | 10% off now, and 10% off the first online order | Yes, see section 10.1 |

- Every contact carries the source it came from, so the follow up differs. Learn more subscribers
  go straight into the pillar sequence. Ten percent subscribers get "your code is waiting" first,
  then the pillar sequence.
- Deduplicate on email address so nobody claims 10% twice by using both forms.
- Members are added to the email list automatically and carry a member flag, giving three
  segments worth mailing differently: subscribers who have never bought, members who joined at the
  stall but have not ordered, and members who have ordered.
- Marketing email requires an unticked consent box at the point of capture. Transactional email
  (order confirmations, dispatch notices) does not.

### 5.1 The welcome sequence

Four emails, one per pillar, delivered over the first fortnight. Each one teaches the pillar and
links to the pillar page.

This is an extension of machinery that already works rather than a new system. The abandoned cart
recovery already sends a timed two email sequence through Resend on a Vercel cron. The welcome
sequence uses the same pattern.

## 6. Discounts

Three discounts exist in the plan and they must each buy something different, or the customer
cannot be valued and the margin cannot be tracked.

| Discount | What it buys | When it applies |
|---|---|---|
| 10% for joining | The email address and the first sale | One time. At the stall, and again on the first online order |
| Loyalty points | Repeat orders, earned rather than given | Every order |
| Subscribe and save, 10% | Predictable recurring revenue | Only while a recurring order is active |

The permanent 10% is reserved for subscribe and save, because that is the only one where the
customer gives something back for it. A permanent discount granted for an email address taxes the
best customers forever.

### 6.1 The discount has to be priced in, not given away

Current prices are Michaela's bottom price, the least she is willing to take. The 10% is then taken
off that, so every discount comes straight out of her profit. A discount funded that way is not a
marketing tool, it is a loss she has agreed to in advance.

The fix is to set the list price so that the discounted price is the price she actually wanted. Then
the 10% costs nothing and can be used freely, at the stall, in ads, and in the welcome email.

**The arithmetic matters, and the obvious version is wrong.** Adding 10% and then taking 10% off does
not return you to where you started, because the two percentages are of different numbers.

- Bottom price GBP 10.00. Add 10% gives GBP 11.00. Take 10% off gives GBP 9.90. Ten pence short on
  every single sale.
- Bottom price GBP 10.00, divided by 0.9, gives a list price of GBP 11.11. Take 10% off gives exactly
  GBP 10.00.

So the rule is **divide the bottom price by 0.9**, which is roughly 11% on rather than 10%. Applied
across a full basket and a year of orders, the difference between the two methods is not trivial.

Two things to check before repricing, because this is a real price rise on the shelf:

- Compare the new list prices against Pets at Home, Fife Animal Feeds and Paws HQ. Funding the
  discount is worthless if it prices her out of the comparison a customer actually makes.
- Anyone already buying at the current price sees an increase. Existing customers should be
  grandfathered or told, not silently repriced.

The same logic applies to subscribe and save. If the ongoing 10% is not priced in, every recurring
customer, which is to say the best customers, is the least profitable.

## 7. The members area

A members area is content, one way. It is not a discussion forum, and the distinction is the whole
reason it can ship in v1.

A broadcast page with three posts on it reads as intentional. A forum with three posts reads as
abandoned, and an abandoned forum actively damages the brand because it says nobody shops here.
Conversation needs concurrency. Content does not.

It is also what keeps the stall pitch honest. Standing in front of somebody saying "we just
launched, get involved, we're building a community" and then showing them a points balance is a
broken promise, and worse than never making it.

### 7.1 What is on the page

- This week's pillar post at the top.
- A dogs of the day strip.
- Early access: products inside their members only window, buyable here first.
- Courses as they land. Nutrition first, then TTouch, in step with Michaela's qualifications.
- Their points balance, and what it is worth in pounds.

### 7.2 How Michaela posts

Through the staff admin she already has. A posts section alongside products, using the same
pattern, the same staff claim and the same image upload. Title, body, photo, publish. Nothing new
for her to learn.

### 7.3 Emails from the members area

- **One weekly digest.** The week's post and a dog photo, batched. Same cron and Resend pattern as
  the abandoned cart engine.
- **Instant email only when it is about them.** Order dispatched, or a members only drop they can
  buy before anyone else.

Explicitly rejected: an email per post. It is the fastest way to lose a list, and losing the
marketing list tends to take the transactional relationship with it, because most people do not
unsubscribe selectively.

### 7.4 Launch content

So it is not empty on day one:

- Eight to ten pillar posts banked before launch, giving roughly two months of buffer. Same
  content as the social posts, so it is not extra work, just work done earlier.
- Early access on whatever new stock has landed. This is the strongest thing to say at the stall,
  better than a discount, and it does not touch margin.

### 7.5 Not in v1

Threads, replies, comments, moderation, notifications, leaderboards, and the walk the dog mini
game. These are the conversation build. They need volume, and the sensible trigger is somewhere
north of a hundred buyers, at which point a new member arrives and finds activity instead of
tumbleweed. Nothing is lost by waiting: every customer between now and then already has an account
and is already on the email list, so the day it switches on the room is full.

## 8. Member records

### 8.1 Fields

A complete member record holds name, address, contact number, email, and one or more dogs.

Collected in full at the stall, in one conversation, on an iPad that Michaela holds.

This supersedes an earlier progressive collection decision in this document's own drafting. That
decision assumed the customer typing into their own phone, where a long form loses people. With
Michaela holding the iPad the friction is not typing, it is conversation, and conversation about
somebody's dog is not friction. It is the reason they stopped at the stall.

The same conversation is the qualification. How old is he, how is he on the lead, does he get an
upset tummy. Those answers tell Michaela what to hand them off the table, so the form earns its
keep twice.

Online sign ups still fill progressively, since Stripe Checkout collects name and shipping address
at the point of purchase anyway.

### 8.2 Dog fields

Each field earns its place by driving something, so the profile is useful rather than long for the
sake of it. Completion rate is not the main constraint, because most profiles are filled in by
conversation at the stall rather than typed in alone. The test is whether Michaela will act on the
answer.

| Field | What it powers |
|---|---|
| Name | The "Loki's Mum" naming convention, and email personalisation |
| Breed | Recommendations, and Michaela's own picture of her market |
| Age | Puppy, adult and senior filtering |
| Size or weight | Chew size and portion advice, which reduces wrong size returns |
| Allergies and sensitivities | The badge ribbons over product cards |
| Activity level | Portioning, and the Comfy Walks recommendations |

Final say on this list is Michaela's, since she is the one who will act on it.

### 8.3 One account, many dogs

The data model supports multiple dogs per account from the start. A meaningful share of her
customers have two or three, and retrofitting it later means rewriting the account page, the badge
filtering and the email personalisation together.

## 9. Loyalty

Points are money off and they **do not expire**. Redemption is a flat 100 points to GBP 1, and the
earn rate is per product so promotions are possible.

This supersedes `docs/specs/2026-07-17-accounts-loyalty-admin-design.md`, which specified a 30 day
per batch expiry. Decision reversed by Liam on 2026-07-25. Any expiry logic already planned against
that spec, including the oldest batch first spend order and the pre expiry reminder email, comes out.

Two consequences of removing expiry, recorded so they are handled rather than met later:

- **The reminder email loses its hook.** "Your points are worth GBP 3 and they go on Friday" was the
  reason that email got opened. Without a deadline the replacement is a plain balance nudge, which
  works far less hard. Worth pairing it with something else, for example new stock landing, rather
  than sending it on its own.
- **Unredeemed points accumulate indefinitely.** Every point issued is money off owed at some future
  date, with no point at which it lapses. Two things keep that from becoming a surprise: report the
  outstanding balance somewhere Michaela can see it, and consider a cap on how much of a single
  order can be paid with points, so a long dormant balance cannot be cashed in all at once against
  one order. Neither is required for launch, but the reporting is cheap and worth having from day
  one.

Watch out for two points systems. If a Skool style leaderboard is ever added, it must not be
called points and must never appear on the same screen as loyalty points, or customers will try to
spend one on the other.

## 10. The stall

The market stall is the primary acquisition channel, not a growth extra. It is the one advantage
no online competitor can match: standing in front of somebody with their dog present.

Ad budget is roughly GBP 300 to 400. That should be spent geo targeted on the stall catchment
rather than nationally, where it evaporates. Locally it compounds with the physical presence.

### 10.1 In person sales create no account, and this must be fixed

Membership is currently granted by the Stripe webhook when an online order completes. A cash or
card sale at a market stall never touches the website, so the people most likely to say yes are
the only ones the system cannot let in.

An iPad on the table fixes it, and does four jobs at once: the yes is captured while they are
still standing there, the 10% is applied, the account is created, and the dog profile is filled in
by conversation rather than by form filling.

A QR code stays as the self serve fallback, on the stall banner and for anyone who does not want to
stop and chat. Both routes write the same record.

Membership is granted by an online purchase, or by signing up at the stall. It is not granted by
the home page email form. This keeps "members see the new stuff first" true, and gives Michaela
something to say at the table that cannot be got from the website.

### 10.1.1 iPad form requirements

- **Built for her hand, not theirs.** One question per screen, large touch targets, every field
  skippable so a chatty customer does not strand her on a required box, and partial records saved
  rather than lost.
- **Works with no signal.** This is the requirement most likely to sink it in practice. Market
  stalls have poor connectivity, and a failed submit does not lose a field, it loses a customer who
  has already said yes and is standing in front of her. The form writes locally first and syncs
  when signal returns. No spinner, no lost record. Same pattern and same reasoning as the resilient
  intake safety net on the Scoop Patrol side.
- **Photo of the dog on the last screen.** Dogs of the day content captured at the moment of
  maximum goodwill, with the owner watching, at no extra effort. It also turns a form into a
  moment.
- **Consent stays theirs.** Michaela cannot tick the marketing box on somebody's behalf, and photo
  permission must be given rather than assumed. One screen carries both, the customer taps it, and
  they see it happen.
- Staff gated, behind the existing staff claim. Michaela is vouching for the person in front of
  her, so no email verification round trip is needed at the table. The welcome email with a magic
  link goes out afterwards.
- **A staff PIN for stall days, not a magic link.** The iPad is borrowed and used on Sundays only.
  Magic link login would mean opening her email inbox on somebody else's device every market day.
  A short staff PIN with an explicit end of day logout is the workable version.
- **Nothing left on the device.** The offline queue clears once it has synced, and logging out
  wipes the local store, because the iPad goes back to its owner. Customer names, addresses and
  phone numbers cannot be sitting in a browser on a device Michaela does not own.
- Built as a web page with nothing to install, since it has to work on a device she does not
  control.

### 10.1.2 Recording stall sales

In scope for v1. Stall sales must land in the system, or stock levels, revenue and loyalty points
are all wrong from day one, and the customers Michaela converted face to face end up the worst
served by the loyalty scheme.

The approach deliberately avoids coupling the data to a payment rail:

- A stall sale form in the staff admin. Michaela picks the member, picks the products and
  quantities, marks it cash or card, saves.
- That decrements stock, awards loyalty points at the normal per product rate, and writes an order
  record so the customer has history and can see it in their account.
- The payment method is recorded but the money is not taken by the site. She takes it however she
  likes, cash, her own card machine, or anything else.
- Same offline requirement as the signup form, for the same reason.

Rationale: the iPad is borrowed and Sunday only, so tying her takings to it is not viable. This
version works with cash, which she will definitely take, and with any card provider she chooses.

On card providers: SumUp and similar advertise free card payments, which means no monthly
subscription rather than no cost. They take a percentage per transaction, as Stripe does in person.
The fee is the small question. The larger one is that a SumUp sale lands in SumUp, so the site never
sees it and two systems need reconciling forever. The stall sale form makes that irrelevant, because
the record is created regardless of which rail took the money. If integrated card payment is ever
wanted, Stripe's in person option is the upgrade path and nothing built here is wasted.

### 10.2 Dogs of the day

Photos of dogs met at the stall, posted publicly to social and to a public page on the site, and
collected in the members area.

It works because it is content that does not require Michaela to be creative every week, and it
has reciprocity built in: the owner gets a nice photo of their dog, so they share it, and their
friends see it. Free reach from people who have already met her.

Public, deliberately. The photos are the shareable proof and locking them behind the gate wastes
the only part that travels. Photos out, discussion in.

Needs: a photo permission line at the stall, and one folder on Michaela's phone.

### 10.3 Skool, parked

An education led free community on Skool was considered and parked. The model assumes volume
pushed into a free offer and monetised at a slice, and GBP 350 nationally will not produce that
volume, so it would mean paying a subscription to maintain a second empty room. Right idea, wrong
time. If the email list reaches a few thousand it becomes viable, and everything written for the
pillar pages and the members area transfers.

## 11. Stripe and going live

Michaela owns the Stripe account, and Liam neither has nor should have the key.

- The key lives in one environment variable on the hosting. It is never in the app, never in the
  admin panel, and no staff member ever pastes an API key into a form. The brainstorm document
  says Michaela "needs her own Stripe API key connected" through the admin, which is a
  misunderstanding worth correcting in that document, because building to it would produce a form
  that asks a user for a secret.
- Michaela enters it herself, either with her own login to the hosting project, or by taking the
  keyboard for thirty seconds on a screen share. She does the same for the webhook signing secret.
- She should create a **restricted key** rather than the full secret key, scoped to only the
  permissions the site needs. Same five minutes, far smaller blast radius.
- Stripe Connect and OAuth are the wrong tool here. Connect is for marketplaces taking a cut of
  other people's sales. This is her shop and she is the only merchant.

Exact click by click instructions for Michaela get written once the hosting question in section 14
is answered, since the steps differ between Vercel and a VPS.

## 12. Legal and compliance

Not mentioned anywhere in the brainstorm document, and a hard launch blocker.

### 12.1 Required pages

Terms and conditions, privacy notice, delivery information, returns and cancellations, and a
contact page with a real business address and contact route. Stripe expects a visible refund
policy and business contact before it will let her trade properly, and UK consumer law requires
the pre contract information regardless.

### 12.2 Data protection

Collecting name, address, phone and pet data is what moves the privacy notice from good practice
to legally required. Marketing email needs an unticked consent box at the point of capture and a
working unsubscribe in every marketing send.

### 12.3 Advertising claims

"Mostly sugar" is a factual claim in a paid advert. The ASA can require it to be withdrawn and
Meta can reject it outright. `docs/research-dossier.md` already exists for exactly this purpose,
having source checked every claim on the current landing page. Every claim in the ad copy and on
the four pillar pages is checked against it, and anything unsupported is either sourced or
softened before it runs.

## 13. Out of scope for v1

With the reason, so each is a decision rather than an omission.

| Item | Why it waits |
|---|---|
| Discussion forum, threads, replies, moderation | Needs concurrency. See 7.5 |
| Walk the dog mini game | Solved by a leaderboard if the community ever ships. Not a launch feature |
| Skool community | See 10.3 |
| Page per SKU | See 3.1 |
| Blog as a separate page with an automated pipeline | The four pillar pages carry the teaching and do the search work. A separate blog duplicates it |
| Weight based postage tiers | Only if order data shows heavy baskets |
| Michaela's in app orders page | The Firestore records and the fulfilment sheet already exist |

## 14. Open assumptions

Written in as assumptions so the document is not held up. Each one will change something.

1. **The stock list.** Michaela has ordered well beyond the original nine and it has landed, but
   the list has not been produced, and the Avasam dropship list is still outstanding from Mikki.
   Assumption: Good Food has a full shelf at launch and the other three pillars open teaching
   first, with whatever few products exist and a "tell us what you need" capture. If the new stock
   includes lickimats, snuffle mats, beds or calming products, all four pillars are shoppable on
   day one and this assumption falls away.
2. ~~**Hosting.**~~ Resolved 2026-07-25: Vercel, with a domain already owned. Michaela's Stripe
   instructions are written against Vercel's environment variables screen.
3. **Michaela's weekly commitment.** Assumed one pillar post per week, with eight to ten banked
   before launch. If she cannot sustain weekly, the members area goes stale, and a stale members
   area is worse than none because everybody who joined can see it died. This is the only part of
   the build whose success depends on somebody doing something every week indefinitely.
4. ~~**Whether the stall iPad also takes the payment.**~~ Resolved 2026-07-25: it does not. Stall
   sales are recorded through a form in the staff admin instead, so the data is right regardless of
   which payment rail took the money. See section 10.1.2.
5. **Avasam and the supplier posted range.** Mostly resolved 2026-07-25 by research into Avasam
   itself, recorded in section 4.5: how a bespoke site connects (manual order entry for v1, the
   Seller API later), what dispatch windows and postage figures are available per product, and how
   returns work on both sides. What is still outstanding is Michaela's, not Avasam's: **which
   products she is actually sourcing, and at what margin**. The Avasam dropship list is still to
   come from Mikki. Nothing in the build waits on it, because the fields are the same whatever the
   list contains, but the pillar pages cannot be populated beyond Good Food until it arrives.

## 15. Build order

Rewritten 2026-07-25. The first version of this section summarised the conversation rather than
checking itself against this document and against the original brainstorm document, so it missed
work that this spec's own body requires. Every item below is either given a step or recorded as cut
with a reason in section 16. Nothing is left implied.

Proving what exists comes before building what does not.

### Phase 0: prove what exists

| # | Step | Notes |
|---|---|---|
| 0.1 | Get the newer work safe on GitHub | Done, `feat/accounts-loyalty-admin` pushed 2026-07-25 |
| 0.2 | Test accounts and the staff product flow end to end in Stripe test mode, as Michaela would use it, and fix what breaks | Nothing in the 25 commits has been exercised by a human. Needs Liam at a keyboard, not a build |
| 0.3 | Michaela's real Stripe keys in, and one live pound taken through the whole path | Needs Michaela. See section 11 |

### Phase A: data foundations

Both of these are cheap now and expensive later, which is the only reason they come first.

| # | Step | Why here |
|---|---|---|
| A.1 | Product data: pillar, lead time, members only window, fulfilment path, and the admin pickers for each | Nothing in Phase B can be built without `pillar`. Planned in `docs/plans/2026-07-25-stage-7-product-data-pillars.md` |
| A.2 | The customer and dog data model: one account, many dogs, and the fields in section 8.2 | Section 8.3 is explicit that retrofitting this means rewriting the account page, the badge filtering and the email personalisation together. It also blocks the stall form in Phase D, which collects the whole record at the table |

### Phase B: the public site

Everything a stranger can reach, and everything Google can index.

| # | Step | Notes |
|---|---|---|
| B.1 | The ring, the four pillar pages, and the flat shop page | Section 3.2. Desktop wedges and the mobile two by two are built once, together |
| B.2 | About Us | Section 3. Carries the origin story, the mission, and the TTouch and nutrition credentials. Section 2.1 makes this page load bearing: it is where touch and handling lives, having been deliberately kept out of the ring |
| B.3 | Dog profile driven merchandising: allergy and sensitivity badges surfaced as ribbons over product cards, and the "Loki's Mum" naming convention | Section 8.2 says the dog fields power this. Without it the fields are collected and never used, which is the worst of both worlds. Depends on A.2 |
| B.4 | Legal pages: terms, privacy, delivery, returns and cancellations, plus contact with a real business address | Section 12. She cannot trade without them, and the returns content is now researched in section 4.5 |
| B.5 | Several photos per product, with a primary image and a gallery | Section 3.3. Added 2026-07-25. Build it with B.1 rather than after: both rewrite the product card, and doing them separately means touching the same shared files twice. Needs a migration for the single `image` field |
| B.6 | Badges Michaela can add herself, moved from a compiled union into Firestore | Section 3.4. Added 2026-07-25. Independent of everything else in this phase, so it can slot in wherever there is room. Retire rather than delete, or badges disappear from products still carrying them |

### Phase C: capture and retention

| # | Step | Notes |
|---|---|---|
| C.1 | Email capture on the home page and the shop page, with source tagging, deduplication and the unticked consent box | Section 5 |
| C.2 | The four email welcome sequence, one per pillar | Section 5.1. Extends the existing abandoned cart cron and Resend setup |
| C.3 | The members area, and the posts section in the staff admin | Section 7. Depends on A.1 for the members only window |
| C.4 | The weekly digest email | Section 7.3. Same cron and Resend pattern |
| C.5 | Loyalty: outstanding points balance reporting for Michaela | Section 9 calls this cheap and worth having from day one, now that points never expire and accumulate as money owed |

### Phase D: the stall

The primary acquisition channel, and the phase with the hardest technical requirement in the
document.

| # | Step | Notes |
|---|---|---|
| D.1 | The stall signup form: one question per screen, every field skippable, dog photo on the last screen, consent screen the customer taps themselves | Section 10.1.1. Depends on A.2 |
| D.2 | Offline first: writes locally, syncs when signal returns, queue clears after sync, logout wipes the local store | Section 10.1.1 names this as the requirement most likely to sink the whole thing in practice. It is its own step because it is the hard part, not a detail of D.1 |
| D.3 | Staff PIN login for stall days, with an explicit end of day logout | Section 10.1.1. The iPad is borrowed and Sunday only, so magic link is unworkable at the table |
| D.4 | The QR code self serve fallback route, writing the same record as D.1 | Section 10.1 |
| D.5 | The stall sale recording form in the staff admin: pick member, pick products and quantities, mark cash or card, save. Decrements stock, awards points, writes an order record | Section 10.1.2 puts this in scope for v1 explicitly. Same offline requirement as D.1 |
| D.6 | Dogs of the day: the public page, and the strip in the members area | Section 10.2 |

### Phase E: commerce features

Both come from the original brainstorm document. Both were unbuilt and uncalled until 2026-07-25,
when Liam confirmed both are in.

| # | Step | Notes |
|---|---|---|
| E.1 | Subscribe and save: recurring orders at 10% off | **In**, confirmed 2026-07-25. Section 6 reserves the permanent 10% for this, and section 6.1 warns that if the ongoing 10% is not priced in, the best customers are the least profitable. Stripe recurring, and it depends on A.1 for pricing |
| E.2 | Pick and mix bundles, 5, 10 and 20 item, randomised selection, on the Good Food page | **In, and last**, confirmed 2026-07-25. The most distinctive product idea in the original document. Built after the site and the stall are done, so it never competes with them for attention |

### What each phase depends on

- Phase 0 is Liam's time at a keyboard rather than build time, so it runs alongside Phase A rather
  than blocking it. It should still finish early, because everything sits on machinery nobody has
  proven and a fault found now is cheaper than a fault found under four phases of new work.
- A.1 blocks B.1, B.3, C.3 and E.1. A.2 blocks B.3, D.1 and D.5.
- B.5 should be built with B.1, not after it. Both rewrite the product card, and splitting them
  means editing the same shared files twice for one outcome. B.6 depends on nothing and can slot
  in anywhere.
- B.4 blocks trading at all, so it cannot be the last thing done.
- E.2 depends on A.1 and on the Good Food page from B.1, and nothing depends on it.

Everything from Phase A is new build, and each step gets its own plan. Trying to plan a phase as one
document produces something nobody can follow.

### 15.1 Parallel execution: the waves

Agreed 2026-07-25. The work runs in git worktrees, one branch per track, several sessions at once.
The limit on parallelism is not the number of sessions, it is shared files and Liam's review time.
Step A.1 touches nearly every shared file in the codebase, so it lands alone before anything fans
out. Three to four concurrent tracks is the ceiling, because past that the reviewer becomes the
bottleneck and the parallelism stops paying.

**Wave 1**

| Track | Work | Why it is safe to run alongside the others |
|---|---|---|
| 1 | A.1 product data | Alone in the shared files. Everything else waits on it |
| 2 | B.2 About Us, B.4 legal and contact | All new files, touches nothing A.1 touches |
| 3 | 0.2, Liam testing accounts and the staff product flow | Not a build |

**Wave 2**, once A.1 merges

| Track | Work |
|---|---|
| 1 | A.2 the dog and customer data model |
| 2 | B.1 the ring, the four pillar pages, the flat shop page |
| 3 | C.1 and C.2 email capture, segmentation and the welcome sequence |
| 4 | D.1, D.2 and D.3 the stall signup form, offline sync and the staff PIN, pulled forward from Wave 3 because the stall is a launch priority and it only depends on A.2 |

E.1 subscribe and save joins Wave 2 if a track frees up, otherwise Wave 3.

**Wave 3**

| Track | Work |
|---|---|
| 1 | C.3, C.4 and C.5 members area, posts admin, weekly digest, points reporting |
| 2 | D.4, D.5 and D.6 QR fallback, stall sale recorder, dogs of the day |
| 3 | B.3 badge ribbons driven by the dog profile |

**Wave 4**

E.2 pick and mix, last by decision.

## 16. Register: the original brainstorm document, item by item

The brainstorm document Liam uploaded on 2026-07-25 is not in this repository, so this section
records what it asked for and what happened to each item. Written 2026-07-25 after an audit found
that several items had been dropped in conversation without ever being recorded as decisions.

| Item in the original document | Outcome |
|---|---|
| Staff login creating and updating products | Built, unproven. Step 0.2 |
| "Michaela needs her own Stripe API key connected" through the admin | **Corrected.** Section 11. Building to it would produce a form asking a user for a secret |
| Customer login and loyalty | Built in part. Section 9 |
| No expiry spend tracking | **Adopted.** Section 9, reversing the earlier 30 day expiry |
| "Spend X get a free item" | **Cut.** Superseded by points as money off at 100 points to GBP 1, which is easier to run and easier to explain. Recorded here because it was never explicitly rejected in conversation |
| Deep dive on Avasam: pricing model, product range, margins | **Partly done.** Section 4.5 covers how it connects, dispatch windows, postage and returns. Product range and margins wait on Michaela and Mikki |
| Competitors to study: Fife Animal Feeds, Pets at Home, Paws HQ | **Outstanding.** Survives only as a price comparison instruction inside section 6.1. The research itself has not been run, and it gates the repricing decision |
| Open source or no code tooling scan, marked mandatory | **Done 2026-07-25.** See section 16.1 |
| Home page leading with philosophy, circular photo tiles | Adopted and expanded. Sections 2 and 3.2 |
| About Us: origin story and mission | Adopted. Step B.2 |
| Treats page broken down by protein type | **Folded into Good Food.** Protein type is not currently a filter anywhere. If it should be, it belongs with the badge filters in section 4.1 and needs adding there |
| Pick and mix, 5, 10 and 20 item randomised bundles | **In, and last.** Step E.2, confirmed 2026-07-25 |
| Animation of items popping into the bag | **Cut.** A polish item on a feature that is not yet decided |
| Product photos from the WhatsApp thread | Operational, not a build item |
| Customer account: profile picture of the human | **Cut.** The dog is the identity in this brand, per the "Loki's Mum" convention |
| Dog profile, fields to be Michaela's call | Adopted. Section 8.2, step A.2 |
| Dietary requirements pushed forward as badges and ribbons over cards | Adopted. Step B.3. This was the point of collecting the data and it had no step until now |
| "Loki's Mum" naming convention | Adopted. Step B.3 |
| Mini game, walk the dog | **Cut.** Section 13 |
| Community page, read only until purchase, Reddit style threads | **Replaced** by the members area, section 7. Threads are section 7.5, not v1 |
| Account created automatically on first purchase | Built. Section 10.1 notes the hole this leaves at the stall, fixed by D.1 |
| Blog as a separate page with an automated content pipeline | **Cut.** Section 13. The four pillar pages carry the teaching and do the search work |
| Avasam product list from Mikki | Outstanding. Section 14.5 |
| Additional SKUs beyond the original nine | Outstanding. Section 14.1 |
| Subscribe and save, 10% | **In.** Step E.1, confirmed 2026-07-25 |
| Market stall days with standalone dog games at the stall | **Cut** as a software item. It is a stall activity, not a build |
| Market days linked to the website through dog photos | Adopted. Section 10.2, step D.6 |

### 16.1 The tooling scan, and the answer

The original document asked, and marked mandatory, whether existing open source or no code tooling
already covers the loyalty system, the community, or the pick and mix builder, before committing
development time. Scanned 2026-07-25. The answer is to finish the bespoke build, and the reasoning
matters more than the conclusion.

**If this were a blank page, Shopify would probably win.** It is not a blank page. Checkout, the
Stripe webhook, Firestore order records, the fulfilment sheet, magic link login and the staff
product admin are all built and working. Migrating throws those away.

- **Whole platform** (Shopify, or headless Medusa, Vendure, Saleor). All would require rebuilding
  the bespoke parts anyway, because the ring, the four teaching pages, the members area, the
  offline stall form and the stall sale recorder are custom work on any platform. Shopify would not
  do the offline iPad form at all, and that is the piece the stall depends on.
- **Membership and gated content** (Memberstack, Outseta). Both duplicate the Firebase auth already
  built, and both charge a percentage of revenue on top of a monthly fee, roughly 2 to 4 percent at
  entry level. The members area in section 7 is one gated page reading content Michaela posts
  through the admin she already has. Buying a platform for that is the expensive option.
- **Loyalty.** Open Loyalty, despite the name, is SaaS rather than open source. Nothing self hosted
  maps cleanly onto a Next.js and Firestore stack, and the rule in section 9 is a flat 100 points to
  GBP 1 with no expiry, which is a small amount of code rather than a system.
- **Pick and mix.** Every option found is a Shopify app, which requires being on Shopify. On this
  stack it is cart logic.

The one thing worth revisiting: if the shop ever needs multi channel selling, stock across
locations, or a team, the calculation changes. It does not today.
