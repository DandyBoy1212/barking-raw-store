import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getDb, getAuthAdmin, getBucket, COLLECTIONS } from "@/lib/firebase-admin";
import { buildActionCodeSettings } from "@/lib/auth-helpers";
import { docToStoredCustomer } from "@/lib/customers-store";
import { sendEmail } from "@/lib/email";
import { docToSubscriber, normaliseSubscriberEmail } from "@/lib/subscribers";
import {
  buildStallCustomerPatch,
  stallMarketingSubscription,
  stallWelcomeEmailHtml,
  type StallRecord,
} from "@/lib/stall-record";

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
 * A ticked marketing box joins the one subscriber list, source "stall".
 *
 * Same transaction shape as /api/subscribe, and the decision itself is pure
 * (stallMarketingSubscription): no consent or no usable email writes nothing, a
 * repeat sync is a no-op that can never reset a sequence position or re-issue a
 * code. Throws on a failed write so the caller keeps the record retryable: the
 * consent was given at the table, so losing the list write silently is not an
 * option.
 */
async function upsertStallSubscriber(db: Firestore, record: StallRecord): Promise<void> {
  const email = normaliseSubscriberEmail(record.email);
  if (!email || !record.consent.marketing) return;
  const ref = db.collection(COLLECTIONS.subscribers).doc(email);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists
      ? docToSubscriber(email, (snap.data() ?? {}) as Record<string, unknown>)
      : null;
    const change = stallMarketingSubscription(record, existing);
    if (!change) return;
    if (!change.create && !change.consentTurnedOn) return;
    const fields: Record<string, unknown> = {
      ...change.fields,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (change.create) {
      fields.email = email;
      fields.sequencePosition = 0;
      fields.createdAt = FieldValue.serverTimestamp();
    }
    if (change.consentTurnedOn) {
      fields.consentAt = FieldValue.serverTimestamp();
      // Re-consent after an unsubscribe starts a clean slate, as /api/subscribe does.
      fields.unsubscribedAt = null;
    }
    tx.set(ref, fields, { merge: true });
  });
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
      // Re-run the subscriber upsert too: it is idempotent, and this covers a
      // crash that landed the customer and marker but lost the list write.
      await upsertStallSubscriber(db, record);
      return { ok: true, created: false, uid: String(marker.data()?.uid ?? "") };
    }

    const uid = await resolveUid(auth, record);
    const photoUrls = await uploadPhotos(uid, record);

    // Before the marker transaction, so a failed list write leaves the whole
    // record retryable rather than marked done with the consent dropped.
    await upsertStallSubscriber(db, record);

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

/**
 * The welcome email after a fresh signup, spec 10.1.1: the magic link goes out
 * afterwards, so the first sign-in lands on the record just made. Best effort
 * only, never throws: a send failure logs and never blocks a sync. Callers only
 * invoke it for a freshly created signup, so a retried record cannot email twice.
 * Shared by /api/stall/sync and /api/join, which write the same record.
 */
export async function sendStallWelcomeEmail(record: StallRecord, siteUrl: string): Promise<void> {
  if (!record.email) return;
  const auth = getAuthAdmin();
  if (!auth) return;
  try {
    const link = await auth.generateSignInWithEmailLink(
      record.email,
      buildActionCodeSettings(siteUrl),
    );
    const sent = await sendEmail(
      record.email,
      "Welcome to Barking Raw",
      stallWelcomeEmailHtml(link, record.name || undefined),
    );
    if (!sent) console.error("[stall-store] welcome email did not send:", record.email);
  } catch (err) {
    console.error("[stall-store] welcome email failed:", err);
  }
}
