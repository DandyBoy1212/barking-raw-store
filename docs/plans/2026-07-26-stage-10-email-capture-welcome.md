# Stage 10: Email Capture and the Welcome Sequence (C.1, C.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One deduplicated subscriber list with source tagging and unticked consent, feeding a four-email pillar welcome sequence (plus a "your code is waiting" email for shop signups) sent by a Vercel cron through Resend.

**Architecture:** All decisions (dedup key, what a repeat submit changes, who is due which email when, unsubscribe token maths) live as pure functions in `src/lib/subscribers.ts`, unit-tested with no Firestore. The email bodies are pure functions in `src/lib/welcome-emails.ts`. Three thin routes (`/api/subscribe`, `/api/unsubscribe`, `/api/cron/welcome`) wire those to Firestore and Resend, following the abandoned-cart cron and `/api/auth/link` patterns exactly. One client component `EmailCapture` renders the form; the home page mounts it in one line.

**Tech Stack:** Next.js 16 route handlers, firebase-admin Firestore, Resend via the existing `sendEmail`, vitest.

## Global Constraints

- British spelling everywhere. NO em dashes anywhere, in code, copy, comments or commits.
- Signing up here does NOT grant membership (spec section 10.1).
- Marketing consent is an UNTICKED checkbox; the stored record keeps what was consented to and when. No consent, no marketing email of any kind.
- Every marketing send carries a working unsubscribe link (spec 12.2).
- Sources are `home` and `shop`; `stall` is reserved in the vocabulary but has no flow.
- Do not create the shop page; the coordinator mounts the shop placement at merge time.
- Baseline gates: 143 tests passing before this work, `npx tsc --noEmit` clean, lint exactly 3 pre-existing errors (CartProvider.tsx, thank-you/page.tsx).
- Commit style: lower-case descriptive clause, body ends `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Decisions taken (recorded here so the report can repeat them)

- **Collection:** `store_subscribers`, doc id = lower-cased trimmed email. The id IS the dedup key: two forms, one doc.
- **Record shape:** `{ email, source, consent, consentText, consentAt, discountCode, codeEmailSentAt, sequencePosition, lastSequenceSentAt, unsubscribedAt, createdAt, updatedAt }`.
- **Repeat submits:** first-touch source wins; consent can be turned ON by a later ticked submit (fresh consentAt) but an unticked repeat never revokes earlier consent (unticked is absence of consent, not a revocation; revocation is the unsubscribe link). Sequence position and issued code are never reset.
- **Code mechanics:** shop-source contacts get one first-order 10% code, ever. The code is created by the cron at send time (not at capture), in `store_discount_codes` with `{ percent: 10, subscriberEmail, used: false, expiresAt: null, createdAt }`, which is exactly the shape checkout validates (exists, !used, unexpired). The code is recorded on the subscriber, so it can never be issued twice.
- **Sequence offsets:** days 0, 4, 9, 14 from consentAt (the fortnight in spec 5.1). Shop contacts get the code email first; the cron sends at most one email per contact per run, so the code email lands one run before pillar one.
- **Send accounting:** the cron advances a contact's position only when `sendEmail` returns true. A failed send logs and retries next run. This is a deliberate improvement over the abandoned cron, which records the send regardless; a welcome sequence that silently skips an email is worse than one that runs a day late.
- **Unsubscribe:** `GET /api/unsubscribe?e=<email>&t=<token>`, token = hex HMAC-SHA256 of the lower-cased email keyed with `UNSUBSCRIBE_SECRET` (falls back to `CRON_SECRET`, then dev-only empty key). Sets `consent: false, unsubscribedAt`, returns a tiny branded HTML page. Idempotent, safe to click twice.
- **Consent gates the code email too** (per the track brief: "Only consented contacts get any of this"), so the shop form copy tells the customer the box is how the code reaches them.

## File Structure

- Create `src/lib/subscribers.ts`: vocabulary, email normalisation, doc mapping, `applySubscription`, `nextWelcomeAction`, unsubscribe token make/verify. Pure, no Firestore.
- Create `src/lib/subscribers.test.ts`.
- Create `src/lib/welcome-emails.ts`: `codeWaitingEmail`, `pillarEmail(i)`, shared footer with unsubscribe link. Pure.
- Create `src/lib/welcome-emails.test.ts`.
- Create `src/app/api/subscribe/route.ts`: POST, `isBrowserSameOrigin`, throttle, upsert via transaction.
- Create `src/app/api/unsubscribe/route.ts`: GET, token check, consent off.
- Create `src/app/api/cron/welcome/route.ts`: GET, CRON_SECRET, find due contacts, send next email.
- Create `src/components/EmailCapture.tsx`: client form, source and offer copy as props.
- Modify `src/app/page.tsx`: one import, one JSX line after the hero section.
- Modify `vercel.json`: add the welcome cron.

---

### Task 1: subscriber vocabulary, normalisation and doc mapping

**Files:**
- Create: `src/lib/subscribers.ts`
- Test: `src/lib/subscribers.test.ts`

**Interfaces:**
- Produces:
  - `type SubscriberSource = "home" | "shop" | "stall"` and `const SUBSCRIBER_SOURCES: readonly SubscriberSource[]` (stall reserved, no flow built).
  - `const CAPTURE_SOURCES = ["home", "shop"] as const` (what /api/subscribe accepts).
  - `const CONSENT_TEXT: Record<"home" | "shop", string>` (the exact sentence shown beside the checkbox, stored on the record).
  - `normaliseSubscriberEmail(raw: unknown): string | null` (trimmed, lower-cased; null unless it looks like `x@y.z`).
  - `type Subscriber = { email: string; source: SubscriberSource; consent: boolean; consentText: string; consentAtMs: number | null; discountCode: string | null; codeEmailSentAtMs: number | null; sequencePosition: number; unsubscribed: boolean }`.
  - `docToSubscriber(id: string, data: Record<string, unknown>): Subscriber` (tolerates any shape ever written; Firestore Timestamps read via a `toMillis` duck-type).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/subscribers.test.ts
import { describe, it, expect } from "vitest";
import {
  normaliseSubscriberEmail,
  docToSubscriber,
  SUBSCRIBER_SOURCES,
  CAPTURE_SOURCES,
  CONSENT_TEXT,
} from "./subscribers";

describe("normaliseSubscriberEmail", () => {
  it("trims and lower-cases, so both forms land on one doc", () => {
    expect(normaliseSubscriberEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });
  it("rejects things that are not an email", () => {
    expect(normaliseSubscriberEmail("")).toBeNull();
    expect(normaliseSubscriberEmail("not-an-email")).toBeNull();
    expect(normaliseSubscriberEmail("a@b")).toBeNull();
    expect(normaliseSubscriberEmail(42)).toBeNull();
    expect(normaliseSubscriberEmail("a b@c.com")).toBeNull();
  });
});

describe("the source vocabulary", () => {
  it("reserves stall without capturing it", () => {
    expect(SUBSCRIBER_SOURCES).toContain("stall");
    expect(CAPTURE_SOURCES).not.toContain("stall");
  });
  it("has consent wording for every capture source", () => {
    for (const s of CAPTURE_SOURCES) expect(CONSENT_TEXT[s].length).toBeGreaterThan(10);
  });
});

describe("docToSubscriber", () => {
  it("reads a full record", () => {
    const at = { toMillis: () => 1000 };
    expect(
      docToSubscriber("sam@example.com", {
        email: "sam@example.com",
        source: "shop",
        consent: true,
        consentText: "tick",
        consentAt: at,
        discountCode: "BR10ABCDE",
        codeEmailSentAt: at,
        sequencePosition: 2,
        unsubscribedAt: null,
      }),
    ).toEqual({
      email: "sam@example.com",
      source: "shop",
      consent: true,
      consentText: "tick",
      consentAtMs: 1000,
      discountCode: "BR10ABCDE",
      codeEmailSentAtMs: 1000,
      sequencePosition: 2,
      unsubscribed: false,
    });
  });
  it("survives an empty doc rather than throwing", () => {
    expect(docToSubscriber("x@y.co", {})).toEqual({
      email: "x@y.co",
      source: "home",
      consent: false,
      consentText: "",
      consentAtMs: null,
      discountCode: null,
      codeEmailSentAtMs: null,
      sequencePosition: 0,
      unsubscribed: false,
    });
  });
  it("reads unsubscribedAt as the unsubscribed flag", () => {
    const s = docToSubscriber("x@y.co", { unsubscribedAt: { toMillis: () => 5 } });
    expect(s.unsubscribed).toBe(true);
  });
  it("clamps a nonsense sequence position", () => {
    expect(docToSubscriber("x@y.co", { sequencePosition: "9" }).sequencePosition).toBe(4);
    expect(docToSubscriber("x@y.co", { sequencePosition: -3 }).sequencePosition).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: FAIL, module `./subscribers` not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/subscribers.ts
// Pure subscriber logic: no Firestore, no next/server, trivially unit-testable
// (mirrors auth-helpers.ts). The doc id in store_subscribers is the lower-cased
// email, which is what makes deduplication automatic: both forms write one doc.

export type SubscriberSource = "home" | "shop" | "stall";

/** Every source the record vocabulary knows. The stall flow is not built yet. */
export const SUBSCRIBER_SOURCES: readonly SubscriberSource[] = ["home", "shop", "stall"];

/** The sources the public /api/subscribe route accepts today. */
export const CAPTURE_SOURCES = ["home", "shop"] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

/**
 * The exact sentence shown beside the unticked checkbox, stored on the record
 * so we always know what was consented to. Defined server-side so a tampered
 * client cannot rewrite what somebody agreed to.
 */
export const CONSENT_TEXT: Record<CaptureSource, string> = {
  home: "Email me free hints and tips from each pillar. Unsubscribe any time.",
  shop: "Email me my 10% first order code and hints and tips from each pillar. Unsubscribe any time.",
};

/** Trimmed and lower-cased, or null unless it looks like an email address. */
export function normaliseSubscriberEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export const WELCOME_SEQUENCE_LENGTH = 4;

export type Subscriber = {
  email: string;
  source: SubscriberSource;
  consent: boolean;
  consentText: string;
  consentAtMs: number | null;
  discountCode: string | null;
  codeEmailSentAtMs: number | null;
  sequencePosition: number;
  unsubscribed: boolean;
};

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Map a Firestore doc to a subscriber, tolerating every shape ever written. */
export function docToSubscriber(id: string, data: Record<string, unknown>): Subscriber {
  const source = SUBSCRIBER_SOURCES.includes(data.source as SubscriberSource)
    ? (data.source as SubscriberSource)
    : "home";
  const rawPosition = Number(data.sequencePosition ?? 0);
  const sequencePosition = Number.isFinite(rawPosition)
    ? Math.min(Math.max(Math.trunc(rawPosition), 0), WELCOME_SEQUENCE_LENGTH)
    : 0;
  return {
    email: String(data.email ?? id),
    source,
    consent: data.consent === true,
    consentText: String(data.consentText ?? ""),
    consentAtMs: toMillis(data.consentAt),
    discountCode: typeof data.discountCode === "string" && data.discountCode ? data.discountCode : null,
    codeEmailSentAtMs: toMillis(data.codeEmailSentAt),
    sequencePosition,
    unsubscribed: toMillis(data.unsubscribedAt) !== null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscribers.ts src/lib/subscribers.test.ts
git commit -m "feat: the subscriber vocabulary, one dedup key, and a tolerant doc reader"
```

