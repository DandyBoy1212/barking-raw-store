# D.1, D.2, D.3: The Stall Form, Offline First, and the Staff PIN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The iPad signup form for Michaela's market stall: one question per screen, every field skippable, offline first with a visible sync queue, a staff PIN instead of a magic link, and records that land in `store_customers` in the exact shape the account page reads.

**Architecture:** Three layers, each behind a seam. Pure logic (record validation, the Firestore patch builder, the queue state machine, the session token maths) lives in `src/lib/*.ts` with tests beside it, no Firestore, no React, no `next/headers`. Thin adapters (an IndexedDB storage adapter, two API routes, one Firestore orchestrator) wrap the pure logic. The UI is one client component driving a screen-per-question state machine, persisting every record locally before any network is attempted.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Admin SDK (Firestore, Auth, Storage), IndexedDB in the browser, Vitest, Resend via the existing `sendEmail`.

## Global Constraints

- **British spelling throughout, in code, comments, copy and commit messages.** No em dashes anywhere, use a comma or a full stop.
- **Read the Next.js guides in `node_modules/next/dist/docs/` before writing any route or component.** This is Next 16 and the APIs differ from training data.
- **TDD, one commit per task.** Failing test first, minimal implementation, watch it pass, commit. Commit body ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **No `.env.local` exists in this worktree.** Nothing may be verified against live Firestore, Firebase Auth or Resend. Unit tests only, following `src/lib/customer-fields.test.ts` and `src/lib/customers-store.test.ts`.
- **New state-changing routes use `isBrowserSameOrigin`**, the strict helper, never `isAllowedOrigin`. Do not merge the two helpers.
- **Do not edit shared files** (header, layout, home page, `globals.css`, `firebase-admin.ts`, `auth-helpers.ts`). Two other agents work in parallel. Everything here is new files plus `.env.example` (append only, at the end).
- **No nav link to `/stall` anywhere.** Staff reach it by URL.
- **Lint must stay at exactly the 3 pre-existing errors** in `CartProvider.tsx` and `thank-you/page.tsx`. The baseline is 143 passing tests and a clean `npx tsc --noEmit`.

---

## The three designs, stated up front

### Identity and keying (D.1)

A stall signup has no Firebase account yet, so the record cannot be keyed by uid at capture
time. Instead every queued record carries a client-generated `clientId` (a UUID minted by the
iPad when the record is saved locally), and identity is resolved **server side at sync time**:

- **With an email:** the sync route resolves a uid exactly the way the Stripe webhook's
  `ensureCustomer` does, `getUserByEmail` first, `createUser({ email })` when there is no
  user yet. The record is merged into `store_customers/{uid}`. When the person later opens
  the welcome email and signs in by magic link, Firebase email-link sign-in matches the same
  user by email, so the session lands on the same uid and `/account` shows their dogs. No
  linking step exists because there is nothing to link, the email is the identity on both
  paths.
- **Without an email** (every field is skippable): no Firebase account is possible and none
  is created. The record lands in `store_customers/stall-{clientId}`. The `stall-` prefix
  cannot collide with a Firebase uid, Michaela still has the data, and if the person ever
  does hand over an email there is a record to merge by hand.

Membership is granted explicitly: the stall patch writes `member: true` onto the customer
doc. (This changed mid-build: membership used to be inferred from the doc merely existing,
which turned out to be a privilege escalation, since the account routes create that doc for
any signed-in user. The base branch now owns the `member` flag semantics and the
`isMemberDoc` predicate; this track only writes the flag, per spec 10.1.)

**Idempotency:** a marker document `store_stall_signups/{clientId}` records that a clientId
has been applied, and which uid it landed on. The sync route checks the marker before doing
anything and re-checks it inside the write transaction, so a record that syncs twice (a retry
after an ambiguous failure) merges zero times more, appends zero duplicate dogs, and sends
zero duplicate welcome emails. The customer write and the marker write happen in one
transaction, so there is no window where the record applied but the marker is missing.

### The offline queue (D.2)

The queue is a pure state machine in `src/lib/stall-queue.ts`:
`{ records: QueuedStallRecord[], syncedCount: number }`. Storage and network sit behind two
interfaces (`StallQueueStorage`, `StallSyncSender`) so the tests fake both. The browser
adapter uses **IndexedDB**, not localStorage, because queued records carry a downscaled dog
photo as a data URL, and two or three of those would blow through localStorage's 5MB quota
on a busy Sunday, which is precisely the moment it must not fail.

Rules: a record is written to storage before any network is attempted, sync is sequential
and never blocks the UI, `"synced"` removes the record and bumps `syncedCount` (a bare
number, so nothing personal survives a successful sync), `"retry"` keeps the record
untouched for the next pass, `"rejected"` (the server said 400) keeps the record but flags
it so it stops burning the auto-retry loop and waits for a manual "Sync now". A thrown
sender (no signal) counts as retry. The summary line ("3 saved, 1 waiting to sync") is
derived state, so Michaela's trust indicator can never drift from the truth. Wipe is a
storage-level operation that clears the IndexedDB store and deletes the database, and it
runs on end-of-day logout before the session cookie is cleared, so nothing personal remains
on the borrowed iPad even if the network is down at wipe time.

### The staff PIN (D.3)

- The PIN lives in `STALL_PIN` on the server and is never shipped to the client. The login
  route compares it server side with a timing-safe comparison over SHA-256 digests (hashing
  first equalises length, so the length of the real PIN leaks nothing).
- On success the route sets `br_stall`, an httpOnly, secure, sameSite=lax cookie holding
  `expiry.HMAC-SHA256(key, expiry)`. The signing key is
  `sha256(STALL_PIN + "\n" + FIREBASE_SERVICE_ACCOUNT)`, so a captured cookie cannot be
  brute-forced offline back to a short PIN without also holding the server credential. The
  token expires after 14 hours, one market day, so a forgotten logout still dies the same
  night.
- **Scope:** the cookie is only ever read by `hasStallAccess()`, which guards `/stall` and
  `/api/stall/*`. It is not a Firebase session, carries no uid and no staff claim, so
  `/admin` (behind `requireStaff`) and the account routes (behind `requireUser`) are
  unreachable with it. A real staff session also passes `hasStallAccess()`, so Michaela
  signed in normally on her own phone can use the form too.
- **Throttling:** the login route keeps a per-IP attempt budget, 5 attempts per 15 minutes,
  same best-effort per-instance pattern as `/api/auth/link`, with the same caveat that a
  platform-level limit should back it up. Failures return a uniform 403.
- **End of day:** one button wipes the local queue first (locally, unconditionally), then
  DELETEs the session cookie. The wipe does not wait on the network.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/stall-record.ts` | Pure: `validateStallRecord`, `buildStallCustomerPatch`, `stallWelcomeEmailHtml`. The record vocabulary |
| `src/lib/stall-record.test.ts` | Unit tests for the above |
| `src/lib/stall-session.ts` | Pure: token mint/verify, PIN comparison, throttle bookkeeping |
| `src/lib/stall-session.test.ts` | Unit tests for the above |
| `src/lib/stall-queue.ts` | Pure: queue state machine, summary line, sync loop over injected sender |
| `src/lib/stall-queue.test.ts` | Unit tests for the above |
| `src/lib/stall-queue-browser.ts` | Thin IndexedDB adapter implementing `StallQueueStorage` |
| `src/lib/stall-auth.ts` | Server-only: `hasStallAccess()` from the cookie or a staff session |
| `src/lib/stall-store.ts` | Server-only: `applyStallRecord`, uid resolution, photo upload, the marker transaction |
| `src/app/api/stall/session/route.ts` | POST the PIN, DELETE to log out |
| `src/app/api/stall/sync/route.ts` | POST one queued record, send the welcome email |
| `src/app/stall/page.tsx` | Server component: PIN screen or the form |
| `src/components/stall/PinLogin.tsx` | The PIN entry screen |
| `src/components/stall/StallForm.tsx` | The one-question-per-screen form, the queue bar, sync, end of day |
| `.env.example` | Append `STALL_PIN` with a comment |

Out of scope, deliberately: D.4 (the QR self-serve route), D.5 (stall sale recording), D.6
(Dogs of the Day). The consent flags and photo URLs written here are what D.6 will read.

---

### Task 1: The stall record vocabulary and its validator

**Files:**
- Create: `src/lib/stall-record.ts`
- Test: `src/lib/stall-record.test.ts`

**Interfaces:**
- Consumes: `validateDogInput`, `normaliseAddress` from `@/lib/customer-fields`; `Dog`, `CustomerAddress` types from `@/data/customers`.
- Produces: `type StallDog = { value: Omit<Dog, "id">; photoData?: string }`, `type StallConsent = { marketing: boolean; photo: boolean }`, `type StallRecord = { clientId: string; capturedAt: string; name: string; email: string; phone: string; address: CustomerAddress; dogs: StallDog[]; consent: StallConsent }`, and `validateStallRecord(input: unknown, receivedAt: string): { ok: true; record: StallRecord } | { ok: false; errors: string[] }`.

The validator is lenient the way `validateDogInput` is lenient, and for the same reason: a
half-known record is worth more than a rejected one. Only two things are hard errors, a
missing or malformed `clientId` (without it the sync cannot be idempotent) and a record with
nothing in it at all (there is nothing to save). Everything else degrades: a nameless dog is
dropped (the A.2 mapper would drop it at read time anyway), an email without an `@` becomes
no email, an oversized or non-image `photoData` is stripped while the dog itself is kept.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/stall-record.test.ts
import { describe, it, expect } from "vitest";
import { validateStallRecord } from "./stall-record";

const CLIENT_ID = "3f2c9b1e-8a4d-4f6b-9c1e-2b7a8d3e5f60";
const RECEIVED = "2026-07-26T09:00:00.000Z";

describe("validateStallRecord", () => {
  it("accepts a full record and normalises it", () => {
    const result = validateStallRecord(
      {
        clientId: CLIENT_ID,
        capturedAt: "2026-07-26T08:30:00.000Z",
        name: "  Sam ",
        email: " Sam@Example.COM ",
        phone: " 07700 900000 ",
        address: { line1: " 1 High St ", city: " Dundee ", postcode: " dd5 1aa " },
        dogs: [{ name: "Loki", breed: "Collie", photoData: "data:image/jpeg;base64,abc" }],
        consent: { marketing: true, photo: true },
      },
      RECEIVED,
    );
    expect(result).toEqual({
      ok: true,
      record: {
        clientId: CLIENT_ID,
        capturedAt: "2026-07-26T08:30:00.000Z",
        name: "Sam",
        email: "sam@example.com",
        phone: "07700 900000",
        address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ value: { name: "Loki", breed: "Collie" }, photoData: "data:image/jpeg;base64,abc" }],
        consent: { marketing: true, photo: true },
      },
    });
  });

  it("refuses a record without a usable clientId, since sync cannot be idempotent without one", () => {
    const result = validateStallRecord({ clientId: "nope!", name: "Sam" }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("A record needs its client id.");
  });

  it("refuses a completely empty record, because there is nothing to save", () => {
    const result = validateStallRecord({ clientId: CLIENT_ID }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Nothing to save.");
  });

  it("keeps a record that only has a phone number, since every other field is skippable", () => {
    const result = validateStallRecord({ clientId: CLIENT_ID, phone: "07700 900000" }, RECEIVED);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.phone).toBe("07700 900000");
      expect(result.record.email).toBe("");
      expect(result.record.dogs).toEqual([]);
    }
  });

  it("drops an email with no @ rather than failing the record", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", email: "not-an-email" },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.email).toBe("");
  });

  it("drops a nameless dog but keeps the record, mirroring the A.2 read-side rule", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", dogs: [{ breed: "Collie" }, { name: "Bear" }] },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Bear" } }]);
  });

  it("strips photoData that is not an inline image, keeping the dog", () => {
    const result = validateStallRecord(
      {
        clientId: CLIENT_ID,
        dogs: [{ name: "Loki", photoData: "https://evil.example/x.jpg" }],
      },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Loki" } }]);
  });

  it("strips photoData over the size cap, keeping the dog", () => {
    const big = `data:image/jpeg;base64,${"a".repeat(2_900_000)}`;
    const result = validateStallRecord(
      { clientId: CLIENT_ID, dogs: [{ name: "Loki", photoData: big }] },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Loki" } }]);
  });

  it("treats anything but true as unticked consent, so consent can only be given deliberately", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", consent: { marketing: "yes", photo: 1 } },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.consent).toEqual({ marketing: false, photo: false });
  });

  it("falls back to receivedAt when capturedAt is missing or unparseable", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", capturedAt: "last sunday" },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.capturedAt).toBe(RECEIVED);
  });

  it("refuses a non-object body", () => {
    expect(validateStallRecord("stuff", RECEIVED).ok).toBe(false);
    expect(validateStallRecord(null, RECEIVED).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/stall-record.test.ts`
