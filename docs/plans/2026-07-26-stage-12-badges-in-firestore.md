# B.6 Badges Michaela Can Add Herself, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the eight badges out of a compiled TypeScript union and into a Firestore collection, with an admin screen where Michaela can add, rename and retire one, so a new badge stops being a code change and a deploy.

**Architecture:** A `store_badges` collection keyed by a slug of the label. Products keep storing badge **labels**, not ids, so no product data migrates and the product card is untouched. Validation stops filtering against a compiled constant and starts filtering against the labels currently in the collection, with the list passed in as an argument so the validator stays pure and unit-testable. Retiring hides a badge from the pickers without removing it from products already carrying it.

**Tech Stack:** Next.js 16 (App Router, server components), TypeScript, Firebase Admin SDK (Firestore), Vitest.

## Do not start this until B.3 has merged

B.6 changes the `Badge` type. B.3 owns `src/components/ProductCard.tsx` and `src/components/Badge.tsx` and reads `SENSITIVITY_BADGE` from `src/data/customers.ts`. A badge collision resolves as a type widening rather than a textual conflict, so it merges cleanly and then fails quietly. Wait for B.3, then rebase this onto it.

## Global Constraints

- **British spelling throughout**, in code, comments, copy and commit messages.
- **No em dashes anywhere.** Use a comma or a full stop.
- **Read the Next.js guide before writing any route or component.** `AGENTS.md` is explicit: this is Next 16 and the APIs differ from training data. Guides are in `node_modules/next/dist/docs/`.
- **Nothing here may depend on Stripe.** `STRIPE_SECRET_KEY` is still absent. Badges never reach Stripe, so if a task finds itself touching `stripe-sync.ts`, it has gone wrong.
- **TDD, and one commit per task.** Test first, watch it fail, minimal implementation, watch it pass, commit.
- **Pure logic lives in `src/lib/*.ts` with `*.test.ts` beside it**, importing no Firestore, no `next/headers` and no React. This is the existing house pattern in `shipping.ts`, `product-fields.ts`, `customer-fields.ts` and `product-admin.ts`.
- **Retire, never delete.** A badge coming off the list must not vanish from products still carrying it (spec section 3.4).

---

## The one thing this plan exists to prevent

`src/data/customers.ts` maps each of the four dog sensitivities onto a badge:

```ts
export const SENSITIVITY_BADGE: Record<Sensitivity, Badge> = {
  "sensitive-tummy": "Gentle on Dodgy Tummies",
  "itchy-skin": "Best for Skin & Coat",
  "stiff-joints": "Natural Joint Support",
  "common-proteins": "Novel Protein",
};
```

B.3 turns a match between those and a product's badges into a ribbon over the product card. A unit test in `src/lib/customer-fields.test.ts` asserts every sensitivity maps onto a badge that exists, and that test is a compile-time guarantee only because the union is compiled in.

**The moment badges live in Firestore, that guarantee becomes a property of Michaela's data.** If she retires "Gentle on Dodgy Tummies" while tidying her list, the dodgy-tummy ribbon silently stops appearing, on every product, for every dog that has it flagged. No error, no failing test, no log line. A feature that quietly stops working months after anyone connected the two.

So five badges are **system badges**: the four above, plus "Most Popular", which `Badge.tsx` string-matches to decide whether to draw the star. System badges cannot be retired and cannot be renamed, and the admin names the feature it is protecting rather than just refusing, because a refusal Michaela cannot understand becomes a message to Liam, and B.6 exists so she does not need him for this.

**The invariant runs both ways, and that is the point.** Michaela cannot remove a badge that a sensitivity points at, because the admin refuses at runtime. And we cannot add a sensitivity without adding its badge, because the Task 1 test asserts `SYSTEM_BADGES` covers every `SENSITIVITY_BADGE` value and fails the build otherwise. So if B.3's vocabulary ever grows a fifth sensitivity, the missing badge is a red test on our side rather than a ribbon nobody can see on hers. Neither half is much use without the other: a runtime guard alone lets us ship a broken mapping, and a compile-time test alone lets her retire the badge afterwards.

**The accepted limitation:** Michaela can reword only three of the eight badges she starts with. That is the price of products storing labels rather than badge ids, and products storing labels is what keeps this change out of `ProductCard.tsx` and off B.3's toes. The upgrade path, if she ever asks to reword the other five, is to store badge ids on products and resolve them at render, which is a bigger job and wants its own plan.

---

## File structure

