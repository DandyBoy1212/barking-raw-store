# Stage 12: About Us (B.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/about`: the origin story, the mission, the four pillars argument, and the TTouch and nutrition credentials, without inventing a single personal fact about Michaela.

**Architecture:** Mirrors the legal pages exactly. A `src/data/founder.ts` file holds every personal fact, with the `PENDING` sentinel and a `pendingFounderFields()` check copied in shape from `src/data/business.ts`. The page renders a visible "draft awaiting Michaela's sign-off" notice while anything is pending, via a new `PendingFounderDetails` component in `src/components/about/`. A short doc tells Michaela what to supply, in the tone of `docs/legal-details-for-michaela.md`.

**Tech Stack:** Next.js App Router (static `metadata` export, server component page), TypeScript, vitest.

## Global Constraints

- House style: British spelling, NO em dashes anywhere (spec header: "British spelling, no em dashes anywhere").
- Facts that cannot be sourced from the repo are `PENDING`, never invented (wave 1 kickoff: "the origin story is Michaela's, not ours ... it needs her sign off, and the TTouch and nutrition credentials must be stated accurately").
- Claims follow `docs/research-dossier.md`: frame around what is left out and the transparency of what is in, never disease causation (dossier golden rule, spec 12.3).
- Touch and handling is deliberately not a pillar: it is Michaela's Tellington TTouch qualification and it lives here (spec 2.1).
- Do not touch the header, root layout, footer or any shared file. New files only, plus at most an append to `src/data/business.ts` or `src/app/globals.css` (neither is expected to be needed).
- Commit messages in the repo's existing lower-case style, body ending with the Co-Authored-By line.
- Definition of done: 143 tests plus the new ones pass, `npx tsc --noEmit` clean, lint still exactly 3 pre-existing errors.

## What the repo can and cannot source

Sourced from the repo, safe to state:

- The mission and the "you've been lied to" positioning: `src/app/page.tsx` hero and label callouts, all backed by `docs/research-dossier.md` Part 1.
- The honest-sourcing stance: open declaration, single named ingredients, no propylene glycol, no ethoxyquin (`src/app/page.tsx`, dossier Parts 1 and 2).
- The four pillars and the reason touch and handling is not one: spec sections 2 and 2.1.
- Dundee: `src/data/business.ts` address and the DD1 to DD6 free delivery rule.
- The market stall as where she meets dogs in person: spec section 10.
- That she holds a Tellington TTouch qualification: spec 2.1 states it as fact. Its exact title and level are NOT stated anywhere.

Cannot be sourced, so `PENDING`:

1. The exact name and level of the Tellington TTouch qualification.
2. The nutrition qualification: its exact title, awarding body, and whether it is completed or in progress (spec 7.1 says courses land "in step with Michaela's qualifications", which implies in progress, so even the status is unconfirmed).
3. The origin story in her own words: when she started, and why.
4. How long she has worked with and around dogs.

---

### Task 1: Founder data module, test first

**Files:**
- Create: `src/data/founder.ts`
- Test: `src/data/founder.test.ts`

**Interfaces:**
- Consumes: `PENDING`, `Pending` from `src/data/business.ts` (already exported).
- Produces: `FOUNDER` const object; `pendingFounderFields(): string[]`; `founderDetailsPending(): boolean`; `founderDetail(key: keyof typeof FOUNDER): string`. Task 2's page and Task 3's notice import all four.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/founder.test.ts
import { describe, it, expect } from "vitest";
import {
  FOUNDER,
  founderDetail,
  founderDetailsPending,
  pendingFounderFields,
} from "./founder";
import { PENDING } from "./business";

describe("pendingFounderFields", () => {
  it("lists every fact Michaela has not supplied yet", () => {
    // Everything personal starts pending, because none of it is documented
    // in the repo and inventing it would put words in her mouth.
    const missing = pendingFounderFields();
    expect(missing).toContain("the exact name and level of her Tellington TTouch qualification");
    expect(missing).toContain("the nutrition qualification: its title, who awards it, and whether it is finished or underway");
    expect(missing).toContain("the origin story in her own words: when she started Barking Raw, and why");
    expect(missing).toContain("how long she has worked with dogs");
  });

  it("lists fields in the order the page presents them", () => {
    const missing = pendingFounderFields();
    expect(missing[0]).toBe("the origin story in her own words: when she started Barking Raw, and why");
  });
});

describe("founderDetailsPending", () => {
  it("is true while anything is missing, so the draft notice cannot clear early", () => {
    expect(founderDetailsPending()).toBe(true);
  });
});