Expected: FAIL, cannot resolve `./stall-record`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/stall-record.ts
// Pure logic for the stall signup record: validation, the Firestore patch, and the
// welcome email body. No Firestore, no next/headers, no React, so this module is
// trivially unit-testable (mirrors customer-fields.ts).

import { normaliseAddress, validateDogInput } from "@/lib/customer-fields";
import type { CustomerAddress, Dog } from "@/data/customers";

/** One dog as captured at the stall: the A.2 fields plus an optional inline photo. */
export type StallDog = { value: Omit<Dog, "id">; photoData?: string };

export type StallConsent = { marketing: boolean; photo: boolean };

/**
 * One signup as queued on the iPad and posted to the sync route.
 *
 * clientId is minted by the device when the record is first saved locally, and it is
 * the idempotency key: syncing the same clientId twice applies the record once.
 */
export type StallRecord = {
  clientId: string;
  capturedAt: string;
  name: string;
  email: string;
  phone: string;
  address: CustomerAddress;
  dogs: StallDog[];
  consent: StallConsent;
};

// UUID-shaped, but tolerant of anything url-safe the same length, since the id only
// has to be unique and unguessable enough to key a marker doc.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

// A downscaled 1280px JPEG is a few hundred KB; base64 inflates by a third. This cap
// keeps the whole record safely inside a serverless request body.
const PHOTO_DATA_PATTERN = /^data:image\/(jpeg|png|webp);base64,/;
const MAX_PHOTO_DATA_CHARS = 2_800_000;

/**
 * Validate one stall record from the queue.
 *
 * Lenient the way validateDogInput is lenient, and for the same reason: these records
 * are captured in conversation with every field skippable, so a half-known record is
 * worth far more than a rejected one. Only a missing clientId (sync could not be
 * idempotent) and a record with nothing in it at all are hard errors. Everything else
 * degrades: bad email becomes no email, a nameless dog is dropped, an unusable photo
 * is stripped while the dog is kept.
 */
