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
  /**
   * A signed read URL on our own Firebase Storage bucket, never anywhere else.
   * Section 10.2 puts these on a public Dogs of the Day page, so an arbitrary URL
   * here would be arbitrary content there.
   */
  photo?: string;
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
  /** Stripe's id for this buyer, stored by webhook fulfilment; the billing portal needs it. */
  stripeCustomerId?: string;
};
