# A.2 Customer and Dog Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every customer record a full address, a contact number and one or more dog profiles, so the stall form, the badge ribbons and the email personalisation all have something real to read.

**Architecture:** Dogs are an ordered array embedded on the existing `store_customers/{uid}` document rather than a subcollection, because a product card that ribbons itself against the signed-in customer's dogs must not cost a second Firestore query per render, and because the stall form writes the whole record in one conversation. Every dog carries a stable `id` so an edit targets a dog rather than an array index. All reads go through one tolerant mapper that copes with the three-field legacy shape already in Firestore, mirroring how `docToStoredProduct` copes with pre-pillar products.

**Tech Stack:** Next.js 16 (App Router, server components), TypeScript, Firebase Admin SDK (Firestore), Vitest.

## Global Constraints

- **British spelling throughout, in code, comments, copy and commit messages.** "Personalisation", not "personalization".
- **No em dashes anywhere**, including comments and copy. Use a comma or a full stop.
- **Read the Next.js guide before writing any route or component.** `AGENTS.md` is explicit: this is Next 16 and the APIs differ from training data. The relevant guides are in `node_modules/next/dist/docs/`.
- **Nothing in this plan may depend on Stripe.** `STRIPE_SECRET_KEY` is still absent, so any code path that reaches Stripe cannot be run or tested. Customer records are written by the webhook today, but this plan only changes the shape of what is written, never adds a Stripe call.
- **TDD, and one commit per task.** Test first, watch it fail, minimal implementation, watch it pass, commit.
- **Pure logic lives in `src/lib/*.ts` with `*.test.ts` beside it**, with no Firestore, no `next/headers` and no React imported, so it is unit-testable. This is the existing house pattern in `shipping.ts`, `product-fields.ts` and `auth-helpers.ts`.
- **Existing customer documents must survive.** Firestore holds real `store_customers` docs in the `{ email, name, lastPostcode }` shape. A read of one of those must never throw and never lose the fields it does have.

---

## File structure

| File | Responsibility |
|---|---|
| `src/data/customers.ts` | The `Dog`, `CustomerAddress` and `StoredCustomer` types, the sensitivity vocabulary and the sensitivity to badge map. Types and constants only, no logic |
| `src/lib/customer-fields.ts` | Pure derivations and validation: `validateDogInput`, `deriveLifeStage`, `dogOwnerLabel`, `normaliseAddress` |
| `src/lib/customer-fields.test.ts` | Unit tests for the above |
| `src/lib/customers-store.ts` | Firestore reads and writes: `docToStoredCustomer`, `getCustomer`, `upsertDog`, `removeDog`, `updateCustomerDetails` |
| `src/lib/customers-store.test.ts` | Unit tests for `docToStoredCustomer`, which is the tolerant mapper and the part worth testing without a database |
| `src/lib/auth-helpers.ts` | Modify `buildCustomerDoc` so a webhook write never clears dogs |
| `src/app/api/account/dogs/route.ts` | POST a new dog, PUT an edited dog, DELETE a dog, for the signed-in user only |
| `src/app/api/account/details/route.ts` | PUT the address and contact number for the signed-in user only |
| `src/app/account/page.tsx` | Show the record and the dogs |
| `src/components/account/DogForm.tsx` | Add and edit a dog |
| `scripts/backfill-customer-fields.mjs` | Bring the legacy docs up to the new shape, dry run by default |

Out of scope, and deliberately: the stall iPad form (D.1), the ribbons themselves (B.3), points (C.5). This plan builds the model and one plain way to exercise it, so the fields are proven before three other steps depend on them.

---

### Task 1: The types and the sensitivity vocabulary

**Files:**
- Create: `src/data/customers.ts`
- Create: `src/lib/customer-fields.ts`
- Test: `src/lib/customer-fields.test.ts`

**Interfaces:**
- Consumes: `Badge` and `ALL_BADGES` from `@/data/products`.
- Produces: `type Dog`, `type CustomerAddress`, `type StoredCustomer`, `type Sensitivity`, `ALL_SENSITIVITIES`, `SENSITIVITY_BADGE`, `deriveLifeStage(bornAt, now)`, `dogOwnerLabel(dogs)`.

Two decisions worth stating, because a later reader will otherwise change them by accident.

**Age is stored as an approximate date of birth, not as a number of years.** At a stall somebody says "he's about three", so the number is approximate either way, but a number goes stale silently. A puppy entered in July is still recorded as a puppy the following summer, and the puppy filtering quietly starts lying. A date does not rot.

**Sensitivities are a controlled list, allergies are free text.** Sensitivities drive the B.3 ribbons, which match against product badges, so they must come from a fixed vocabulary. Allergies are ingredients ("chicken", "wheat") which nobody can enumerate in advance, so they stay free text and drive Michaela's advice rather than the UI. The test below asserts every sensitivity maps to a badge that actually exists, so B.3 cannot be handed a vocabulary it has no way to render.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/customer-fields.test.ts
import { describe, it, expect } from "vitest";
import { ALL_BADGES } from "@/data/products";
import { ALL_SENSITIVITIES, SENSITIVITY_BADGE } from "@/data/customers";
import { deriveLifeStage, dogOwnerLabel } from "./customer-fields";

