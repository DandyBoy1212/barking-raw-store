import {
  ALL_BADGES,
  ALL_PILLARS,
  ALL_PRODUCT_CATEGORIES,
  type Badge,
  type Pillar,
  type ProductCategory,
  type FulfilmentPath,
} from "@/data/products";
import { normaliseImages, primaryImageUrl, type ProductImage } from "@/lib/product-images";

export { ALL_BADGES, ALL_PILLARS, ALL_PRODUCT_CATEGORIES };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProductInput = {
  name: string;
  price: number;
  hook: string;
  description: string;
  badges: Badge[];
  /** The photo list, ordered, exactly one primary after validation. */
  images: ProductImage[];
  /** Derived from images: the primary photo's URL. */
  image: string;
  safetyNote?: string;
  pillar: Pillar;
  category: ProductCategory;
  leadTimeDays: number;
  membersOnlyUntil?: string;
  fulfilment: FulfilmentPath;
  supplierPostage?: number;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
  packWeightGrams?: number;
  packPieceCount?: number;
  /** Whole units on the shelf. Absent means untracked (stage 4's rule); 0 means sold out. */
  stock?: number;
  /** Loyalty earn rate. Absent means loyalty.ts's default; 0 means deliberately no points. */
  pointsPerPound?: number;
  /** Shelf position, 1 is first. Absent means unplaced: after the placed ones, alphabetically. */
  sortOrder?: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Optional whole number above zero, or undefined. Used for the pack size fields,
 * where a blank box means "not known" rather than zero.
 */
function optionalPositiveInteger(
  raw: unknown,
  label: string,
  errors: string[],
): number | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;
  const n = Number(raw);
  if (!(Number.isFinite(n) && n > 0 && Number.isInteger(n))) {
    errors.push(`${label} must be a whole number above 0, or left blank.`);
    return undefined;
  }
  return n;
}

/**
 * Validate a product from the admin form.
 *
 * `allowedBadges` is the labels currently in the badge collection, passed in rather
 * than read here so this stays pure and synchronous, and so the Firestore read
 * happens once per request instead of once per validation. Callers get it from
 * getActiveBadgeLabels().
 */
