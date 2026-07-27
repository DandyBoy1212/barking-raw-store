// Pure derivations from a customer or a dog. No Firestore, no next/headers, no
// React, so this module is trivially unit-testable (mirrors product-fields.ts).

import {
  ALL_SENSITIVITIES,
  EMPTY_ADDRESS,
  type ActivityLevel,
  type CustomerAddress,
  type Dog,
  type DogSize,
  type LifeStage,
  type Sensitivity,
} from "@/data/customers";

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

/**
 * True only for a URL on our own Firebase Storage bucket.
 *
 * A dog photo URL is handed back by the browser after upload, so it is caller
 * supplied and cannot be trusted. Section 10.2 puts dog photos on a public page,
 * which turns "any URL the client sends" into "any image on a public page of ours".
 * Signed Storage reads are served from *.googleapis.com over https, and nothing else
 * is accepted.
 */
function isOwnStorageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return url.hostname === "storage.googleapis.com" || url.hostname.endsWith(".googleapis.com");
}

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
    ? input.sensitivities.filter((s): s is Sensitivity =>
        ALL_SENSITIVITIES.includes(s as Sensitivity),
      )
    : [];
  if (sensitivities.length) value.sensitivities = sensitivities;

  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((a) => String(a).trim().toLowerCase()).filter(Boolean)
    : [];
  if (allergies.length) value.allergies = allergies;

  const photo = String(input.photo ?? "").trim();
  if (photo && isOwnStorageUrl(photo)) value.photo = photo;

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

/**
 * Whether a store_customers document represents a member.
 *
 * Membership used to be inferred from the document merely existing, which was true
 * while a paid Stripe order was the only thing that ever created one. The A.2 account
 * routes broke that: they set({merge: true}) on the same document, so adding a dog or
 * saving an address created it, and any signed-in visitor became a member and got the
 * members-only early access that spec section 10.1 says signing up must not grant.
 *
 * So membership is now an explicit flag, written by the paths that actually confer it:
 * a paid order, and the stall signup. Strict === true, because Firestore will store a
 * string and "false" is truthy.
 */
export function isMemberDoc(data: Record<string, unknown> | undefined): boolean {
  return data?.member === true;
}
