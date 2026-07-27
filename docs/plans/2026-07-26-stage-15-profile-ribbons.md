# Stage 15: Profile Ribbons (B.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each signed-in customer's dog profiles as ribbons over product cards (build order step B.3), and settle the "Loki's Mum" greeting convention.

**Architecture:** A pure module (`src/lib/dog-merchandising.ts`) decides which ribbons a card shows from a customer's dogs and a product's badges. A thin server-only helper (`src/lib/viewer-dogs.ts`) reads the session cookie and the customer record, and the three server surfaces that already fetch products (home page, shop page, `PillarProducts`) pass the dogs down to `ProductCard` as a prop. Signed-out and dog-less visitors get an empty array, render exactly today's markup, and pay nothing.

**Tech Stack:** Next.js App Router (server components fetch, client `ProductCard` renders), Vitest, plain CSS in `globals.css`.

## Global Constraints

- British spelling, NO em dashes, anywhere (copy, comments, commits, docs).
- Baseline: 271 tests passing, `npx tsc --noEmit` clean, `npm run lint` at exactly 3 pre-existing errors (CartProvider.tsx, thank-you/page.tsx). Never more, never fewer.
- `SENSITIVITY_BADGE` and the sensitivity vocabulary in `src/data/customers.ts` must not drift; the existing test in `src/lib/customer-fields.test.ts` guards it.
- Spec 3.4: Michaela's hand-set product badges and these profile-driven ribbons are separate systems and must stay visually and logically distinct.
- Do not touch `/members` pages, admin posts, `/stall`, `/join`, dogs-of-the-day pages, checkout/cart/stripe-sync, HANDOVER.md, vercel.json. Do not push or merge.
- Commit per task, body ending: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Design decisions (recorded per the brief)

### Matching

Two ribbon kinds, both computed per dog per product:

1. **Suit ribbon** (why the product suits this dog): the dog has a sensitivity whose
   `SENSITIVITY_BADGE` entry appears in `product.badges`. One suit ribbon per dog per
   card at most; when several sensitivities match, the first in the dog's stored order
   wins, because a second ribbon for the same dog says nothing new.
2. **Caution ribbon** (why it does not): one of the dog's free-text allergy tokens
   appears as a whole word, case-insensitively, in the **product name only**. The name
   is the honest matching surface on this site ("one ingredient, named in full");
   description text false-positives (the Rabbit Ears description mentions chicken while
   containing none), so descriptions are never matched.

Precedence: for the same dog, a caution suppresses any suit ribbon ("Gentle for Loki"
on a product Loki reacts to would be the worst line the site could print). Across the
card, cautions sort before suits; within each kind, dogs keep their stored order.

### The cap

**Two ribbons per card** (`MAX_CARD_RIBBONS = 2`). The media panel is a square that
already carries Michaela's badge column top left and the gallery dots bottom centre;
two pills top right is the most the photo can carry without being buried. Cautions
take the slots first.

### Wording (British, no em dashes, dog's name always present)

| Trigger | Ribbon text |
|---|---|
| sensitive-tummy matched | `Gentle for Loki` |
| itchy-skin matched | `Good for Loki's coat` |
| stiff-joints matched | `Kind to Loki's joints` |
| common-proteins matched | `A new protein for Loki` |
| allergy hit on the name | `Not one for Loki` |

Possessives follow the site's existing rule from `dogOwnerLabel`: a name ending in s
takes a bare apostrophe (`Gus' coat`).

### The greeting convention

