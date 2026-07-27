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
