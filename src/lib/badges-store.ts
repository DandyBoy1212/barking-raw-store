import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  badgeSlug,
  canRetireBadge,
  docToStoredBadge,
  validateBadgeInput,
} from "@/lib/badge-admin";
import { SEED_BADGES, SYSTEM_BADGES, type StoredBadge } from "@/data/badges";

function seedAsBadges(): StoredBadge[] {
  return SEED_BADGES.map((label) => ({
    slug: badgeSlug(label),
    label,
    retired: false,
    system: SYSTEM_BADGES.includes(label),
  }));
}

/**
 * Every badge, including retired ones, for the admin screen.
 *
 * Falls back to the seed list when Firestore is unreachable or empty, so the product
 * form never renders with no badges at all and look broken. Mirrors how
 * products-store falls back to the product seed.
 */
export async function getAllBadges(): Promise<StoredBadge[]> {
  const db = getDb();
  if (!db) return seedAsBadges();
  try {
    const snap = await db.collection(COLLECTIONS.badges).get();
    if (snap.empty) return seedAsBadges();
    return snap.docs
      .map((d) => docToStoredBadge(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error("[badges-store] read failed, falling back to the seed:", err);
    return seedAsBadges();
  }
}

/** The labels a product may currently carry. Retired badges are not offered. */
export async function getActiveBadgeLabels(): Promise<string[]> {
  return (await getAllBadges()).filter((b) => !b.retired).map((b) => b.label);
}

export async function createBadge(
  label: string,
): Promise<{ ok: true; badge: StoredBadge } | { ok: false; errors: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const existing = await getAllBadges();
  const parsed = validateBadgeInput({ label }, existing);
  if (!parsed.ok) return parsed;

  const slug = badgeSlug(parsed.value.label);
  const badge: StoredBadge = { slug, label: parsed.value.label, retired: false, system: false };
  try {
    // create() rather than set(), so a concurrent create of the same slug fails
    // instead of silently overwriting. Same reasoning as the product create route.
    await db.collection(COLLECTIONS.badges).doc(slug).create({
      label: badge.label,
      retired: false,
      system: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[badges-store] create failed:", err);
    return { ok: false, errors: ["There is already a badge called that."] };
  }
  return { ok: true, badge };
}

/**
 * Rename a badge, and carry the new label onto every product wearing the old one.
 *
 * Products store badge labels rather than ids, so a rename that did not propagate
 * would leave those products carrying a badge that no longer exists. At nine
 * products a batch is plenty; if the catalogue ever runs to thousands this wants
 * paginating.
 */
export async function renameBadge(
  slug: string,
  label: string,
): Promise<{ ok: boolean; errors?: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const all = await getAllBadges();
  const badge = all.find((b) => b.slug === slug);
  if (!badge) return { ok: false, errors: ["That badge no longer exists."] };
  if (badge.system) {
    return {
      ok: false,
      errors: [
        "This badge is matched to dog profiles by name, so it cannot be renamed. " +
          "Renaming it would stop that matching working.",
      ],
    };
  }

  const parsed = validateBadgeInput({ label }, all.filter((b) => b.slug !== slug));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  try {
    const products = await db
      .collection(COLLECTIONS.products)
      .where("badges", "array-contains", badge.label)
      .get();

    const batch = db.batch();
    // The slug stays as it was. Re-slugging would orphan every product carrying it,
    // and the slug is only a document id, never shown to anybody.
    batch.set(
      db.collection(COLLECTIONS.badges).doc(slug),
      { label: parsed.value.label, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    for (const doc of products.docs) {
      const badges = ((doc.data().badges ?? []) as string[]).map((b) =>
        b === badge.label ? parsed.value.label : b,
      );
      batch.set(doc.ref, { badges, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.error("[badges-store] rename failed:", err);
    return { ok: false, errors: ["Rename failed."] };
  }
  return { ok: true };
}

/** Retire or un-retire. Never deletes, so products keep the badges they have. */
export async function setBadgeRetired(
  slug: string,
  retired: boolean,
): Promise<{ ok: boolean; errors?: string[] }> {
  const db = getDb();
  if (!db) return { ok: false, errors: ["Service not configured."] };

  const badge = (await getAllBadges()).find((b) => b.slug === slug);
  if (!badge) return { ok: false, errors: ["That badge no longer exists."] };

  if (retired) {
    const allowed = canRetireBadge(badge);
    if (!allowed.ok) return { ok: false, errors: [allowed.reason] };
  }

  try {
    await db
      .collection(COLLECTIONS.badges)
      .doc(slug)
      .set({ retired, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error("[badges-store] retire failed:", err);
    return { ok: false, errors: ["Save failed."] };
  }
  return { ok: true };
}