export function validateStallRecord(
  input: unknown,
  receivedAt: string,
): { ok: true; record: StallRecord } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Bad record."] };
  const raw = input as Record<string, unknown>;

  const clientId = String(raw.clientId ?? "").trim();
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, errors: ["A record needs its client id."] };
  }

  const capturedRaw = String(raw.capturedAt ?? "").trim();
  const capturedAt = Number.isFinite(Date.parse(capturedRaw)) ? capturedRaw : receivedAt;

  const name = String(raw.name ?? "").trim();
  const emailRaw = String(raw.email ?? "").trim().toLowerCase();
  const email = emailRaw.includes("@") ? emailRaw : "";
  const phone = String(raw.phone ?? "").trim();
  const address = normaliseAddress(raw.address as Partial<CustomerAddress> | undefined);

  const dogs: StallDog[] = [];
  if (Array.isArray(raw.dogs)) {
    for (const entry of raw.dogs) {
      if (!entry || typeof entry !== "object") continue;
      const parsed = validateDogInput(entry as Partial<Dog>);
      // A nameless dog is dropped, not fatal: docToStoredCustomer would drop it at
      // read time anyway, so keeping it here would only defer the loss.
      if (!parsed.ok) continue;
      const photoData = String((entry as Record<string, unknown>).photoData ?? "");
      const usablePhoto =
        PHOTO_DATA_PATTERN.test(photoData) && photoData.length <= MAX_PHOTO_DATA_CHARS;
      dogs.push(usablePhoto ? { value: parsed.value, photoData } : { value: parsed.value });
    }
  }

  const consentRaw = (raw.consent ?? {}) as Record<string, unknown>;
  // Strictly === true: consent is opt in, so anything mangled reads as unticked.
  const consent: StallConsent = {
    marketing: consentRaw.marketing === true,
    photo: consentRaw.photo === true,
  };

  const hasAddress = Object.values(address).some(Boolean);
  if (!name && !email && !phone && !hasAddress && dogs.length === 0) {
    return { ok: false, errors: ["Nothing to save."] };
  }

  return { ok: true, record: { clientId, capturedAt, name, email, phone, address, dogs, consent } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/stall-record.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stall-record.ts src/lib/stall-record.test.ts
git commit -m "feat: validate a stall record leniently, keyed by a client id"
```

---

### Task 2: The Firestore patch a record becomes, and the welcome email body

**Files:**
- Modify: `src/lib/stall-record.ts`
- Test: `src/lib/stall-record.test.ts`

**Interfaces:**
- Consumes: `StoredCustomer` from `@/data/customers`, `nextDogId` from `@/lib/customers-store` is NOT used here (it is server-only); this module carries its own copy of the id rule to stay pure. `StallRecord` from Task 1.
- Produces: `buildStallCustomerPatch(current: StoredCustomer, record: StallRecord, photoUrls: (string | undefined)[]): Record<string, unknown>` and `stallWelcomeEmailHtml(link: string, name?: string): string`.

Merge rules, stated once: a non-blank record field wins over the existing value (the stall
conversation is the freshest deliberate collection we have), a blank record field never
blanks anything. Email is the one exception, it is identity, so it is only ever written
into a doc that has none. Dogs append after the existing ones using the same
`dog-{n}` never-reuse rule as `nextDogId` in `customers-store.ts` (duplicated here rather
than imported, because that module is `server-only` and this one must stay pure; the unit
test pins the behaviour so the copies cannot drift silently). Consent is always written,
ticked or not, with the moment it was captured, because "no" recorded at a timestamp is a
defensible answer and an absent field is not.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/lib/stall-record.test.ts
// Extend the existing import from "./stall-record":
//   import { buildStallCustomerPatch, stallWelcomeEmailHtml, validateStallRecord } from "./stall-record";
// Add: import type { StoredCustomer } from "@/data/customers";

const BLANK_CUSTOMER: StoredCustomer = {
  uid: "u1",
  email: "",
  name: "",
  phone: "",
  address: { line1: "", line2: "", city: "", postcode: "" },
  dogs: [],
};

function record(overrides: Record<string, unknown>) {
  const result = validateStallRecord({ clientId: "3f2c9b1e-8a4d-4f6b-9c1e-2b7a8d3e5f60", ...overrides }, "2026-07-26T09:00:00.000Z");
  if (!result.ok) throw new Error("test record did not validate");
  return result.record;
}

describe("buildStallCustomerPatch", () => {
  it("writes a full record onto a blank customer", () => {
    const patch = buildStallCustomerPatch(
      BLANK_CUSTOMER,
      record({
        name: "Sam",
        email: "sam@example.com",
        phone: "07700 900000",
        address: { line1: "1 High St", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ name: "Loki", breed: "Collie" }],
        consent: { marketing: true, photo: false },
        capturedAt: "2026-07-26T08:30:00.000Z",
      }),
      [undefined],
    );
    expect(patch).toEqual({
      email: "sam@example.com",
      name: "Sam",
      phone: "07700 900000",
      address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
      lastPostcode: "DD5 1AA",
      dogs: [{ id: "dog-1", name: "Loki", breed: "Collie" }],
      marketingConsent: true,
      photoConsent: false,
      consentAt: "2026-07-26T08:30:00.000Z",
      stallSignupAt: "2026-07-26T08:30:00.000Z",
    });
  });

  it("never blanks an existing field with a skipped one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      name: "Samantha",
      phone: "07700 111222",
      address: { line1: "2 Low St", line2: "", city: "Dundee", postcode: "DD4 9ZZ" },
    };
    const patch = buildStallCustomerPatch(current, record({ name: "", phone: "", dogs: [{ name: "Loki" }] }), [undefined]);
    expect(patch).not.toHaveProperty("name");
    expect(patch).not.toHaveProperty("phone");
    expect(patch).not.toHaveProperty("address");
    expect(patch).not.toHaveProperty("lastPostcode");
  });

  it("lets a fresh non-blank answer win, since the stall conversation is the newest data", () => {
    const current: StoredCustomer = { ...BLANK_CUSTOMER, name: "Sam" };
    const patch = buildStallCustomerPatch(current, record({ name: "Samantha" }), []);
    expect(patch.name).toBe("Samantha");
  });

  it("never overwrites an existing email, because email is identity", () => {
    const current: StoredCustomer = { ...BLANK_CUSTOMER, email: "old@example.com" };
    const patch = buildStallCustomerPatch(current, record({ name: "Sam", email: "new@example.com" }), []);
    expect(patch).not.toHaveProperty("email");
  });

  it("merges a partial address field by field over the existing one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      address: { line1: "2 Low St", line2: "", city: "Dundee", postcode: "" },
    };
    const patch = buildStallCustomerPatch(current, record({ address: { postcode: "DD5 1AA" } }), []);
    expect(patch.address).toEqual({ line1: "2 Low St", line2: "", city: "Dundee", postcode: "DD5 1AA" });
    expect(patch.lastPostcode).toBe("DD5 1AA");
  });

  it("appends dogs after the existing ids, never reusing one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      dogs: [{ id: "dog-1", name: "Old" }, { id: "dog-3", name: "Older" }],
    };
    const patch = buildStallCustomerPatch(current, record({ dogs: [{ name: "Loki" }, { name: "Bear" }] }), [undefined, undefined]);
    expect(patch.dogs).toEqual([
      { id: "dog-1", name: "Old" },
      { id: "dog-3", name: "Older" },
      { id: "dog-4", name: "Loki" },
      { id: "dog-5", name: "Bear" },
    ]);
  });

  it("attaches an uploaded photo url to its dog and leaves the others alone", () => {
    const patch = buildStallCustomerPatch(
      BLANK_CUSTOMER,
      record({ dogs: [{ name: "Loki" }, { name: "Bear" }] }),
      ["https://storage.googleapis.com/b/loki.jpg", undefined],
    );
    expect(patch.dogs).toEqual([
      { id: "dog-1", name: "Loki", photo: "https://storage.googleapis.com/b/loki.jpg" },
      { id: "dog-2", name: "Bear" },
    ]);
  });

  it("records unticked consent as an explicit false with its timestamp", () => {
    const patch = buildStallCustomerPatch(BLANK_CUSTOMER, record({ name: "Sam", capturedAt: "2026-07-26T08:30:00.000Z" }), []);
    expect(patch.marketingConsent).toBe(false);
    expect(patch.photoConsent).toBe(false);
    expect(patch.consentAt).toBe("2026-07-26T08:30:00.000Z");
  });
});

describe("stallWelcomeEmailHtml", () => {
  it("carries the magic link and greets by name when there is one", () => {
    const html = stallWelcomeEmailHtml("https://example.com/link", "Sam");
    expect(html).toContain("https://example.com/link");
    expect(html).toContain("Hi Sam,");
  });

  it("escapes a hostile name rather than interpolating it as markup", () => {
    const html = stallWelcomeEmailHtml("https://example.com/link", "<script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/stall-record.test.ts`
Expected: FAIL, `buildStallCustomerPatch` and `stallWelcomeEmailHtml` are not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/stall-record.ts
// Extend the type-only import from "@/data/customers" to include Dog and StoredCustomer.

/**
 * The dog-{n} id rule, one higher than the highest ever used. This duplicates
 * nextDogId in customers-store.ts deliberately: that module is server-only and this
 * one must stay pure. The unit test pins the behaviour so the copies cannot drift.
 */
function nextStallDogId(existing: { id: string }[]): string {
  const highest = existing.reduce((max, d) => {
    const match = /^dog-(\d+)$/.exec(d.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `dog-${highest + 1}`;
}

/**
 * The Firestore merge patch one stall record becomes.
 *
 * A non-blank record field wins over the existing value, because the stall
 * conversation is the freshest deliberate collection there is. A blank field never
 * blanks anything, mirroring buildCustomerDoc's caution. Email is the exception both
 * ways: it is identity, so it is only written into a doc that has none. Consent is
 * always written, ticked or not, because "no, asked on this date" is a defensible
 * answer and an absent field is not.
 */
export function buildStallCustomerPatch(
  current: StoredCustomer,
  record: StallRecord,
  photoUrls: (string | undefined)[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (record.email && !current.email) patch.email = record.email;
  if (record.name) patch.name = record.name;
  if (record.phone) patch.phone = record.phone;

  const anyAddressField = Object.values(record.address).some(Boolean);
  if (anyAddressField) {
    const merged = {
      line1: record.address.line1 || current.address.line1,
      line2: record.address.line2 || current.address.line2,
      city: record.address.city || current.address.city,
      postcode: record.address.postcode || current.address.postcode,
    };
    patch.address = merged;
    if (merged.postcode) patch.lastPostcode = merged.postcode;
  }

  if (record.dogs.length) {
    const dogs = [...current.dogs];
    record.dogs.forEach((stallDog, i) => {
      const url = photoUrls[i];
      dogs.push({
        id: nextStallDogId(dogs),
        ...stallDog.value,
        ...(url ? { photo: url } : {}),
      });
    });
    patch.dogs = dogs;
  }

  patch.marketingConsent = record.consent.marketing;
  patch.photoConsent = record.consent.photo;
  patch.consentAt = record.capturedAt;
  patch.stallSignupAt = record.capturedAt;

  return patch;
}

/** Escape the characters that matter for safe HTML text interpolation. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The welcome email sent after a stall signup syncs, carrying the magic link so the
 * person's first sign-in lands on the record Michaela just made for them.
 */
export function stallWelcomeEmailHtml(link: string, name?: string): string {
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Welcome to Barking Raw</h1>
    <p>${hi}</p>
    <p>Lovely to meet you at the stall. Your account is ready, with your dog's details already on it.</p>
    <p>Tap the button below to sign in. The link works once and expires shortly, and you can always ask for a fresh one at barkingraw.dog/login.</p>
    <p><a href="${link}" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Sign in</a></p>
    <p style="color:#6b6b6b;font-size:13px">If this was not you, you can ignore this email.</p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
  </div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/stall-record.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stall-record.ts src/lib/stall-record.test.ts
git commit -m "feat: the patch a stall record writes, and the welcome email"
```

---

### Task 3: The stall session token, the PIN comparison, and the throttle

**Files:**
- Create: `src/lib/stall-session.ts`
- Test: `src/lib/stall-session.test.ts`

**Interfaces:**
- Consumes: `node:crypto` only.
- Produces: `STALL_COOKIE_NAME = "br_stall"`, `STALL_SESSION_MAX_AGE_MS`, `deriveStallKey(pin: string, serverSecret: string): Buffer`, `mintStallToken(key: Buffer, now: number, maxAgeMs: number): string`, `verifyStallToken(key: Buffer, token: string, now: number): boolean`, `pinMatches(supplied: string, expected: string): boolean`, `recordAttempt(timestamps: number[], now: number, windowMs: number, max: number): { allowed: boolean; kept: number[] }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/stall-session.test.ts
import { describe, it, expect } from "vitest";
import {
  deriveStallKey,
  mintStallToken,
  pinMatches,
  recordAttempt,
  verifyStallToken,
} from "./stall-session";

const KEY = deriveStallKey("4519", "server-secret");
const NOW = 1_753_500_000_000;

describe("stall tokens", () => {
  it("round-trips a freshly minted token", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW)).toBe(true);
  });

  it("refuses a token after it expires, so a forgotten logout dies on its own", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW + 60_001)).toBe(false);
  });

  it("refuses a token signed with a different key", () => {
    const otherKey = deriveStallKey("9999", "server-secret");
    const token = mintStallToken(otherKey, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW)).toBe(false);
  });

  it("refuses a token whose expiry was tampered with", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    const [, signature] = token.split(".");
    expect(verifyStallToken(KEY, `${NOW + 999_999_999}.${signature}`, NOW)).toBe(false);
  });

  it("refuses garbage rather than throwing", () => {
    expect(verifyStallToken(KEY, "", NOW)).toBe(false);
    expect(verifyStallToken(KEY, "no-dot-here", NOW)).toBe(false);
    expect(verifyStallToken(KEY, ".signature-only", NOW)).toBe(false);
  });

  it("derives a different key from a different server secret, so a leaked cookie cannot be brute-forced to the PIN alone", () => {
    expect(deriveStallKey("4519", "a").equals(deriveStallKey("4519", "b"))).toBe(false);
  });
});

describe("pinMatches", () => {
  it("accepts the right PIN and refuses a wrong one", () => {
    expect(pinMatches("4519", "4519")).toBe(true);
    expect(pinMatches("4518", "4519")).toBe(false);
  });

  it("refuses everything when no PIN is configured, rather than matching empty on empty", () => {
    expect(pinMatches("", "")).toBe(false);
  });
});

