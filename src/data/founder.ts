// Every personal fact about Michaela that the About page leans on. One file, same
// pattern as src/data/business.ts, and for the same reason: her story and her
// training are the trust argument for the whole site, so a guessed detail here is
// worse than a gap. Anything unresolved keeps the "draft awaiting sign-off"
// notice on the page, and the notice clears itself once this file is filled in.
//
// The story itself was supplied by Liam on 2026-07-26 and is written into the
// page as prose. It is drafted, not signed off: how much of the personal
// background is published is Michaela's decision alone, so `storySignedOff`
// stays false until she has read the page and picked the version she wants.
// Both versions are in docs/about-details-for-michaela.md.
//
// Her courses are in progress, not finished. The page must say "training in" or
// "working through", never "qualified" or "certified", until she says otherwise.

import { PENDING, type Pending } from "./business";

export const FOUNDER = {
  /** Safe: her first name is throughout the specs and the handover. */
  firstName: "Michaela",

  /**
   * Flips to true only when Michaela has read the story section and chosen how
   * much of the personal background stays in. Until then the page is a draft.
   */
  storySignedOff: false as boolean,

  /**
   * The name and provider of the Tellington TTouch course she is currently
   * working through. The course exists; its exact title is not recorded
   * anywhere, so the page names the method and leaves the credential to her.
   */
  ttouchCourse: PENDING as string | Pending,

  /**
   * The name and provider of the canine nutrition course she is currently
   * working through. Same rule: in progress, named exactly or not at all.
   */
  nutritionCourse: PENDING as string | Pending,
} as const;

/** Everything still outstanding, in the order the page presents it. */
export function pendingFounderFields(): string[] {
  const missing: string[] = [];

  // The sign-off is not a PENDING string, it is a decision, so it is checked
  // explicitly, the same way business.ts checks the postcode.
  if (!FOUNDER.storySignedOff) {
    missing.push(
      "her sign-off on the story as written, including how much of the personal background stays in"
    );
  }

  const labels: Record<string, string> = {
    ttouchCourse:
      "the name and provider of the Tellington TTouch course she is working through",
    nutritionCourse:
      "the name and provider of the canine nutrition course she is working through",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (FOUNDER[key as keyof typeof FOUNDER] === PENDING) missing.push(label);
  }

  return missing;
}

export function founderDetailsPending(): boolean {
  return pendingFounderFields().length > 0;
}

/** A field's value, or a visible placeholder that cannot be mistaken for the real thing. */
export function founderDetail(key: keyof typeof FOUNDER): string {
  const value = FOUNDER[key];
  return value === PENDING ? "[to be confirmed]" : String(value);
}