describe("SENSITIVITY_BADGE", () => {
  it("maps every sensitivity onto a badge that exists", () => {
    // Spec section 8.2: each dog field has to power something. A sensitivity with
    // no badge behind it cannot be rendered as a ribbon in B.3, so it would be a
    // field collected and never used.
    for (const s of ALL_SENSITIVITIES) {
      expect(ALL_BADGES).toContain(SENSITIVITY_BADGE[s]);
    }
  });
});

describe("deriveLifeStage", () => {
  const now = new Date("2026-07-25T00:00:00Z");

  it("calls under a year a puppy", () => {
    expect(deriveLifeStage("2026-02-01", now)).toBe("puppy");
  });

  it("calls one to seven an adult", () => {
    expect(deriveLifeStage("2023-07-25", now)).toBe("adult");
  });

  it("calls seven and over a senior", () => {
    expect(deriveLifeStage("2018-01-01", now)).toBe("senior");
  });

  it("returns unknown for a missing or unparseable date rather than guessing", () => {
    expect(deriveLifeStage(undefined, now)).toBe("unknown");
    expect(deriveLifeStage("not a date", now)).toBe("unknown");
  });

  it("returns unknown for a date in the future rather than a negative age", () => {
    expect(deriveLifeStage("2027-01-01", now)).toBe("unknown");
  });
});