---

### Task 2: what a submit changes, and what a repeat submit must not

**Files:**
- Modify: `src/lib/subscribers.ts`
- Test: `src/lib/subscribers.test.ts`

**Interfaces:**
- Consumes: `Subscriber`, `CaptureSource`, `CONSENT_TEXT` from Task 1.
- Produces: `applySubscription(existing: Subscriber | null, input: { source: CaptureSource; consent: boolean }): { create: boolean; consentTurnedOn: boolean; fields: { email?: never; source?: SubscriberSource; consent?: boolean; consentText?: string } }`. The route turns `consentTurnedOn` into a fresh `consentAt` server timestamp. `fields` never contains sequencePosition, discountCode or codeEmailSentAt, which is the idempotency guarantee.

- [ ] **Step 1: Write the failing tests** (append to `src/lib/subscribers.test.ts`)

```ts
import { applySubscription } from "./subscribers";

const existing = (over: Partial<Parameters<typeof docToSubscriber>[1]> = {}) =>
  docToSubscriber("sam@example.com", { email: "sam@example.com", ...over });

describe("applySubscription", () => {
  it("creates a new contact carrying source and consent wording", () => {
    const r = applySubscription(null, { source: "shop", consent: true });
    expect(r.create).toBe(true);
    expect(r.consentTurnedOn).toBe(true);
    expect(r.fields).toEqual({ source: "shop", consent: true, consentText: CONSENT_TEXT.shop });
  });
  it("creates without consent when the box was left unticked", () => {
    const r = applySubscription(null, { source: "home", consent: false });
    expect(r.consentTurnedOn).toBe(false);
    expect(r.fields).toEqual({ source: "home", consent: false, consentText: "" });
  });
  it("keeps the first-touch source on a repeat submit", () => {
    const r = applySubscription(existing({ source: "home", consent: true, consentAt: { toMillis: () => 1 } }), {
      source: "shop",
      consent: true,
    });
    expect(r.create).toBe(false);
    expect(r.fields.source).toBeUndefined();
  });
  it("turns consent on later, with the wording of the form that won it", () => {
    const r = applySubscription(existing({ source: "home", consent: false }), {
      source: "shop",
      consent: true,
    });
    expect(r.consentTurnedOn).toBe(true);
    expect(r.fields.consent).toBe(true);
    expect(r.fields.consentText).toBe(CONSENT_TEXT.shop);
  });
  it("never revokes consent from an unticked repeat", () => {
    const r = applySubscription(
      existing({ source: "home", consent: true, consentText: "kept", consentAt: { toMillis: () => 1 } }),
      { source: "home", consent: false },
    );
    expect(r.consentTurnedOn).toBe(false);
    expect(r.fields.consent).toBeUndefined();
    expect(r.fields.consentText).toBeUndefined();
  });
  it("does not resurrect an unsubscribed contact silently", () => {
    // An unsubscribed contact who ticks the box again HAS re-consented.
    const r = applySubscription(
      existing({ consent: false, unsubscribedAt: { toMillis: () => 5 } }),
      { source: "home", consent: true },
    );
    expect(r.consentTurnedOn).toBe(true);
  });
  it("never touches the sequence position or the code", () => {
    const r = applySubscription(
      existing({ source: "shop", consent: true, consentAt: { toMillis: () => 1 }, sequencePosition: 3, discountCode: "BR10AAAAA" }),
      { source: "shop", consent: true },
    );
    expect(Object.keys(r.fields)).toEqual([]);
  });
});
```

