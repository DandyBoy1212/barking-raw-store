// Pure derivations from a product. No Firestore, no next/headers, no React,
// so this module is trivially unit-testable (mirrors shipping.ts and auth-helpers.ts).

import type { FulfilmentPath } from "@/data/products";

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

/** Customer facing dispatch note for a product with a non-zero lead time, or null. */
export function leadTimeNote(p: { leadTimeDays?: number }): string | null {
  const days = Number(p.leadTimeDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  return `Ordered in for you, dispatches in ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Customer facing note for a product that posts from the supplier rather than from
 * Michaela. Tells the buyer the two things that affect them, that it comes separately
 * and roughly when, and nothing about the supply chain behind it.
 */
export function supplierArrivalNote(p: {
  fulfilment?: FulfilmentPath;
  supplierArrivalMinDays?: number;
  supplierArrivalMaxDays?: number;
}): string | null {
  if (p.fulfilment !== "supplier-posted") return null;
  const min = Number(p.supplierArrivalMinDays ?? 0);
  const max = Number(p.supplierArrivalMaxDays ?? 0);
  if (!(min > 0) || !(max > 0)) return "Posts separately";
  if (min === max) return `Posts separately, arrives in ${min} ${min === 1 ? "day" : "days"}`;
  return `Posts separately, arrives in ${min} to ${max} days`;
}
