import "server-only";
import { getSessionUser } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";

/**
 * Membership is granted by an online purchase or by signing up at the stall, both of
 * which write a store_customers doc. It is deliberately not granted by the home page
 * email form, so "members see the new stuff first" stays true (spec section 10.1).
 */
export async function isMemberUid(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db || !uid) return false;
  try {
    const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
    return doc.exists;
  } catch (err) {
    console.error("[membership] customer lookup failed, treating as non-member:", err);
    return false;
  }
}

/** Whether the current visitor may see and buy products inside a members only window. */
export async function currentUserIsMember(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (user.staff) return true; // Michaela must be able to check the drop before it lands.
  return isMemberUid(user.uid);
}