Note the last test also pins re-ticking an already consented box to a no-op (no fresh consentAt), which keeps the recorded consent moment the original one.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: FAIL, `applySubscription` is not exported.

- [ ] **Step 3: Implement** (append to `src/lib/subscribers.ts`)

```ts
/**
 * What one form submit changes on the record. Pure: the route adds timestamps.
 *
 * The rules a repeat submit must obey (spec section 5, and C.1):
 * - first-touch source wins, so the follow up matches the offer they saw first;
 * - a later ticked box turns consent on, recording the wording that won it;
 * - an unticked repeat is the absence of consent, not a revocation, so it
 *   changes nothing (revocation is the unsubscribe link);
 * - sequence position and any issued code are never reset, so a repeat submit
 *   cannot restart the emails or claim the 10% twice.
 */
export function applySubscription(
  existing: Subscriber | null,
  input: { source: CaptureSource; consent: boolean },
): {
  create: boolean;
  consentTurnedOn: boolean;
  fields: { source?: SubscriberSource; consent?: boolean; consentText?: string };
} {
  if (!existing) {
    return {
      create: true,
      consentTurnedOn: input.consent,
      fields: {
        source: input.source,
        consent: input.consent,
        consentText: input.consent ? CONSENT_TEXT[input.source] : "",
      },
    };
  }
  if (input.consent && !existing.consent) {
    return {
      create: false,
      consentTurnedOn: true,
      fields: { consent: true, consentText: CONSENT_TEXT[input.source] },
    };
  }
  return { create: false, consentTurnedOn: false, fields: {} };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscribers.ts src/lib/subscribers.test.ts
git commit -m "feat: a repeat submit cannot reset the sequence, re-claim the code, or revoke consent"
```

---

### Task 3: who is due which email when

**Files:**
- Modify: `src/lib/subscribers.ts`
- Test: `src/lib/subscribers.test.ts`

**Interfaces:**
- Consumes: `Subscriber`, `WELCOME_SEQUENCE_LENGTH`.
- Produces:
  - `const WELCOME_OFFSETS_DAYS = [0, 4, 9, 14] as const` (day per pillar email, from consentAt).
  - `type WelcomeAction = { type: "code" } | { type: "pillar"; index: 0 | 1 | 2 | 3 } | null`.
  - `nextWelcomeAction(s: Subscriber, nowMs: number): WelcomeAction`. Rules: no consent or unsubscribed means null; a shop contact with no codeEmailSentAtMs gets `{ type: "code" }` before anything else; otherwise pillar `i = sequencePosition` when `nowMs >= consentAtMs + offsets[i] days`; null when the sequence is finished or nothing is due yet.

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { nextWelcomeAction, WELCOME_OFFSETS_DAYS } from "./subscribers";

const DAY = 24 * 60 * 60 * 1000;