export function validateProductInput(
  input: Partial<ProductInput>,
  allowedBadges: string[],
): { ok: true; value: ProductInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = String(input.name ?? "").trim();
  const price = Number(input.price ?? 0);
  const hook = String(input.hook ?? "").trim();
  const description = String(input.description ?? "").trim();
  // The form sends a photo list; an older payload may still send the single
  // image string. Either way the primary is derived, never trusted from input.
  const images = normaliseImages(input.images, input.image);
  const image = primaryImageUrl(images);
  // Filtered against what is in the badge collection right now, so a retired or
  // invented badge never reaches a product.
  const badges = Array.isArray(input.badges)
    ? input.badges.filter((b): b is Badge => allowedBadges.includes(String(b)))
    : [];
  const safetyNote = input.safetyNote ? String(input.safetyNote).trim() : undefined;

  if (!name) errors.push("Name is required.");
  if (!(Number.isFinite(price) && price > 0)) errors.push("Price must be greater than 0.");
  if (!hook) errors.push("Hook is required.");
  if (!description) errors.push("Description is required.");
  if (images.length === 0) errors.push("At least one photo is required.");

  // A product with no pillar appears on no page, which looks exactly like the site
  // working while the product is invisible. Required, never defaulted, on the way in.
  const rawPillar = String(input.pillar ?? "");
  const pillarOk = ALL_PILLARS.includes(rawPillar as Pillar);
  if (!pillarOk) errors.push("Choose which pillar this product belongs to.");
  const pillar = (pillarOk ? rawPillar : "good-food") as Pillar;

  // Same reasoning as the pillar above: a product on no shelf appears nowhere,
  // which looks exactly like the site working while the product is invisible.
  // Required, never defaulted, on the way in.
  const rawCategory = String(input.category ?? "");
  const categoryOk = ALL_PRODUCT_CATEGORIES.includes(rawCategory as ProductCategory);
  if (!categoryOk) errors.push("Choose which part of the shop this product belongs to.");
  const category = (categoryOk ? rawCategory : "treats") as ProductCategory;

  const rawLead =
    input.leadTimeDays === undefined ||
    input.leadTimeDays === null ||
    String(input.leadTimeDays) === ""
      ? 0
      : Number(input.leadTimeDays);
  const leadOk = Number.isFinite(rawLead) && rawLead >= 0 && Number.isInteger(rawLead);
  if (!leadOk) errors.push("Lead time must be a whole number of days, 0 or more.");
  const leadTimeDays = leadOk ? rawLead : 0;

  const rawWindow = String(input.membersOnlyUntil ?? "").trim();
  let membersOnlyUntil: string | undefined;
  if (rawWindow) {
    if (!ISO_DATE.test(rawWindow) || !Number.isFinite(Date.parse(`${rawWindow}T00:00:00Z`))) {
      errors.push("Members only date must be in the form YYYY-MM-DD.");
    } else {
      membersOnlyUntil = rawWindow;
    }
  }

  const fulfilment: FulfilmentPath =
    input.fulfilment === "supplier-posted" ? "supplier-posted" : "own-stock";

  let supplierPostage: number | undefined;
  let supplierArrivalMinDays: number | undefined;
  let supplierArrivalMaxDays: number | undefined;

  if (fulfilment === "supplier-posted") {
    const postage = Number(input.supplierPostage ?? NaN);
    if (!(Number.isFinite(postage) && postage >= 0)) {
      errors.push("Supplier posted products need their own postage amount.");
    } else {
      supplierPostage = postage;
    }
    const min = Number(input.supplierArrivalMinDays ?? NaN);
    const max = Number(input.supplierArrivalMaxDays ?? NaN);
    const minOk = Number.isFinite(min) && min > 0 && Number.isInteger(min);
    const maxOk = Number.isFinite(max) && max > 0 && Number.isInteger(max);
    if (minOk !== maxOk) {
      errors.push("Give both ends of the arrival range, or neither.");
    } else if (minOk && maxOk) {
      if (min > max) {
        errors.push("Arrival range must run from the shorter time to the longer.");
      } else {
        supplierArrivalMinDays = min;
        supplierArrivalMaxDays = max;
      }
    }
  }

  // Pack size. Optional, because the nine originals shipped without one, but a
  // price cannot be compared against a competitor's without it.
  const packWeightGrams = optionalPositiveInteger(input.packWeightGrams, "Pack weight", errors);
  const packPieceCount = optionalPositiveInteger(input.packPieceCount, "Piece count", errors);

  // Stock and points rate. Blank and zero are different answers: blank stock is
  // untracked and blank rate is the default, while zero is sold out and no
  // points respectively, both deliberate.
  let stock: number | undefined;
  if (!(input.stock === undefined || input.stock === null || String(input.stock).trim() === "")) {
    const n = Number(input.stock);
    if (Number.isFinite(n) && n >= 0 && Number.isInteger(n)) stock = n;
    else errors.push("Stock must be a whole number, 0 or more, or left blank.");
  }
  let pointsPerPound: number | undefined;
  if (
    !(
      input.pointsPerPound === undefined ||
      input.pointsPerPound === null ||
      String(input.pointsPerPound).trim() === ""
    )
  ) {
    const n = Number(input.pointsPerPound);
    if (Number.isFinite(n) && n >= 0) pointsPerPound = n;
    else errors.push("Points per pound must be 0 or more, or left blank.");
  }

  // Shelf position. Counts from 1 because that is how Michaela will think of it;
  // blank means unplaced, which sorts after everything she has placed.
  const sortOrder = optionalPositiveInteger(input.sortOrder, "Sort position", errors);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      price,
      hook,
      description,
      badges,
      images,
      image,
      safetyNote,
      pillar,
      category,
      leadTimeDays,
      membersOnlyUntil,
      fulfilment,
      supplierPostage,
      supplierArrivalMinDays,
      supplierArrivalMaxDays,
      packWeightGrams,
      packPieceCount,
      stock,
      pointsPerPound,
      sortOrder,
    },
  };
}