describe("recordAttempt", () => {
  it("allows attempts inside the budget and refuses the one over it", () => {
    let timestamps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = recordAttempt(timestamps, NOW + i, 60_000, 5);
      expect(result.allowed).toBe(true);
      timestamps = result.kept;
    }
    expect(recordAttempt(timestamps, NOW + 5, 60_000, 5).allowed).toBe(false);
  });

  it("forgets attempts outside the window, so the budget refills", () => {
    const old = [NOW - 61_000, NOW - 62_000, NOW - 63_000, NOW - 64_000, NOW - 65_000];
    const result = recordAttempt(old, NOW, 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.kept).toEqual([NOW]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/stall-session.test.ts`
Expected: FAIL, cannot resolve `./stall-session`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/stall-session.ts
// Pure token and PIN maths for the stall session. No next/headers and no env reads
// here, so every branch is unit-testable with a fixed clock (mirrors auth-helpers.ts).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const STALL_COOKIE_NAME = "br_stall";

// One market day with slack: set up at eight, forgotten until ten at night, and a
// token that outlives the borrowing of the iPad is exactly what must not exist.
export const STALL_SESSION_MAX_AGE_MS = 14 * 60 * 60 * 1000;

/**
 * The HMAC key for stall tokens: the PIN strengthened with a server-held secret.
 *
 * A short PIN alone would let anybody who captured a cookie brute-force the PIN
 * offline in milliseconds. Mixing in FIREBASE_SERVICE_ACCOUNT (the caller passes it)
 * means forging or reversing a token requires the server credential too.
 */
export function deriveStallKey(pin: string, serverSecret: string): Buffer {
  return createHash("sha256").update(`${pin}\n${serverSecret}`).digest();
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** A stall token: the expiry in plain sight, signed so it cannot be moved. */
export function mintStallToken(key: Buffer, now: number, maxAgeMs: number): string {
  const expires = now + maxAgeMs;
  return `${expires}.${sign(key, String(expires))}`;
}

/** True only for an untampered token that has not yet expired. Never throws. */
export function verifyStallToken(key: Buffer, token: string, now: number): boolean {
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiresPart = token.slice(0, dot);
  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires <= now) return false;
  return safeEqual(sign(key, expiresPart), token.slice(dot + 1));
}

/**
 * Server-side PIN comparison. Hashing both sides first equalises length, so the
 * comparison is constant-time and the length of the real PIN leaks nothing. An
 * empty expected PIN matches nothing: unset means the whole feature is off.
 */
export function pinMatches(supplied: string, expected: string): boolean {
  if (!expected) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest().toString("hex");
  return safeEqual(digest(supplied), digest(expected));
}

/**
 * Sliding-window attempt budget, pure so the route owns the Map and the tests own
 * the clock. Same best-effort-per-instance caveat as the /api/auth/link throttle.
 */
export function recordAttempt(
  timestamps: number[],
  now: number,
  windowMs: number,
  max: number,
): { allowed: boolean; kept: number[] } {
  const kept = timestamps.filter((t) => t > now - windowMs);
  if (kept.length >= max) return { allowed: false, kept };
  kept.push(now);
  return { allowed: true, kept };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/stall-session.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stall-session.ts src/lib/stall-session.test.ts
git commit -m "feat: stall session tokens, PIN comparison and an attempt budget"
```

---

### Task 4: The offline queue state machine

**Files:**
- Create: `src/lib/stall-queue.ts`
- Test: `src/lib/stall-queue.test.ts`

**Interfaces:**
- Consumes: `StallRecord` from `@/lib/stall-record` (types only, the module stays pure).
- Produces: `type QueuedStallRecord = { record: StallRecord; attempts: number; failed: boolean }`, `type StallQueueState = { records: QueuedStallRecord[]; syncedCount: number }`, `EMPTY_QUEUE`, `interface StallQueueStorage { load(): Promise<StallQueueState>; save(state: StallQueueState): Promise<void>; wipe(): Promise<void> }`, `type StallSyncOutcome = "synced" | "retry" | "rejected"`, `type StallSyncSender = (record: StallRecord) => Promise<StallSyncOutcome>`, `normaliseQueueState(raw: unknown): StallQueueState`, `enqueueRecord(state, record): StallQueueState`, `queueSummary(state): { waiting: number; failed: number; synced: number; label: string }`, `syncQueue(state, sender, includeFailed?): Promise<StallQueueState>`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/stall-queue.test.ts
import { describe, it, expect } from "vitest";
import {
  EMPTY_QUEUE,
  enqueueRecord,
  normaliseQueueState,
  queueSummary,
  syncQueue,
  type StallQueueState,
} from "./stall-queue";
import type { StallRecord } from "./stall-record";

function record(clientId: string): StallRecord {
  return {
    clientId,
    capturedAt: "2026-07-26T09:00:00.000Z",
    name: "Sam",
    email: "",
    phone: "",
    address: { line1: "", line2: "", city: "", postcode: "" },
    dogs: [],
    consent: { marketing: false, photo: false },
  };
}

describe("enqueueRecord", () => {
  it("appends a record as waiting with zero attempts", () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    expect(state.records).toEqual([{ record: record("id-0000-1"), attempts: 0, failed: false }]);
  });

  it("replaces a record with the same clientId rather than queueing it twice", () => {
    const once = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const twice = enqueueRecord(once, { ...record("id-0000-1"), name: "Samantha" });
    expect(twice.records).toHaveLength(1);
    expect(twice.records[0].record.name).toBe("Samantha");
  });

  it("does not mutate the state it was given", () => {
    const state: StallQueueState = { records: [], syncedCount: 0 };
    enqueueRecord(state, record("id-0000-1"));
    expect(state.records).toHaveLength(0);
  });
});

describe("queueSummary", () => {
  it("says nothing is saved yet on an empty queue", () => {
    expect(queueSummary(EMPTY_QUEUE).label).toBe("Nothing saved yet");
  });

  it("counts saved and waiting the way Michaela reads them at the table", () => {
    let state: StallQueueState = { records: [], syncedCount: 2 };
    state = enqueueRecord(state, record("id-0000-1"));
    const summary = queueSummary(state);
    expect(summary).toEqual({ waiting: 1, failed: 0, synced: 2, label: "3 saved, 1 waiting to sync" });
  });

  it("says all synced when the queue is drained", () => {
    expect(queueSummary({ records: [], syncedCount: 4 }).label).toBe("All 4 saved and synced");
  });

  it("counts a failed record separately so it is visible rather than silently stuck", () => {
    const state: StallQueueState = {
      records: [{ record: record("id-0000-1"), attempts: 3, failed: true }],
      syncedCount: 0,
    };
    const summary = queueSummary(state);
    expect(summary.failed).toBe(1);
    expect(summary.label).toBe("1 saved, 1 waiting to sync (1 needs a second go)");
  });
});

describe("syncQueue", () => {
  it("removes a synced record and keeps only the count, so nothing personal outlives a sync", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "synced");
    expect(after.records).toHaveLength(0);
    expect(after.syncedCount).toBe(1);
  });

  it("keeps a record the server could not take yet, counting the attempt", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "retry");
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: false }]);
  });

  it("keeps and flags a rejected record instead of losing it or retrying it forever", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => "rejected");
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: true }]);
  });

  it("treats a thrown sender as retry, because no signal must never lose a record", async () => {
    const state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    const after = await syncQueue(state, async () => {
      throw new Error("offline");
    });
    expect(after.records).toEqual([{ record: record("id-0000-1"), attempts: 1, failed: false }]);
  });

  it("skips failed records on an automatic pass and includes them on a manual one", async () => {
    let state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    state = { ...state, records: [{ ...state.records[0], failed: true }] };
    const sent: string[] = [];
    const sender = async (r: StallRecord) => {
      sent.push(r.clientId);
      return "synced" as const;
    };
    const auto = await syncQueue(state, sender);
    expect(sent).toEqual([]);
    expect(auto.records).toHaveLength(1);
    const manual = await syncQueue(state, sender, true);
    expect(sent).toEqual(["id-0000-1"]);
    expect(manual.records).toHaveLength(0);
  });

  it("continues past a retry to sync the records behind it", async () => {
    let state = enqueueRecord(EMPTY_QUEUE, record("id-0000-1"));
    state = enqueueRecord(state, record("id-0000-2"));
    const after = await syncQueue(state, async (r) => (r.clientId === "id-0000-1" ? "retry" : "synced"));
    expect(after.records.map((q) => q.record.clientId)).toEqual(["id-0000-1"]);
    expect(after.syncedCount).toBe(1);
  });
});