describe("founderDetail", () => {
  it("returns a visible placeholder for a pending value, never the sentinel", () => {
    expect(FOUNDER.ttouchQualification).toBe(PENDING);
    expect(founderDetail("ttouchQualification")).toBe("[to be confirmed]");
  });

  it("returns the real value once one exists", () => {
    expect(founderDetail("firstName")).toBe("Michaela");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/founder.test.ts`
Expected: FAIL, cannot resolve `./founder`.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/founder.ts
// Every personal fact about Michaela that the About page quotes. One file, same
// pattern as src/data/business.ts, and for the same reason: the TTouch and
// nutrition credentials are the trust argument for the whole site, so a guessed
// qualification here is worse than a gap. Everything marked PENDING renders as a
// visible placeholder and keeps the "draft awaiting sign-off" notice on the page.
//
// The one fact stated as PENDING that is partly documented: the design spec
// (section 2.1) records that she holds a Tellington TTouch qualification. Its
// exact title and level are recorded nowhere, so the page says "Tellington
// TTouch" in prose and leaves the precise credential to her.

import { PENDING, type Pending } from "./business";

export const FOUNDER = {
  /** Safe: her first name is throughout the specs and the handover. */
  firstName: "Michaela",

  /**
   * When she started Barking Raw and why, in her words. The wave 1 kickoff is
   * explicit that the origin story is hers, not ours, so the page carries a
   * drafted framing and this field holds the part only she can write.
   */
  originStory: PENDING as string | Pending,

  /** The exact name and level of the TTouch credential, e.g. which practitioner level. */
  ttouchQualification: PENDING as string | Pending,

  /**
   * The nutrition credential: title, awarding body, and status. The members
   * area spec says courses land "in step with Michaela's qualifications",
   * which reads as still underway, so even completed-or-not needs her answer.
   */
  nutritionQualification: PENDING as string | Pending,

  /** How long she has worked with dogs, since "years around dogs" invites rounding up. */
  yearsWithDogs: PENDING as string | Pending,
} as const;

/** Every fact Michaela still has to supply, in the order the page presents them. */
export function pendingFounderFields(): string[] {
  const labels: Record<string, string> = {
    originStory: "the origin story in her own words: when she started Barking Raw, and why",
    ttouchQualification: "the exact name and level of her Tellington TTouch qualification",
    nutritionQualification:
      "the nutrition qualification: its title, who awards it, and whether it is finished or underway",
    yearsWithDogs: "how long she has worked with dogs",
  };
  return Object.entries(labels)
    .filter(([key]) => FOUNDER[key as keyof typeof FOUNDER] === PENDING)
    .map(([, label]) => label);
}

export function founderDetailsPending(): boolean {
  return pendingFounderFields().length > 0;
}

/** A field's value, or a visible placeholder that cannot be mistaken for the real thing. */
export function founderDetail(key: keyof typeof FOUNDER): string {
  const value = FOUNDER[key];
  return value === PENDING ? "[to be confirmed]" : String(value);
}
```

Note: `business.ts` exports `Pending` as a type. If `import { PENDING, type Pending }` trips on the `as const` comparison, match the exact import shape `business.ts`'s own consumers use (`import { BUSINESS, PENDING, detail }` in `src/app/terms/page.tsx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/founder.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Run the whole suite, tsc and lint**

Run: `npm test` then `npx tsc --noEmit` then `npm run lint`
Expected: 148 tests pass, tsc silent, lint exactly 3 pre-existing errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/founder.ts src/data/founder.test.ts
git commit -m "feat: founder facts as pending entries, mirroring the business file"
```

(Body: why the pattern is copied from business.ts, ending with the Co-Authored-By line.)

### Task 2: The draft notice component

**Files:**
- Create: `src/components/about/PendingFounderDetails.tsx`

**Interfaces:**
- Consumes: `pendingFounderFields()` from `src/data/founder.ts` (Task 1).
- Produces: `PendingFounderDetails()` React server component, no props. Task 3's page renders it under the h1.

- [ ] **Step 1: Write the component**

Copy the shape of `src/components/legal/PendingDetails.tsx` (red bordered `aside role="note"`), reworded for sign-off rather than publication readiness:

```tsx
// src/components/about/PendingFounderDetails.tsx
import { pendingFounderFields } from "@/data/founder";

/**
 * A visible notice that this page is a draft awaiting Michaela's sign-off.
 *
 * The origin story is hers and the credentials are the trust argument for the
 * whole site, so a guessed version reading as finished copy is the failure this
 * exists to prevent. It disappears on its own once src/data/founder.ts is
 * filled in, with nothing else to remember to remove.
 */
export function PendingFounderDetails() {
  const missing = pendingFounderFields();
  if (!missing.length) return null;

  return (
    <aside
      role="note"
      style={{
        border: "2px solid #b00",
        background: "#fff4f4",
        color: "#5a0000",
        padding: "1rem 1.2rem",
        margin: "0 0 2rem",
      }}
    >
      <b style={{ display: "block", marginBottom: ".4rem" }}>
        Draft awaiting Michaela&apos;s sign-off
      </b>
      <p style={{ marginBottom: ".6rem" }}>
        This page was drafted from the project notes, not from her. It still needs:
      </p>
      <ul style={{ margin: "0 0 .6rem 1.1rem" }}>
        {missing.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      <p style={{ fontSize: ".9rem" }}>
        Fill them in at <code>src/data/founder.ts</code> and this notice goes away by
        itself. What to send is listed in <code>docs/about-details-for-michaela.md</code>.
      </p>
    </aside>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: silent. (No unit test: it is presentation over already-tested logic, same as `PendingDetails`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/about/PendingFounderDetails.tsx
git commit -m "feat: the sign-off notice the about page carries while facts are missing"
```

### Task 3: The About page

**Files:**
- Create: `src/app/about/page.tsx`

**Interfaces:**
- Consumes: `PendingFounderDetails` (Task 2); `FOUNDER`, `PENDING` re-export awareness via `founderDetailsPending` not needed here; `founderDetail` only if a pending value is quoted inline (the credentials section quotes `founderDetail("ttouchQualification")` and `founderDetail("nutritionQualification")`).
- Produces: the `/about` route. Nav wiring happens at merge time, not here.

- [ ] **Step 1: Write the page**

Follow `src/app/terms/page.tsx` for structure: static `metadata` export, `main.band.band--paper`, `div.wrap` at `maxWidth: 720`, `p.eyebrow`, `h1.display`, `h2` sections. Sections and their sourcing:

1. **Heading.** Eyebrow "Who we are", h1 "About us". `PendingFounderDetails` directly below.
2. **The short version.** Barking Raw is a Dundee dog treat business run by Michaela, sold online and from the market stall, built on one idea: dogs deserve food their owners can actually read. (Sourced: business.ts address, spec section 10, landing hero.)
3. **Why Barking Raw exists (the mission).** The landing page argument restated in first person plural: the labels are legal and vague by design, "meat and animal derivatives", "various sugars", 2% beef; we read the labels, then went looking for the opposite. Frame strictly as what we leave out and what we name in full, per the dossier golden rule. No disease claims.
4. **Michaela's story (the draft).** Two or three sentences of documented framing (Dundee, the stall, meeting dogs and owners in person) and an explicit sentence that the story in her words is coming: render `founderDetail("originStory")` so the placeholder is visible in the prose, not hidden.
5. **What she brings (the credentials).** States she is qualified in Tellington TTouch (spec 2.1 states the fact) with the exact credential as `founderDetail("ttouchQualification")`, and nutrition training as `founderDetail("nutritionQualification")`. One honest sentence on why the page does not round up: the credentials are the reason to trust the site, so they are stated exactly or not at all.
6. **The four things we think matter (the pillars).** Good Food, Comfy Walks, Fun & Games, Cosy Sleep, each with its one-liner from spec section 2. Then the 2.1 argument: get the four right and training gets lapped up, and why touch and handling is deliberately not a pillar: it is not a thing you buy off a shelf, it is a thing Michaela teaches, so it lives here and in the teaching.
7. **How we choose what we sell.** The honest-sourcing stance: single named ingredients, open declaration, no propylene glycol, no ethoxyquin, sourced claims only (landing page and dossier Part 2, softened per dossier flags: "banned from cat food", "withdrawn because safety couldn't be confirmed", never "causes").
8. **Footer links.** Contact and the shop, matching the link row on the legal pages.

Metadata:

```tsx
export const metadata: Metadata = {
  title: "About Us | Barking Raw",
  description:
    "Who is behind Barking Raw: Michaela, her Tellington TTouch and nutrition training, and why we sell dog treats with every ingredient named in full.",
};
```

British spelling, no em dashes, apostrophes escaped per the repo's lint rules (the legal pages use plain apostrophes inside JSX expressions and `&apos;`/`&amp;` in text where needed; match whatever keeps lint at 3 errors).

- [ ] **Step 2: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 148 pass, tsc silent, exactly 3 lint errors.

- [ ] **Step 3: Render check**

Run: `npm run build` is not required by the definition of done and pulls env vars; skip it. Instead confirm the page compiles under tsc and the imports resolve, which is what the existing legal pages relied on too.

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "feat: the about page, drafted and visibly awaiting sign-off"
```

### Task 4: The doc for Michaela

**Files:**
- Create: `docs/about-details-for-michaela.md`

**Interfaces:**
- Consumes: the field list from Task 1, kept word-for-word in step with `pendingFounderFields()`.
- Produces: the ask list the report quotes.

- [ ] **Step 1: Write the doc**

Match the tone and shape of `docs/legal-details-for-michaela.md`: what exists, what is missing, a table of the four facts with why each is needed, then a "the wording is hers to approve" section telling her to read the drafted story and credentials sections rather than nod at them, and a note that the red notice clears itself once `src/data/founder.ts` is filled in.

- [ ] **Step 2: Commit**

```bash
git add docs/about-details-for-michaela.md
git commit -m "docs: the four answers the about page needs from michaela"
```

## Self-review

- Spec coverage: section 3's About Us row (origin story, mission, credentials) maps to page sections 4, 3 and 5; section 2.1's touch and handling argument maps to section 6; section 12.3 claim discipline is a global constraint enforced in sections 3 and 7; the kickoff's "draft, needs sign-off" requirement maps to Tasks 1, 2 and 4.
- No placeholders in this plan: every code step carries the code.
- Types line up: `pendingFounderFields(): string[]` is consumed by the notice; `founderDetail(key)` keys match the `FOUNDER` object literal.
