import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getDb, getAuthAdmin, getBucket, COLLECTIONS } from "@/lib/firebase-admin";
import { docToStoredCustomer } from "@/lib/customers-store";
import { buildStallCustomerPatch, type StallRecord } from "@/lib/stall-record";

// Marker docs recording which clientIds have been applied, and onto which uid.
// Defined here rather than added to COLLECTIONS to keep this track out of the
// shared files two parallel agents may touch. Same store_ prefix convention.
const STALL_SIGNUPS_COLLECTION = "store_stall_signups";

export type ApplyStallResult =
  | { ok: true; created: boolean; uid: string }
  | { ok: false; retryable: boolean };

/**
 * Who this record belongs to.
 *
 * With an email, the same resolution ensureCustomer uses for the Stripe webhook:
 * the existing Firebase user by email, or a fresh one. First magic-link sign-in
 * with that email then lands on the same uid, so the person sees their own dogs.
 * Without an email no account is possible, so the record is keyed stall-{clientId},
 * which cannot collide with a Firebase uid and keeps the data for Michaela.
 */
async function resolveUid(auth: Auth, record: StallRecord): Promise<string> {
  if (!record.email) return `stall-${record.clientId}`;
  try {
    return (await auth.getUserByEmail(record.email)).uid;
  } catch {
    return (await auth.createUser({ email: record.email, displayName: record.name || undefined }))
      .uid;
  }
}

/**
 * Upload each dog's inline photo to our own bucket, returning a signed URL per dog
 * (undefined where there is no photo or the upload failed). A failed photo never
 * fails the record: the signup is the point, the photo is the bonus.
 */
async function uploadPhotos(uid: string, record: StallRecord): Promise<(string | undefined)[]> {
  const bucket = getBucket();
  return Promise.all(
    record.dogs.map(async (dog) => {
      if (!dog.photoData || !bucket) return undefined;
      try {
        const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dog.photoData);
        if (!match) return undefined;
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const file = bucket.file(`dogs/${uid}/${randomUUID()}.${ext}`);
        await file.save(Buffer.from(match[2], "base64"), {
          contentType: `image/${match[1]}`,
          resumable: false,
        });
        // Long-lived signed read URL, same pattern as the account dog photo route.
        const [url] = await file.getSignedUrl({ action: "read", expires: "2500-01-01" });
        return url;
      } catch (err) {
        console.error("[stall-store] photo upload failed, keeping the dog without it:", err);
        return undefined;
      }
    }),
  );
}

/**
 * Apply one stall record, exactly once per clientId.
 *
 * The marker doc store_stall_signups/{clientId} is checked before any work and
 * re-checked inside the transaction that writes the customer, so a record that
 * syncs twice (a retry after an ambiguous failure) merges zero times more, appends
 * zero duplicate dogs, and reports created: false so no second welcome email goes.
 */
export async function applyStallRecord(record: StallRecord): Promise<ApplyStallResult> {
  const db = getDb();
  const auth = getAuthAdmin();
  if (!db || !auth) return { ok: false, retryable: true };

  const markerRef = db.collection(STALL_SIGNUPS_COLLECTION).doc(record.clientId);
  try {
    const marker = await markerRef.get();
    if (marker.exists) {
      return { ok: true, created: false, uid: String(marker.data()?.uid ?? "") };
    }

    const uid = await resolveUid(auth, record);
    const photoUrls = await uploadPhotos(uid, record);
    const customerRef = db.collection(COLLECTIONS.customers).doc(uid);

    const created = await db.runTransaction(async (tx) => {
      const markerSnap = await tx.get(markerRef);
      if (markerSnap.exists) return false;
      const snap = await tx.get(customerRef);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      const patch = buildStallCustomerPatch(current, record, photoUrls);
      tx.set(
        customerRef,
        {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
          ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
      tx.set(markerRef, { uid, syncedAt: FieldValue.serverTimestamp() });
      return true;
    });

    return { ok: true, created, uid };
  } catch (err) {
    console.error("[stall-store] applyStallRecord failed:", err);
    return { ok: false, retryable: true };
  }
}