describe("normaliseQueueState", () => {
  it("returns an empty queue for anything unreadable rather than throwing", () => {
    expect(normaliseQueueState(undefined)).toEqual(EMPTY_QUEUE);
    expect(normaliseQueueState("junk")).toEqual(EMPTY_QUEUE);
    expect(normaliseQueueState({ records: "junk", syncedCount: "many" })).toEqual(EMPTY_QUEUE);
  });

  it("keeps well-formed entries and drops the rest", () => {
    const state = normaliseQueueState({
      records: [
        { record: record("id-0000-1"), attempts: 2, failed: false },
        { notARecord: true },
      ],
      syncedCount: 3,
    });
    expect(state.records).toEqual([{ record: record("id-0000-1"), attempts: 2, failed: false }]);
    expect(state.syncedCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/stall-queue.test.ts`
Expected: FAIL, cannot resolve `./stall-queue`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/stall-queue.ts
// The offline queue as a pure state machine. Storage (IndexedDB) and network (the
// sync route) sit behind the two interfaces below, so every rule here is tested
// with fakes, the way shipping.ts is tested (spec 10.1.1 calls offline-first the
// requirement most likely to sink the stall form, which is why it gets a module).

import type { StallRecord } from "@/lib/stall-record";

export type QueuedStallRecord = { record: StallRecord; attempts: number; failed: boolean };

export type StallQueueState = { records: QueuedStallRecord[]; syncedCount: number };

export const EMPTY_QUEUE: StallQueueState = { records: [], syncedCount: 0 };

/** Where the queue lives between page loads. The browser adapter uses IndexedDB. */
export interface StallQueueStorage {
  load(): Promise<StallQueueState>;
  save(state: StallQueueState): Promise<void>;
  wipe(): Promise<void>;
}

/**
 * What one sync attempt came to. "synced" removes the record, "retry" keeps it for
 * the next pass (no signal, server busy), "rejected" keeps it but flags it so a
 * record the server refuses outright stops burning the automatic retry loop and
 * waits for a manual sync instead. Nothing is ever dropped unsynced.
 */
export type StallSyncOutcome = "synced" | "retry" | "rejected";

export type StallSyncSender = (record: StallRecord) => Promise<StallSyncOutcome>;

/** Rebuild a queue from whatever storage returned, dropping only what is unreadable. */
export function normaliseQueueState(raw: unknown): StallQueueState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_QUEUE, records: [] };
  const data = raw as Record<string, unknown>;
  const records: QueuedStallRecord[] = Array.isArray(data.records)
    ? (data.records as unknown[]).filter((entry): entry is QueuedStallRecord => {
        if (!entry || typeof entry !== "object") return false;
        const q = entry as Partial<QueuedStallRecord>;
        return Boolean(q.record && typeof q.record === "object" && q.record.clientId);
      }).map((q) => ({ record: q.record, attempts: Number(q.attempts) || 0, failed: q.failed === true }))
    : [];
  const syncedCount = Number(data.syncedCount);
  return { records, syncedCount: Number.isFinite(syncedCount) && syncedCount > 0 ? syncedCount : 0 };
}

/** Add a record, replacing any queued record with the same clientId. Never mutates. */
export function enqueueRecord(state: StallQueueState, record: StallRecord): StallQueueState {
  const kept = state.records.filter((q) => q.record.clientId !== record.clientId);
  return { ...state, records: [...kept, { record, attempts: 0, failed: false }] };
}

/** The line Michaela reads at the table. Derived, so it can never drift from the truth. */
export function queueSummary(state: StallQueueState): {
  waiting: number;
  failed: number;
  synced: number;
  label: string;
} {
  const waiting = state.records.length;
  const failed = state.records.filter((q) => q.failed).length;
  const synced = state.syncedCount;
  const total = synced + waiting;
  let label: string;
  if (total === 0) label = "Nothing saved yet";
  else if (waiting === 0) label = `All ${total} saved and synced`;
  else {
    label = `${total} saved, ${waiting} waiting to sync`;
    if (failed) label += ` (${failed} need${failed === 1 ? "s" : ""} a second go)`;
  }
  return { waiting, failed, synced, label };
}

/**
 * One sync pass, sequential so a weak signal is not asked to carry six photos at
 * once. Failed records only go again when includeFailed is set (the manual button).
 * A thrown sender counts as retry: losing signal mid-request must never lose data.
 */
export async function syncQueue(
  state: StallQueueState,
  sender: StallSyncSender,
  includeFailed = false,
): Promise<StallQueueState> {
  let syncedCount = state.syncedCount;
  const remaining: QueuedStallRecord[] = [];

  for (const queued of state.records) {
    if (queued.failed && !includeFailed) {
      remaining.push(queued);
      continue;
    }
    let outcome: StallSyncOutcome;
    try {
      outcome = await sender(queued.record);
    } catch {
      outcome = "retry";
    }
    if (outcome === "synced") syncedCount += 1;
    else remaining.push({ ...queued, attempts: queued.attempts + 1, failed: outcome === "rejected" });
  }

  return { records: remaining, syncedCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/stall-queue.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stall-queue.ts src/lib/stall-queue.test.ts
git commit -m "feat: the offline queue as a pure, fully tested state machine"
```

---

### Task 5: The PIN session routes and the stall gate

**Files:**
- Create: `src/lib/stall-auth.ts`
- Create: `src/app/api/stall/session/route.ts`
- Modify: `.env.example` (append at the end)

**Interfaces:**
- Consumes: Task 3's whole surface; `getSessionUser` from `@/lib/auth`; `isBrowserSameOrigin` from `@/lib/auth-helpers`; `cookies` from `next/headers`.
- Produces: `hasStallAccess(): Promise<boolean>` and `stallKey(): Buffer | null` from `stall-auth.ts`; `POST /api/stall/session` taking `{ pin }`, `DELETE /api/stall/session`.

No unit test: there is no route-level harness in this repo (the account routes set that
precedent), and every branch of the logic these routes call is covered by Task 3. The
verification step exercises the wiring by hand where it can be without credentials.

- [ ] **Step 1: Write the gate**

```typescript
// src/lib/stall-auth.ts
import "server-only";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { STALL_COOKIE_NAME, deriveStallKey, verifyStallToken } from "@/lib/stall-session";

/**
 * The stall token signing key, or null when no PIN is configured (feature off).
 *
 * The key mixes the PIN with FIREBASE_SERVICE_ACCOUNT so a captured cookie cannot
 * be brute-forced offline back to a short PIN without also holding the server
 * credential. In production the service account is always set; locally without it
 * the tokens are only as strong as the PIN, which for a dev machine is fine.
 */
export function stallKey(): Buffer | null {
  const pin = process.env.STALL_PIN;
  if (!pin) return null;
  return deriveStallKey(pin, process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
}

/**
 * Whether this request may use the stall form and its sync routes.
 *
 * A valid stall cookie (minted by the PIN route) or a signed-in staff member both
 * pass. The stall cookie deliberately is not a Firebase session: it carries no uid
 * and no staff claim, so it opens /stall and /api/stall/* and nothing else. /admin
 * stays behind requireStaff and is unreachable from the borrowed iPad.
 */
export async function hasStallAccess(): Promise<boolean> {
  const key = stallKey();
  if (key) {
    const store = await cookies();
    const token = store.get(STALL_COOKIE_NAME)?.value;
    if (token && verifyStallToken(key, token, Date.now())) return true;
  }
  const user = await getSessionUser();
  return Boolean(user?.staff);
}
```

- [ ] **Step 2: Write the session route**

```typescript
// src/app/api/stall/session/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import {
  STALL_COOKIE_NAME,
  STALL_SESSION_MAX_AGE_MS,
  mintStallToken,
  pinMatches,
  recordAttempt,
} from "@/lib/stall-session";
import { stallKey } from "@/lib/stall-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance, same caveat as the /api/auth/link throttle:
// a platform-level rate limit should back this up. Five tries in fifteen minutes is
// plenty for one mistyped PIN and useless for guessing one.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_ATTEMPTS = 5;
const attemptsByCaller = new Map<string, number[]>();

function callerId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function originOk(req: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl);
}

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });

  const pin = process.env.STALL_PIN;
  if (!pin) {
    return NextResponse.json(
      { ok: false, error: "The stall PIN is not set up yet." },
      { status: 503 },
    );
  }

  const caller = callerId(req);
  const attempt = recordAttempt(
    attemptsByCaller.get(caller) ?? [],
    Date.now(),
    THROTTLE_WINDOW_MS,
    THROTTLE_MAX_ATTEMPTS,
  );
  attemptsByCaller.set(caller, attempt.kept);
  if (!attempt.allowed) {
    console.error("[stall/session] throttled:", caller);
    // Uniform with a wrong PIN, so the throttle gives nothing away.
    return NextResponse.json({ ok: false, error: "That PIN is not right." }, { status: 403 });
  }

  let body: { pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (!pinMatches(String(body.pin ?? ""), pin)) {
    return NextResponse.json({ ok: false, error: "That PIN is not right." }, { status: 403 });
  }

  const key = stallKey();
  if (!key) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 503 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STALL_COOKIE_NAME, mintStallToken(key, Date.now(), STALL_SESSION_MAX_AGE_MS), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(STALL_SESSION_MAX_AGE_MS / 1000),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  // The client wipes its local queue before calling this: the wipe must not depend
  // on the network, and the logout must not depend on the wipe having synced.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(STALL_COOKIE_NAME);
  return res;
}
```

- [ ] **Step 3: Append the env var**

Append to `.env.example`:

```bash
# --- The stall (D.3) ---
# Short staff PIN for /stall on market days. Compared server-side only, never sent
# to the browser. Unset means the stall form is off (staff sessions still get in).
# Make it 6+ characters: the throttle slows online guessing, and the session key
# mixes in FIREBASE_SERVICE_ACCOUNT, but a longer PIN costs Michaela nothing.
STALL_PIN=
```

- [ ] **Step 4: Verify what can be verified without credentials**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: the full suite passes, typecheck clean, lint still exactly 3 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stall-auth.ts src/app/api/stall/session/route.ts .env.example
git commit -m "feat: the stall PIN route, its throttle, and the scoped session cookie"
```

---

### Task 6: The sync route and the Firestore apply

**Files:**
- Create: `src/lib/stall-store.ts`
- Create: `src/app/api/stall/sync/route.ts`

**Interfaces:**
- Consumes: `validateStallRecord`, `buildStallCustomerPatch`, `stallWelcomeEmailHtml`, `type StallRecord` from Task 1 and 2; `docToStoredCustomer` from `@/lib/customers-store`; `getDb`, `getAuthAdmin`, `getBucket`, `COLLECTIONS` from `@/lib/firebase-admin`; `hasStallAccess` from Task 5; `buildActionCodeSettings` from `@/lib/auth-helpers`; `sendEmail` from `@/lib/email`.
- Produces: `applyStallRecord(record: StallRecord): Promise<{ ok: true; created: boolean; uid: string } | { ok: false; retryable: boolean }>` and `POST /api/stall/sync`.

No unit test for `stall-store.ts` itself: it is Firestore orchestration with every decision
already tested one layer down (validation in Task 1, the patch in Task 2), the same split
`customers-store.ts` uses, where the mapper is tested and the transaction wrapper is not.

- [ ] **Step 1: Write the store**

```typescript
// src/lib/stall-store.ts
import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getDb, getAuthAdmin, getBucket, COLLECTIONS } from "@/lib/firebase-admin";
import { docToStoredCustomer } from "@/lib/customers-store";
import { buildStallCustomerPatch, type StallRecord } from "@/lib/stall-record";

// Marker docs recording which clientIds have been applied, and onto which uid.
// Defined here rather than added to COLLECTIONS to keep this track out of the
// shared files two parallel agents may touch. Same store_ prefix convention.
const STALL_SIGNUPS_COLLECTION = "store_stall_signups";

export type ApplyStallResult =
  | { ok: true; created: boolean; uid: string }
  | { ok: false; retryable: boolean };

/**
 * Who this record belongs to.
 *
 * With an email, the same resolution ensureCustomer uses for the Stripe webhook:
 * the existing Firebase user by email, or a fresh one. First magic-link sign-in
 * with that email then lands on the same uid, so the person sees their own dogs.
 * Without an email no account is possible, so the record is keyed stall-{clientId},
 * which cannot collide with a Firebase uid and keeps the data for Michaela.
 */
async function resolveUid(auth: Auth, record: StallRecord): Promise<string> {
  if (!record.email) return `stall-${record.clientId}`;
  try {
    return (await auth.getUserByEmail(record.email)).uid;
  } catch {
    return (await auth.createUser({ email: record.email, displayName: record.name || undefined })).uid;
  }
}

/**
 * Upload each dog's inline photo to our own bucket, returning a signed URL per dog
 * (undefined where there is no photo or the upload failed). A failed photo never
 * fails the record: the signup is the point, the photo is the bonus.
 */
async function uploadPhotos(uid: string, record: StallRecord): Promise<(string | undefined)[]> {
  const bucket = getBucket();
  return Promise.all(
    record.dogs.map(async (dog) => {
      if (!dog.photoData || !bucket) return undefined;
      try {
        const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dog.photoData);
        if (!match) return undefined;
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const file = bucket.file(`dogs/${uid}/${randomUUID()}.${ext}`);
        await file.save(Buffer.from(match[2], "base64"), {
          contentType: `image/${match[1]}`,
          resumable: false,
        });
        // Long-lived signed read URL, same pattern as the account dog photo route.
        const [url] = await file.getSignedUrl({ action: "read", expires: "2500-01-01" });
        return url;
      } catch (err) {
        console.error("[stall-store] photo upload failed, keeping the dog without it:", err);
        return undefined;
      }
    }),
  );
}

/**
 * Apply one stall record, exactly once per clientId.
 *
 * The marker doc store_stall_signups/{clientId} is checked before any work and
 * re-checked inside the transaction that writes the customer, so a record that
 * syncs twice (a retry after an ambiguous failure) merges zero times more, appends
 * zero duplicate dogs, and reports created: false so no second welcome email goes.
 */
export async function applyStallRecord(record: StallRecord): Promise<ApplyStallResult> {
  const db = getDb();
  const auth = getAuthAdmin();
  if (!db || !auth) return { ok: false, retryable: true };

  const markerRef = db.collection(STALL_SIGNUPS_COLLECTION).doc(record.clientId);
  try {
    const marker = await markerRef.get();
    if (marker.exists) {
      return { ok: true, created: false, uid: String(marker.data()?.uid ?? "") };
    }

    const uid = await resolveUid(auth, record);
    const photoUrls = await uploadPhotos(uid, record);
    const customerRef = db.collection(COLLECTIONS.customers).doc(uid);

    const created = await db.runTransaction(async (tx) => {
      const markerSnap = await tx.get(markerRef);
      if (markerSnap.exists) return false;
      const snap = await tx.get(customerRef);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      const patch = buildStallCustomerPatch(current, record, photoUrls);
      tx.set(
        customerRef,
        {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
          ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
      tx.set(markerRef, { uid, syncedAt: FieldValue.serverTimestamp() });
      return true;
    });

    return { ok: true, created, uid };
  } catch (err) {
    console.error("[stall-store] applyStallRecord failed:", err);
    return { ok: false, retryable: true };
  }
}
```

- [ ] **Step 2: Write the sync route**

```typescript
// src/app/api/stall/sync/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin, buildActionCodeSettings } from "@/lib/auth-helpers";
import { getAuthAdmin } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { validateStallRecord, stallWelcomeEmailHtml } from "@/lib/stall-record";
import { applyStallRecord } from "@/lib/stall-store";
import { hasStallAccess } from "@/lib/stall-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Take one queued stall record. The client maps the response onto a queue outcome:
 * 2xx synced, 400 rejected (kept and flagged, never dropped), anything else retry.
 * 401 also tells the iPad its stall session has ended.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  }
  if (!(await hasStallAccess())) {
    return NextResponse.json({ ok: false, error: "The stall session has ended." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad record."] }, { status: 400 });
  }

  const parsed = validateStallRecord(body, new Date().toISOString());
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const result = await applyStallRecord(parsed.record);
  if (!result.ok) {
    // Retryable: the record stays queued on the iPad and comes back later.
    return NextResponse.json({ ok: false, error: "Could not save just now." }, { status: 503 });
  }

  // The welcome email, spec 10.1.1: the magic link goes out afterwards, so the
  // first sign-in lands on this record. Best effort only, a send failure logs and
  // never blocks the sync, and only a freshly created signup gets one, so a
  // retried record cannot email twice.
  if (result.created && parsed.record.email) {
    const auth = getAuthAdmin();
    if (auth) {
      try {
        const link = await auth.generateSignInWithEmailLink(
          parsed.record.email,
          buildActionCodeSettings(siteUrl),
        );
        const sent = await sendEmail(
          parsed.record.email,
          "Welcome to Barking Raw",
          stallWelcomeEmailHtml(link, parsed.record.name || undefined),
        );
        if (!sent) console.error("[stall/sync] welcome email did not send:", parsed.record.email);
      } catch (err) {
        console.error("[stall/sync] welcome email failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify what can be verified without credentials**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: the full suite passes, typecheck clean, lint still exactly 3 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stall-store.ts src/app/api/stall/sync/route.ts
git commit -m "feat: the sync route applies a stall record exactly once, then welcomes"
```

---

### Task 7: The IndexedDB storage adapter

**Files:**
- Create: `src/lib/stall-queue-browser.ts`

**Interfaces:**
- Consumes: `EMPTY_QUEUE`, `normaliseQueueState`, `StallQueueState`, `StallQueueStorage` from Task 4.
- Produces: `createBrowserQueueStorage(): StallQueueStorage`.

No unit test: this is a thin adapter over a browser API vitest's node environment does not
have, and every decision (what a valid state looks like, what happens to junk) is in the
pure module. Kept to plumbing on purpose.

- [ ] **Step 1: Write the adapter**

```typescript
// src/lib/stall-queue-browser.ts
// IndexedDB adapter for the stall queue. IndexedDB rather than localStorage because
// queued records carry a downscaled dog photo as a data URL, and a handful of those
// would blow through localStorage's ~5MB quota on exactly the busy Sunday when the
// queue must not fail. All rules live in stall-queue.ts; this file is plumbing.

import {
  EMPTY_QUEUE,
  normaliseQueueState,
  type StallQueueState,
  type StallQueueStorage,
} from "@/lib/stall-queue";

const DB_NAME = "br-stall";
const STORE = "queue";
const KEY = "state";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createBrowserQueueStorage(): StallQueueStorage {
  return {
    async load(): Promise<StallQueueState> {
      try {
        const db = await openDb();
        try {
          const raw = await requestToPromise(
            db.transaction(STORE, "readonly").objectStore(STORE).get(KEY),
          );
          return normaliseQueueState(raw);
        } finally {
          db.close();
        }
      } catch {
        return { ...EMPTY_QUEUE, records: [] };
      }
    },

    async save(state: StallQueueState): Promise<void> {
      const db = await openDb();
      try {
        await requestToPromise(
          db.transaction(STORE, "readwrite").objectStore(STORE).put(state, KEY),
        );
      } finally {
        db.close();
      }
    },

    /**
     * End of day: clear the store, then delete the whole database, belt and braces,
     * because the iPad is borrowed and nothing personal may remain on it.
     */
    async wipe(): Promise<void> {
      try {
        const db = await openDb();
        try {
          await requestToPromise(db.transaction(STORE, "readwrite").objectStore(STORE).clear());
        } finally {
          db.close();
        }
      } catch {
        // Fall through to the delete, which is the wipe that matters.
      }
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stall-queue-browser.ts
git commit -m "feat: the queue keeps itself in IndexedDB, and wipes to nothing"
```

---

### Task 8: The PIN screen, the form, and the page

**Files:**
- Create: `src/components/stall/PinLogin.tsx`
- Create: `src/components/stall/StallForm.tsx`
- Create: `src/app/stall/page.tsx`

**Interfaces:**
- Consumes: everything above; the house CSS vocabulary (`band band--ink`, `panel`, `field`, `chip`, `btn`) exactly as `DogForm.tsx` uses it. No `globals.css` edits: stall-specific sizing is inline style, because that file is being edited in a parallel worktree.
- Produces: the `/stall` route. No nav link anywhere, staff reach it by URL.

Screen order (spec 10.1.1, every bullet): name, email, phone, address, then per dog name,
breed, born, size, activity, sensitivities, allergies, then "another dog?", then the
consent screen the customer taps themselves, then photos last, then save. Every screen has
Back, Skip and Next, all sized for a thumb. Save enqueues locally first, then pokes sync.

- [ ] **Step 1: Write the PIN screen**

```tsx
// src/components/stall/PinLogin.tsx
"use client";

import { useState } from "react";

/**
 * The stall day gate. The PIN goes to the server and never lives in this bundle;
 * on success the server sets the scoped stall cookie and a reload renders the form.
 */
export default function PinLogin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stall/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That PIN is not right.");
        return;
      }
      window.location.reload();
    } catch {
      setError("No connection. The PIN check needs signal, so try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} style={{ maxWidth: 420, margin: "0 auto" }}>
      <p className="panel__title">Stall day PIN</p>
      <label className="field">
        <span>Enter the PIN to open the signup form</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ fontSize: "1.6rem", textAlign: "center", letterSpacing: "0.4em" }}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p style={{ marginTop: "1.2rem" }}>
        <button
          className="btn btn--solid-ink btn--block"
          type="submit"
          disabled={busy || !pin}
          style={{ fontSize: "1.1rem", padding: "1rem" }}
        >
          {busy ? "Checking..." : "Open the form"}
        </button>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Write the form**

The big one. One component, a screen-per-question state machine. Full code:

```tsx
// src/components/stall/StallForm.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_SENSITIVITIES,
  SENSITIVITY_LABEL,
  type ActivityLevel,
  type DogSize,
  type Sensitivity,
} from "@/data/customers";
import {
  EMPTY_QUEUE,
  enqueueRecord,
  queueSummary,
  syncQueue,
  type StallQueueState,
  type StallSyncOutcome,
} from "@/lib/stall-queue";
import { createBrowserQueueStorage } from "@/lib/stall-queue-browser";
import type { StallRecord } from "@/lib/stall-record";

// A draft dog while the conversation is still going: strings throughout, shaped
// into a StallRecord dog only at save time.
type DraftDog = {
  name: string;
  breed: string;
  bornAt: string;
  size: DogSize | "";
  activity: ActivityLevel | "";
  sensitivities: Sensitivity[];
  allergies: string;
  photoData: string;
};

const EMPTY_DOG: DraftDog = {
  name: "",
  breed: "",
  bornAt: "",
  size: "",
  activity: "",
  sensitivities: [],
  allergies: "",
  photoData: "",
};

type Draft = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  dogs: DraftDog[];
  marketing: boolean;
  photoConsent: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  dogs: [{ ...EMPTY_DOG }],
  marketing: false,
  photoConsent: false,
};

type Screen =
  | "start"
  | "name"
  | "email"
  | "phone"
  | "address"
  | "dog-name"
  | "dog-breed"
  | "dog-born"
  | "dog-size"
  | "dog-activity"
  | "dog-sensitivities"
  | "dog-allergies"
  | "dog-more"
  | "consent"
  | "photos"
  | "saved";

const DOG_SCREENS: Screen[] = [
  "dog-name",
  "dog-breed",
  "dog-born",
  "dog-size",
  "dog-activity",
  "dog-sensitivities",
  "dog-allergies",
];

const SIZES: { value: DogSize; label: string }[] = [
  { value: "small", label: "Wee one" },
  { value: "medium", label: "Middle sized" },
  { value: "large", label: "Big unit" },
];

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "low", label: "Steady" },
  { value: "moderate", label: "Middling" },
  { value: "high", label: "Never stops" },
];

/** Downscale a camera photo to a queue-sized JPEG data URL. */
async function fileToPhotoData(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable image"));
      img.src = url;
    });
    const longest = Math.max(image.width, image.height);
    const scale = longest > 1280 ? 1280 / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The stall signup form, spec 10.1.1: one question per screen, thumb-sized targets,
 * every field skippable, saved locally before any network, synced when signal
 * allows, wiped at end of day because the iPad is borrowed.
 */
export default function StallForm() {
  const storageRef = useRef(createBrowserQueueStorage());
  const syncingRef = useRef(false);
  const queueRef = useRef<StallQueueState>(EMPTY_QUEUE);
  const [queue, setQueueState] = useState<StallQueueState>(EMPTY_QUEUE);
  const [screen, setScreen] = useState<Screen>("start");
  const [dogIndex, setDogIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, dogs: [{ ...EMPTY_DOG }] });
  const [sessionEnded, setSessionEnded] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  const setQueue = useCallback((state: StallQueueState) => {
    queueRef.current = state;
    setQueueState(state);
  }, []);

  /** Post one record; map the response onto a queue outcome. */
  const sender = useCallback(async (record: StallRecord): Promise<StallSyncOutcome> => {
    const res = await fetch("/api/stall/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) return "synced";
    if (res.status === 401) {
      setSessionEnded(true);
      return "retry";
    }
    return res.status === 400 ? "rejected" : "retry";
  }, []);

  const runSync = useCallback(
    async (includeFailed: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const after = await syncQueue(queueRef.current, sender, includeFailed);
        setQueue(after);
        try {
          await storageRef.current.save(after);
        } catch {
          setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [sender, setQueue],
  );

  // Load the queue, then try a sync; keep trying whenever signal comes back.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storageRef.current.load();
      if (cancelled) return;
      setQueue(loaded);
      void runSync(false);
    })();
    const onOnline = () => void runSync(false);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [runSync, setQueue]);

  function patchDog(patch: Partial<DraftDog>) {
    setDraft((d) => ({
      ...d,
      dogs: d.dogs.map((dog, i) => (i === dogIndex ? { ...dog, ...patch } : dog)),
    }));
  }

  const dog = draft.dogs[dogIndex] ?? EMPTY_DOG;

  function next() {
    if (screen === "name") setScreen("email");
    else if (screen === "email") setScreen("phone");
    else if (screen === "phone") setScreen("address");
    else if (screen === "address") setScreen("dog-name");
    else if (screen === "dog-name" && !dog.name.trim()) setScreen("consent");
    else if (DOG_SCREENS.includes(screen)) {
      const at = DOG_SCREENS.indexOf(screen);
      setScreen(at + 1 < DOG_SCREENS.length ? DOG_SCREENS[at + 1] : "dog-more");
    }
  }

  function back() {
    if (screen === "email") setScreen("name");
    else if (screen === "phone") setScreen("email");
    else if (screen === "address") setScreen("phone");
    else if (screen === "dog-name") setScreen("address");
    else if (DOG_SCREENS.includes(screen)) {
      const at = DOG_SCREENS.indexOf(screen);
      setScreen(DOG_SCREENS[at - 1]);
    } else if (screen === "dog-more") setScreen("dog-allergies");
    else if (screen === "consent") setScreen(dog.name.trim() ? "dog-more" : "dog-name");
    else if (screen === "photos") setScreen("consent");
  }

  async function save() {
    const record: StallRecord = {
      clientId: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      address: {
        line1: draft.line1.trim(),
        line2: draft.line2.trim(),
        city: draft.city.trim(),
        postcode: draft.postcode.trim().toUpperCase(),
      },
      dogs: draft.dogs
        .filter((d) => d.name.trim())
        .map((d) => ({
          value: {
            name: d.name.trim(),
            ...(d.breed.trim() ? { breed: d.breed.trim() } : {}),
            ...(d.bornAt ? { bornAt: d.bornAt } : {}),
            ...(d.size ? { size: d.size } : {}),
            ...(d.activity ? { activity: d.activity } : {}),
            ...(d.sensitivities.length ? { sensitivities: d.sensitivities } : {}),
            ...(d.allergies.trim()
              ? { allergies: d.allergies.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) }
              : {}),
          },
          ...(d.photoData ? { photoData: d.photoData } : {}),
        })),
      consent: { marketing: draft.marketing, photo: draft.photoConsent },
    };

    // Local first, always: the queue in memory and on disk before any network.
    const after = enqueueRecord(queueRef.current, record);
    setQueue(after);
    try {
      await storageRef.current.save(after);
    } catch {
      setStorageWarning("Saving to this iPad is not working. Do not close this tab.");
    }
    setScreen("saved");
    void runSync(false);
  }

  async function endDay() {
    if (!window.confirm("End the day? This wipes every record from this iPad. Anything not yet synced is lost.")) {
      return;
    }
    // The wipe is local and unconditional; the logout call is best effort. The
    // borrowed iPad must come up clean even with no signal at the pack-down.
    try {
      await storageRef.current.wipe();
    } catch {
      // deleteDatabase resolving is the best a browser offers; carry on to logout.
    }
    setQueue(EMPTY_QUEUE);
    try {
      await fetch("/api/stall/session", { method: "DELETE" });
    } catch {
      // Offline: the cookie dies on its own within 14 hours.
    }
    window.location.reload();
  }

  async function choosePhoto(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photoData = await fileToPhotoData(file);
      setDraft((d) => ({
        ...d,
        dogs: d.dogs.map((dg, at) => (at === i ? { ...dg, photoData } : dg)),
      }));
    } catch {
      // A photo that will not read is skipped; the signup still saves.
    }
  }

  const summary = queueSummary(queue);
  const namedDogs = draft.dogs.filter((d) => d.name.trim());

  const bigBtn = { fontSize: "1.15rem", padding: "1.05rem 1.4rem" } as const;
  const bigInput = { fontSize: "1.3rem", padding: "0.9rem" } as const;

  /** Back, Skip, Next in a row, all thumb sized. Skip clears the screen's field. */
  function nav(onSkip: () => void, nextLabel = "Next") {
    return (
      <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
        <button className="btn" type="button" onClick={back} style={bigBtn}>
          Back
        </button>
        <button
          className="btn"
          type="button"
          style={{ ...bigBtn, marginLeft: "auto" }}
          onClick={() => {
            onSkip();
            next();
          }}
        >
          Skip
        </button>
        <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
          {nextLabel}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <p className="notice" aria-live="polite" style={{ marginBottom: "1.2rem" }}>
        {summary.label}
        {summary.failed > 0 && screen === "start" && " Use Sync now below."}
      </p>
      {sessionEnded && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          The stall session has ended. Records are safe on this iPad. Reload this page and
          enter the PIN to carry on syncing.
        </p>
      )}
      {storageWarning && (
        <p className="form-error" role="alert" style={{ marginBottom: "1.2rem" }}>
          {storageWarning}
        </p>
      )}

      {screen === "start" && (
        <div className="panel">
          <p className="panel__title">Stall signups</p>
          <p style={{ marginBottom: "1.2rem" }}>
            Records save to this iPad first and sync themselves when there is signal.
          </p>
          <button
            className="btn btn--solid-ink btn--block"
            type="button"
            style={{ fontSize: "1.3rem", padding: "1.2rem" }}
            onClick={() => {
              setDraft({ ...EMPTY_DRAFT, dogs: [{ ...EMPTY_DOG }] });
              setDogIndex(0);
              setScreen("name");
            }}
          >
            New signup
          </button>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={() => void runSync(true)}>
              Sync now
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => void endDay()}
            >
              End the day
            </button>
          </div>
        </div>
      )}

      {screen === "name" && (
        <div className="panel">
          <p className="panel__title">What is their name?</p>
          <label className="field">
            <span>Their name</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              style={bigInput}
            />
          </label>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={() => setScreen("start")}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                setDraft((d) => ({ ...d, name: "" }));
                next();
              }}
            >
              Skip
            </button>
            <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
              Next
            </button>
          </div>
        </div>
      )}

      {screen === "email" && (
        <div className="panel">
          <p className="panel__title">Best email for them?</p>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">
              This is how their account reaches them. Skippable, but without it there is no
              sign-in and no welcome email.
            </span>
          </label>
          {nav(() => setDraft((d) => ({ ...d, email: "" })))}
        </div>
      )}

      {screen === "phone" && (
        <div className="panel">
          <p className="panel__title">A phone number?</p>
          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              style={bigInput}
            />
          </label>
          {nav(() => setDraft((d) => ({ ...d, phone: "" })))}
        </div>
      )}

      {screen === "address" && (
        <div className="panel">
          <p className="panel__title">Where do they live?</p>
          <label className="field">
            <span>First line</span>
            <input
              value={draft.line1}
              onChange={(e) => setDraft({ ...draft, line1: e.target.value })}
              style={bigInput}
            />
          </label>
          <label className="field">
            <span>Second line</span>
            <input
              value={draft.line2}
              onChange={(e) => setDraft({ ...draft, line2: e.target.value })}
              style={bigInput}
            />
          </label>
          <div className="form-grid form-grid--2">
            <label className="field">
              <span>Town or city</span>
              <input
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                style={bigInput}
              />
            </label>
            <label className="field">
              <span>Postcode</span>
              <input
                autoCapitalize="characters"
                value={draft.postcode}
                onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
                style={bigInput}
              />
            </label>
          </div>
          {nav(() => setDraft((d) => ({ ...d, line1: "", line2: "", city: "", postcode: "" })))}
        </div>
      )}

      {screen === "dog-name" && (
        <div className="panel">
          <p className="panel__title">
            {dogIndex === 0 ? "And who is the dog?" : "And the next dog's name?"}
          </p>
          <label className="field">
            <span>Dog&apos;s name</span>
            <input
              autoFocus
              value={dog.name}
              onChange={(e) => patchDog({ name: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">Skipping this skips the dog questions.</span>
          </label>
          {/* Skip here jumps straight to consent rather than calling next(), because
              next() would read the dog name from a closure taken before the clear. */}
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                patchDog({ ...EMPTY_DOG });
                setScreen("consent");
              }}
            >
              Skip
            </button>
            <button className="btn btn--solid-ink" type="button" onClick={next} style={bigBtn}>
              Next
            </button>
          </div>
        </div>
      )}

      {screen === "dog-breed" && (
        <div className="panel">
          <p className="panel__title">What is {dog.name || "the dog"}?</p>
          <label className="field">
            <span>Breed</span>
            <input
              value={dog.breed}
              onChange={(e) => patchDog({ breed: e.target.value })}
              placeholder="Cane Corso, or a good guess"
              style={bigInput}
            />
          </label>
          {nav(() => patchDog({ breed: "" }))}
        </div>
      )}

      {screen === "dog-born" && (
        <div className="panel">
          <p className="panel__title">Roughly when was {dog.name || "the dog"} born?</p>
          <label className="field">
            <span>A rough date is fine</span>
            <input
              type="date"
              value={dog.bornAt}
              onChange={(e) => patchDog({ bornAt: e.target.value })}
              style={bigInput}
            />
            <span className="field__hint">
              &quot;About three&quot; is the first of the month, three years back. It only
              feeds puppy, adult or senior.
            </span>
          </label>
          {nav(() => patchDog({ bornAt: "" }))}
        </div>
      )}

      {screen === "dog-size" && (
        <div className="panel">
          <p className="panel__title">How big is {dog.name || "the dog"}?</p>
          <div className="chips">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.size === s.value}
                onClick={() => patchDog({ size: dog.size === s.value ? "" : s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ size: "" }))}
        </div>
      )}

      {screen === "dog-activity" && (
        <div className="panel">
          <p className="panel__title">How much go has {dog.name || "the dog"} got?</p>
          <div className="chips">
            {ACTIVITY.map((a) => (
              <button
                key={a.value}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.activity === a.value}
                onClick={() => patchDog({ activity: dog.activity === a.value ? "" : a.value })}
              >
                {a.label}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ activity: "" }))}
        </div>
      )}

      {screen === "dog-sensitivities" && (
        <div className="panel">
          <p className="panel__title">Anything {dog.name || "the dog"} struggles with?</p>
          <div className="chips">
            {ALL_SENSITIVITIES.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                style={{ fontSize: "0.95rem", padding: "0.85rem 1.2rem" }}
                aria-pressed={dog.sensitivities.includes(s)}
                onClick={() =>
                  patchDog({
                    sensitivities: dog.sensitivities.includes(s)
                      ? dog.sensitivities.filter((x) => x !== s)
                      : [...dog.sensitivities, s],
                  })
                }
              >
                {SENSITIVITY_LABEL[s]}
              </button>
            ))}
          </div>
          {nav(() => patchDog({ sensitivities: [] }))}
        </div>
      )}

      {screen === "dog-allergies" && (
        <div className="panel">
          <p className="panel__title">Any ingredients that upset them?</p>
          <label className="field">
            <span>Separate with commas</span>
            <input
              value={dog.allergies}
              onChange={(e) => patchDog({ allergies: e.target.value })}
              placeholder="chicken, wheat"
              style={bigInput}
            />
          </label>
          {nav(() => patchDog({ allergies: "" }))}
        </div>
      )}

      {screen === "dog-more" && (
        <div className="panel">
          <p className="panel__title">Another dog at home?</p>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.2rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => {
                setDraft((d) => ({ ...d, dogs: [...d.dogs, { ...EMPTY_DOG }] }));
                setDogIndex(draft.dogs.length);
                setScreen("dog-name");
              }}
            >
              Yes, add one
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={bigBtn}
              onClick={() => setScreen("consent")}
            >
              No, carry on
            </button>
          </div>
        </div>
      )}

      {screen === "consent" && (
        <div className="panel">
          <p className="panel__title">Now this bit is yours, not ours</p>
          <p style={{ marginBottom: "1.2rem" }}>
            Michaela hands you the iPad here. Tap whichever you are happy with, or neither.
            Nothing is ticked unless you tick it.
          </p>
          <div className="chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button
              type="button"
              className="chip"
              style={{ fontSize: "1rem", padding: "1.1rem", textAlign: "left" }}
              aria-pressed={draft.marketing}
              onClick={() => setDraft((d) => ({ ...d, marketing: !d.marketing }))}
            >
              Email me the new stuff and the member offers. Unsubscribe any time.
            </button>
            <button
              type="button"
              className="chip"
              style={{ fontSize: "1rem", padding: "1.1rem", textAlign: "left" }}
              aria-pressed={draft.photoConsent}
              onClick={() => setDraft((d) => ({ ...d, photoConsent: !d.photoConsent }))}
            >
              {namedDogs.length
                ? `You can share ${namedDogs.map((d) => d.name.trim()).join(" and ")}'s photo on Dogs of the Day.`
                : "You can share my dog's photo on Dogs of the Day."}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto" }}
              onClick={() => setScreen("photos")}
            >
              Done, hand it back
            </button>
          </div>
        </div>
      )}

      {screen === "photos" && (
        <div className="panel">
          <p className="panel__title">
            {namedDogs.length ? "Last thing: a photo" : "Last thing"}
          </p>
          {namedDogs.length === 0 && (
            <p style={{ marginBottom: "1.2rem" }}>No dog on this one, so nothing to snap.</p>
          )}
          {draft.dogs.map((d, i) =>
            d.name.trim() ? (
              <div key={i} className="photo-pick" style={{ marginBottom: "1rem" }}>
                {d.photoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="photo-pick__preview" src={d.photoData} alt={d.name} />
                ) : null}
                <label className="btn btn--solid-ink" style={{ ...bigBtn, cursor: "pointer" }}>
                  {d.photoData ? `Retake ${d.name}` : `Snap ${d.name}`}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void choosePhoto(i, e)}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            ) : null,
          )}
          <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.4rem" }}>
            <button className="btn" type="button" style={bigBtn} onClick={back}>
              Back
            </button>
            <button
              className="btn btn--solid-ink"
              type="button"
              style={{ ...bigBtn, marginLeft: "auto", fontSize: "1.25rem" }}
              onClick={() => void save()}
            >
              Save this signup
            </button>
          </div>
        </div>
      )}

      {screen === "saved" && (
        <div className="panel">
          <p className="panel__title">Saved on this iPad</p>
          <p style={{ marginBottom: "1.2rem" }}>
            It will sync itself the moment there is signal. Nothing more to do.
          </p>
          <button
            className="btn btn--solid-ink btn--block"
            type="button"
            style={{ fontSize: "1.3rem", padding: "1.2rem" }}
            onClick={() => setScreen("start")}
          >
            Back to the start
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/stall/page.tsx
import { hasStallAccess } from "@/lib/stall-auth";
import PinLogin from "@/components/stall/PinLogin";
import StallForm from "@/components/stall/StallForm";

export const dynamic = "force-dynamic";

/**
 * The stall iPad form, spec 10.1.1. Reached by URL only, no nav link anywhere:
 * this is a tool on Michaela's table, not a page customers browse to.
 */
export default async function StallPage() {
  const allowed = await hasStallAccess();

  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">The stall</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
            {allowed ? "Sign somebody up" : "Stall day"}
          </h1>
        </div>
      </section>
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 720 }}>
          {allowed ? <StallForm /> : <PinLogin />}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Verify the suite, the types and the lint**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: full suite passes, typecheck clean, lint still exactly the 3 pre-existing errors.
The dev server cannot be meaningfully exercised without `.env.local`, so this task's
browser verification is deferred to whoever holds credentials; the logic layers underneath
are all unit-tested.

- [ ] **Step 5: Commit**

```bash
git add src/app/stall/page.tsx src/components/stall
git commit -m "feat: the stall form, one question per screen, saved before any network"
```

---

### Task 9: Final verification

- [ ] **Step 1: The whole gate**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: 143 baseline tests plus the new stall tests all passing, `tsc` clean, lint at
exactly 3 errors, all in `CartProvider.tsx` and `thank-you/page.tsx`.

- [ ] **Step 2: Confirm nothing shared was touched**

Run: `git diff --stat main...HEAD -- src/app/layout.tsx src/app/page.tsx src/components/Header.tsx src/app/globals.css src/lib/auth-helpers.ts src/lib/firebase-admin.ts`
Expected: empty output.

- [ ] **Step 3: Confirm everything is committed**

Run: `git status --short`
Expected: clean.

---

## Self-review notes

- **Spec 10.1.1 coverage:** one question per screen (Task 8 state machine), large touch
  targets (Task 8 inline sizing), every field skippable (Skip on every screen, lenient
  validation in Task 1), partial records saved (queue write before network in Task 8),
  works with no signal (Tasks 4, 7, 8), photo on the last screen with camera capture
  (Task 8 `photos` screen), consent stays theirs and unticked by default (Task 1 strict
  `=== true`, Task 8 consent screen copy), staff gated (Task 5 gate on page and routes),
  welcome email with magic link afterwards (Task 6), staff PIN with explicit end-of-day
  logout (Tasks 3, 5, 8), nothing left on the device (Tasks 7, 8 wipe), a web page with
  nothing to install (all of it).
- **Membership granted:** the sync write stamps `member: true` on the customer doc, the
  explicit flag the base branch's `isMemberDoc` reads. Section 10.1 satisfied without
  touching `membership.ts`.
- **12.2:** marketing consent unticked at capture, stored with a timestamp.
