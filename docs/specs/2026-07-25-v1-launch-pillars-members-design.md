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
| Account | Existing. Profile, dogs, points balance and expiry |
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
  (order confirmations, points expiry) does not.

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
- Their points balance and expiry date.

### 7.2 How Michaela posts

Through the staff admin she already has. A posts section alongside products, using the same
pattern, the same staff claim and the same image upload. Title, body, photo, publish. Nothing new
for her to learn.

### 7.3 Emails from the members area

- **One weekly digest.** The week's post and a dog photo, batched. Same cron and Resend pattern as
  the abandoned cart engine.
- **Instant email only when it is about them.** Points expiring, order dispatched.

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

Each field earns its place by driving something. Anything that drives nothing gets cut.

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

Confirmed: the 30 day, money off model, as already specced in
`docs/specs/2026-07-17-accounts-loyalty-admin-design.md`. Points expire 30 days after the order
that earned them, redemption is a flat 100 points to GBP 1, and the earn rate is per product so
promotions are possible.

This overrides the brainstorm document, which described no expiry and a free item. The expiry is
load bearing, because it is what makes the "your points are worth GBP 3 and they go on Friday"
email work.

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
2. **Hosting.** Assumed Vercel, on the strength of `vercel.json` and the existing cron schedule.
   If it is a VPS instead, the environment variable steps and the cron mechanism both change.
3. **Michaela's weekly commitment.** Assumed one pillar post per week, with eight to ten banked
   before launch. If she cannot sustain weekly, the members area goes stale, and a stale members
   area is worse than none because everybody who joined can see it died. This is the only part of
   the build whose success depends on somebody doing something every week indefinitely.
4. **Whether the stall iPad also takes the payment.** Assumed not, for v1, on scope grounds.
   The consequence of that assumption has to be handled rather than ignored: stall sales are
   invisible to the system, so stock levels do not decrement, revenue reporting is short, and the
   customers Michaela converted face to face end up as members with no order history and no loyalty
   points, which makes them the worst served by the loyalty scheme. So if the iPad does not take the
   money, Michaela needs a way to log a stall sale against a member afterwards, or the data is
   quietly wrong from day one. If it does take the money, signup and sale become one flow and
   everything lands correctly, at the cost of real extra scope on an already full launch.

## 15. Build order

Proving what exists comes before building what does not.

1. Get the newer work safe on GitHub. Done, `feat/accounts-loyalty-admin` pushed 2026-07-25.
2. Test accounts and the staff product flow end to end in Stripe test mode, as Michaela would use
   it, and fix what breaks. Nothing in the 25 commits has been exercised by a human.
3. Michaela's real Stripe keys in, and one live pound taken through the whole path.
4. Product data changes: category, lead time, members only window, and the admin pickers for each.
5. The ring, the four pillar pages, and the flat shop page.
6. Email capture, segmentation, and the four email welcome sequence.
7. The members area, and the posts section in the admin.
8. Legal pages and contact. She cannot trade without them.
9. Stall assets: the QR flow, the account creating form, dogs of the day.

Steps 1 to 3 prove what exists. Everything from 4 is new build.
