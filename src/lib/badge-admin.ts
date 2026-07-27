// Pure helpers for the badge collection. No Firestore, no next/headers, no React,
// so this module is trivially unit-testable (mirrors product-admin.ts).

import { MAX_BADGE_LENGTH, type StoredBadge } from "@/data/badges";
import { SENSITIVITY_BADGE, SENSITIVITY_LABEL, type Sensitivity } from "@/data/customers";

/** The Firestore document id for a badge label. */
export function badgeSlug(label: string): string {
  return String(label ?? "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map a Firestore doc to a badge, tolerating a partial record. */
export function docToStoredBadge(slug: string, data: Record<string, unknown>): StoredBadge {
  return {
    slug,
    label: String(data.label ?? ""),
    retired: data.retired === true,
    system: data.system === true,
  };
}

/**
 * Validate a new or renamed badge label against the badges that already exist.
 *
 * Stricter than validateDogInput deliberately. A dog is filled in by conversation and
 * a half-known dog is worth keeping, but a badge is a deliberate act with one field,
 * and a duplicate or unusable one is a mess on every product card that carries it.
 */
export function validateBadgeInput(
  input: { label?: string },
  existing: StoredBadge[],
): { ok: true; value: { label: string } } | { ok: false; errors: string[] } {
  const label = String(input.label ?? "").trim();
  if (!label) return { ok: false, errors: ["A badge needs a name."] };
  if (label.length > MAX_BADGE_LENGTH) {
    return { ok: false, errors: [`Keep a badge to ${MAX_BADGE_LENGTH} characters or fewer.`] };
  }

  const slug = badgeSlug(label);
  if (!slug) return { ok: false, errors: ["That name cannot be used."] };
  if (existing.some((b) => b.slug === slug)) {
    return { ok: false, errors: ["There is already a badge called that."] };
  }

  return { ok: true, value: { label } };
}

/**
 * Why a badge is protected, named specifically, or null if it is not.
 *
 * Deliberately names the feature rather than saying "this is a system badge". A
 * refusal Michaela cannot understand becomes a message to Liam, and B.6 exists so
 * that she does not need him to manage her own labels. It also always tells her what
 * she CAN do instead, because what she usually wants is this badge off this product,
 * not the badge gone entirely.
 */
export function badgeProtectionReason(label: string): string | null {
  const sensitivity = (Object.keys(SENSITIVITY_BADGE) as Sensitivity[]).find(
    (s) => SENSITIVITY_BADGE[s] === label,
  );
  if (sensitivity) {
    return (
      `This badge powers the "${SENSITIVITY_LABEL[sensitivity]}" ribbon, shown to owners whose ` +
      `dog has that flagged on their profile. Retiring it would stop those ribbons appearing. ` +
      `You can stop putting it on products instead.`
    );
  }
  if (label === "Most Popular") {
    return (
      "This badge draws the star on a product card, so the site looks for it by name. " +
      "You can stop putting it on products instead."
    );
  }
  return null;
}

/** Whether a badge may be retired, and a reason Michaela can act on if not. */
export function canRetireBadge(badge: StoredBadge): { ok: true } | { ok: false; reason: string } {
  if (!badge.system) return { ok: true };
  return {
    ok: false,
    reason:
      badgeProtectionReason(badge.label) ??
      "This badge is built in and the site depends on it by name. You can stop putting it on products instead.",
  };
}
