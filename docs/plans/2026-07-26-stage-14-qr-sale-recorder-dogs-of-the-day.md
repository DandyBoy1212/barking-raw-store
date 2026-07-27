# D.4, D.5, D.6: The QR Fallback, the Sale Recorder, and Dogs of the Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The QR self-serve signup at `/join` writing the same record through the same apply logic as the stall form, a stall sale recorder at `/stall/sale` that decrements stock, awards points and writes an order atomically and idempotently, the public Dogs of the Day page fed only by consented, host-validated photos, and the stall-consent-to-subscriber seam closed so a ticked box at the table actually joins the marketing list.

**Architecture:** Everything new follows the stage 11 split: pure logic in `src/lib/*.ts` with tests beside it, thin server-only Firestore stores, routes that only orchestrate, client components that queue locally before any network. The offline queue becomes generic over `{ clientId: string }` so signups and sales share one tested state machine and one IndexedDB database (one end-of-day wipe clears both). Idempotency for sales copies the signup marker pattern: `store_stall_sales/{clientId}` checked before work and re-checked inside the one transaction that decrements stock, awards points and writes the order.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Admin SDK (Firestore transactions), IndexedDB, Vitest, Resend via `sendEmail`.

## Global Constraints

- **British spelling throughout. NO em dashes anywhere**, in code, comments, copy or commit messages.
- **TDD, one commit per task.** Commit body ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **No `.env.local`; no live Firestore, Stripe or Resend.** Unit tests only. `npm run build` fails at prerender without env; known, not a gate.
- **Base is 79cced0** (the members track merged in). **Baseline: 318 tests passing, `npx tsc --noEmit` clean, lint at exactly 3 pre-existing errors** (CartProvider.tsx, thank-you/page.tsx). It must end there plus my tests.
- **Points rates live in `src/lib/loyalty.ts` and nowhere else.** Its header says earn machinery must import rates from it rather than restating them; the earn-side constants this stage needs are ADDED there (the members track is merged and done with the file), and `stall-sale.ts` imports them.
- **Do not touch:** `/members` pages (the coordinator swaps its dogs-of-the-day placeholder for my strip at merge time), admin posts pages, home page, header, product card, admin product form, stripe-sync, checkout, `vercel.json`, `HANDOVER.md`, `src/lib/firebase-admin.ts` (COLLECTIONS stays a merge-seam-free zone; new collection names are local consts, the `stall-store.ts` precedent). The ONE permitted admin nav edit is a single added line in `src/app/admin/page.tsx` for the dogs picker, flagged in the report.
- **Membership contract:** membership is ONLY the explicit `member: true` flag. `/join` grants it through `buildStallCustomerPatch` (already writes it); the sale apply writes it explicitly because a purchase confers membership (mirrors `ensureCustomer`). Never infer membership from doc existence.
- **Photo host guard:** dog photos render publicly only when they pass the pinned guard in `validateDogInput` (https, `*.googleapis.com`). The guard is reused by calling `validateDogInput`, never re-implemented, never relaxed. Re-checked at read time before anything renders.
- New state-changing routes use `isBrowserSameOrigin`, never `isAllowedOrigin`.
- Scheduled work would ride a GitHub Action; nothing in this stage needs one.

---

## Decisions taken, stated up front

### D.4: route and gate design

`/join` is a public page for the customer's own phone. Its submissions go to a **new sibling
route `POST /api/join`**, not to `/api/stall/sync` with a relaxed gate. Reasons: the stall
sync gate stays one line (`hasStallAccess`) with no mode flag to get wrong; the public route
carries the public-route protections (`isBrowserSameOrigin`, a per-IP `recordAttempt`
throttle like `/api/subscribe`'s, a dog-count cap) that would be noise on the PIN-gated
route; and both call the SAME `validateStallRecord` and `applyStallRecord`, so "both routes
write the same record" is true by construction, including membership (`member: true` in
`buildStallCustomerPatch`) and idempotency (the `store_stall_signups/{clientId}` marker).

One public-route hardening: `/api/join` **strips `photoData`** from every dog before
applying. The stall form's photo path is safe because Michaela is holding the iPad; a public
route accepting inline photos would let anyone store arbitrary images in our bucket, where
they would then pass the own-host guard and be featurable on a public page. The `/join` page
does not offer photos, and the route enforces it.

Offline behaviour on `/join` is a friendly retry, not a full queue: the record (with its
clientId, minted once) persists in `localStorage` so a refresh loses nothing, a Retry button
and an `online` listener resubmit, and the stable clientId makes every retry idempotent.

### D.5: placement

The recorder lives at **`/stall/sale`, behind `hasStallAccess`**, not in `/admin`. Spec
10.1.2 says "in the staff admin", but at the table Michaela holds only the stall PIN
session, which deliberately cannot reach `/admin`; a sale recorder she cannot open while
taking the money would fail at its one job. `hasStallAccess` also passes real staff
sessions, so it is reachable from her own phone signed in normally. The admin home's
"Stall sales" entry stays in COMING (that file belongs to the members track this wave);
the report flags the one-line move for the coordinator.

### D.5: atomicity, idempotency, and the missing stages 4 and 5

