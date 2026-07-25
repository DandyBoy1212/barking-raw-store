import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { normaliseAddress } from "@/lib/customer-fields";
import type { Dog, StoredCustomer } from "@/data/customers";

/**
 * Map a Firestore doc to a customer, tolerating every shape ever written.
 *
 * Legacy docs carry { email, name, lastPostcode } and nothing else, so lastPostcode
 * seeds the postcode rather than being dropped. A dog missing its id or its name is
 * dropped, because it can be neither edited nor displayed, and keeping it would put
 * an unfixable row on the account page.
 */
export function docToStoredCustomer(uid: string, data: Record<string, unknown>): StoredCustomer {
  const rawAddress = (data.address ?? {}) as Record<string, unknown>;
  const address = normaliseAddress({
    line1: String(rawAddress.line1 ?? ""),
    line2: String(rawAddress.line2 ?? ""),
    city: String(rawAddress.city ?? ""),
    postcode: String(rawAddress.postcode ?? data.lastPostcode ?? ""),
  });

  const dogs: Dog[] = Array.isArray(data.dogs)
    ? (data.dogs as unknown[]).filter((d): d is Dog => {
        if (!d || typeof d !== "object") return false;
        const dog = d as Partial<Dog>;
        return Boolean(dog.id) && Boolean(dog.name);
      })
    : [];

  return {
    uid,
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    address,
    dogs,
  };
}

/** The signed-in customer's record, or null when they have never bought or signed up. */
export async function getCustomer(uid: string): Promise<StoredCustomer | null> {
  const db = getDb();
  if (!db || !uid) return null;
  try {
    const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
    if (!doc.exists) return null;
    return docToStoredCustomer(uid, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.error("[customers-store] getCustomer read failed:", err);
    return null;
  }
}
