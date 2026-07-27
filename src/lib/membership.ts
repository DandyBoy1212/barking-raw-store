import "server-only";
import { getSessionUser } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { isMemberDoc } from "@/lib/customer-fields";

/**
 * Membership is granted by an online purchase or by signing up at the stall. It is
 * deliberately not granted by the home page email form, nor by filling in an account,
 * so "members see the new stuff first" stays true (spec section 10.1).
 *
 * It is decided by an explicit `member` flag, NOT by a store_customers doc existing.
 * That distinction is the fix for a real escalation: the account routes create that
 * doc when somebody adds a dog or saves an address, so while existence meant
 * membership, any signed-in visitor could hand themselves early access.
 *
 * Anything that should confer membership must write `member: true` itself.
 */
export async function isMemberUid(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db || !uid) return false;
  try {
    const doc = await db.collection(COLLECTIONS.customers).doc(uid).get();
    return isMemberDoc(doc.data());
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