| File | Responsibility |
|---|---|
| `src/data/badges.ts` | The `StoredBadge` type, the eight seed labels, and which of them are system badges. Types and constants only |
| `src/lib/badge-admin.ts` | Pure helpers: `badgeSlug`, `validateBadgeInput`, `badgeProtectionReason`, `canRetireBadge`, `docToStoredBadge`. Mirrors `product-admin.ts` |
| `src/lib/badge-admin.test.ts` | Unit tests for the above |
| `src/lib/badges-store.ts` | Firestore reads and writes: `getAllBadges`, `getActiveBadgeLabels`, `createBadge`, `renameBadge`, `setBadgeRetired` |
| `src/lib/product-admin.ts` | `validateProductInput` takes the allowed labels as an argument instead of filtering against `ALL_BADGES` |
| `src/app/api/admin/badges/route.ts` | GET the list, POST a new badge |
| `src/app/api/admin/badges/[slug]/route.ts` | PATCH to rename, DELETE to retire (and un-retire) |
| `src/app/admin/badges/page.tsx` | Michaela's screen |
| `src/components/admin/BadgeManager.tsx` | The client component that adds, renames and retires |
| `src/components/admin/ProductForm.tsx` | Badge chips come from the live list rather than `ALL_BADGES` |
| `scripts/seed-badges.mjs` | Puts the existing eight into Firestore, marking the five system ones |

`src/data/products.ts` keeps `Badge` and `ALL_BADGES`, both narrowed in meaning: `Badge` becomes `string`, and `ALL_BADGES` becomes the seed list only, no longer the authority on what is valid. Leaving the names in place keeps the diff off every file that imports them.

---

### Task 1: The badge type and the pure helpers

**Files:**
- Create: `src/data/badges.ts`
- Create: `src/lib/badge-admin.ts`
- Test: `src/lib/badge-admin.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `type StoredBadge = { slug: string; label: string; retired: boolean; system: boolean }`, `SEED_BADGES: string[]`, `SYSTEM_BADGES: string[]`, `badgeSlug(label): string`, `validateBadgeInput(input, existing): {ok: true; value: {label: string}} | {ok: false; errors: string[]}`, `badgeProtectionReason(label): string | null`, `canRetireBadge(badge): {ok: true} | {ok: false; reason: string}`, `docToStoredBadge(slug, data): StoredBadge`.

Note this makes `badge-admin.ts` import from `@/data/customers`. That coupling is real, and naming it in code is better than leaving it in a comment: the badge list and the dog sensitivity vocabulary genuinely constrain each other.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/badge-admin.test.ts
import { describe, it, expect } from "vitest";
import { SEED_BADGES, SYSTEM_BADGES } from "@/data/badges";
import { SENSITIVITY_BADGE } from "@/data/customers";
import { badgeSlug, canRetireBadge, docToStoredBadge, validateBadgeInput } from "./badge-admin";

describe("SYSTEM_BADGES", () => {
  it("covers every badge a dog sensitivity points at", () => {
    // This is the whole reason system badges exist. If Michaela could retire one of
    // these, the matching ribbon in B.3 would silently stop appearing everywhere.
    for (const badge of Object.values(SENSITIVITY_BADGE)) {
      expect(SYSTEM_BADGES).toContain(badge);
    }
  });

  it("covers Most Popular, which Badge.tsx string-matches to draw the star", () => {
    expect(SYSTEM_BADGES).toContain("Most Popular");
  });

  it("is a subset of the seed badges", () => {
    for (const badge of SYSTEM_BADGES) expect(SEED_BADGES).toContain(badge);
  });
});

describe("badgeSlug", () => {
  it("lower cases, strips punctuation and hyphenates", () => {
    expect(badgeSlug("Gentle on Dodgy Tummies")).toBe("gentle-on-dodgy-tummies");
    expect(badgeSlug("Best for Skin & Coat")).toBe("best-for-skin-coat");
    expect(badgeSlug("  Novel   Protein  ")).toBe("novel-protein");
  });

  it("returns empty for a label with nothing usable in it", () => {
    expect(badgeSlug("   ")).toBe("");
    expect(badgeSlug("!!!")).toBe("");
  });
});

describe("validateBadgeInput", () => {
  const existing = [
    { slug: "most-popular", label: "Most Popular", retired: false, system: true },
  ];

  it("accepts a new label and trims it", () => {
    expect(validateBadgeInput({ label: "  Great for Puppies " }, existing))
      .toEqual({ ok: true, value: { label: "Great for Puppies" } });
  });

  it("refuses an empty label", () => {
    const r = validateBadgeInput({ label: "  " }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("A badge needs a name.");
  });

  it("refuses a label that would collide with an existing badge", () => {
    // Same slug, different capitalisation. Two badges rendering identically would
    // be indistinguishable on a product card.
    const r = validateBadgeInput({ label: "most popular" }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("There is already a badge called that.");
  });

  it("refuses a label that slugs to nothing", () => {
    const r = validateBadgeInput({ label: "!!!" }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("That name cannot be used.");
  });

  it("refuses a label long enough to break the pill layout", () => {
    const r = validateBadgeInput({ label: "x".repeat(41) }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Keep a badge to 40 characters or fewer.");
  });
});

describe("canRetireBadge", () => {
  it("allows retiring an ordinary badge", () => {
    expect(canRetireBadge({ slug: "single-ingredient", label: "Single Ingredient", retired: false, system: false }))
      .toEqual({ ok: true });
  });

  it("names the ribbon a sensitivity badge powers, rather than just refusing", () => {
    // A refusal Michaela cannot understand becomes a support message to Liam, and
    // the whole point of B.6 is that she does not need him for this.
    const r = canRetireBadge({ slug: "gentle-on-dodgy-tummies", label: "Gentle on Dodgy Tummies", retired: false, system: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("Dodgy tummy");
      expect(r.reason).toContain("stop putting it on products");
    }
  });

  it("explains the star for Most Popular, which is protected for a different reason", () => {
    const r = canRetireBadge({ slug: "most-popular", label: "Most Popular", retired: false, system: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("star");
  });
});

describe("docToStoredBadge", () => {
  it("reads a full record", () => {
    expect(docToStoredBadge("novel-protein", { label: "Novel Protein", retired: false, system: true }))
      .toEqual({ slug: "novel-protein", label: "Novel Protein", retired: false, system: true });
  });

  it("defaults a partial record rather than throwing", () => {
    expect(docToStoredBadge("x", {})).toEqual({ slug: "x", label: "", retired: false, system: false });
  });

  it("treats any non-true retired value as active", () => {
    expect(docToStoredBadge("x", { label: "X", retired: "yes" }).retired).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/badge-admin.test.ts`