The spec names the convention "Loki's Mum", but the record never stores who is reading:
gender is not collected, and 8.3 says one account can serve a whole household. So the
site renders the gender-neutral form always: **"Loki's human"** (and "Loki and Bear's
human" for several dogs). Warm, honest and in the site's voice; nobody is misgendered
by a guess. The account page heading is the only greeting surface today and already
calls `dogOwnerLabel`, so the change is one word in `customer-fields.ts` plus its
tests. The convention keeps its spec name in the docs.

### Delivery of dog data

Server side, by props, no client fetch: `getViewerDogs()` in `src/lib/viewer-dogs.ts`
(server-only) reads the session via `getSessionUser()` and the record via
`getCustomer(uid)`. The home page, the shop page and `PillarProducts` (itself a server
component, covering all four pillar pages) call it and pass `dogs` into `ProductCard`.
All five surfaces are already `force-dynamic`, so the cookie read changes nothing about
rendering mode. `ProductCard` takes `dogs` as an optional prop defaulting to `[]`, so
every other renderer of the card (the members track renders it too) is untouched.

### Visual language

Ribbons are pills like everything else, but the dog's side of the card: **top right,
right-aligned, sentence case** against Michaela's **top left, uppercase** badge column.
Suit ribbons are solid ink on paper text; the caution ribbon is paper with a dashed ink
border. No new colours, one small append-only block in `globals.css`.

## File structure

- Create: `src/lib/dog-merchandising.ts` (pure ribbon logic) and `src/lib/dog-merchandising.test.ts`
- Create: `src/lib/viewer-dogs.ts` (server-only session-to-dogs glue, no logic)
- Modify: `src/lib/customer-fields.ts` (greeting word), `src/lib/customer-fields.test.ts`
- Modify: `src/components/ProductCard.tsx` (optional `dogs` prop, ribbon overlay)
- Modify: `src/components/PillarProducts.tsx`, `src/app/page.tsx`, `src/app/shop/page.tsx` (fetch and pass dogs)
- Modify: `src/app/globals.css` (append `.card__ribbons`, `.ribbon`, `.ribbon--caution`)

---

### Task 1: The pure ribbon module

**Files:**
- Create: `src/lib/dog-merchandising.ts`
- Test: `src/lib/dog-merchandising.test.ts`

**Interfaces:**
- Consumes: `Dog`, `Sensitivity`, `SENSITIVITY_BADGE`, `ALL_SENSITIVITIES` from `@/data/customers`; `Badge` from `@/data/products`.
- Produces: `type RibbonKind = "suit" | "caution"`, `type Ribbon = { key: string; kind: RibbonKind; text: string }`, `const MAX_CARD_RIBBONS = 2`, `const RIBBON_WORDING: Record<Sensitivity, (name: string) => string>`, `function productRibbons(dogs: Dog[], product: { name: string; badges: Badge[] }): Ribbon[]`.

- [x] **Step 1: Write the failing tests**

```ts
// src/lib/dog-merchandising.test.ts
import { describe, it, expect } from "vitest";
import { ALL_SENSITIVITIES, type Dog } from "@/data/customers";
import {
  MAX_CARD_RIBBONS,
  RIBBON_WORDING,
  productRibbons,
} from "./dog-merchandising";

const dog = (over: Partial<Dog>): Dog => ({ id: "dog-1", name: "Loki", ...over });
const sprats = { name: "Whole Sprats", badges: ["Most Popular", "Best for Skin & Coat"] as const };
const chickenFeet = {
  name: "Chicken Feet",
  badges: ["Natural Joint Support", "Single Ingredient"] as const,
};

describe("RIBBON_WORDING", () => {
  it("has a line for every sensitivity, so no profile answer is collected and never shown", () => {
    for (const s of ALL_SENSITIVITIES) {
      expect(RIBBON_WORDING[s]("Loki")).toContain("Loki");
    }
  });

  it("gives a name ending in s a bare apostrophe, matching the greeting rule", () => {
    expect(RIBBON_WORDING["itchy-skin"]("Gus")).toBe("Good for Gus' coat");
  });
});

describe("productRibbons", () => {
  it("shows nothing with no dogs, so signed-out cards are exactly today's cards", () => {
    expect(productRibbons([], sprats)).toEqual([]);
  });

  it("shows nothing for a dog with no sensitivities or allergies", () => {
    expect(productRibbons([dog({})], sprats)).toEqual([]);
  });

  it("turns a matched sensitivity into a suit ribbon with the dog's name", () => {
    const out = productRibbons([dog({ sensitivities: ["itchy-skin"] })], sprats);
    expect(out).toEqual([{ key: "dog-1-suit", kind: "suit", text: "Good for Loki's coat" }]);
  });

  it("shows no suit ribbon when the mapped badge is not on the product", () => {
    expect(productRibbons([dog({ sensitivities: ["sensitive-tummy"] })], sprats)).toEqual([]);
  });

  it("caps a dog at one ribbon even when two sensitivities match", () => {
    const rabbitEars = {
      name: "Rabbit Ears",
      badges: ["Novel Protein", "Gentle on Dodgy Tummies"] as const,
    };
    const out = productRibbons(
      [dog({ sensitivities: ["sensitive-tummy", "common-proteins"] })],
      rabbitEars,
    );
    expect(out).toEqual([{ key: "dog-1-suit", kind: "suit", text: "Gentle for Loki" }]);
  });

  it("gives each matching dog a ribbon, in the order the dogs are stored", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-2", name: "Bear", sensitivities: ["itchy-skin"] }),
      ],
      sprats,
    );
    expect(out.map((r) => r.text)).toEqual(["Good for Loki's coat", "Good for Bear's coat"]);
  });

  it("caps the card at MAX_CARD_RIBBONS ribbons", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-2", name: "Bear", sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-3", name: "Nell", sensitivities: ["itchy-skin"] }),
      ],
      sprats,
    );
    expect(out).toHaveLength(MAX_CARD_RIBBONS);
    expect(out.map((r) => r.text)).toEqual(["Good for Loki's coat", "Good for Bear's coat"]);
  });

  it("turns an allergy whose word appears in the product name into a caution", () => {
    const out = productRibbons([dog({ allergies: ["chicken"] })], chickenFeet);
    expect(out).toEqual([{ key: "dog-1-caution", kind: "caution", text: "Not one for Loki" }]);
  });

  it("matches whole words only, so chick does not condemn chicken", () => {
    expect(productRibbons([dog({ allergies: ["chick"] })], chickenFeet)).toEqual([]);
  });

  it("matches the name case-insensitively", () => {
    const out = productRibbons([dog({ allergies: ["CHICKEN"] })], chickenFeet);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("caution");
  });

  it("never matches the description, only the name", () => {
    // The Rabbit Ears description mentions chicken while containing none, which is
    // exactly why descriptions are out of bounds. The function never sees one.
    const rabbitEars = { name: "Rabbit Ears", badges: ["Novel Protein"] as const };
    expect(productRibbons([dog({ allergies: ["chicken"] })], rabbitEars)).toEqual([]);
  });

  it("lets a caution suppress the same dog's suit ribbon", () => {
    const out = productRibbons(
      [dog({ sensitivities: ["stiff-joints"], allergies: ["chicken"] })],
      chickenFeet,
    );
    expect(out).toEqual([{ key: "dog-1-caution", kind: "caution", text: "Not one for Loki" }]);
  });

  it("sorts cautions before suits across dogs, and cautions take the capped slots", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["stiff-joints"] }),
        dog({ id: "dog-2", name: "Bear", allergies: ["chicken"] }),
      ],
      chickenFeet,
    );
    expect(out.map((r) => r.kind)).toEqual(["caution", "suit"]);
  });

  it("skips a dog whose name is blank, because a ribbon with no name says nothing", () => {
    expect(productRibbons([dog({ name: "  ", sensitivities: ["itchy-skin"] })], sprats)).toEqual([]);
  });

  it("does not choke on an allergy token that is regex-hostile", () => {
    expect(productRibbons([dog({ allergies: ["(beef)"] })], chickenFeet)).toEqual([]);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/dog-merchandising.test.ts`
Expected: FAIL, module not found.

- [x] **Step 3: Write the implementation**

```ts
// src/lib/dog-merchandising.ts
// Pure ribbon logic for step B.3: which ribbons a product card shows for the
// viewer's dogs. No Firestore, no next/headers, no React, so both the server
// pages and the client ProductCard can import it (mirrors customer-fields.ts).
//
// These ribbons are the site reacting to the dog looking at the card. Michaela's
// hand-set badges describe the product. Spec section 3.4 keeps the two systems
// separate, which is why this module never invents badges and never edits them.

import { SENSITIVITY_BADGE, type Dog, type Sensitivity } from "@/data/customers";
import type { Badge } from "@/data/products";

export type RibbonKind = "suit" | "caution";

export type Ribbon = {
  /** Stable per card: one ribbon per dog, so the dog id plus the kind is enough. */
  key: string;
  kind: RibbonKind;
  text: string;
};

/**
 * Two ribbons per card at most. The media square already carries Michaela's badge
 * column top left and the gallery dots bottom centre; more than two pills top
 * right would bury the photo the card exists to show.
 */
export const MAX_CARD_RIBBONS = 2;

/** "Gus' coat", not "Gus's coat", matching dogOwnerLabel in customer-fields.ts. */
const possessive = (name: string): string => (name.endsWith("s") ? `${name}'` : `${name}'s`);

/**
 * One line per sensitivity, keyed on the vocabulary in src/data/customers.ts so
 * it cannot drift from SENSITIVITY_BADGE without the type breaking. The test
 * proves every sensitivity has a line, for the same reason the badge map has one:
 * a profile answer with no rendering is a field collected and never used.
 */
export const RIBBON_WORDING: Record<Sensitivity, (name: string) => string> = {
  "sensitive-tummy": (name) => `Gentle for ${name}`,
  "itchy-skin": (name) => `Good for ${possessive(name)} coat`,
  "stiff-joints": (name) => `Kind to ${possessive(name)} joints`,
  "common-proteins": (name) => `A new protein for ${name}`,
};

/** Whole-word, case-insensitive match against the product name only. */
const nameCarries = (productName: string, allergy: string): boolean => {
  const token = allergy.trim();
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(productName);
};

/**
 * The ribbons a product card shows for these dogs.
 *
 * Matching is deliberately narrow. A suit ribbon needs a sensitivity whose mapped
 * badge is on the product, so Michaela's own product description stays the source
 * of truth for what the product is good for. A caution needs the allergy word in
 * the product NAME: on a site that sells one ingredient named in full, the name is
 * the honest surface, and description text false-positives (the Rabbit Ears copy
 * mentions chicken while containing none).
 *
 * Per dog, a caution suppresses the suit ribbon: "Gentle for Loki" on a product
 * Loki reacts to would be the worst line the site could print. Across the card,
 * cautions sort first and take the capped slots first, because a warning matters
 * more than a recommendation.
 */
export function productRibbons(
  dogs: Dog[],
  product: { name: string; badges: readonly Badge[] },
): Ribbon[] {
  const cautions: Ribbon[] = [];
  const suits: Ribbon[] = [];
  for (const dog of dogs) {
    const name = dog.name.trim();
    if (!name) continue;
    if ((dog.allergies ?? []).some((a) => nameCarries(product.name, a))) {
      cautions.push({ key: `${dog.id}-caution`, kind: "caution", text: `Not one for ${name}` });
      continue;
    }
    const matched = (dog.sensitivities ?? []).find((s) =>
      product.badges.includes(SENSITIVITY_BADGE[s]),
    );
    if (matched) {
      suits.push({ key: `${dog.id}-suit`, kind: "suit", text: RIBBON_WORDING[matched](name) });
    }
  }
  return [...cautions, ...suits].slice(0, MAX_CARD_RIBBONS);
}
```

- [x] **Step 4: Run the tests to verify they pass, then the full gates**

Run: `npx vitest run src/lib/dog-merchandising.test.ts` then `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: new file green, 271 + 16 total, tsc clean, lint at exactly 3.

- [x] **Step 5: Commit**

```bash
git add src/lib/dog-merchandising.ts src/lib/dog-merchandising.test.ts
git commit -m "feat: the pure ribbon logic, a dog's profile against a product's badges"
```

---

### Task 2: The gender-neutral greeting

**Files:**
- Modify: `src/lib/customer-fields.ts` (dogOwnerLabel)
- Test: `src/lib/customer-fields.test.ts` (the dogOwnerLabel describe block)

**Interfaces:**
- Produces: `dogOwnerLabel` keeps its exact signature; only the rendered word changes from `Mum` to `human`.

- [x] **Step 1: Update the tests to the decided wording (failing first)**

In `src/lib/customer-fields.test.ts`, rewrite the `dogOwnerLabel` block:

```ts
describe("dogOwnerLabel", () => {
  // The spec calls this the "Loki's Mum" convention, but the record never stores
  // who is reading: gender is not collected, and one account serves a household
  // (spec 8.3). So the site always renders the neutral form, "Loki's human".
  it("names the first dog, the Loki's Mum convention rendered gender-neutrally", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }])).toBe("Loki's human");
  });

  it("adds an apostrophe only for a name ending in s", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Gus" }])).toBe("Gus' human");
  });

  it("joins two dogs with and, because both names are how she knows them", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }, { id: "d2", name: "Bear" }]))
      .toBe("Loki and Bear's human");
  });

  it("falls back to a plain greeting with no dogs, never to an empty possessive", () => {
    expect(dogOwnerLabel([])).toBe("");
  });
});
```

- [x] **Step 2: Run to verify the three wording tests fail**

Run: `npx vitest run src/lib/customer-fields.test.ts`
Expected: 3 failures, all expecting `human` and receiving `Mum`.

- [x] **Step 3: Change the implementation**

In `src/lib/customer-fields.ts`, update the doc comment and the return line of `dogOwnerLabel`:

```ts
/**
 * The "Loki's Mum" naming convention from spec section 8.2, used in emails and on
 * the account page, rendered gender-neutrally as "Loki's human": the record never
 * stores who is reading (gender is not collected, and spec 8.3 gives one account
 * to a whole household), so the site never guesses. Returns "" with no dogs, so
 * the caller falls back to a plain greeting rather than a dangling possessive.
 */
