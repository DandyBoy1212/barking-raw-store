import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { getDb, getAuthAdmin, COLLECTIONS } from "@/lib/firebase-admin";
import { docToStoredCustomer } from "@/lib/customers-store";
import { buildSaleOutcome, docToSaleProduct, type SaleProduct, type StallSale } from "@/lib/stall-sale";

// Marker docs recording which sale clientIds have been applied. A local const
// rather than a COLLECTIONS entry, the stall-store.ts precedent: that shared
// file is a merge seam other tracks touch. Same store_ prefix convention.
const STALL_SALES_COLLECTION = "store_stall_sales";

export type ApplySaleResult =
  | { ok: true; applied: boolean }
  | { ok: false; retryable: boolean; errors?: string[] };

/**
 * Whose sale this is: the picked member's uid verbatim, else the signup rule
 * for a typed email (the existing Firebase user, or a fresh one, so the order
 * and points land where a later magic-link sign-in will look), else nobody.
 * An anonymous sale still records stock and revenue, which is 10.1.2's point.
 */
async function resolveSaleUid(auth: Auth, sale: StallSale): Promise<string> {
  if (sale.customer.uid) return sale.customer.uid;
  if (!sale.customer.email) return "";
  try {
    return (await auth.getUserByEmail(sale.customer.email)).uid;
  } catch {
    return (
      await auth.createUser({
        email: sale.customer.email,
        displayName: sale.customer.name || undefined,
      })
    ).uid;
  }
}

// A sentinel thrown inside the transaction to surface a non-retryable refusal.
class SaleRejected extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
  }
}

/**
 * Apply one stall sale, exactly once per clientId (spec 10.1.2).
 *
 * The marker doc store_stall_sales/{clientId} is checked before any work and
 * re-checked inside the one transaction that reads every product, decrements
 * tracked stock (clamped at zero), writes the order, awards the points and
 * grants membership. A sale that syncs twice therefore decrements zero stock
 * more and awards zero points more. A sale naming an unknown product is
 * rejected outright (not retryable) so it waits on the iPad for a second look
 * rather than silently recording a wrong sale.
 */
export async function applyStallSale(sale: StallSale): Promise<ApplySaleResult> {
  const db = getDb();
  const auth = getAuthAdmin();
  if (!db || !auth) return { ok: false, retryable: true };

  const markerRef = db.collection(STALL_SALES_COLLECTION).doc(sale.clientId);
  try {
    const marker = await markerRef.get();
    if (marker.exists) return { ok: true, applied: false };

    const uid = await resolveSaleUid(auth, sale);
    const orderId = `stall-${sale.clientId}`;
    const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
    const customerRef = uid ? db.collection(COLLECTIONS.customers).doc(uid) : null;

    const applied = await db.runTransaction(async (tx: Transaction) => {
      // Reads first, Firestore's transaction rule.
      const markerSnap = await tx.get(markerRef);
      if (markerSnap.exists) return false;

      const products = new Map<string, SaleProduct>();
      const productRefs = sale.lines.map((l) => db.collection(COLLECTIONS.products).doc(l.slug));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
      productSnaps.forEach((snap, i) => {
        if (snap.exists) {
          products.set(sale.lines[i].slug, docToSaleProduct(snap.id, snap.data() ?? {}));
        }
      });

      const customerSnap = customerRef ? await tx.get(customerRef) : null;

      const priced = buildSaleOutcome(sale, products);
      if (!priced.ok) throw new SaleRejected(priced.errors);
      const { items, total, points, stockChanges } = priced.outcome;

      for (const change of stockChanges) {
        tx.update(db.collection(COLLECTIONS.products).doc(change.slug), {
          stock: change.stock,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Shaped like the webhook's orders so the same readers work, plus what a
      // stall sale knows that Stripe would have known: who, how paid, points.
      const current = customerSnap
        ? docToStoredCustomer(uid, (customerSnap.data() ?? {}) as Record<string, unknown>)
        : null;
      tx.set(orderRef, {
        source: "stall",
        stallClientId: sale.clientId,
        ...(uid ? { uid } : {}),
        items,
        customer: {
          name: sale.customer.name || current?.name || "",
          email: sale.customer.email || current?.email || "",
        },
        subtotal: total,
        shipping: 0,
        total,
        local: true,
        paymentMethod: sale.payment,
        pointsEarned: points,
        recordedAt: sale.recordedAt,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (customerRef && customerSnap) {
        // A purchase confers membership (spec 10.1, the ensureCustomer rule),
        // written as the explicit flag because doc existence grants nothing.
        tx.set(
          customerRef,
          {
            member: true,
            ...(points > 0 ? { pointsBalance: FieldValue.increment(points) } : {}),
            ...(sale.customer.email && !current?.email ? { email: sale.customer.email } : {}),
            ...(sale.customer.name && !current?.name ? { name: sale.customer.name } : {}),
            ...(customerSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      tx.set(markerRef, { uid, orderId, syncedAt: FieldValue.serverTimestamp() });
      return true;
    });

    return { ok: true, applied };
  } catch (err) {
    if (err instanceof SaleRejected) {
      return { ok: false, retryable: false, errors: err.errors };
    }
    console.error("[stall-sale-store] applyStallSale failed:", err);
    return { ok: false, retryable: true };
  }
}

/**
 * The members Michaela can pick from at the table: a page-load snapshot of the
 * synced customers, name and email only, capped so a long customer list cannot
 * weigh the page down. Sorted for the search box, empty when Firestore is not
 * reachable (the recorder still takes anonymous and typed-email sales).
 */
export async function listStallMembers(): Promise<{ uid: string; name: string; email: string }[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTIONS.customers).limit(500).get();
    return snap.docs
      .map((doc) => {
        const c = docToStoredCustomer(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
        return { uid: c.uid, name: c.name, email: c.email };
      })
      .filter((m) => m.name || m.email)
      .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  } catch (err) {
    console.error("[stall-sale-store] listStallMembers failed:", err);
    return [];
  }
}