Expected: FAIL, cannot resolve `@/data/badges` and `./badge-admin`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/data/badges.ts
// Types and constants for Michaela's badges. No logic, so client components can
// import it (mirrors src/data/products.ts and src/data/customers.ts).

/** One badge as stored in Firestore. The slug is the document id. */
export type StoredBadge = {
  slug: string;
  label: string;
  /** Retired badges disappear from the pickers but stay on products already carrying them. */
  retired: boolean;
  /** System badges cannot be retired or renamed. See SYSTEM_BADGES below. */
  system: boolean;
};

/** The eight badges that existed as a compiled union before B.6. Seed data only. */
export const SEED_BADGES: string[] = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];

/**
 * Badges that code depends on by name, so Michaela must not be able to retire or
 * rename them.
 *
 * Four are the targets of SENSITIVITY_BADGE in src/data/customers.ts, which is how a
 * dog's sensitivities become ribbons over product cards in step B.3. Retiring one
 * would stop that ribbon appearing anywhere, silently. "Most Popular" is matched by
 * name in src/components/Badge.tsx to decide whether to draw the star.
 *
 * A unit test asserts this list covers every SENSITIVITY_BADGE value, so adding a
 * fifth sensitivity without adding its badge here fails the build rather than
 * quietly shipping a ribbon nobody can see.
 */
export const SYSTEM_BADGES: string[] = [
  "Most Popular",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Natural Joint Support",
  "Novel Protein",
];

export const MAX_BADGE_LENGTH = 40;
```

```typescript
// src/lib/badge-admin.ts
// Pure helpers for the badge collection. No Firestore, no next/headers, no React,
// so this module is trivially unit-testable (mirrors product-admin.ts).

import { MAX_BADGE_LENGTH, type StoredBadge } from "@/data/badges";
import { SENSITIVITY_BADGE, SENSITIVITY_LABEL, type Sensitivity } from "@/data/customers";