export function dogOwnerLabel(dogs: { id: string; name: string }[]): string {
  const names = dogs.map((d) => d.name.trim()).filter(Boolean);
  if (!names.length) return "";
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  // "Gus' human", not "Gus's human".
  return joined.endsWith("s") ? `${joined}' human` : `${joined}'s human`;
}
```

- [x] **Step 4: Run the full gates**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: all green, lint at exactly 3.

- [x] **Step 5: Commit**

```bash
git add src/lib/customer-fields.ts src/lib/customer-fields.test.ts
git commit -m "feat: the greeting goes gender-neutral, Loki's human"
```

---

### Task 3: Ribbons on the card, and the CSS

**Files:**
- Modify: `src/components/ProductCard.tsx`
- Modify: `src/app/globals.css` (append only)

**Interfaces:**
- Consumes: `productRibbons`, `Ribbon` from `@/lib/dog-merchandising`; `Dog` from `@/data/customers`.
- Produces: `ProductCard({ product, dogs = [] }: { product: Product; dogs?: Dog[] })`. Every existing call site compiles unchanged.

- [x] **Step 1: Add the prop and the overlay to ProductCard**

In `src/components/ProductCard.tsx`: add imports, widen the signature, compute ribbons, and render the overlay as the first child of `.card__media` after the badges block.

```tsx
import type { Dog } from "@/data/customers";
import { productRibbons } from "@/lib/dog-merchandising";

