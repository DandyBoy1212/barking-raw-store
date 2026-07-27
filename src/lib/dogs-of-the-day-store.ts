import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  consentedDogPhotos,
  docToDogFeature,
  sortFeaturesNewestFirst,
  type ConsentedDogPhoto,
  type DogFeature,
} from "@/lib/dogs-of-the-day";

// A local const rather than a COLLECTIONS entry, the stall-store.ts precedent:
// that shared file is a merge seam other tracks touch. Same store_ prefix.
const FEATURES_COLLECTION = "store_dogs_of_the_day";

/**
 * Featured dogs, newest first. Every doc passes back through docToDogFeature,
 * so anything hand-edited onto a foreign host silently disappears rather than
 * rendering. Empty on db null or error: the public page shows its empty state.
 */
export async function listDogFeatures(max = 30): Promise<DogFeature[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(FEATURES_COLLECTION).limit(200).get();
    const features = snap.docs
      .map((doc) => docToDogFeature(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
      .filter((f): f is DogFeature => f !== null);
    return sortFeaturesNewestFirst(features).slice(0, max);
  } catch (err) {
    console.error("[dogs-of-the-day-store] listDogFeatures failed:", err);
    return [];
  }
}

/** Create one feature. The caller has already validated through validateDogFeatureInput. */
export async function createDogFeature(value: {
  dogName: string;
  photo: string;
  date: string;
}): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.collection(FEATURES_COLLECTION).add({
      ...value,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("[dogs-of-the-day-store] createDogFeature failed:", err);
    return false;
  }
}

/** The pickable dogs for the staff screen: consented owners, guard-passing photos. */
export async function listConsentedDogPhotos(): Promise<ConsentedDogPhoto[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTIONS.customers).limit(500).get();
    return consentedDogPhotos(
      snap.docs.map((doc) => ({ uid: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> })),
    );
  } catch (err) {
    console.error("[dogs-of-the-day-store] listConsentedDogPhotos failed:", err);
    return [];
  }
}
