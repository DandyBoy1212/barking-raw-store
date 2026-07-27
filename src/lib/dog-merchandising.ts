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
 * badge is on the product, so Michaela's own badges stay the source of truth for
 * what the product is good for. A caution needs the allergy word in the product
 * NAME: on a site that sells one ingredient named in full, the name is the honest
 * surface, and description text false-positives (the Rabbit Ears copy mentions
 * chicken while containing none).
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