export function ProductCard({ product, dogs = [] }: { product: Product; dogs?: Dog[] }) {
```

and inside `.card__media`, directly after the closing of the badges conditional:

```tsx
{ribbons.length > 0 && (
  <div className="card__ribbons">
    {ribbons.map((r) => (
      <span key={r.key} className={r.kind === "caution" ? "ribbon ribbon--caution" : "ribbon"}>
        {r.text}
      </span>
    ))}
  </div>
)}
```

with, above the return:

```tsx
const ribbons = productRibbons(dogs, product);
```

- [x] **Step 2: Append the CSS block to globals.css**

```css
/* B.3 profile ribbons: the dog's side of the card. Michaela's badges sit top left,
   uppercase, and describe the product; these sit top right, sentence case, and react
   to the viewer's dogs (spec 3.4 keeps the two systems separate). Absolutely
   positioned, so a card with none renders exactly as before. */
.card__ribbons { position: absolute; top: 0.7rem; right: 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end; z-index: 2; pointer-events: none; }
.ribbon { font-size: 0.7rem; font-weight: 700; padding: 0.32rem 0.65rem; border-radius: 999px; background: var(--ink); color: var(--paper); border: 1.5px solid var(--ink); white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.ribbon--caution { background: var(--paper); color: var(--ink); border-style: dashed; }
```

- [x] **Step 3: Run the gates**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: all green (no call site passes dogs yet, prop is optional), lint at exactly 3.

- [x] **Step 4: Commit**

```bash
git add src/components/ProductCard.tsx src/app/globals.css
git commit -m "feat: the card takes the viewer's dogs and wears their ribbons"
```

---

### Task 4: The dogs reach the cards, server side

**Files:**
- Create: `src/lib/viewer-dogs.ts`
- Modify: `src/components/PillarProducts.tsx`, `src/app/page.tsx`, `src/app/shop/page.tsx`

**Interfaces:**
- Consumes: `getSessionUser` from `@/lib/auth`, `getCustomer` from `@/lib/customers-store`, `ProductCard`'s `dogs` prop from Task 3.
- Produces: `async function getViewerDogs(): Promise<Dog[]>` (server-only).

- [x] **Step 1: Write the helper**

```ts
// src/lib/viewer-dogs.ts
import "server-only";
import type { Dog } from "@/data/customers";
import { getSessionUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";

/**
 * The signed-in viewer's dogs, for the B.3 ribbons, or [] when signed out,
 * unconfigured or dog-less, so every public page renders identically for a
 * visitor with no profile. Glue only: the session read is memoised in auth.ts
 * and the ribbon logic is tested in dog-merchandising.ts, so there is nothing
 * here to unit test.
 */
export async function getViewerDogs(): Promise<Dog[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const customer = await getCustomer(user.uid);
  return customer?.dogs ?? [];
}
```

- [x] **Step 2: Wire the three surfaces**

`src/components/PillarProducts.tsx` (covers all four pillar pages):

```tsx
import { getViewerDogs } from "@/lib/viewer-dogs";
// in the component body:
const dogs = await getViewerDogs();
// and in the grid:
<ProductCard key={p.slug} product={p} dogs={dogs} />
```

`src/app/page.tsx` and `src/app/shop/page.tsx`: same three lines each; fetch alongside the products and pass `dogs={dogs}` at the single `ProductCard` call site in each file. Fetch the two in parallel where both are awaited:

```tsx
const [products, dogs] = await Promise.all([
  getPublicProducts().then((list) => list.map(toCatalogue)),
  getViewerDogs(),
]);
```

- [x] **Step 3: Run the gates**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: all green, lint at exactly 3.

- [x] **Step 4: Look at it running (optional but cheap)**

Start a dev server in the worktree on a spare port (`npm run dev -- -p 3457`), load `/shop` signed out, confirm the cards are pixel-identical, stop the server. Without `.env.local` no session exists, so the signed-in path is exercised by the unit tests instead.

- [x] **Step 5: Commit**

```bash
git add src/lib/viewer-dogs.ts src/components/PillarProducts.tsx src/app/page.tsx src/app/shop/page.tsx
git commit -m "feat: the viewer's dogs reach every product grid, server side"
```

---

### Task 5: Tick the plan through and close out

- [x] **Step 1: Mark every checkbox above, re-run the full gates one last time**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`.
Expected: 271 + new tests passing, tsc clean, lint at exactly 3.

- [x] **Step 2: Commit the plan updates**

```bash
git add docs/plans/2026-07-26-stage-15-profile-ribbons.md
git commit -m "docs: tick the stage 15 plan through"
```