describe("nextWelcomeAction", () => {
  const base = { consent: true, consentAt: { toMillis: () => 0 } };
  it("sends nothing without consent, ever", () => {
    expect(nextWelcomeAction(existing({ consent: false }), 99 * DAY)).toBeNull();
  });
  it("sends nothing after an unsubscribe, even with consent still true in the doc", () => {
    expect(
      nextWelcomeAction(existing({ ...base, unsubscribedAt: { toMillis: () => 1 } }), 99 * DAY),
    ).toBeNull();
  });
  it("gives a consented shop contact the code email first", () => {
    expect(nextWelcomeAction(existing({ ...base, source: "shop" }), 0)).toEqual({ type: "code" });
  });
  it("home contacts go straight into the pillar sequence on day 0", () => {
    expect(nextWelcomeAction(existing({ ...base, source: "home" }), 0)).toEqual({
      type: "pillar",
      index: 0,
    });
  });
  it("a shop contact whose code email went out moves on to the pillars", () => {
    expect(
      nextWelcomeAction(
        existing({ ...base, source: "shop", codeEmailSentAt: { toMillis: () => 0 } }),
        1,
      ),
    ).toEqual({ type: "pillar", index: 0 });
  });
  it("holds each pillar email until its day", () => {
    const s = existing({ ...base, sequencePosition: 1 });
    expect(nextWelcomeAction(s, 3 * DAY)).toBeNull();
    expect(nextWelcomeAction(s, 4 * DAY)).toEqual({ type: "pillar", index: 1 });
  });
  it("finishes after the fourth email", () => {
    expect(nextWelcomeAction(existing({ ...base, sequencePosition: 4 }), 99 * DAY)).toBeNull();
  });
  it("anchors the fortnight on the consent moment", () => {
    const s = existing({ ...base, consentAt: { toMillis: () => 10 * DAY }, sequencePosition: 3 });
    expect(nextWelcomeAction(s, 23 * DAY)).toBeNull();
    expect(nextWelcomeAction(s, 24 * DAY)).toEqual({ type: "pillar", index: 3 });
  });
  it("spreads over the first fortnight", () => {
    expect(WELCOME_OFFSETS_DAYS).toEqual([0, 4, 9, 14]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: FAIL, `nextWelcomeAction` not exported.

- [ ] **Step 3: Implement** (append)

```ts
/** Day offsets from consent for the four pillar emails: the first fortnight. */
export const WELCOME_OFFSETS_DAYS = [0, 4, 9, 14] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type WelcomeAction = { type: "code" } | { type: "pillar"; index: 0 | 1 | 2 | 3 } | null;

/**
 * The one email this contact is due right now, or null.
 *
 * No consent, no marketing sequence, and the code email counts as marketing
 * (the shop form says the ticked box is how the code arrives). Shop contacts
 * get "your code is waiting" before pillar one. The cron sends at most one
 * email per contact per run, so the code email lands a run ahead of pillar one
 * rather than in the same inbox minute.
 */
export function nextWelcomeAction(s: Subscriber, nowMs: number): WelcomeAction {
  if (!s.consent || s.unsubscribed || s.consentAtMs === null) return null;
  if (s.source === "shop" && s.codeEmailSentAtMs === null) return { type: "code" };
  const index = s.sequencePosition;
  if (index >= WELCOME_SEQUENCE_LENGTH) return null;
  if (nowMs >= s.consentAtMs + WELCOME_OFFSETS_DAYS[index] * DAY_MS) {
    return { type: "pillar", index: index as 0 | 1 | 2 | 3 };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscribers.ts src/lib/subscribers.test.ts
git commit -m "feat: the scheduler knows who is due which welcome email when"
```

---

### Task 4: the unsubscribe token

**Files:**
- Modify: `src/lib/subscribers.ts`
- Test: `src/lib/subscribers.test.ts`

**Interfaces:**
- Produces:
  - `unsubscribeToken(email: string, secret: string): string` (hex HMAC-SHA256 of the lower-cased email).
  - `verifyUnsubscribeToken(email: string, token: string, secret: string): boolean` (constant-time compare).
  - `unsubscribeUrl(siteUrl: string, email: string, secret: string): string` (`{site}/api/unsubscribe?e=...&t=...`, URL-encoded).
- Uses `node:crypto` (createHmac, timingSafeEqual). This module stays importable by vitest (node environment) and by route handlers; it is not imported by client components.

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "./subscribers";

describe("unsubscribe tokens", () => {
  it("verifies its own token", () => {
    const t = unsubscribeToken("sam@example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", t, "s3cret")).toBe(true);
  });
  it("is case-insensitive on the email, matching the dedup key", () => {
    const t = unsubscribeToken("Sam@Example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", t, "s3cret")).toBe(true);
  });
  it("rejects a forged token, a wrong email, and a wrong secret", () => {
    const t = unsubscribeToken("sam@example.com", "s3cret");
    expect(verifyUnsubscribeToken("sam@example.com", "deadbeef", "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("eve@example.com", t, "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("sam@example.com", t, "other")).toBe(false);
  });
  it("rejects garbage tokens rather than throwing", () => {
    expect(verifyUnsubscribeToken("sam@example.com", "", "s3cret")).toBe(false);
    expect(verifyUnsubscribeToken("sam@example.com", "zz not hex", "s3cret")).toBe(false);
  });
  it("builds the link the email footer carries", () => {
    const url = unsubscribeUrl("https://barkingraw.dog", "sam+dog@example.com", "s3cret");
    expect(url.startsWith("https://barkingraw.dog/api/unsubscribe?e=sam%2Bdog%40example.com&t=")).toBe(true);
  });
  it("strips a trailing slash from the site url", () => {
    const url = unsubscribeUrl("https://barkingraw.dog/", "a@b.co", "s");
    expect(url.includes(".dog/api/")).toBe(true);
    expect(url.includes("//api/")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: FAIL, `unsubscribeToken` not exported.

- [ ] **Step 3: Implement** (append; add `import { createHmac, timingSafeEqual } from "node:crypto";` at the top of the file)

```ts
/**
 * Signed unsubscribe links (spec 12.2: a working unsubscribe in every
 * marketing send). The token is an HMAC of the lower-cased email, so the link
 * proves it came from us without a database round trip, and one contact's
 * link cannot unsubscribe anybody else.
 */
export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email, secret), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  if (given.length !== expected.length || expected.length === 0) return false;
  return timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, email: string, secret: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const e = email.trim().toLowerCase();
  return `${base}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e, secret)}`;
}
```

Note: `Buffer.from("zz not hex", "hex")` does not throw, it truncates, so the length guard is what rejects it. The try/catch is belt and braces.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/subscribers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subscribers.ts src/lib/subscribers.test.ts
git commit -m "feat: signed unsubscribe links that prove themselves without a lookup"
```

---

### Task 5: the five email bodies

**Files:**
- Create: `src/lib/welcome-emails.ts`
- Test: `src/lib/welcome-emails.test.ts`

**Interfaces:**
- Consumes: `unsubscribeUrl` from Task 4.
- Produces:
  - `type WelcomeEmail = { subject: string; html: string }`.
  - `PILLARS: readonly { name: string; path: string }[]` in order: Good Food `/good-food`, Comfy Walks `/comfy-walks`, Fun & Games `/fun-and-games`, Cosy Sleep `/cosy-sleep`.
  - `codeWaitingEmail(args: { code: string; siteUrl: string; email: string; secret: string }): WelcomeEmail`.
  - `pillarEmail(index: 0 | 1 | 2 | 3, args: { siteUrl: string; email: string; secret: string }): WelcomeEmail`.
- House style: same wrapper div as `signInEmailHtml` (Arial, 520px, #0b0b0b), uppercase 900-weight h1, pill button, grey small print, British spelling, no em dashes, and every email ends with an unsubscribe line linking to `unsubscribeUrl`.
- Honesty standard (dossier): no disease-causation claims, no "dogs are wolves", no invented percentages. The Good Food email leans on the open versus closed declaration contrast and the real label facts already used on the home page. The other three teach in the plain confirming voice of the pillar lines in spec section 2.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/welcome-emails.test.ts
import { describe, it, expect } from "vitest";
import { PILLARS, codeWaitingEmail, pillarEmail } from "./welcome-emails";

const args = { siteUrl: "https://barkingraw.dog", email: "sam@example.com", secret: "s" };

describe("PILLARS", () => {
  it("is the four pillars, in ring order, at their agreed paths", () => {
    expect(PILLARS.map((p) => p.name)).toEqual([
      "Good Food",
      "Comfy Walks",
      "Fun & Games",
      "Cosy Sleep",
    ]);
    expect(PILLARS.map((p) => p.path)).toEqual([
      "/good-food",
      "/comfy-walks",
      "/fun-and-games",
      "/cosy-sleep",
    ]);
  });
});

describe("codeWaitingEmail", () => {
  it("carries the code and a link to the shop", () => {
    const e = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(e.subject.toLowerCase()).toContain("code");
    expect(e.html).toContain("BR10ABCDE");
    expect(e.html).toContain("https://barkingraw.dog");
  });
  it("carries a working unsubscribe link", () => {
    const e = codeWaitingEmail({ code: "BR10ABCDE", ...args });
    expect(e.html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
  });
});

describe("pillarEmail", () => {
  it("each teaches its own pillar and links to its page", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const e = pillarEmail(i, args);
      expect(e.subject).toBeTruthy();
      expect(e.html).toContain(`https://barkingraw.dog${PILLARS[i].path}`);
      expect(e.html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
    }
  });
  it("keeps the house style: no em dashes anywhere", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const e = pillarEmail(i, args);
      expect(e.subject.includes("—")).toBe(false);
      expect(e.html.includes("—")).toBe(false);
    }
  });
  it("stays inside the dossier: no wolf claims, no dewormer myth, no scare words", () => {
    for (const i of [0, 1, 2, 3] as const) {
      const html = pillarEmail(i, args).html.toLowerCase();
      for (const banned of ["wolves", "wolf", "dewormer", "kills", "poison", "toxic"]) {
        expect(html.includes(banned)).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/welcome-emails.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/welcome-emails.ts
// The five welcome sends: "your code is waiting" plus one email per pillar.
// Pure functions returning subject and HTML, in the house email style set by
// signInEmailHtml: Arial, 520px, black on white, bold uppercase heading, pill
// button, grey small print. British spelling, no em dashes. Every send ends
// with an unsubscribe line, because every one of these is marketing (12.2).
// Claims follow docs/research-dossier.md: the deception is provable, the
// disease-causation is not, so we teach and never scare.

import { unsubscribeUrl } from "./subscribers";

export type WelcomeEmail = { subject: string; html: string };

export const PILLARS = [
  { name: "Good Food", path: "/good-food" },
  { name: "Comfy Walks", path: "/comfy-walks" },
  { name: "Fun & Games", path: "/fun-and-games" },
  { name: "Cosy Sleep", path: "/cosy-sleep" },
] as const;

type CommonArgs = { siteUrl: string; email: string; secret: string };

function wrap(heading: string, bodyHtml: string, cta: { href: string; label: string }, args: CommonArgs): string {
  const unsub = unsubscribeUrl(args.siteUrl, args.email, args.secret);
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">${heading}</h1>
    ${bodyHtml}
    <p><a href="${cta.href}" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">${cta.label}</a></p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
    <p style="color:#6b6b6b;font-size:13px">Had enough? <a href="${unsub}" style="color:#6b6b6b">Unsubscribe</a> and we will not email you again.</p>
  </div>`;
}

export function codeWaitingEmail(args: { code: string } & CommonArgs): WelcomeEmail {
  const body = `
    <p>Hi,</p>
    <p>Here is the 10% off your first order we promised. It works once, on anything in the shop.</p>
    <p style="font-size:22px;font-weight:900">Your code: <span style="background:#0b0b0b;color:#fff;padding:4px 10px;border-radius:6px">${args.code}</span></p>
    <p>Over the next fortnight we will send you four short emails, one for each of the four things a dog needs before training will ever stick. No fluff, no scare stories, just what the labels and the biology actually say.</p>`;
  return {
    subject: "Your 10% code is waiting",
    html: wrap("Your code is waiting.", body, { href: args.siteUrl, label: "Use it in the shop" }, args),
  };
}

const PILLAR_BODIES: { subject: string; heading: string; body: string; ctaLabel: string }[] = [
  {
    subject: "Good Food: what goes in shows up in everything else",
    heading: "Good food first.",
    body: `
    <p>Hi,</p>
    <p>Get these four right and your dog will lap up training: good food, comfy walks, fun and games, cosy sleep. Most people start with training. That is the last bit, not the first. This is email one of four, and it starts where everything starts.</p>
    <p><b>What goes in shows up in everything else.</b> Coat, teeth, energy, stools, even mood.</p>
    <p>UK law lets a label say "cereals" and "meat and animal derivatives" without naming a single ingredient. That is why a "beef" treat can be 2% beef with sugars listed above the meat, straight off the pack. We choose the opposite: open declaration, every ingredient named. If it says beef trachea, that is the list.</p>
    <p>Your dog is not a bin. Dogs can digest some starch, but from teeth to gut they are built primarily for meat, and they thrive on meat-rich, minimally processed food.</p>`,
    ctaLabel: "Read the Good Food page",
  },
  {
    subject: "Comfy Walks: is the walk actually comfortable?",
    heading: "Comfy walks.",
    body: `
    <p>Hi,</p>
    <p>Email two of four. A dog that is choking on a collar is not enjoying the walk. You are just dragging it.</p>
    <p>Comfort changes behaviour. A fitted harness spreads the pressure a collar puts on the throat, and a longer line gives the nose room to work, which is most of what a walk is for. A dog that is comfortable pulls less, sniffs more, and comes home walked rather than wound up.</p>
    <p>Three things worth checking today: does the harness rub behind the legs, can you fit two fingers under every strap, and is the lead long enough to let the head drop to the ground?</p>`,
    ctaLabel: "Read the Comfy Walks page",
  },
  {
    subject: "Fun & Games: a bored dog finds his own fun",
    heading: "Fun and games.",
    body: `
    <p>Hi,</p>
    <p>Email three of four. A bored dog will find his own fun. You won't like it.</p>
    <p>Chewed skirting, dug beds and a shredded post pile are rarely naughtiness. They are a clever animal with an empty afternoon. Ten minutes of sniffing and working for food tires a dog in a way a long march does not, because the nose is doing the thinking.</p>
    <p>Easy wins: scatter part of a meal in the grass, roll a towel around some treats, or use a lickimat or snuffle mat and let the dog work. Work first, then rest. That order matters, and email four is about the rest.</p>`,
    ctaLabel: "Read the Fun & Games page",
  },
  {
    subject: "Cosy Sleep: an overtired dog can't think straight",
    heading: "Cosy sleep.",
    body: `
    <p>Hi,</p>
    <p>Email four of four. An overtired dog can't think straight.</p>
    <p>Adult dogs sleep a large part of the day when they are allowed to, and puppies need even more. A dog that never properly switches off gets scratchy, mouthy and deaf to everything it knows, much like the rest of us.</p>
    <p>What helps is simple: a bed somewhere calm away from the household traffic, a routine that puts proper rest after play, and the confidence to let a settled dog lie. Get all four of these right, food, walks, games and sleep, and training stops being a battle, because the dog finally has everything it needs to listen.</p>`,
    ctaLabel: "Read the Cosy Sleep page",
  },
];

export function pillarEmail(index: 0 | 1 | 2 | 3, args: CommonArgs): WelcomeEmail {
  const p = PILLAR_BODIES[index];
  const href = `${args.siteUrl.replace(/\/$/, "")}${PILLARS[index].path}`;
  return {
    subject: p.subject,
    html: wrap(p.heading, p.body, { href, label: p.ctaLabel }, args),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/welcome-emails.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/welcome-emails.ts src/lib/welcome-emails.test.ts
git commit -m "feat: the code email and the four pillar emails, taught in the house voice"
```

---

### Task 6: POST /api/subscribe

**Files:**
- Create: `src/app/api/subscribe/route.ts`

**Interfaces:**
- Consumes: `normaliseSubscriberEmail`, `CAPTURE_SOURCES`, `docToSubscriber`, `applySubscription` (Tasks 1 to 2); `isBrowserSameOrigin`; `getDb`, `COLLECTIONS`.
- Produces: `POST /api/subscribe` with JSON body `{ email, source, consent }`; responds `{ ok: true }` on success and on throttle, 400 on bad input, 403 cross-origin, 503 no db. The doc write runs in a transaction on `store_subscribers/{email}`.
- Requires `COLLECTIONS.subscribers = "store_subscribers"` added to `src/lib/firebase-admin.ts`.

- [ ] **Step 1: Add the collection name**

In `src/lib/firebase-admin.ts`, add `subscribers: "store_subscribers",` to `COLLECTIONS` (after `customers`).

- [ ] **Step 2: Implement the route**

```ts
// src/app/api/subscribe/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import {
  CAPTURE_SOURCES,
  type CaptureSource,
  applySubscription,
  docToSubscriber,
  normaliseSubscriberEmail,
} from "@/lib/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance, same shape and reasoning as /api/auth/link.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_REQUESTS = 5;
const recentRequestsByEmail = new Map<string, number[]>();

function isThrottled(email: string): boolean {
  const now = Date.now();
  const cutoff = now - THROTTLE_WINDOW_MS;
  for (const [key, timestamps] of recentRequestsByEmail) {
    const kept = timestamps.filter((t) => t > cutoff);
    if (kept.length === 0) recentRequestsByEmail.delete(key);
    else recentRequestsByEmail.set(key, kept);
  }
  const timestamps = recentRequestsByEmail.get(email) ?? [];
  if (timestamps.length >= THROTTLE_MAX_REQUESTS) return true;
  timestamps.push(now);
  recentRequestsByEmail.set(email, timestamps);
  return false;
}

/**
 * One list, deduplicated on the lower-cased email, which is the doc id.
 * Signing up here does NOT grant membership (spec 10.1). A repeat submit is
 * idempotent: applySubscription never touches the sequence position or an
 * issued code, and an unticked box never revokes earlier consent.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { email?: unknown; source?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = normaliseSubscriberEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }
  if (!CAPTURE_SOURCES.includes(body.source as CaptureSource)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const source = body.source as CaptureSource;
  const consent = body.consent === true;

  if (isThrottled(email)) {
    // Uniform response, same as /api/auth/link: no signal that the throttle tripped.
    console.error("[subscribe] throttled:", email);
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Sign-up is not switched on yet." }, { status: 503 });
  }

  const ref = db.collection(COLLECTIONS.subscribers).doc(email);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists
        ? docToSubscriber(email, (snap.data() ?? {}) as Record<string, unknown>)
        : null;
      const change = applySubscription(existing, { source, consent });
      const fields: Record<string, unknown> = {
        ...change.fields,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (change.create) {
        fields.email = email;
        fields.sequencePosition = 0;
        fields.createdAt = FieldValue.serverTimestamp();
      }
      if (change.consentTurnedOn) {
        fields.consentAt = FieldValue.serverTimestamp();
        // Re-consent after an unsubscribe starts a clean slate.
        fields.unsubscribedAt = null;
      }
      tx.set(ref, fields, { merge: true });
    });
  } catch (err) {
    console.error("[subscribe] write failed:", err);
    return NextResponse.json({ error: "Something went wrong saving that." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify the gates**

Run: `npx tsc --noEmit` (clean) and `npx vitest run` (all passing).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/subscribe/route.ts src/lib/firebase-admin.ts
git commit -m "feat: one subscribe route, deduplicated, throttled, and idempotent on repeats"
```

---

### Task 7: GET /api/unsubscribe

**Files:**
- Create: `src/app/api/unsubscribe/route.ts`

**Interfaces:**
- Consumes: `normaliseSubscriberEmail`, `verifyUnsubscribeToken` (Tasks 1, 4); `getDb`, `COLLECTIONS`.
- Produces: `GET /api/unsubscribe?e=<email>&t=<token>` returning a small branded HTML page. Valid token: sets `consent: false, unsubscribedAt: serverTimestamp()` (merge, idempotent). Invalid: a polite failure page, 400. Secret resolution `process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || ""` is shared with the cron via a tiny helper exported from the subscribers module? No: keep env reading in routes; both routes use the same two-line expression.
- No same-origin guard: the link is opened from an email client, which is exactly the cross-origin GET the guard would refuse. The HMAC is the guard.

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/unsubscribe/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { normaliseSubscriberEmail, verifyUnsubscribeToken } from "@/lib/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#fff;color:#0b0b0b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:520px;padding:2rem;text-align:center">
<h1 style="font-weight:900;text-transform:uppercase">${title}</h1>
<p>${body}</p>
<p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * The unsubscribe link from every marketing email (spec 12.2). A GET because
 * it is opened straight from an email client; the signed token is what makes
 * that safe, since only our own emails can carry a valid one. Idempotent, so
 * clicking twice is fine.
 */
export async function GET(req: NextRequest) {
  const email = normaliseSubscriberEmail(req.nextUrl.searchParams.get("e"));
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  if (!email || !verifyUnsubscribeToken(email, token, secret)) {
    const res = page("That link did not work.", "It may have been cut short by your email app. Reply to any of our emails and a human will take you off the list.");
    return new NextResponse(await res.text(), { status: 400, headers: res.headers });
  }
  const db = getDb();
  if (!db) {
    const res = page("Not quite.", "We could not reach the list just now. Try the link again in a minute.");
    return new NextResponse(await res.text(), { status: 503, headers: res.headers });
  }
  try {
    await db.collection(COLLECTIONS.subscribers).doc(email).set(
      { consent: false, unsubscribedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error("[unsubscribe] write failed:", err);
    const res = page("Not quite.", "We could not reach the list just now. Try the link again in a minute.");
    return new NextResponse(await res.text(), { status: 503, headers: res.headers });
  }
  return page("You are unsubscribed.", "No more marketing email from us. Order and delivery emails still arrive when you buy something.");
}
```

- [ ] **Step 2: Verify the gates**

Run: `npx tsc --noEmit` and `npx vitest run`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/unsubscribe/route.ts
git commit -m "feat: a signed unsubscribe link that turns consent off and says so"
```

---

### Task 8: the welcome cron

**Files:**
- Create: `src/app/api/cron/welcome/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `docToSubscriber`, `nextWelcomeAction` (Tasks 1, 3); `codeWaitingEmail`, `pillarEmail` (Task 5); `getDb`, `COLLECTIONS`, `sendEmail`.
- Produces: `GET /api/cron/welcome`, CRON_SECRET-guarded like the other crons, JSON summary `{ scanned, codes, pillars, failures }`.
- One email per contact per run. Position advances only when `sendEmail` returns true (deliberate improvement over the abandoned cron, noted in the plan header). Codes are `BR10` + 5 random chars via the same `makeCode` shape the abandoned cron uses, written to `store_discount_codes` before the send, and recorded on the subscriber with `codeEmailSentAt` after a successful send. If the send fails after the code was created, the next run reuses the recorded `discountCode` rather than minting another.

Wait: recording the code on the subscriber must happen when the code is created, not only after a successful send, or a failed send re-mints. Order per contact: if no `discountCode`, mint and write code doc and `discountCode` field first; then send; then set `codeEmailSentAt` only on success.

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/cron/welcome/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { docToSubscriber, nextWelcomeAction } from "@/lib/subscribers";
import { codeWaitingEmail, pillarEmail, PILLARS } from "@/lib/welcome-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCode(percent: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BR${percent}${rand}`;
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret set = allow (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The welcome sequence, same pattern as the abandoned-cart cron: find who is
 * due, send the next email, record it, so a re-run is harmless. One email per
 * contact per run. The position only advances when the send succeeded, so a
 * Resend failure retries tomorrow rather than silently skipping an email.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ skipped: "no db" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  const now = Date.now();
  let codes = 0;
  let pillars = 0;
  let failures = 0;

  const snap = await db
    .collection(COLLECTIONS.subscribers)
    .where("consent", "==", true)
    .limit(500)
    .get();

  for (const doc of snap.docs) {
    const s = docToSubscriber(doc.id, doc.data() as Record<string, unknown>);
    const action = nextWelcomeAction(s, now);
    if (!action) continue;
    const emailArgs = { siteUrl, email: s.email, secret };

    if (action.type === "code") {
      let code = s.discountCode;
      if (!code) {
        code = makeCode(10);
        await db.collection(COLLECTIONS.discountCodes).doc(code).set({
          percent: 10,
          subscriberEmail: s.email,
          used: false,
          expiresAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        // Recorded before the send, so a failed send reuses this code
        // tomorrow instead of minting a second one.
        await doc.ref.set({ discountCode: code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      const { subject, html } = codeWaitingEmail({ code, ...emailArgs });
      if (await sendEmail(s.email, subject, html)) {
        await doc.ref.set({ codeEmailSentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        codes++;
      } else {
        console.error("[cron/welcome] code email failed:", s.email);
        failures++;
      }
      continue;
    }

    const { subject, html } = pillarEmail(action.index, emailArgs);
    if (await sendEmail(s.email, subject, html)) {
      await doc.ref.set(
        {
          sequencePosition: action.index + 1,
          lastSequenceSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      pillars++;
    } else {
      console.error("[cron/welcome] pillar email failed:", s.email, PILLARS[action.index].name);
      failures++;
    }
  }

  return NextResponse.json({ scanned: snap.size, codes, pillars, failures });
}
```

- [ ] **Step 2: Add the cron schedule**

In `vercel.json`, add `{ "path": "/api/cron/welcome", "schedule": "30 8 * * *" }` to the crons array (after abandoned at 8:00 and digest at 7:00).

- [ ] **Step 3: Verify the gates**

Run: `npx tsc --noEmit` and `npx vitest run`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/welcome/route.ts vercel.json
git commit -m "feat: the welcome cron sends the next due email and only records what really sent"
```

---

### Task 9: the EmailCapture component, mounted on the home page

**Files:**
- Create: `src/components/EmailCapture.tsx`
- Modify: `src/app/page.tsx` (one import line, one JSX line after the closing `</section>` of the hero)

**Interfaces:**
- Consumes: `POST /api/subscribe` from Task 6.
- Produces: `<EmailCapture source="home" heading="Free hints and tips, one pillar at a time" sub="Four short emails over a fortnight: good food, comfy walks, fun and games, cosy sleep. No spam, no selling your address." />` and, for merge time, the shop mount `<EmailCapture source="shop" heading="10% off your first order" sub="Pop your email in, tick the box, and the code lands in your inbox." />` (documented, not mounted; the shop page does not exist in this branch).
- The consent line beside the checkbox mirrors `CONSENT_TEXT` (import the constant so the label and the stored wording cannot drift). Checkbox defaults UNTICKED. Submitting without the tick still records the address (no consent, no sequence), and says so in the confirmation copy.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/EmailCapture.tsx
"use client";

import { useState } from "react";
import { CONSENT_TEXT, type CaptureSource } from "@/lib/subscribers";

/**
 * The email capture form (spec section 5). One list behind it; the source prop
 * tags where the contact came from so the follow up matches the offer they saw.
 * The consent box starts UNTICKED and its wording comes from CONSENT_TEXT, the
 * same constant the server stores, so the label and the record cannot drift.
 * Signing up here does not grant membership (spec 10.1).
 */
export function EmailCapture(props: { source: CaptureSource; heading: string; sub: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: props.source, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || "That did not go through. Try again in a minute.");
        setState("error");
        return;
      }
      setMessage(
        consent
          ? "Lovely. Keep an eye on your inbox."
          : "Saved. Tick the box next time if you would like the emails.",
      );
      setState("done");
    } catch {
      setMessage("That did not go through. Try again in a minute.");
      setState("error");
    }
  }

  return (
    <section className="band band--ink">
      <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
        <h2 className="display">{props.heading}</h2>
        <p style={{ margin: "0.8rem auto 1.6rem", opacity: 0.85 }}>{props.sub}</p>
        {state === "done" ? (
          <p style={{ fontWeight: 800 }}>{message}</p>
        ) : (
          <form onSubmit={submit}>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                style={{
                  flex: "1 1 220px",
                  maxWidth: 320,
                  padding: "12px 16px",
                  borderRadius: 999,
                  border: "1px solid #6b6b6b",
                  background: "#fff",
                  color: "#0b0b0b",
                }}
              />
              <button
                type="submit"
                className="btn btn--solid-paper"
                disabled={state === "busy"}
                style={{ cursor: state === "busy" ? "wait" : "pointer" }}
              >
                {state === "busy" ? "Saving..." : "Count me in"}
              </button>
            </div>
            <label
              style={{
                display: "flex",
                gap: "0.6rem",
                alignItems: "flex-start",
                justifyContent: "center",
                margin: "1rem auto 0",
                maxWidth: 420,
                fontSize: "0.85rem",
                opacity: 0.85,
                textAlign: "left",
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{CONSENT_TEXT[props.source]}</span>
            </label>
            {state === "error" && (
              <p role="alert" style={{ marginTop: "0.8rem", fontWeight: 700 }}>
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
```

Check: `src/lib/subscribers.ts` must stay importable from a client component. It imports `node:crypto` for the tokens, which would break the client bundle. Split the constants: EmailCapture imports only `CONSENT_TEXT` and the type. If Next refuses the `node:crypto` import in a client-reachable module, move the token functions to `src/lib/subscribers-server.ts` instead, and keep everything else where it is. Decide by running the build gates; do not guess.

- [ ] **Step 2: Mount on the home page**

In `src/app/page.tsx`: add `import { EmailCapture } from "@/components/EmailCapture";` with the other imports, and after the hero `</section>` (before the WHAT'S REALLY IN THEM section) insert exactly one line:

```tsx
      <EmailCapture source="home" heading="Free hints and tips, one pillar at a time" sub="Four short emails over a fortnight: good food, comfy walks, fun and games, cosy sleep. No spam, no selling your address." />
```

- [ ] **Step 3: Verify all gates**

Run: `npx vitest run` (147+ passing), `npx tsc --noEmit` (clean), `npm run lint` (exactly the 3 pre-existing errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/EmailCapture.tsx src/app/page.tsx
git commit -m "feat: the capture form, unticked by design, mounted under the hero in one line"
```

---

### Task 10: full verification pass

- [ ] **Step 1: Run everything**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`.
Expected: all tests passing (143 baseline plus the new subscriber and email tests), tsc clean, lint exactly 3 pre-existing errors.

- [ ] **Step 2: Read the diff once with fresh eyes**

`git log --oneline main..HEAD` and `git diff main..HEAD --stat`. Check: no em dashes anywhere in the new copy, British spelling, no stray files, page.tsx diff is two lines.

- [ ] **Step 3: Commit anything the pass shook out**

## Self-Review

- Spec coverage: 5 (two sources, one list, dedup, consent) Tasks 1, 2, 6, 9. 5.1 (four emails, fortnight, same cron pattern) Tasks 3, 5, 8. 6 (one-time first-order 10%) Task 8 code mechanics. 12.2 (unsubscribe) Tasks 4, 7 and the footer in Task 5. 12.3 (claims) Task 5 test bans the myth words. 10.1 (no membership) is a thing NOT built, asserted in comments. Shop page mount deferred by instruction.
- Placeholder scan: none; every step carries its content.
- Type consistency: `Subscriber`, `CaptureSource`, `WelcomeAction`, `WelcomeEmail` named identically across tasks; `CONSENT_TEXT` used by Tasks 1, 2, 9; `unsubscribeUrl` by Tasks 4, 5.
