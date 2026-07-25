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
