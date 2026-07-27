import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { normaliseAddress, validateDogInput } from "@/lib/customer-fields";
import type { CustomerAddress, Dog, StoredCustomer } from "@/data/customers";

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
    ...(data.stripeCustomerId ? { stripeCustomerId: String(data.stripeCustomerId) } : {}),
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

/**
 * The next dog id, one higher than the highest ever used on this record.
 *
 * Deliberately not `dogs.length + 1`: deleting dog-2 from three dogs would then
 * generate dog-3 again, and an edit already in flight against the real dog-3 would
 * land on the new dog instead.
 */
export function nextDogId(existing: { id: string }[]): string {
  const highest = existing.reduce((max, d) => {
    const match = /^dog-(\d+)$/.exec(d.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `dog-${highest + 1}`;
}

/**
 * Add a dog, or replace one by id. Runs in a transaction because dogs are an array
 * on one document, so a read, modify and write from two tabs at once would otherwise
 * silently drop one of them.
 */
export async function upsertDog(
  uid: string,
  dogId: string | null,
  input: Partial<Dog>,
): Promise<{ ok: true; dog: Dog } | { ok: false; errors: string[] }> {
  const parsed = validateDogInput(input);
  if (!parsed.ok) return parsed;

  const db = getDb();
  if (!db || !uid) return { ok: false, errors: ["Service not configured."] };

  const ref = db.collection(COLLECTIONS.customers).doc(uid);
  try {
    const dog = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      const id = dogId ?? nextDogId(current.dogs);
      const saved: Dog = { id, ...parsed.value };
      const dogs = dogId
        ? current.dogs.map((d) => (d.id === dogId ? saved : d))
        : [...current.dogs, saved];
      // An edit for an id that is not there appends rather than vanishing, so a
      // stale tab never silently discards what somebody typed.
      if (dogId && !current.dogs.some((d) => d.id === dogId)) dogs.push(saved);
      tx.set(ref, { dogs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return saved;
    });
    return { ok: true, dog };
  } catch (err) {
    console.error("[customers-store] upsertDog failed:", err);
    return { ok: false, errors: ["Save failed."] };
  }
}

/** Remove a dog by id. True when the write went through. */
export async function removeDog(uid: string, dogId: string): Promise<boolean> {
  const db = getDb();
  if (!db || !uid || !dogId) return false;
  const ref = db.collection(COLLECTIONS.customers).doc(uid);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = docToStoredCustomer(uid, (snap.data() ?? {}) as Record<string, unknown>);
      tx.set(
        ref,
        {
          dogs: current.dogs.filter((d) => d.id !== dogId),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return true;
  } catch (err) {
    console.error("[customers-store] removeDog failed:", err);
    return false;
  }
}

/**
 * The customer's own name, phone and address. Writes lastPostcode alongside address
 * so the older field stays true for anything still reading it.
 */
export async function updateCustomerDetails(
  uid: string,
  input: { name?: string; phone?: string; address?: Partial<CustomerAddress> },
): Promise<boolean> {
  const db = getDb();
  if (!db || !uid) return false;
  const address = normaliseAddress(input.address);
  try {
    await db.collection(COLLECTIONS.customers).doc(uid).set(
      {
        name: String(input.name ?? "").trim(),
        phone: String(input.phone ?? "").trim(),
        address,
        lastPostcode: address.postcode,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("[customers-store] updateCustomerDetails failed:", err);
    return false;
  }
}