/** The Firestore document id for a badge label. */
export function badgeSlug(label: string): string {
  return String(label ?? "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map a Firestore doc to a badge, tolerating a partial record. */
export function docToStoredBadge(slug: string, data: Record<string, unknown>): StoredBadge {
  return {
    slug,
    label: String(data.label ?? ""),
    retired: data.retired === true,
    system: data.system === true,
  };
}

/**
 * Validate a new or renamed badge label against the badges that already exist.
 *
 * Stricter than validateDogInput deliberately. A dog is filled in by conversation and
 * a half-known dog is worth keeping, but a badge is a deliberate act with one field,
 * and a duplicate or unusable one is a mess on every product card that carries it.
 */
export function validateBadgeInput(
  input: { label?: string },
  existing: StoredBadge[],
): { ok: true; value: { label: string } } | { ok: false; errors: string[] } {
  const label = String(input.label ?? "").trim();
  if (!label) return { ok: false, errors: ["A badge needs a name."] };
  if (label.length > MAX_BADGE_LENGTH) {
    return { ok: false, errors: [`Keep a badge to ${MAX_BADGE_LENGTH} characters or fewer.`] };
  }

  const slug = badgeSlug(label);
  if (!slug) return { ok: false, errors: ["That name cannot be used."] };
  if (existing.some((b) => b.slug === slug)) {
    return { ok: false, errors: ["There is already a badge called that."] };
  }

  return { ok: true, value: { label } };
}

/**
 * Why a badge is protected, named specifically, or null if it is not.
 *
 * Deliberately names the feature rather than saying "this is a system badge". A
 * refusal Michaela cannot understand becomes a message to Liam, and B.6 exists so
 * that she does not need him to manage her own labels. It also always tells her what
 * she CAN do instead, because what she usually wants is this badge off this product,
 * not the badge gone entirely.
 */
export function badgeProtectionReason(label: string): string | null {
  const sensitivity = (Object.keys(SENSITIVITY_BADGE) as Sensitivity[]).find(
    (s) => SENSITIVITY_BADGE[s] === label,
  );
  if (sensitivity) {
    return (
      `This badge powers the "${SENSITIVITY_LABEL[sensitivity]}" ribbon, shown to owners whose ` +
      `dog has that flagged on their profile. Retiring it would stop those ribbons appearing. ` +
      `You can stop putting it on products instead.`
    );
  }
  if (label === "Most Popular") {
    return (
      "This badge draws the star on a product card, so the site looks for it by name. " +
      "You can stop putting it on products instead."
    );
  }
  return null;
}

/** Whether a badge may be retired, and a reason Michaela can act on if not. */
export function canRetireBadge(badge: StoredBadge): { ok: true } | { ok: false; reason: string } {
  if (!badge.system) return { ok: true };
  return {
    ok: false,
    reason:
      badgeProtectionReason(badge.label) ??
      "This badge is built in and the site depends on it by name. You can stop putting it on products instead.",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/badge-admin.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/badges.ts src/lib/badge-admin.ts src/lib/badge-admin.test.ts
git commit -m "feat: badge types, and the system badges code depends on by name"
```

---

### Task 2: The badges collection

**Files:**
- Modify: `src/lib/firebase-admin.ts` (the `COLLECTIONS` map)
- Create: `src/lib/badges-store.ts`

**Interfaces:**
- Consumes: `docToStoredBadge`, `badgeSlug` from Task 1.
- Produces: `getAllBadges(): Promise<StoredBadge[]>`, `getActiveBadgeLabels(): Promise<string[]>`, `createBadge(label): Promise<{ok: true; badge: StoredBadge} | {ok: false; errors: string[]}>`, `renameBadge(slug, label): Promise<{ok: boolean; errors?: string[]}>`, `setBadgeRetired(slug, retired): Promise<{ok: boolean; errors?: string[]}>`.

No unit test for this module: it is all Firestore calls, and the pure parts it depends on are covered by Task 1. It is exercised by hand in Task 5, exactly as the product routes were.

- [ ] **Step 1: Add the collection**

In `src/lib/firebase-admin.ts`, add to `COLLECTIONS`:

```typescript
  badges: "store_badges",
```

- [ ] **Step 2: Write the store**

```typescript
// src/lib/badges-store.ts
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { badgeSlug, docToStoredBadge, validateBadgeInput } from "@/lib/badge-admin";
import { SEED_BADGES, SYSTEM_BADGES, type StoredBadge } from "@/data/badges";

/**
 * Every badge, including retired ones, for the admin screen.
 *
 * Falls back to the seed list when Firestore is unreachable or empty, so the product
 * form never renders with no badges at all and look broken. Mirrors how
 * products-store falls back to the product seed.
 */
export async function getAllBadges(): Promise<StoredBadge[]> {
  const db = getDb();
  if (!db) return seedAsBadges();
  try {
    const snap = await db.collection(COLLECTIONS.badges).get();
    if (snap.empty) return seedAsBadges();
    return snap.docs
      .map((d) => docToStoredBadge(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error("[badges-store] read failed, falling back to the seed:", err);
    return seedAsBadges();
  }
}

/** The labels a product may currently carry. Retired badges are not offered. */
export async function getActiveBadgeLabels(): Promise<string[]> {
  return (await getAllBadges()).filter((b) => !b.retired).map((b) => b.label);
}

function seedAsBadges(): StoredBadge[] {
  return SEED_BADGES.map((label) => ({
    slug: badgeSlug(label),
    label,
    retired: false,
    system: SYSTEM_BADGES.includes(label),
  }));
}

export async function createBadge(
  label: string,
): Promise<{ ok: true; badge: StoredBadge } | { ok: false; errors: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const existing = await getAllBadges();
  const parsed = validateBadgeInput({ label }, existing);
  if (!parsed.ok) return parsed;

  const slug = badgeSlug(parsed.value.label);
  const badge: StoredBadge = { slug, label: parsed.value.label, retired: false, system: false };
  try {
    // create() rather than set(), so a concurrent create of the same slug fails
    // instead of silently overwriting. Same reasoning as the product create route.
    await db.collection(COLLECTIONS.badges).doc(slug).create({
      label: badge.label,
      retired: false,
      system: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[badges-store] create failed:", err);
    return { ok: false, errors: ["There is already a badge called that."] };
  }
  return { ok: true, badge };
}

/**
 * Rename a badge, and carry the new label onto every product wearing the old one.
 *
 * Products store badge labels rather than ids, so a rename that did not propagate
 * would leave those products carrying a badge that no longer exists. At nine
 * products a batch is plenty; if the catalogue ever runs to thousands this wants
 * paginating.
 */
export async function renameBadge(
  slug: string,
  label: string,
): Promise<{ ok: boolean; errors?: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const all = await getAllBadges();
  const badge = all.find((b) => b.slug === slug);
  if (!badge) return { ok: false, errors: ["That badge no longer exists."] };
  if (badge.system) {
    return {
      ok: false,
      errors: [
        "This badge is matched to dog profiles by name, so it cannot be renamed. " +
          "Renaming it would stop that matching working.",
      ],
    };
  }

  const parsed = validateBadgeInput({ label }, all.filter((b) => b.slug !== slug));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  try {
    const products = await db
      .collection(COLLECTIONS.products)
      .where("badges", "array-contains", badge.label)
      .get();

    const batch = db.batch();
    // The slug stays as it was. Re-slugging would orphan every product carrying it,
    // and the slug is only a document id, never shown to anybody.
    batch.set(
      db.collection(COLLECTIONS.badges).doc(slug),
      { label: parsed.value.label, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    for (const doc of products.docs) {
      const badges = (doc.data().badges as string[]).map((b) =>
        b === badge.label ? parsed.value.label : b,
      );
      batch.set(doc.ref, { badges, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.error("[badges-store] rename failed:", err);
    return { ok: false, errors: ["Rename failed."] };
  }
  return { ok: true };
}

/** Retire or un-retire. Never deletes, so products keep the badges they have. */
export async function setBadgeRetired(
  slug: string,
  retired: boolean,
): Promise<{ ok: boolean; errors?: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const badge = (await getAllBadges()).find((b) => b.slug === slug);
  if (!badge) return { ok: false, errors: ["That badge no longer exists."] };

  if (retired) {
    const allowed = canRetireBadge(badge);
    if (!allowed.ok) return { ok: false, errors: [allowed.reason] };
  }

  try {
    await db
      .collection(COLLECTIONS.badges)
      .doc(slug)
      .set({ retired, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error("[badges-store] retire failed:", err);
    return { ok: false, errors: ["Save failed."] };
  }
  return { ok: true };
}
```

Add `canRetireBadge` to the import from `@/lib/badge-admin` at the top of the file.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/badges-store.ts src/lib/firebase-admin.ts
git commit -m "feat: the badge collection, with rename carrying onto products"
```

---

### Task 3: Seed the eight existing badges

**Files:**
- Create: `scripts/seed-badges.mjs`

**Interfaces:**
- Consumes: `FIREBASE_SERVICE_ACCOUNT` from the environment.
- Produces: nothing in the app.

Model it on `scripts/backfill-product-fields.mjs`, which is already proven against the live project. Dry run by default, `--apply` to write, idempotent.

- [ ] **Step 1: Write the script**

```javascript
// scripts/seed-badges.mjs
// Put the eight badges that used to be a compiled union into store_badges, marking
// the five that code depends on by name as system badges.
//
// Idempotent: a badge already present is left exactly as it is, including its
// retired flag, so re-running never un-retires something Michaela retired.
//
// Dry run:  node scripts/seed-badges.mjs
// Apply:    node scripts/seed-badges.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

const SEED_BADGES = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];

const SYSTEM_BADGES = [
  "Most Popular",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Natural Joint Support",
  "Novel Protein",
];

const slug = (label) =>
  label.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const json = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!json) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT before running this.");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(json)) });
const db = getFirestore();

let written = 0;
for (const label of SEED_BADGES) {
  const id = slug(label);
  const ref = db.collection("store_badges").doc(id);
  if ((await ref.get()).exists) continue;
  written += 1;
  const system = SYSTEM_BADGES.includes(label);
  console.log(`${APPLY ? "creating" : "would create"} ${id}${system ? " (system)" : ""}`);
  if (APPLY) {
    await ref.set({ label, retired: false, system, createdAt: FieldValue.serverTimestamp() });
  }
}

console.log(
  `${SEED_BADGES.length} seed badges, ${written} ${APPLY ? "created" : "would be created"}.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
```

- [ ] **Step 2: Dry run it**

Run: `node scripts/seed-badges.mjs`
Expected: lists eight badges it would create, writes nothing.

- [ ] **Step 3: Apply, then prove idempotency**

Run: `node scripts/seed-badges.mjs --apply`
Then run: `node scripts/seed-badges.mjs`
Expected: the second run reports `0 would be created`. Same check the product and customer backfills passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-badges.mjs
git commit -m "chore: seed the eight existing badges into Firestore"
```

---

### Task 4: Validation stops trusting a compiled list

**Files:**
- Modify: `src/data/products.ts` (the `Badge` type and `ALL_BADGES`)
- Modify: `src/lib/product-admin.ts` (`validateProductInput`)
- Modify: `src/lib/product-admin.test.ts`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[slug]/route.ts`

**Interfaces:**
- Consumes: `getActiveBadgeLabels` from Task 2.
- Produces: `validateProductInput(input, allowedBadges: string[])`. **Every caller must pass the second argument.**

This is the riskiest task in the plan, because it changes a signature that the two product routes and an existing test file depend on. Do it in one go and run the whole suite, not just the badge tests.

Keeping the validator pure, with the allowed list passed in rather than fetched inside, is deliberate: it stays synchronous and unit-testable, and the Firestore read happens once in the route rather than once per validation.

- [ ] **Step 1: Write the failing test**

```typescript
// in src/lib/product-admin.test.ts, replace the existing badge test with these
describe("validateProductInput badges", () => {
  const allowed = ["Most Popular", "Single Ingredient"];
  const base = {
    name: "Beef Trachea Rings",
    price: 6.5,
    hook: "One ingredient",
    description: "Beef trachea, dried.",
    images: [{ url: "https://storage.googleapis.com/x/a.png" }],
    pillar: "good-food",
  };

  it("keeps a badge that is currently on the list", () => {
    const r = validateProductInput({ ...base, badges: ["Most Popular"] }, allowed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Most Popular"]);
  });

  it("drops a badge that is not on the list", () => {
    // Retired or invented. Either way it must not reach the product, or the card
    // renders a badge nobody can manage.
    const r = validateProductInput({ ...base, badges: ["Most Popular", "Made Up"] }, allowed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Most Popular"]);
  });

  it("accepts a badge Michaela added that was never in the old compiled union", () => {
    // The entire point of B.6.
    const r = validateProductInput({ ...base, badges: ["Great for Puppies"] }, [
      ...allowed,
      "Great for Puppies",
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Great for Puppies"]);
  });

  it("drops everything when the allowed list is empty", () => {
    const r = validateProductInput({ ...base, badges: ["Most Popular"] }, []);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/product-admin.test.ts`
Expected: FAIL. `validateProductInput` takes one argument, so the second is ignored and "Great for Puppies" is dropped.

- [ ] **Step 3: Widen the type**

In `src/data/products.ts`, replace the union with:

```typescript
/**
 * A badge label. Was a compiled union until B.6; badges now live in the
 * store_badges collection so Michaela can add her own without a deploy, and the
 * authority on what is valid is that collection, not this type.
 */
export type Badge = string;

/** The badges the site shipped with. Seed data, not the list of what is valid. */
export const ALL_BADGES: Badge[] = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];
```

- [ ] **Step 4: Take the allowed list as an argument**

In `src/lib/product-admin.ts`, change the signature and the badge filter:

```typescript
export function validateProductInput(
  input: Partial<ProductInput>,
  allowedBadges: string[],
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
```

```typescript
  // Filtered against what is in the badge collection right now, so a retired or
  // invented badge never reaches a product. Passed in rather than read here, to
  // keep this function pure and synchronous.
  const badges = Array.isArray(input.badges)
    ? input.badges.filter((b): b is Badge => allowedBadges.includes(String(b)))
    : [];
```

- [ ] **Step 5: Update both product routes**

In `src/app/api/admin/products/route.ts` and `src/app/api/admin/products/[slug]/route.ts`, import the store and pass the list:

```typescript
import { getActiveBadgeLabels } from "@/lib/badges-store";
```

Then, immediately before each `validateProductInput` call:

```typescript
  const allowedBadges = await getActiveBadgeLabels();
  const parsed = validateProductInput(body, allowedBadges);
```

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: all tests pass, typecheck clean, lint at the 3 errors that pre-date this work. If typecheck reports a missing second argument anywhere, that is a caller this plan missed. Add it.

- [ ] **Step 7: Commit**

```bash
git add src/data/products.ts src/lib/product-admin.ts src/lib/product-admin.test.ts src/app/api/admin/products
git commit -m "feat: product validation filters badges against the collection, not a union"
```

---

### Task 5: The badge admin routes

**Files:**
- Create: `src/app/api/admin/badges/route.ts`
- Create: `src/app/api/admin/badges/[slug]/route.ts`

**Interfaces:**
- Consumes: `requireStaff` from `@/lib/auth`, `isAllowedOrigin` from `@/lib/auth-helpers`, and Task 2's store functions.
- Produces: `GET/POST /api/admin/badges`, `PATCH/DELETE /api/admin/badges/{slug}`.

Read the route handler guide in `node_modules/next/dist/docs/` first. Note that a dynamic segment's `params` is a promise in this version, so it is awaited.

These are staff-only, so they use `requireStaff` and the existing `isAllowedOrigin`, matching the product routes. Do not use `isBrowserSameOrigin`: that stricter helper exists for the customer account routes, and the admin routes follow the product-route pattern.

- [ ] **Step 1: Write the collection route**

```typescript
// src/app/api/admin/badges/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { createBadge, getAllBadges } from "@/lib/badges-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

export async function GET() {
  await requireStaff();
  return NextResponse.json({ ok: true, badges: await getAllBadges() });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  if (!isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl())) {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  }

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const result = await createBadge(String(body.label ?? ""));
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Write the item route**

```typescript
// src/app/api/admin/badges/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { isAllowedOrigin } from "@/lib/auth-helpers";
import { renameBadge, setBadgeRetired } from "@/lib/badges-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

function guard(req: NextRequest) {
  return isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl());
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const { slug } = await params;

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const result = await renameBadge(slug, String(body.label ?? ""));
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

/** Retire, or un-retire with {"retired": false}. Never deletes. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  if (!guard(req)) return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 403 });
  const { slug } = await params;

  let retired = true;
  try {
    const body = await req.json();
    if (body && body.retired === false) retired = false;
  } catch {
    // No body means retire, which is what the button sends.
  }

  const result = await setBadgeRetired(slug, retired);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Verify by hand**

Sign in as staff, then from the browser console on the site's own origin:

```javascript
await (await fetch("/api/admin/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Great for Puppies" }) })).json()
```

Expected: `{ ok: true, badge: { slug: "great-for-puppies", label: "Great for Puppies", retired: false, system: false } }`.

Then prove a system badge is protected:

```javascript
await (await fetch("/api/admin/badges/novel-protein", { method: "DELETE" })).json()
```

Expected: `ok: false`, and an error mentioning the dog profile matching. **This is the check the whole plan exists for. Do not skip it.**

Then prove the duplicate guard:

```javascript
await (await fetch("/api/admin/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "great for puppies" }) })).json()
```

Expected: `ok: false`, "There is already a badge called that."

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/badges
git commit -m "feat: staff routes to add, rename and retire a badge"
```

---

### Task 6: Michaela's badge screen

**Files:**
- Create: `src/app/admin/badges/page.tsx`
- Create: `src/components/admin/BadgeManager.tsx`
- Modify: `src/app/admin/page.tsx` (one link into the new screen)

**Interfaces:**
- Consumes: `getAllBadges` from Task 2, the routes from Task 5.
- Produces: nothing later tasks depend on.

Use the design vocabulary the account page and the product form now share: `.panel`, `.panel__title`, `.field`, `.chip`, `.btn`, `.form-error`. Do not hand-roll bare inputs. That was the "Windows 95" note that got the product form rewritten.

**Check before adding the admin nav link:** the members-area track and the D.4 to D.6 track were both adding one. Look at `src/app/admin/page.tsx` as it stands and add a link in the same shape as whatever is already there, rather than inventing a second pattern.

- [ ] **Step 1: Write the page**

```tsx
// src/app/admin/badges/page.tsx
import { requireStaff } from "@/lib/auth";
import { getAllBadges } from "@/lib/badges-store";
import BadgeManager from "@/components/admin/BadgeManager";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  await requireStaff();
  const badges = await getAllBadges();

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Staff</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
          Badges
        </h1>
        <p style={{ marginTop: "1rem", maxWidth: "60ch" }}>
          These are the labels you can put on a product. Add your own whenever you like. Retiring
          one takes it off the list for new products without removing it from products that already
          carry it.
        </p>
        <BadgeManager initial={badges} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the manager**

```tsx
// src/components/admin/BadgeManager.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoredBadge } from "@/data/badges";

export default function BadgeManager({ initial }: { initial: StoredBadge[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError((data.errors ?? ["That did not work."]).join(" "));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="form-error" role="alert" style={{ margin: "1.2rem 0" }}>
          {error}
        </p>
      )}

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="panel__title">Your badges</p>
        {initial.map((badge) => (
          <div
            key={badge.slug}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
              flexWrap: "wrap",
              padding: "0.9rem 0",
              borderTop: "1px solid var(--line)",
            }}
          >
            {editing === badge.slug ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.7rem", border: "1px solid var(--line)", borderRadius: 8 }}
                />
                <button
                  type="button"
                  className="linkbtn"
                  disabled={busy}
                  onClick={async () => {
                    if (await send(`/api/admin/badges/${badge.slug}`, "PATCH", { label: draft })) {
                      setEditing(null);
                    }
                  }}
                >
                  Save
                </button>
                <button type="button" className="linkbtn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className={badge.retired ? "badge" : "badge"} style={badge.retired ? { opacity: 0.45 } : undefined}>
                  {badge.label}
                </span>
                {badge.retired && <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>retired</span>}
                {badge.system && (
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    built in, matched to dog profiles
                  </span>
                )}
                <span style={{ marginLeft: "auto", display: "flex", gap: "0.9rem" }}>
                  {!badge.system && (
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => {
                        setEditing(badge.slug);
                        setDraft(badge.label);
                        setError("");
                      }}
                    >
                      Rename
                    </button>
                  )}
                  {!badge.system && (
                    <button
                      type="button"
                      className="linkbtn"
                      disabled={busy}
                      onClick={() =>
                        send(`/api/admin/badges/${badge.slug}`, "DELETE", { retired: !badge.retired })
                      }
                    >
                      {badge.retired ? "Put back" : "Retire"}
                    </button>
                  )}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/admin/badges", "POST", { label })) setLabel("");
        }}
      >
        <p className="panel__title">Add a badge</p>
        <label className="field">
          <span>What should it say?</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
          <span className="field__hint">
            Keep it short. It has to fit on a pill over a product photo.
          </span>
        </label>
        <p style={{ marginTop: "1.2rem" }}>
          <button className="btn btn--solid-ink btn--block" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add this badge"}
          </button>
        </p>
      </form>
    </>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Sign in as staff and go to `/admin/badges`.

Expected: the eight badges listed, the five system ones showing "built in, matched to dog profiles" with no Rename or Retire buttons, and the other three offering both. Add "Great for Puppies" and watch it appear without a manual reload. Retire "Single Ingredient" and confirm it greys out and says retired.

- [ ] **Step 4: Run the whole suite**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: tests pass, typecheck clean, lint at the 3 pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/badges src/components/admin/BadgeManager.tsx src/app/admin/page.tsx
git commit -m "feat: a screen where Michaela adds, renames and retires her own badges"
```

---

### Task 7: The product form offers the live list

**Files:**
- Modify: `src/components/admin/ProductForm.tsx`
- Modify: `src/app/admin/products/new/page.tsx`
- Modify: `src/app/admin/products/[slug]/page.tsx`

Those are the only two files that render `<ProductForm>`, confirmed by grep.

**Interfaces:**
- Consumes: `getActiveBadgeLabels` from Task 2.
- Produces: nothing.

The form currently imports `ALL_BADGES` and renders a chip per entry. It must render a chip per **active badge in the collection**, so a badge Michaela adds appears here without a deploy, which is the entire point of B.6.

Fetch in the page, which is already a server component, and pass down. Do not fetch in the client component.

- [ ] **Step 1: Pass the list in**

In `src/components/admin/ProductForm.tsx`, add `availableBadges` to the props and use it:

```tsx
export function ProductForm({
  mode,
  initial,
  availableBadges,
}: {
  mode: Mode;
  initial?: Product;
  availableBadges: string[];
}) {
```

Remove `ALL_BADGES` from the `@/lib/product-admin` import, and change the badge chips to map over `availableBadges` instead:

```tsx
          {availableBadges.map((b) => (
            <button
              key={b}
              type="button"
              className="chip"
              aria-pressed={badges.includes(b)}
              onClick={() => toggleBadge(b)}
            >
              {b}
            </button>
          ))}
```

A badge already on the product but since retired will not appear as a chip. Keep it on the product anyway: it is still on the card, and silently stripping it on the next save would be a surprise. Render those under the chips:

```tsx
          {badges.filter((b) => !availableBadges.includes(b)).map((b) => (
            <span key={b} className="badge" style={{ opacity: 0.5 }} title="Retired badge, still on this product">
              {b}
            </span>
          ))}
```

- [ ] **Step 2: Feed it from both pages**

In each page that renders `<ProductForm>`:

```tsx
import { getActiveBadgeLabels } from "@/lib/badges-store";
```

```tsx
  const availableBadges = await getActiveBadgeLabels();
```

and pass `availableBadges={availableBadges}`.

- [ ] **Step 3: Verify in the browser**

Go to `/admin/products/new`.

Expected: the badge chips match what is on `/admin/badges`, including "Great for Puppies" added in Task 6, and excluding anything retired. Open an existing product that carries a retired badge and confirm it still shows, greyed, and survives a save.

- [ ] **Step 4: Run the whole suite**

Run: `npm test -- --run && npx tsc --noEmit && npm run lint`
Expected: tests pass, typecheck clean, lint at the 3 pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ProductForm.tsx src/app/admin/products
git commit -m "feat: the product form offers the badges that actually exist"
```

---

## Deploy order

This joins the queue that already has the membership backfill and the product-images backfill in it:

1. Deploy the code.
2. Run `node scripts/seed-badges.mjs --apply`.
3. Only then use the badge admin.

Until step 2 runs, `getAllBadges` falls back to the seed list, so the product form keeps working and nothing looks broken. But a badge created before the seed lands would sit alongside eight badges that do not exist in the collection yet, and the seed would then not create them, because it skips ids that already exist... which they would not. Run the seed first and the question never arises.

## What this deliberately leaves alone

- **Products keep storing badge labels**, not ids. That is what keeps this change out of `ProductCard.tsx`, which B.3 owns. The cost is that system badges cannot be renamed. If Michaela ever asks to reword one, the fix is to store ids on products and resolve at render, and that wants its own plan.
- **The star on "Most Popular"** stays a string match in `Badge.tsx`. Making it a `star` flag on the badge document would mean the product card fetching badge records to render, which is a bigger change in a file B.3 owns.
- **Badge ordering** is alphabetical by label. Nobody has asked for a curated order, and the product sort-order question in `HANDOVER.md` is the one that actually matters.