Stage 4 (inventory) and stage 5 (loyalty) are plan documents only; no stock code exists
anywhere in `src/` and the Stripe webhook neither decrements stock nor awards points. The
merged members track brought `src/lib/loyalty.ts`, the code's single definition of points
rates (redemption side today). So:

- **Stock:** optional `stock` on the product doc; absent means untracked and nothing is
  written (stage 4's rule). Decrement clamps at zero inside the transaction.
- **Points:** the earn-side constants join `loyalty.ts` (its header requires exactly
  this): `DEFAULT_EARN_RATE = 10` points per GBP (stage 5's economy), `earnRateFor`
  honouring a per-product `pointsPerPound` override (spec 9 keeps the per-product rate
  and removes expiry), `earnedPoints(amount, rate)` flooring to whole points.
  `stall-sale.ts` imports them; nothing restates a rate. The award is
  `FieldValue.increment` on the customer doc's `pointsBalance`, exactly the field the
  points-owed report (`customerPoints` in `loyalty.ts`) reads. No ledger is invented
  here; the order doc records `pointsEarned` for audit, and a future ledger build can
  backfill from orders.

One transaction per sale: re-check the marker, read every product and the customer doc,
then write the clamped stock values, the order doc (`store_orders/stall-{clientId}`, shaped
like the webhook's orders plus `paymentMethod`, `source: "stall"`, `uid` and
`pointsEarned`), the points increment plus `member: true`, and the marker. A retried sync
hits the marker and changes nothing, so stock cannot double-decrement and points cannot
double-award. A sale naming a product that does not exist is rejected (400) so it surfaces
on the iPad as "needs a second go" rather than silently recording a wrong sale.

A sale may be anonymous (walk-up who declined signup): no uid, no points, no membership,
but stock and revenue stay true, which is 10.1.2's headline requirement.

### D.6: consent and the host guard

Only dogs whose owner's customer doc carries `photoConsent === true` (strict) appear in the
admin picker, and only when the dog's stored photo passes the own-storage guard, reused by
round-tripping through `validateDogInput`. The feature doc stores only what renders: dog
name, photo URL, date. The public page and the members strip re-run the guard at read time
(`docToDogFeature` returns null for anything foreign), so even a hand-edited Firestore doc
cannot put an arbitrary image on the site. No owner data is ever stored on or rendered from
a feature.

The members strip is `src/components/DogsOfTheDayStrip.tsx`, a self-contained async server
component that fetches its own data. It is NOT mounted anywhere in this track;
`src/app/members/page.tsx` (the members track's file, untouchable here) carries a
dogs-of-the-day placeholder paragraph that the coordinator swaps for `<DogsOfTheDayStrip />`
at merge time.

### The consent seam (coordinator addendum)

`applySubscription` gains "stall" as a writable source (public `/api/subscribe` still
refuses it: `CAPTURE_SOURCES` is unchanged), `CONSENT_TEXT` gains the stall wording
verbatim from the consent screen, and `nextWelcomeAction` gives stall contacts the code
email first, like shop (spec 5: "10% off now, and 10% off the first online order"). The
decision of whether a synced record joins the list is pure
(`stallMarketingSubscription` in `stall-record.ts`): marketing consent AND a usable email,
else nothing. The write goes through the same transaction shape as `/api/subscribe`, so a
re-synced record can never reset a sequence position or re-issue a code. It runs inside
`applyStallRecord` BEFORE the marker transaction, so a failed subscriber write leaves the
whole record retryable, and both `/api/stall/sync` and `/api/join` get it for free.
`store_customers` keeps the record of what was agreed; `store_subscribers` alone decides
what is sent; nothing sends from `customer.marketingConsent`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/subscribers.ts` | Modify: stall consent wording, `applySubscription` accepts stall, `nextWelcomeAction` codes stall |
| `src/lib/subscribers.test.ts` | Extend: the stall cases |
| `src/lib/stall-record.ts` | Modify: export `isUsableClientId`, add `stallMarketingSubscription` |
| `src/lib/stall-record.test.ts` | Extend: subscription decision cases |
| `src/lib/stall-store.ts` | Modify: subscriber upsert inside `applyStallRecord`, extract `sendStallWelcomeEmail` |
| `src/app/api/stall/sync/route.ts` | Modify: call the extracted welcome helper |
| `src/lib/stall-queue.ts` | Modify: generic over `{ clientId }`, back-compat aliases kept |
| `src/lib/stall-queue.test.ts` | Extend: a second record type through the machine |
| `src/lib/stall-queue-browser.ts` | Modify: storage key parameter, one DB so one wipe |
| `src/lib/loyalty.ts` | Modify: the earn-side rates join the canon rates module |
| `src/lib/loyalty.test.ts` | Extend: earn rate cases |
| `src/lib/stall-sale.ts` | New pure: sale validation, product doc reads, totals, points, stock changes |
| `src/lib/stall-sale.test.ts` | New: tests for the above |
| `src/lib/stall-sale-store.ts` | New server-only: `applyStallSale` (the transaction), `listStallMembers` |
| `src/app/api/stall/sale/route.ts` | New: POST one queued sale |
| `src/components/stall/SaleRecorder.tsx` | New client: member search, product steppers, cash or card, offline queue |
| `src/app/stall/sale/page.tsx` | New: PIN screen or the recorder, products and members as props |
| `src/components/stall/StallForm.tsx` | Modify: one link to `/stall/sale` on the start screen |
| `src/app/api/join/route.ts` | New: the public QR route, throttled, photoData stripped |
| `src/components/join/JoinForm.tsx` | New client: one-page form, localStorage pending record, retry state |
| `src/app/join/page.tsx` | New public page |
| `src/lib/dogs-of-the-day.ts` | New pure: feature validation, read-side guard, consented dog selection |
| `src/lib/dogs-of-the-day.test.ts` | New: tests for the above |
| `src/lib/dogs-of-the-day-store.ts` | New server-only: list and create features, list consented dogs |
| `src/app/api/admin/dogs-of-the-day/route.ts` | New: staff-gated feature creation |
| `src/components/admin/FeatureDogButton.tsx` | New client: the one button |
| `src/app/admin/dogs/page.tsx` | New staff page: the picker |
| `src/app/admin/page.tsx` | Modify: ONE added line in BUILT |
| `src/app/dogs-of-the-day/page.tsx` | New public page |
| `src/components/DogsOfTheDayStrip.tsx` | New: self-contained members strip, mounted by the coordinator |

New Firestore collections (local consts, `store_` prefix): `store_stall_sales` (sale
markers). Features live in `store_dogs_of_the_day`. Orders reuse `store_orders`.

---

### Task 1: The stall consent reaches the marketing list

**Files:**
- Modify: `src/lib/subscribers.ts`
- Modify: `src/lib/subscribers.test.ts`
- Modify: `src/lib/stall-record.ts`, `src/lib/stall-record.test.ts`
- Modify: `src/lib/stall-store.ts`
- Modify: `src/app/api/stall/sync/route.ts`

**Interfaces:**
- Consumes: `applySubscription`, `docToSubscriber`, `normaliseSubscriberEmail`, `type Subscriber` from `@/lib/subscribers`; `StallRecord` from Task 0 (existing).
- Produces: `CONSENT_TEXT: Record<SubscriberSource, string>`; `applySubscription(existing, input: { source: SubscriberSource; consent: boolean })`; `nextWelcomeAction` treating `"stall"` like `"shop"`; `stallMarketingSubscription(record: StallRecord, existing: Subscriber | null): ReturnType<typeof applySubscription> | null` and `isUsableClientId(value: string): boolean` from `stall-record.ts`; `sendStallWelcomeEmail(record: StallRecord, siteUrl: string): Promise<void>` from `stall-store.ts`.

- [x] **Step 1: Write the failing tests**

Append to `src/lib/subscribers.test.ts` (a `stall source` describe):

```typescript
describe("the stall source", () => {
  it("has its own consent wording, matching the consent screen verbatim", () => {
    expect(CONSENT_TEXT.stall).toBe(
      "Email me the new stuff and the member offers. Unsubscribe any time.",
    );
  });

  it("is refused by the public capture vocabulary", () => {
    expect(CAPTURE_SOURCES).not.toContain("stall");
  });

  it("creates a consented stall subscriber through applySubscription", () => {
    const change = applySubscription(null, { source: "stall", consent: true });
    expect(change.create).toBe(true);
    expect(change.consentTurnedOn).toBe(true);
    expect(change.fields.source).toBe("stall");
    expect(change.fields.consentText).toBe(CONSENT_TEXT.stall);
  });

  it("gives a consented stall contact the code email first, like shop", () => {
    const s: Subscriber = {
      email: "sam@example.com",
      source: "stall",
      consent: true,
      consentText: CONSENT_TEXT.stall,
      consentAtMs: 0,
      discountCode: null,
      codeEmailSentAtMs: null,
      sequencePosition: 0,
      unsubscribed: false,
    };
    expect(nextWelcomeAction(s, 0)).toEqual({ type: "code" });
    expect(nextWelcomeAction({ ...s, codeEmailSentAtMs: 1 }, 0)).toEqual({
      type: "pillar",
      index: 0,
    });
    expect(nextWelcomeAction({ ...s, unsubscribed: true }, 0)).toBeNull();
  });
});
```

Append to `src/lib/stall-record.test.ts` (extend the import; add `Subscriber` fixtures):

```typescript
describe("stallMarketingSubscription", () => {
  it("joins the list with source stall when consent and an email are both there", () => {
    const change = stallMarketingSubscription(
      record({ name: "Sam", email: "sam@example.com", consent: { marketing: true, photo: false } }),
      null,
    );
    expect(change).not.toBeNull();
    expect(change?.create).toBe(true);
    expect(change?.fields.source).toBe("stall");
  });

  it("does nothing without marketing consent, however complete the record", () => {
    const r = record({ name: "Sam", email: "sam@example.com" });
    expect(stallMarketingSubscription(r, null)).toBeNull();
  });

  it("does nothing without a usable email, however enthusiastic the consent", () => {
    const r = record({ name: "Sam", consent: { marketing: true, photo: true } });
    expect(stallMarketingSubscription(r, null)).toBeNull();
  });

  it("is a no-op on a repeat sync, never resetting position or code", () => {
    const existing: Subscriber = {
      email: "sam@example.com",
      source: "stall",
      consent: true,
      consentText: "",
      consentAtMs: 5,
      discountCode: "SAVED10",
      codeEmailSentAtMs: 6,
      sequencePosition: 2,
      unsubscribed: false,
    };
    const change = stallMarketingSubscription(
      record({ email: "sam@example.com", consent: { marketing: true, photo: false } }),
      existing,
    );
    expect(change).toEqual({ create: false, consentTurnedOn: false, fields: {} });
  });
});
```

- [x] **Step 2: Run to verify failure** `npm test -- --run src/lib/subscribers.test.ts src/lib/stall-record.test.ts` fails (CONSENT_TEXT.stall missing, function missing).

- [x] **Step 3: Implement**

In `subscribers.ts`: `CONSENT_TEXT` becomes `Record<SubscriberSource, string>` with
`stall: "Email me the new stuff and the member offers. Unsubscribe any time."`;
`applySubscription`'s input widens to `{ source: SubscriberSource; consent: boolean }`
(the public route still narrows to `CaptureSource` before calling); `nextWelcomeAction`
line becomes `if ((s.source === "shop" || s.source === "stall") && s.codeEmailSentAtMs === null)`.

In `stall-record.ts`: export `isUsableClientId(value: string)` wrapping the existing
pattern (the validator uses it; Task 4 reuses it), and:

```typescript
import { applySubscription, normaliseSubscriberEmail, type Subscriber } from "@/lib/subscribers";

/**
 * Whether a synced stall record joins the marketing list, and how.
 *
 * store_customers records what was agreed at the table; store_subscribers decides
 * what is SENT, and this is the only bridge between them. No marketing consent or
 * no usable email means no bridge. Routed through applySubscription so a re-synced
 * record can never reset a sequence position or re-issue a code.
 */
export function stallMarketingSubscription(
  record: StallRecord,
  existing: Subscriber | null,
): ReturnType<typeof applySubscription> | null {
  if (!record.consent.marketing) return null;
  if (!normaliseSubscriberEmail(record.email)) return null;
  return applySubscription(existing, { source: "stall", consent: true });
}
```

In `stall-store.ts`: a private `upsertStallSubscriber(db, record)` running the same
transaction shape as `/api/subscribe` (read, `stallMarketingSubscription`, merge-set with
`updatedAt`; on create also `email`, `sequencePosition: 0`, `createdAt`; on
consentTurnedOn also `consentAt` and `unsubscribedAt: null`; a no-op change writes
nothing). Called in `applyStallRecord` after uid resolution and BEFORE the marker
transaction; a thrown error returns `{ ok: false, retryable: true }` so the record stays
queued and the list write is retried, and on the marker-already-exists path it is called
again (covers a crash between customer write and subscriber write). Also extract the
welcome email block from the sync route into:

```typescript
/** Best effort: the welcome magic-link email after a fresh signup. Never throws. */
export async function sendStallWelcomeEmail(record: StallRecord, siteUrl: string): Promise<void>
```

and have `src/app/api/stall/sync/route.ts` call it (same `result.created && record.email`
condition), so Task 6's `/api/join` shares it.

- [x] **Step 4: Run** `npm test -- --run` all green, `npx tsc --noEmit` clean.
- [x] **Step 5: Commit** `feat: a ticked stall consent joins the one marketing list`

---

### Task 2: The queue learns a second record type

**Files:**
- Modify: `src/lib/stall-queue.ts`
- Modify: `src/lib/stall-queue.test.ts`
- Modify: `src/lib/stall-queue-browser.ts`

**Interfaces:**
- Produces: `type QueueRecord = { clientId: string }`, `type Queued<T extends QueueRecord>`, `type QueueState<T extends QueueRecord>`, `emptyQueue<T>(): QueueState<T>`, `interface QueueStorage<T extends QueueRecord>`, `type SyncSender<T extends QueueRecord> = (record: T) => Promise<StallSyncOutcome>`, generic `normaliseQueueState<T>`, `enqueueRecord<T>`, `queueSummary<T>`, `syncQueue<T>`; back-compat aliases `QueuedStallRecord`, `StallQueueState`, `EMPTY_QUEUE`, `StallQueueStorage`, `StallSyncSender` unchanged in meaning so `StallForm.tsx` needs no edit. `createBrowserQueueStorage<T extends QueueRecord>(key?: string): QueueStorage<T>` with the default key `"state"` (signups) and one shared database, so the end-of-day wipe clears every queue.

- [x] **Step 1: Failing test** appended to `stall-queue.test.ts`:

```typescript
describe("a second record type", () => {
  type Note = { clientId: string; note: string };
  it("queues, replaces and syncs any record carrying a clientId", async () => {
    let state = enqueueRecord(emptyQueue<Note>(), { clientId: "id-0000-9", note: "first" });
    state = enqueueRecord(state, { clientId: "id-0000-9", note: "second" });
    expect(state.records).toHaveLength(1);
    expect(state.records[0].record.note).toBe("second");
    const after = await syncQueue(state, async () => "synced" as const);
    expect(after.records).toHaveLength(0);
    expect(after.syncedCount).toBe(1);
  });
});
```

- [x] **Step 2: Verify failure** (no `emptyQueue` export).
- [x] **Step 3: Implement.** Generic signatures as above; bodies unchanged. Browser adapter takes `key = "state"`, keeps DB `br-stall` and store `queue`; comment why one DB (one wipe).
- [x] **Step 4: Full suite green, tsc clean.**
- [x] **Step 5: Commit** `feat: the offline queue goes generic, one wipe for every record type`

---

### Task 3: The sale vocabulary, its maths, and its validator

**Files:**
- Modify: `src/lib/loyalty.ts` (earn-side rates join the canon module)
- Modify: `src/lib/loyalty.test.ts`
- Create: `src/lib/stall-sale.ts`
- Test: `src/lib/stall-sale.test.ts`

**Interfaces:**
- Consumes: `isUsableClientId` from `@/lib/stall-record`; `DEFAULT_EARN_RATE`, `earnRateFor`, `earnedPoints` from `@/lib/loyalty` (added here, imported by `stall-sale.ts`, never restated).
- Produces (in `loyalty.ts`):
  - `DEFAULT_EARN_RATE = 10` (points per GBP, stage 5's economy)
  - `earnRateFor(p: { pointsPerPound?: number }): number`
  - `earnedPoints(amount: number, rate: number): number` (floors; never negative)
- Produces (in `stall-sale.ts`):
  - `type StallSaleLine = { slug: string; qty: number }`
  - `type StallSale = { clientId: string; recordedAt: string; customer: { uid: string; email: string; name: string }; lines: StallSaleLine[]; payment: "cash" | "card" }`
  - `validateStallSale(input: unknown, receivedAt: string): { ok: true; sale: StallSale } | { ok: false; errors: string[] }`
  - `type SaleProduct = { slug: string; name: string; price: number; pointsPerPound?: number; stock?: number }`
  - `docToSaleProduct(id: string, data: Record<string, unknown>): SaleProduct`
  - `type SaleOutcome = { items: { slug: string; name: string; qty: number; amount: number; points: number }[]; total: number; points: number; stockChanges: { slug: string; stock: number }[] }`
  - `buildSaleOutcome(sale: StallSale, products: Map<string, SaleProduct>): { ok: true; outcome: SaleOutcome } | { ok: false; errors: string[] }`

Validation rules: hard errors are a bad clientId, no usable line ("Nothing sold."), and a
payment that is not `"cash"` or `"card"` ("How was it paid?"). A line degrades: slug is
lower-cased and must match `/^[a-z0-9][a-z0-9-]{0,79}$/` else the line is dropped; qty is
truncated to an integer and must land in 1 to 99 else dropped; duplicate slugs merge by
summing qty (capped at 99). Customer fields degrade exactly like the signup record: uid
must match `/^[A-Za-z0-9_-]{1,128}$/` else "", email must contain `@` (lower-cased) else
"", name trims. `recordedAt` falls back to `receivedAt` when unparseable.

Maths: `amount = Math.round(price * qty * 100) / 100`; `points = earnedPoints(amount,
earnRateFor(product))`; `earnRateFor` returns `pointsPerPound` when it is a finite number
at least 0, else `DEFAULT_EARN_RATE`; `earnedPoints` is `Math.max(0, Math.floor(amount *
rate))`. `docToSaleProduct` reads `price` (finite else 0),
`pointsPerPound` (finite and >= 0 else absent), `stock` (finite and >= 0, truncated, else
absent: absent means untracked). `buildSaleOutcome` fails listing every missing slug
("Not on the shelf list: x"); stock changes only for tracked products,
`Math.max(0, stock - qty)`.

- [x] **Step 1: Failing tests.** In `loyalty.test.ts`: earnRateFor default 10,
per-product override, zero override honoured, junk override falls back; earnedPoints
floors (7.50 at 10 is 75; 0.99 at 10 is 9) and never goes negative. In
`stall-sale.test.ts`: full valid sale normalises (case, merge duplicates, qty
truncation); bad clientId, empty lines, bad payment all hard-fail with their sentences;
junk lines dropped while good ones survive; non-object refused; recordedAt fallback;
docToSaleProduct defaults and the absent-means-untracked stock rule; buildSaleOutcome
amounts, per-product points, total sums, missing product fails naming the slug, stock
clamps at zero, untracked product produces no stock change.
- [x] **Step 2: Verify failure** (module not found).
- [x] **Step 3: Implement** as specified.
- [x] **Step 4: Green, tsc clean.**
- [x] **Step 5: Commit** `feat: a stall sale validates leniently and prices itself server side`

---

### Task 4: The sale transaction and the member list

**Files:**
- Create: `src/lib/stall-sale-store.ts`

**Interfaces:**
- Consumes: Task 3's surface; `getDb`, `getAuthAdmin`, `COLLECTIONS` from `@/lib/firebase-admin`; `docToStoredCustomer` from `@/lib/customers-store`.
- Produces: `applyStallSale(sale: StallSale): Promise<{ ok: true; applied: boolean } | { ok: false; retryable: boolean; errors?: string[] }>`; `listStallMembers(): Promise<{ uid: string; name: string; email: string }[]>`.

No unit test: Firestore orchestration with every decision tested one layer down, the
`stall-store.ts` precedent. Marker collection is a local const
`const STALL_SALES_COLLECTION = "store_stall_sales"`.

Shape of `applyStallSale`:
1. db or auth null: `{ ok: false, retryable: true }`.
2. Marker pre-check: exists means `{ ok: true, applied: false }`.
3. Resolve uid outside the transaction: `sale.customer.uid` verbatim when present, else
   the signup rule for an email (`getUserByEmail`, then `createUser`), else `""`
   (anonymous sale: stock and revenue still land).
4. One transaction, all reads first: marker (exists: applied false), every product doc
   (missing slugs collected), the customer doc when there is a uid. Missing products
   return `{ ok: false, retryable: false, errors: ["Not on the shelf list: ..."] }`.
5. `buildSaleOutcome`, then the writes:
   - each stock change: `tx.update(productRef, { stock, updatedAt })`;
   - the order, `store_orders/stall-{clientId}`: `{ source: "stall", stallClientId, uid`
     (when there is one)`, items: [{ slug, name, qty, amount, points }], customer:
     { name, email }, subtotal: total, shipping: 0, total, local: true, paymentMethod,
     pointsEarned: points, recordedAt, createdAt: serverTimestamp }`;
   - when there is a uid: merge-set on the customer doc of `member: true` (a purchase
     confers membership, the `ensureCustomer` rule), `pointsBalance:
     FieldValue.increment(points)` when points > 0, `email` only when the doc has none,
     `name` only when the doc has none, `createdAt` only when the doc is new, `updatedAt`;
   - the marker: `{ uid, orderId, syncedAt: serverTimestamp }`.
6. Any thrown error logs and returns `{ ok: false, retryable: true }`.

`listStallMembers`: first 500 `store_customers` docs through `docToStoredCustomer`, keep
those with a name or an email, map to `{ uid, name, email }`, sort by name then email.
Empty array on db null or error.

- [x] **Step 1: Implement.**
- [x] **Step 2: `npx tsc --noEmit` clean, suite still green.**
- [x] **Step 3: Commit** `feat: a sale lands once: stock, points, order and marker in one transaction`

---

### Task 5: The sale sync route

**Files:**
- Create: `src/app/api/stall/sale/route.ts`

Same skeleton as `/api/stall/sync`: `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
`isBrowserSameOrigin` 403, `hasStallAccess` 401 ("The stall session has ended."), JSON
parse 400, `validateStallSale` 400 with errors, `applyStallSale`: retryable false is 400
with its errors (the iPad flags it for a second look), retryable true is 503, ok is
`{ ok: true }`. No email of any kind.

- [x] **Step 1: Implement.**
- [x] **Step 2: tsc clean, lint at 3.**
- [x] **Step 3: Commit** `feat: the sale route takes one queued sale, or says try again`

---

### Task 6: The sale recorder page

**Files:**
- Create: `src/components/stall/SaleRecorder.tsx`
- Create: `src/app/stall/sale/page.tsx`
- Modify: `src/components/stall/StallForm.tsx` (one link on the start screen)

**Interfaces:**
- Consumes: the generic queue (`emptyQueue`, `enqueueRecord`, `queueSummary`, `syncQueue`, `createBrowserQueueStorage<StallSale>("sales")`), `type StallSale` from Task 3, `hasStallAccess`, `getStoredProducts`, `listStallMembers`, `gbp` from `@/lib/format`, `PinLogin`.
- Produces: the `/stall/sale` route.

`page.tsx`: server component, `dynamic = "force-dynamic"`. `hasStallAccess()` false
renders `PinLogin` in the same bands as `/stall`; true fetches
`(await getStoredProducts()).map((p) => ({ slug: p.slug, name: p.name, price: p.price }))`
and `listStallMembers()` and renders `<SaleRecorder products={...} members={...} />`.
The catalogue and member list are a page-load snapshot: the page is opened with signal at
set-up, then works offline all day, the same assumption the signup form makes.

`SaleRecorder`: one screen, thumb-sized, mirroring `StallForm`'s queue plumbing exactly
(storage key `"sales"`, sender posting to `/api/stall/sale`, same outcome mapping, same
`online` listener, same summary line, Sync now button). Content: a member search input
filtering `members` by name or email substring (case-insensitive, first 8 shown), a
selected-member chip with a clear button, a "No account" option (anonymous sale), product
rows with minus and plus steppers and a running `gbp` total, cash and card chips
(`aria-pressed`), and Save, disabled until at least one line and a payment method are
chosen. Save builds the `StallSale` (`clientId: crypto.randomUUID()`, `recordedAt` now,
chosen member's uid or ""), enqueues locally first, saves storage, shows a saved notice,
resets, pokes sync. A back link to `/stall` at the top; the end-of-day wipe lives on the
signup page and clears this queue too (one database), said in a comment.

`StallForm` start screen gains one `next/link` styled `btn` to `/stall/sale`, "Record a
sale".

- [x] **Step 1: Implement all three.**
- [x] **Step 2: tsc clean, lint at 3, suite green.**
- [x] **Step 3: Commit** `feat: the sale recorder, offline like the signups it sits beside`

---

### Task 7: The public QR route

**Files:**
- Create: `src/app/api/join/route.ts`

**Interfaces:**
- Consumes: `isBrowserSameOrigin`; `recordAttempt` from `@/lib/stall-session`; `validateStallRecord` from `@/lib/stall-record`; `applyStallRecord`, `sendStallWelcomeEmail` from `@/lib/stall-store`.
- Produces: `POST /api/join`.

`runtime = "nodejs"`, `dynamic = "force-dynamic"`. Order of checks: same-origin 403;
per-IP throttle (`recordAttempt`, 10 attempts per 15 minutes per
`x-forwarded-for` head, Map per instance, same caveat comment as the others) returning
429 `{ ok: false, error: "Give it a minute and try again." }` (NOT a silent ok: unlike
/api/subscribe a dropped submit here loses a signup, and the stable clientId makes an
honest retry safe); JSON parse 400; `validateStallRecord` 400 with errors. Then the
public-route hardening: dogs are capped at the first 10 and every `photoData` is stripped
(`record.dogs.map(({ value }) => ({ value }))`), with the comment saying why (a public
route must not be a path for arbitrary images into our bucket, where they would pass the
own-host guard). `applyStallRecord` failure is 503; success calls
`sendStallWelcomeEmail` when `result.created && record.email`, then `{ ok: true }`.

- [x] **Step 1: Implement.**
- [x] **Step 2: tsc clean, lint at 3.**
- [x] **Step 3: Commit** `feat: the QR route writes the same record the iPad does`

---

### Task 8: The join page

**Files:**
- Create: `src/components/join/JoinForm.tsx`
- Create: `src/app/join/page.tsx`

`page.tsx`: public server component, `metadata = { title: "Join Barking Raw" }`, the house
bands (`band band--ink` hero: eyebrow "The stall", display "Join Barking Raw", a line
saying membership starts here; `band band--paper` wrapping the form, maxWidth 560).

`JoinForm` (client): one page, not one-question-per-screen (it is their own phone). Fields:
name, email (hinted as how the welcome email arrives), phone, address (line1, line2, city,
postcode), dogs as repeatable name-and-breed rows with "Add another dog" (client caps at
10, matching the route), and the two consent tickboxes rendered as the stall's chip
buttons, unticked, marketing wording IDENTICAL to `CONSENT_TEXT.stall` and the photo
wording from the stall screen. No photo capture. Submit flow:

- A `pending` record persists in `localStorage` key `"br-join-pending"`: minted with
  `clientId: crypto.randomUUID()` at first submit, restored on mount (a refresh loses
  nothing), cleared on success. The clientId never changes across retries, so the server
  marker makes every retry idempotent.
- States: `editing`, `sending`, `waiting` (the friendly retry: "No signal just now. Your
  signup is saved on this phone. It will go the moment you are back online, or tap
  retry."), `done` ("You are in. If you gave an email, your sign-in link is on its way.").
  A 400 returns to `editing` showing the server's errors; 429 and network errors go to
  `waiting`; an `online` listener and a Retry button resubmit the same record.

- [x] **Step 1: Implement both.**
- [x] **Step 2: tsc clean, lint at 3, suite green.**
- [x] **Step 3: Commit** `feat: the QR page, typed from a poster, forgiving of no signal`

---

### Task 9: Dogs of the Day pure logic

**Files:**
- Create: `src/lib/dogs-of-the-day.ts`
- Test: `src/lib/dogs-of-the-day.test.ts`

**Interfaces:**
- Consumes: `validateDogInput` from `@/lib/customer-fields` (the pinned host guard, reused not copied); `docToStoredCustomer` from... NOT consumed: that module is server-only, so this pure module reads the raw dogs array itself, tolerantly.
- Produces:
  - `type DogFeature = { id: string; dogName: string; photo: string; date: string }`
  - `usableDogPhoto(url: unknown): string` ("" unless the guard passes)
  - `validateDogFeatureInput(input: unknown, today: string): { ok: true; value: { dogName: string; photo: string; date: string } } | { ok: false; errors: string[] }`
  - `docToDogFeature(id: string, data: Record<string, unknown>): DogFeature | null`
  - `sortFeaturesNewestFirst(features: DogFeature[]): DogFeature[]`
  - `type ConsentedDogPhoto = { uid: string; dogId: string; dogName: string; photo: string; ownerName: string }`
  - `consentedDogPhotos(docs: { uid: string; data: Record<string, unknown> }[]): ConsentedDogPhoto[]`

`usableDogPhoto` round-trips through `validateDogInput({ name: "check", photo })` and
returns the photo only if it survived, so the one guard with the unit tests pinning it
stays the single authority. `validateDogFeatureInput`: dogName required, trimmed, max 80
("The dog needs its name."); photo must pass the guard ("The photo must live on our own
storage."); date must match `/^\d{4}-\d{2}-\d{2}$/` and parse, else `today`.
`docToDogFeature` returns null when the stored name is blank or the stored photo fails
the guard, so nothing foreign ever renders even from a hand-edited doc.
`consentedDogPhotos`: keeps docs with `photoConsent === true` (strict), walks `dogs`
tolerantly (object, string id and name), keeps only dogs whose photo passes the guard;
`ownerName` is the doc's name or "" (shown only in the staff picker, never stored on a
feature, never rendered publicly).

- [x] **Step 1: Failing tests** covering: guard passes a signed
`https://storage.googleapis.com/...` URL and refuses http, foreign hosts
(`https://evil.example/x.jpg`), javascript:, and junk; validate requires the name, refuses
a foreign photo, falls back the date; docToDogFeature maps a good doc, nulls a foreign
photo and a nameless doc; sort newest first by date with id as tiebreak; consentedDogPhotos
refuses `photoConsent: "true"` (string), refuses consent without a photo, keeps only
guard-passing dogs, and never invents owner data.
- [x] **Step 2: Verify failure.** **Step 3: Implement.** **Step 4: Green.**
- [x] **Step 5: Commit** `feat: dogs of the day trusts only consent and our own storage`

---

### Task 10: The feature store, the staff route, and the picker

**Files:**
- Create: `src/lib/dogs-of-the-day-store.ts`
- Create: `src/app/api/admin/dogs-of-the-day/route.ts`
- Create: `src/components/admin/FeatureDogButton.tsx`
- Create: `src/app/admin/dogs/page.tsx`
- Modify: `src/app/admin/page.tsx` (ONE line)

**Interfaces:**
- Consumes: Task 9's surface; `getDb`, `COLLECTIONS` from firebase-admin; `requireStaff`; `isBrowserSameOrigin`.
- Produces: `listDogFeatures(max?: number): Promise<DogFeature[]>`, `createDogFeature(value: { dogName: string; photo: string; date: string }): Promise<boolean>`, `listConsentedDogPhotos(): Promise<ConsentedDogPhoto[]>`; `POST /api/admin/dogs-of-the-day`; the `/admin/dogs` page.

Store: local const `const FEATURES_COLLECTION = "store_dogs_of_the_day"` (COLLECTIONS is
a shared file other agents own this wave). `listDogFeatures`: up to 200 docs through
`docToDogFeature` (nulls dropped), `sortFeaturesNewestFirst`, sliced to `max` (default
30); empty on db null or error. `createDogFeature`: `.add({ ...value, createdAt:
serverTimestamp })`, boolean. `listConsentedDogPhotos`: first 500 customers into
`consentedDogPhotos`.

Route: `requireStaff()` then `isBrowserSameOrigin` 403, JSON 400,
`validateDogFeatureInput(body, today)` 400 with errors, db null 503, create false 500,
else `{ ok: true }`. Today is `new Date().toISOString().slice(0, 10)`.

Picker page: `requireStaff`, `dynamic = "force-dynamic"`. Recent features list (name and
date, so she can see who has had a turn), then the consented dogs as cards: photo
(`<img>` with the eslint-disable line, the `StallForm` precedent), dog name, owner name,
and `FeatureDogButton` (client: POST, busy state, "Featured" on success, error line on
failure) passing dogName and photo only. Honest empty state: "Nobody has ticked the photo
box yet. It is on the stall form's consent screen."

Admin nav, the flagged single line inside `BUILT`:

```typescript
  { href: "/admin/dogs", title: "Dogs of the day", blurb: "Feature a consented stall dog on the public page." },
```

- [x] **Step 1: Implement all five.**
- [x] **Step 2: tsc clean, lint at 3, suite green.**
- [x] **Step 3: Commit** `feat: the picker shows Michaela only the dogs she may publish`

---

### Task 11: The public page and the members strip

**Files:**
- Create: `src/app/dogs-of-the-day/page.tsx`
- Create: `src/components/DogsOfTheDayStrip.tsx`

Public page: no gate, `dynamic = "force-dynamic"`, `metadata` (title "Dogs of the Day",
description about the dogs met at the stall). Hero band, then a responsive grid of
features from `listDogFeatures(30)`: photo (`<img>`, eslint-disable line, lazy loading)
and the dog's name and date, NOTHING else, per 10.2 (photos out; no owner data exists on
a feature to leak). Empty state: "The first stall dogs land here soon."

Strip: an async server component, self-contained (fetches `listDogFeatures(6)` itself) so
the coordinator can mount `<DogsOfTheDayStrip />` in `/members` with no wiring. Small
heading, a horizontal row of photos with names, a link to `/dogs-of-the-day`, and a one
line empty state so mounting it early still looks deliberate. NOT mounted anywhere in
this track, stated in the file's doc comment.

- [x] **Step 1: Implement both.**
- [x] **Step 2: tsc clean, lint at 3, suite green.**
- [x] **Step 3: Commit** `feat: dogs of the day, photos out, discussion in`

---

### Task 12: Final verification

- [x] `npm test -- --run` green (318 baseline plus this stage's), `npx tsc --noEmit`
clean, `npm run lint` exactly the 3 pre-existing errors, `git status` clean, every task
committed. Confirm no touched file belongs to another track beyond the one flagged admin
nav line.

## Self-review notes

- Spec coverage: 10.1 QR fallback (Tasks 7, 8), 10.1.2 every bullet (Tasks 3 to 6),
  10.2 (Tasks 9 to 11), 9 (per-product earn, no expiry, Task 3), 8.2 vocabulary reused
  via the existing validators, coordinator addendum (Task 1).
- Types named in later tasks (`StallSale`, `SaleOutcome`, `DogFeature`,
  `ConsentedDogPhoto`, `QueueState`) are defined in earlier ones; the queue aliases keep
  `StallForm.tsx` untouched by Task 2.
- The one deliberately shared-file edit is the single admin nav line, flagged here and in
  the report.
