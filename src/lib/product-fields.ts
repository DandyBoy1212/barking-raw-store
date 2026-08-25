// Pure derivations from a product. No Firestore, no next/headers, no React,
// so this module is trivially unit-testable (mirrors shipping.ts and auth-helpers.ts).

/**
 * True while a product is inside its members only window.
 *
 * The window is compared at UTC midnight on the named day, so "2026-08-10" means
 * "members only right up to the start of the 10th". An unparseable date returns
 * false: a typo in the admin must not hide a product from the shop forever.
 */
export function isMembersOnly(p: { membersOnlyUntil?: string }, now: Date): boolean {
  if (!p.membersOnlyUntil) return false;
  const until = Date.parse(`${p.membersOnlyUntil}T00:00:00Z`);
  if (!Number.isFinite(until)) return false;
  return now.getTime() < until;
}

/**
 * Customer facing pack size, or null when nothing useful is known.
 *
 * This is what makes a price comparable. Without it a GBP 6.50 bag of sprats
 * cannot be judged against a competitor's GBP 3.50 100g bag, so the repricing
 * in section 6.1 of the v1 launch spec would be a guess. The weight also feeds
 * the weight based postage tiers parked in section 13, and supplier postage
 * priced by order weight in section 4.5.
 */
export function packSizeLabel(p: {
  packWeightGrams?: number;
  packPieceCount?: number;
}): string | null {
  const parts: string[] = [];

  const pieces = Number(p.packPieceCount ?? 0);
  if (Number.isFinite(pieces) && pieces > 0) {
    parts.push(`${pieces} ${pieces === 1 ? "piece" : "pieces"}`);
  }

  const grams = Number(p.packWeightGrams ?? 0);
  if (Number.isFinite(grams) && grams > 0) {
    // Grams up to 999, then kilograms, because "15000g" is unreadable on a shelf.
    parts.push(
      grams < 1000 ? `${grams}g` : `${Number((grams / 1000).toFixed(2))}kg`,
    );
  }

  return parts.length ? parts.join(", ") : null;
}