describe("dogOwnerLabel", () => {
  it("names the first dog, which is the Loki's Mum convention in spec section 8.2", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }])).toBe("Loki's Mum");
  });

  it("adds an apostrophe only for a name ending in s", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Gus" }])).toBe("Gus' Mum");
  });

  it("joins two dogs with and, because both names are how she knows them", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }, { id: "d2", name: "Bear" }]))
      .toBe("Loki and Bear's Mum");
  });

  it("falls back to a plain greeting with no dogs, never to an empty possessive", () => {
    expect(dogOwnerLabel([])).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/customer-fields.test.ts`
Expected: FAIL, cannot resolve `@/data/customers` and `./customer-fields`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/data/customers.ts
// Types and constants for member records. No logic, so both server and client
// components can import it (mirrors src/data/products.ts).

import type { Badge } from "@/data/products";

/**
 * The controlled list of dog sensitivities, from spec section 8.2.
 *
 * Controlled rather than free text because step B.3 renders these as ribbons over
 * product cards, matched against the product's badges. Free text cannot be matched.
 * Ingredient allergies stay free text on the dog record, since nobody can list
 * every ingredient a dog might react to in advance.
 */
export type Sensitivity = "sensitive-tummy" | "itchy-skin" | "stiff-joints" | "common-proteins";

export const ALL_SENSITIVITIES: Sensitivity[] = [
  "sensitive-tummy",
  "itchy-skin",
  "stiff-joints",
  "common-proteins",
];

/** What Michaela sees and taps, since the stored value is a slug. */
export const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  "sensitive-tummy": "Dodgy tummy",
  "itchy-skin": "Itchy skin or dull coat",
  "stiff-joints": "Stiff joints",
  "common-proteins": "Reacts to the usual proteins",
};

/**
 * The badge a sensitivity looks for on a product. Step B.3 turns a match into a
 * ribbon. Defined here rather than in B.3 so the vocabulary cannot drift into
 * something unrenderable, and so the unit test can prove every entry lands.
 */
export const SENSITIVITY_BADGE: Record<Sensitivity, Badge> = {
  "sensitive-tummy": "Gentle on Dodgy Tummies",
  "itchy-skin": "Best for Skin & Coat",
  "stiff-joints": "Natural Joint Support",
  "common-proteins": "Novel Protein",
};

export type DogSize = "small" | "medium" | "large";
export type ActivityLevel = "low" | "moderate" | "high";
export type LifeStage = "puppy" | "adult" | "senior" | "unknown";

/**
 * One dog. Every field except id and name is optional, because the record is filled
 * in by conversation at a stall and a half-known dog is worth more than no dog.
 *
 * Size is a band and weight is a number, and both are kept: at the table somebody
 * says "he's a big lad", not "he's 32 kilos", but a weight when known gives better
 * portion advice.
 */
export type Dog = {
  id: string;
  name: string;
  breed?: string;
  /** Approximate ISO date, YYYY-MM-DD. A date rather than an age, so it cannot go stale. */
  bornAt?: string;
  size?: DogSize;
  weightKg?: number;
  activity?: ActivityLevel;
  sensitivities?: Sensitivity[];
  /** Free text ingredients, lower cased, for example "chicken", "wheat". */
  allergies?: string[];
};

export type CustomerAddress = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
};

export const EMPTY_ADDRESS: CustomerAddress = { line1: "", line2: "", city: "", postcode: "" };

export type StoredCustomer = {
  uid: string;
  email: string;
  name: string;
  phone: string;
  address: CustomerAddress;
  dogs: Dog[];
};
```

```typescript
// src/lib/customer-fields.ts
// Pure derivations from a customer or a dog. No Firestore, no next/headers, no
// React, so this module is trivially unit-testable (mirrors product-fields.ts).

import type { LifeStage } from "@/data/customers";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Puppy, adult or senior from an approximate date of birth, for the filtering in
 * spec section 8.2.
 *
 * Anything unparseable, missing or in the future returns "unknown" rather than a
 * guess, because a dog wrongly filed as a puppy gets the wrong portion advice,
 * which is worse than no advice at all.
 */
export function deriveLifeStage(bornAt: string | undefined, now: Date): LifeStage {
  if (!bornAt) return "unknown";
  const born = Date.parse(`${bornAt}T00:00:00Z`);
  if (!Number.isFinite(born)) return "unknown";
  const years = (now.getTime() - born) / MS_PER_YEAR;
  if (years < 0) return "unknown";
  if (years < 1) return "puppy";
  if (years < 7) return "adult";
  return "senior";
}

/**
 * The "Loki's Mum" naming convention from spec section 8.2, used in emails and on
 * the account page. Returns "" with no dogs, so the caller falls back to a plain
 * greeting rather than printing a dangling possessive.
 */
export function dogOwnerLabel(dogs: { id: string; name: string }[]): string {
  const names = dogs.map((d) => d.name.trim()).filter(Boolean);
  if (!names.length) return "";
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  // "Gus' Mum", not "Gus's Mum".
  return joined.endsWith("s") ? `${joined}' Mum` : `${joined}'s Mum`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/customer-fields.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/customers.ts src/lib/customer-fields.ts src/lib/customer-fields.test.ts
git commit -m "feat: dog and customer types, and the sensitivity vocabulary"
```

---

### Task 2: Validating a dog and an address

**Files:**
- Modify: `src/lib/customer-fields.ts`
- Test: `src/lib/customer-fields.test.ts`

**Interfaces:**
- Consumes: the types from Task 1.
- Produces: `validateDogInput(input): { ok: true; value: Omit<Dog, "id"> } | { ok: false; errors: string[] }`, and `normaliseAddress(input): CustomerAddress`. The result shape mirrors `validateProductInput` in `src/lib/product-admin.ts`, so the API routes in Tasks 5 and 6 read the same way as the product routes.

The rule for this validator is the opposite of the product one. A product with a missing field is broken. A dog with a missing field is a dog somebody did not get round to asking about, and rejecting it would lose the record. So only the name is required, and everything else is dropped when it is not usable rather than raising an error.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/lib/customer-fields.test.ts
// Extend the existing import at the top of the file rather than adding a second
// one from the same module:
//   import { deriveLifeStage, dogOwnerLabel, normaliseAddress, validateDogInput } from "./customer-fields";

describe("validateDogInput", () => {
  it("accepts a dog with nothing but a name, because the rest is asked for in conversation", () => {
    const result = validateDogInput({ name: "  Loki " });
    expect(result).toEqual({ ok: true, value: { name: "Loki" } });
  });

  it("refuses a dog with no name, since a nameless dog cannot be shown or greeted", () => {
    const result = validateDogInput({ name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("A dog needs a name.");
  });

  it("keeps the fields it understands", () => {
    const result = validateDogInput({
      name: "Bear",
      breed: " Labrador ",
      bornAt: "2020-03-04",
      size: "large",
      weightKg: 32,
      activity: "high",
      sensitivities: ["itchy-skin"],
      allergies: [" Chicken ", "wheat"],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Bear",
        breed: "Labrador",
        bornAt: "2020-03-04",
        size: "large",
        weightKg: 32,
        activity: "high",
        sensitivities: ["itchy-skin"],
        allergies: ["chicken", "wheat"],
      },
    });
  });

  it("drops a value it does not understand instead of failing the whole dog", () => {
    const result = validateDogInput({
      name: "Gus",
      size: "enormous",
      activity: "vigorous",
      sensitivities: ["itchy-skin", "made-up"],
      bornAt: "the summer",
      weightKg: -4,
    });
    expect(result).toEqual({ ok: true, value: { name: "Gus", sensitivities: ["itchy-skin"] } });
  });
});

describe("normaliseAddress", () => {
  it("trims every line and upper cases the postcode", () => {
    expect(normaliseAddress({ line1: " 1 High St ", city: " Dundee ", postcode: " dd5 1aa " }))
      .toEqual({ line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" });
  });

  it("returns a fully blank address for nothing at all, never undefined fields", () => {
    expect(normaliseAddress(undefined)).toEqual({ line1: "", line2: "", city: "", postcode: "" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/customer-fields.test.ts`
Expected: FAIL, `validateDogInput` and `normaliseAddress` are not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/customer-fields.ts
// Merge into the existing "@/data/customers" import at the top of the file, so
// there is one import per module:
//   import {
//     ALL_SENSITIVITIES,
//     EMPTY_ADDRESS,
//     type ActivityLevel,
//     type CustomerAddress,
//     type Dog,
//     type DogSize,
//     type LifeStage,
//     type Sensitivity,
//   } from "@/data/customers";

const SIZES: DogSize[] = ["small", "medium", "large"];
const ACTIVITIES: ActivityLevel[] = ["low", "moderate", "high"];

/**
 * Validate one dog from a form or an API body.
 *
 * Only the name is required. Every other field is dropped when it is not usable
 * rather than raising an error, because these records are filled in by conversation
 * at a stall and half a dog profile is worth far more than a rejected one. This is
 * deliberately the opposite of validateProductInput, where a missing field means a
 * broken product.
 */
export function validateDogInput(
  input: Partial<Dog>,
): { ok: true; value: Omit<Dog, "id"> } | { ok: false; errors: string[] } {
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, errors: ["A dog needs a name."] };

  const value: Omit<Dog, "id"> = { name };

  const breed = String(input.breed ?? "").trim();
  if (breed) value.breed = breed;

  // Stored only when it parses, so deriveLifeStage never has to defend itself twice.
  const bornAt = String(input.bornAt ?? "").trim();
  if (bornAt && Number.isFinite(Date.parse(`${bornAt}T00:00:00Z`))) value.bornAt = bornAt;

  if (SIZES.includes(input.size as DogSize)) value.size = input.size as DogSize;
  if (ACTIVITIES.includes(input.activity as ActivityLevel)) {
    value.activity = input.activity as ActivityLevel;
  }

  const weight = Number(input.weightKg);
  if (Number.isFinite(weight) && weight > 0) value.weightKg = weight;

  const sensitivities = Array.isArray(input.sensitivities)
    ? input.sensitivities.filter((s): s is Sensitivity => ALL_SENSITIVITIES.includes(s as Sensitivity))
    : [];
  if (sensitivities.length) value.sensitivities = sensitivities;

  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((a) => String(a).trim().toLowerCase()).filter(Boolean)
    : [];
  if (allergies.length) value.allergies = allergies;

  return { ok: true, value };
}

/** A complete address with blanks rather than gaps, so a merge never leaves a field undefined. */
export function normaliseAddress(input: Partial<CustomerAddress> | undefined): CustomerAddress {
  if (!input) return { ...EMPTY_ADDRESS };
  return {
    line1: String(input.line1 ?? "").trim(),
    line2: String(input.line2 ?? "").trim(),
    city: String(input.city ?? "").trim(),
    postcode: String(input.postcode ?? "").trim().toUpperCase(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/customer-fields.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/customer-fields.ts src/lib/customer-fields.test.ts
git commit -m "feat: validate a dog leniently and an address strictly"
```

---

### Task 3: The tolerant customer read

**Files:**
- Create: `src/lib/customers-store.ts`
- Test: `src/lib/customers-store.test.ts`

**Interfaces:**
- Consumes: `StoredCustomer`, `Dog` from `@/data/customers`; `normaliseAddress` from `@/lib/customer-fields`; `getDb`, `COLLECTIONS` from `@/lib/firebase-admin`.
- Produces: `docToStoredCustomer(uid, data): StoredCustomer`, `getCustomer(uid): Promise<StoredCustomer | null>`.

This is the module that has to cope with the real Firestore contents. The docs written so far hold `{ email, name, lastPostcode, createdAt, updatedAt }` and nothing else. `lastPostcode` is where the only address information lives, so it seeds `address.postcode` rather than being thrown away.

`customers-store.ts` imports `server-only`, which would normally make it unimportable from a test. `vitest.setup.ts` already mocks that module away, which is how `products-store.test.ts` imports its own mapper, so the test below works as written.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/customers-store.test.ts
import { describe, it, expect } from "vitest";
import { docToStoredCustomer } from "./customers-store";

describe("docToStoredCustomer", () => {
  it("reads a full record", () => {
    expect(
      docToStoredCustomer("u1", {
        email: "a@b.com",
        name: "Sam",
        phone: "07700 900000",
        address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ id: "d1", name: "Loki", breed: "Collie" }],
      }),
    ).toEqual({
      uid: "u1",
      email: "a@b.com",
      name: "Sam",
      phone: "07700 900000",
      address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
      dogs: [{ id: "d1", name: "Loki", breed: "Collie" }],
    });
  });

  it("reads a legacy doc, keeping lastPostcode as the only address it has", () => {
    // Every customer doc in Firestore today is this shape. Losing lastPostcode would
    // throw away the one piece of address information the site ever collected.
    expect(docToStoredCustomer("u2", { email: "a@b.com", name: "Sam", lastPostcode: "DD5 1AA" }))
      .toEqual({
        uid: "u2",
        email: "a@b.com",
        name: "Sam",
        phone: "",
        address: { line1: "", line2: "", city: "", postcode: "DD5 1AA" },
        dogs: [],
      });
  });

  it("survives an empty doc rather than throwing", () => {
    expect(docToStoredCustomer("u3", {})).toEqual({
      uid: "u3",
      email: "",
      name: "",
      phone: "",
      address: { line1: "", line2: "", city: "", postcode: "" },
      dogs: [],
    });
  });

  it("drops a dog with no id or no name, which cannot be edited or displayed", () => {
    const result = docToStoredCustomer("u4", {
      dogs: [{ id: "d1", name: "Loki" }, { name: "no id" }, { id: "d3" }, "nonsense"],
    });
    expect(result.dogs).toEqual([{ id: "d1", name: "Loki" }]);
  });

  it("ignores a dogs field that is not an array", () => {
    expect(docToStoredCustomer("u5", { dogs: "Loki" }).dogs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/customers-store.test.ts`
Expected: FAIL, cannot resolve `./customers-store`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/customers-store.ts
import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { normaliseAddress } from "@/lib/customer-fields";
import type { Dog, StoredCustomer } from "@/data/customers";

/**
 * Map a Firestore doc to a customer, tolerating every shape ever written.
 *
 * Legacy docs carry { email, name, lastPostcode } and nothing else, so lastPostcode
 * seeds the postcode rather than being dropped. A dog missing its id or its name is
 * dropped, because it can be neither edited nor displayed, and keeping it would put
 * an unfixable row on the account page.
 */
export function docToStoredCustomer(uid: string, data: Record<string, unknown>): StoredCustomer {
  const rawAddress = (data.address ?? {}) as Record<string, unknown>;
  const address = normaliseAddress({
    line1: String(rawAddress.line1 ?? ""),
    line2: String(rawAddress.line2 ?? ""),
    city: String(rawAddress.city ?? ""),
    postcode: String(rawAddress.postcode ?? data.lastPostcode ?? ""),
  });

  const dogs: Dog[] = Array.isArray(data.dogs)
    ? (data.dogs as unknown[]).filter((d): d is Dog => {
        if (!d || typeof d !== "object") return false;
        const dog = d as Partial<Dog>;
        return Boolean(dog.id) && Boolean(dog.name);
      })
    : [];

  return {
    uid,
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    address,
    dogs,
  };
}

/** The signed-in customer's record, or null when they have never bought or signed up. */
export async function getCustomer(uid: string): Promise<StoredCustomer | null> {
  const db = getDb();
  if (!db || !uid) return null;
  try {
    const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
    if (!doc.exists) return null;
    return docToStoredCustomer(uid, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.error("[customers-store] getCustomer read failed:", err);
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/customers-store.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/customers-store.ts src/lib/customers-store.test.ts
git commit -m "feat: read a customer record, tolerating the legacy shape"
```

---

### Task 4: Writing dogs and details without losing the rest

**Files:**
- Modify: `src/lib/customers-store.ts`
- Modify: `src/lib/auth-helpers.ts:52-62` (`buildCustomerDoc`)
- Test: `src/lib/customers-store.test.ts`, `src/lib/auth-helpers.test.ts:46-53`

**Interfaces:**
- Consumes: `validateDogInput` from Task 2, `getCustomer` from Task 3.
- Produces: `upsertDog(uid, dogId | null, input): Promise<{ ok: true; dog: Dog } | { ok: false; errors: string[] }>`, `removeDog(uid, dogId): Promise<boolean>`, `updateCustomerDetails(uid, { name, phone, address }): Promise<boolean>`, and `nextDogId(existing): string`.

The hazard here is the one that makes embedding an array a real decision rather than a free one. Editing a dog is read, modify, write, so two writes racing lose one of them. At this volume that is acceptable, and a Firestore transaction closes it, so use one.

The second hazard is `buildCustomerDoc`. The Stripe webhook merges its result into the customer doc on every order. It currently returns `{ email, name, lastPostcode }`, and `name` is whatever Stripe collected at checkout. A customer who fills in their own name on the account page and then orders would have it overwritten by the Stripe spelling. Keep the write, but never let it blank a field that already holds something.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/lib/customers-store.test.ts
// Extend the existing import rather than adding a second one from the same module:
//   import { docToStoredCustomer, nextDogId } from "./customers-store";

describe("nextDogId", () => {
  it("starts at dog-1", () => {
    expect(nextDogId([])).toBe("dog-1");
  });

  it("never reuses an id, so an edit cannot land on a deleted dog's row", () => {
    // dog-2 was deleted. Reusing it would point an in-flight edit at the wrong dog.
    expect(nextDogId([{ id: "dog-1", name: "Loki" }, { id: "dog-3", name: "Bear" }])).toBe("dog-4");
  });

  it("ignores an id it did not generate", () => {
    expect(nextDogId([{ id: "imported-abc", name: "Gus" }])).toBe("dog-1");
  });
});
```

```typescript
// replace the buildCustomerDoc block in src/lib/auth-helpers.test.ts:46-53
describe("buildCustomerDoc", () => {
  it("normalises fields with sensible blanks", () => {
    expect(buildCustomerDoc({ email: "a@b.com", name: "Sam", postcode: "DD1 1AA" }))
      .toEqual({ email: "a@b.com", name: "Sam", lastPostcode: "DD1 1AA" });
  });

  it("omits a blank field rather than writing an empty string over a real one", () => {
    // This doc is merged in by the Stripe webhook on every order. Writing "" would
    // wipe a name or a postcode the customer had already given on the account page.
    expect(buildCustomerDoc({ email: "a@b.com" })).toEqual({ email: "a@b.com" });
    expect(buildCustomerDoc({ email: "a@b.com", name: "  " })).toEqual({ email: "a@b.com" });
  });

  it("never writes dogs or address, which only the customer and the stall form own", () => {
    const doc = buildCustomerDoc({ email: "a@b.com", name: "Sam", postcode: "DD1 1AA" });
    expect(doc).not.toHaveProperty("dogs");
    expect(doc).not.toHaveProperty("address");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/customers-store.test.ts src/lib/auth-helpers.test.ts`
Expected: FAIL, `nextDogId` is not exported, and `buildCustomerDoc` returns `{ email, name: "", lastPostcode: "" }` where the test wants the blanks omitted.

- [ ] **Step 3: Write minimal implementation**

```typescript
// replace buildCustomerDoc in src/lib/auth-helpers.ts
/**
 * Plain, serialisable customer fields (caller adds server timestamps).
 *
 * A blank field is omitted rather than written as "". This doc is merged into
 * store_customers by the Stripe webhook on every order, so writing an empty string
 * would blank a name or postcode the customer had already given on the account page.
 * It deliberately never carries dogs or address: those belong to the customer and to
 * the stall form, and Stripe knows nothing about either.
 */
export function buildCustomerDoc(input: { email: string; name?: string; postcode?: string }): {
  email: string;
  name?: string;
  lastPostcode?: string;
} {
  const name = String(input.name ?? "").trim();
  const postcode = String(input.postcode ?? "").trim();
  return {
    email: input.email,
    ...(name ? { name } : {}),
    ...(postcode ? { lastPostcode: postcode } : {}),
  };
}
```

```typescript
// append to src/lib/customers-store.ts
// New import: FieldValue. The other two merge into the imports already at the top:
//   import { FieldValue } from "firebase-admin/firestore";
//   import { normaliseAddress, validateDogInput } from "@/lib/customer-fields";
//   import type { CustomerAddress, Dog, StoredCustomer } from "@/data/customers";

/**
 * The next dog id, one higher than the highest ever used on this record.
 *
 * Deliberately not `dogs.length + 1`: deleting dog-2 from three dogs would then
 * generate dog-3 again, and an edit already in flight against the real dog-3 would
 * land on the new dog instead.
 */
export function nextDogId(existing: { id: string }[]): string {
  const highest = existing.reduce((max, d) => {
    const match = /^dog-(\d+)$/.exec(d.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `dog-${highest + 1}`;
}

/**
 * Add a dog, or replace one by id. Runs in a transaction because dogs are an array
 * on one document, so a read, modify and write from two tabs at once would otherwise
 * silently drop one of them.
 */
export async function upsertDog(
  uid: string,
  dogId: string | null,
  input: Partial<Dog>,
): Promise<{ ok: true; dog: Dog } | { ok: false; errors: string[] }> {
  const parsed = validateDogInput(input);
  if (!parsed.ok) return parsed;

  const db = getDb();
  if (!db || !uid) return { ok: false, errors: ["Service not configured."] };

  const ref = db.collection(COLLECTIONS.customers).doc(uid);
  try {
    const dog = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      const id = dogId ?? nextDogId(current.dogs);
      const saved: Dog = { id, ...parsed.value };
      const dogs = dogId
        ? current.dogs.map((d) => (d.id === dogId ? saved : d))
        : [...current.dogs, saved];
      // An edit for an id that is not there appends rather than vanishing, so a
      // stale tab never silently discards what somebody typed.
      if (dogId && !current.dogs.some((d) => d.id === dogId)) dogs.push(saved);
      tx.set(ref, { dogs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return saved;
    });
    return { ok: true, dog };
  } catch (err) {
    console.error("[customers-store] upsertDog failed:", err);
    return { ok: false, errors: ["Save failed."] };
  }
}

/** Remove a dog by id. True when the write went through. */
export async function removeDog(uid: string, dogId: string): Promise<boolean> {
  const db = getDb();
  if (!db || !uid || !dogId) return false;
  const ref = db.collection(COLLECTIONS.customers).doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      tx.set(
        ref,
        { dogs: current.dogs.filter((d) => d.id !== dogId), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
    return true;
  } catch (err) {
    console.error("[customers-store] removeDog failed:", err);
    return false;
  }
}

/**
 * The customer's own name, phone and address. Writes lastPostcode alongside address
 * so the older field stays true for anything still reading it.
 */
export async function updateCustomerDetails(
  uid: string,
  input: { name?: string; phone?: string; address?: Partial<CustomerAddress> },
): Promise<boolean> {
  const db = getDb();
  if (!db || !uid) return false;
  const address = normaliseAddress(input.address);
  try {
    await db.collection(COLLECTIONS.customers).doc(uid).set(
      {
        name: String(input.name ?? "").trim(),
        phone: String(input.phone ?? "").trim(),
        address,
        lastPostcode: address.postcode,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("[customers-store] updateCustomerDetails failed:", err);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run`
Expected: PASS, the whole suite. `auth-helpers.test.ts` now covers the omit-blanks behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/lib/customers-store.ts src/lib/customers-store.test.ts src/lib/auth-helpers.ts src/lib/auth-helpers.test.ts
git commit -m "feat: write dogs and details without the webhook blanking them"
```

---

### Task 5: The account API routes

**Files:**
- Create: `src/app/api/account/dogs/route.ts`
- Create: `src/app/api/account/details/route.ts`

**Interfaces:**
- Consumes: `requireUser` from `@/lib/auth`, `isAllowedOrigin` from `@/lib/auth-helpers`, and Task 4's `upsertDog`, `removeDog`, `updateCustomerDetails`.
- Produces: `POST/PUT/DELETE /api/account/dogs` and `PUT /api/account/details`, all returning `{ ok: true, ... }` or `{ ok: false, errors: string[] }`.

Read `node_modules/next/dist/docs/` on route handlers before writing these. Two rules that are not negotiable:

**The uid comes from the session, never from the body.** If a route trusted a uid in the request, anybody signed in could rewrite anybody else's dogs. This is the whole security surface of the step.

**These routes change state, so they need the same origin check the auth routes use.** `isAllowedOrigin` already exists in `src/lib/auth-helpers.ts` and is the house pattern for CSRF here.

- [ ] **Step 1: Write the failing test**

There is no route-level test harness in this repo and adding one is its own job, so this task is verified by hand in Step 4. The logic these routes call is already covered by Tasks 2 to 4. Do not skip Step 4.

- [ ] **Step 2: Read the routing docs**

Run: `ls node_modules/next/dist/docs/` and read the route handler guide.
Expected: you can state how this version wants a handler's signature and its dynamic config before you write one.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/account/dogs/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { upsertDog, removeDog } from "@/lib/customers-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

function guard(req: NextRequest) {
  return isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // requireUser redirects when signed out, so uid below is always the caller's own.
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  if (!input) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });

  const result = await upsertDog(user.uid, null, input);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, dog: result.dog });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  if (!input) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });

  const dogId = String(input.id ?? "").trim();
  if (!dogId) return NextResponse.json({ ok: false, errors: ["Which dog?"] }, { status: 400 });

  // The uid is the session's, so a request cannot reach another account's dog.
  const result = await upsertDog(user.uid, dogId, input);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, dog: result.dog });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const input = await body(req);
  const dogId = String(input?.id ?? "").trim();
  if (!dogId) return NextResponse.json({ ok: false, errors: ["Which dog?"] }, { status: 400 });

  const ok = await removeDog(user.uid, dogId);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
```

```typescript
// src/app/api/account/details/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { updateCustomerDetails } from "@/lib/customers-store";
import type { CustomerAddress } from "@/data/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  }

  let input: { name?: string; phone?: string; address?: Partial<CustomerAddress> };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const ok = await updateCustomerDetails(user.uid, input);
  if (!ok) return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify by hand**

Sign in, then from the browser console on the site's own origin so the origin check passes:

```javascript
await (await fetch("/api/account/dogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Loki", breed: "Collie", size: "medium" }) })).json()
```

Expected: `{ ok: true, dog: { id: "dog-1", name: "Loki", breed: "Collie", size: "medium" } }`, and a `dogs` array on the `store_customers` doc in the Firebase console.

Then confirm the origin guard bites:

```bash
curl -X PUT http://localhost:3000/api/account/details -H "Content-Type: application/json" -d "{\"name\":\"nope\"}"
```

Expected: a redirect to `/login` (no session) rather than a write. With a session cookie but no `Origin` header, expect 403.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account
git commit -m "feat: account routes for dogs and contact details"
```

---

### Task 6: The account page shows the record

**Files:**
- Modify: `src/app/account/page.tsx`
- Create: `src/components/account/DogForm.tsx`

**Interfaces:**
- Consumes: `getCustomer` from Task 3, `deriveLifeStage` and `dogOwnerLabel` from Task 1, `SENSITIVITY_LABEL` from Task 1, and the routes from Task 5.
- Produces: nothing later tasks depend on.

The point of this task is that A.2 does not end as an unexercised data model. Wave 1 shipped 25 commits nobody had run, and this is the cheapest way to not repeat it. Plain and functional is the target, not designed. B.3 and D.1 build the real surfaces.

Read the Next 16 guides on server components and client components before writing. The page stays a server component and does the Firestore read; `DogForm` is the client component with `"use client"`, because it holds form state and calls the API routes.

- [ ] **Step 1: Write the page**

```tsx
// src/app/account/page.tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";
import { deriveLifeStage, dogOwnerLabel } from "@/lib/customer-fields";
import { SENSITIVITY_LABEL } from "@/data/customers";
import DogForm from "@/components/account/DogForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const customer = await getCustomer(user.uid);
  const dogs = customer?.dogs ?? [];
  const label = dogOwnerLabel(dogs);
  const now = new Date();

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1 className="display">Your account</h1>
        <p>{label ? `${label}, signed in as ${user.email}.` : `Signed in as ${user.email}.`}</p>

        {/* Staff had no route into the admin from anywhere in the site, so Michaela
            had to know and type the URL. This is the entry point until there is a
            proper staff nav. */}
        {user.staff && (
          <p style={{ marginTop: "1.5rem" }}>
            <Link className="btn btn--solid-ink" href="/admin">
              Go to the staff area
            </Link>
          </p>
        )}

        <h2 style={{ marginTop: "2rem" }}>Your dogs</h2>
        {dogs.length === 0 && <p style={{ opacity: 0.7 }}>No dogs yet. Add one below.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {dogs.map((dog) => {
            const stage = deriveLifeStage(dog.bornAt, now);
            return (
              <li key={dog.id} style={{ borderTop: "1px solid rgba(0,0,0,.1)", padding: "1rem 0" }}>
                <strong>{dog.name}</strong>
                {dog.breed ? `, ${dog.breed}` : ""}
                {stage !== "unknown" ? `, ${stage}` : ""}
                {dog.sensitivities?.length ? (
                  <div style={{ opacity: 0.7, fontSize: ".9rem" }}>
                    {dog.sensitivities.map((s) => SENSITIVITY_LABEL[s]).join(", ")}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <DogForm />

        <p style={{ opacity: 0.7, marginTop: "2rem" }}>Points and order history arrive in a later stage.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the form**

```tsx
// src/components/account/DogForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_SENSITIVITIES, SENSITIVITY_LABEL, type Sensitivity } from "@/data/customers";

/**
 * Add a dog. Deliberately plain: the real collection surface is the stall iPad form
 * in step D.1, and this exists so the model is exercised rather than assumed.
 */
export default function DogForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [bornAt, setBornAt] = useState("");
  const [sensitivities, setSensitivities] = useState<Sensitivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(s: Sensitivity) {
    setSensitivities((current) =>
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, breed, bornAt, sensitivities }),
      });
      const data = await res.json();
      // Surface the failure. The product form shipped without this and a failed save
      // looked identical to a successful one.
      if (!res.ok || !data.ok) {
        setError((data.errors ?? ["Save failed."]).join(" "));
        return;
      }
      setName("");
      setBreed("");
      setBornAt("");
      setSensitivities([]);
      router.refresh();
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: "1.5rem", display: "grid", gap: ".75rem" }}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Breed
        <input value={breed} onChange={(e) => setBreed(e.target.value)} />
      </label>
      <label>
        Roughly when was he or she born?
        <input type="date" value={bornAt} onChange={(e) => setBornAt(e.target.value)} />
      </label>
      <fieldset>
        <legend>Anything he or she struggles with?</legend>
        {ALL_SENSITIVITIES.map((s) => (
          <label key={s} style={{ display: "block" }}>
            <input type="checkbox" checked={sensitivities.includes(s)} onChange={() => toggle(s)} />
            {SENSITIVITY_LABEL[s]}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" style={{ color: "#b00" }}>{error}</p>}
      <button className="btn btn--solid-ink" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Add this dog"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verify it in the browser**

Run the dev server, sign in, and go to `/account`.

Expected: adding "Loki" makes him appear in the list without a manual reload, the greeting becomes "Loki's Mum, signed in as ...", a second dog changes it to "Loki and Bear's Mum", and submitting a blank name is refused with a readable message rather than a silent failure.

- [ ] **Step 4: Run the whole suite and the typecheck**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: tests pass, typecheck clean, lint still at the 3 errors that pre-date this work and no new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/page.tsx src/components/account/DogForm.tsx
git commit -m "feat: account page shows the dogs and can add one"
```

---

### Task 7: Backfill the existing customer documents

**Files:**
- Create: `scripts/backfill-customer-fields.mjs`

**Interfaces:**
- Consumes: `FIREBASE_SERVICE_ACCOUNT` from the environment.
- Produces: nothing in the app.

Model it on `scripts/backfill-product-fields.mjs`, which is already in the repo and already proven against the live project. Same shape: dry run by default, `--apply` to write, idempotent so a second run reports nothing to do.

`docToStoredCustomer` already defaults everything, so nothing is broken without this. The reason to run it is that a customer doc with a real `dogs: []` and `address` is queryable, and one without them is not, which will matter the first time Michaela wants a count.

- [ ] **Step 1: Write the script**

```javascript
// scripts/backfill-customer-fields.mjs
// Bring legacy store_customers docs up to the A.2 shape: phone, address, dogs.
// Dry run by default. Pass --apply to write.
//
// Mirrors scripts/backfill-product-fields.mjs, which was run against barking-raw
// on 2026-07-25 and is the pattern that worked.

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const snap = await db.collection("store_customers").get();
let patched = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const patch = {};

  if (typeof data.phone !== "string") patch.phone = "";
  if (!Array.isArray(data.dogs)) patch.dogs = [];
  if (!data.address || typeof data.address !== "object") {
    // lastPostcode is the only address information these docs ever held.
    patch.address = {
      line1: "",
      line2: "",
      city: "",
      postcode: String(data.lastPostcode ?? "").toUpperCase(),
    };
  }

  if (!Object.keys(patch).length) continue;
  patched += 1;
  console.log(`${apply ? "patching" : "would patch"} ${doc.id}:`, Object.keys(patch).join(", "));
  if (apply) await doc.ref.set(patch, { merge: true });
}

console.log(`${snap.size} customers, ${patched} ${apply ? "patched" : "to patch"}.`);
if (!apply && patched) console.log("Re-run with --apply to write.");
```

- [ ] **Step 2: Dry run it**

Run: `node scripts/backfill-customer-fields.mjs`
Expected: it lists the docs it would patch and writes nothing.

- [ ] **Step 3: Apply it, then prove it is idempotent**

Run: `node scripts/backfill-customer-fields.mjs --apply`
Then run: `node scripts/backfill-customer-fields.mjs`
Expected: the second run reports `0 to patch`. That is the idempotency check, and it is the same check the product backfill passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-customer-fields.mjs
git commit -m "chore: backfill phone, address and dogs onto existing customers"
```

---

## What this leaves for later, on purpose

- **The stall iPad form (D.1)** writes this same record, one question per screen. It is the reason the validator is lenient.
- **The badge ribbons (B.3)** read `dog.sensitivities` and `SENSITIVITY_BADGE`. Task 1's test guarantees every sensitivity has a badge to match.
- **A dog photo.** Section 10.1.1 puts it on the last screen of the stall form, and section 10.2 uses it for Dogs of the Day. It needs the same Firebase Storage upload path the product image uses, so it belongs with D.1 rather than here.
- **Editing and deleting a dog from the account page.** The routes exist and are tested by hand in Task 5; only the UI is missing, and D.1 will build the real one.
- **Michaela's final say on the field list.** Section 8.2 gives it to her. `ALL_SENSITIVITIES` and the dog fields are the ones the spec names, and changing them later is a vocabulary edit plus a backfill, not a rewrite.
