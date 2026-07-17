import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { products as seed, type Product, type Badge } from "@/data/products";

export type StoredProduct = Product & {
  active: boolean;
  archived: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
};

/** Normalise a raw Firestore doc into a StoredProduct, applying defaults. */
export function docToStoredProduct(id: string, data: Record<string, unknown>): StoredProduct {
  const rawPrice = Number(data.price ?? 0);
  return {
    slug: id,
    name: String(data.name ?? ""),
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    hook: String(data.hook ?? ""),
    description: String(data.description ?? ""),
    badges: Array.isArray(data.badges) ? (data.badges as Badge[]) : [],
    image: String(data.image ?? ""),
    safetyNote: data.safetyNote ? String(data.safetyNote) : undefined,
    active: data.active === undefined ? true : Boolean(data.active),
    archived: Boolean(data.archived ?? false),
    stripeProductId: data.stripeProductId ? String(data.stripeProductId) : undefined,
    stripePriceId: data.stripePriceId ? String(data.stripePriceId) : undefined,
  };
}

/** The static seed, expressed as StoredProducts (used as the fallback catalogue). */
export function seedAsStoredProducts(): StoredProduct[] {
  return seed.map((p) => ({ ...p, active: true, archived: false }));
}

/** Reduce a StoredProduct to the plain catalogue shape safe to pass to client components. */
export function toCatalogue(sp: StoredProduct): Product {
  return {
    slug: sp.slug,
    name: sp.name,
    price: sp.price,
    hook: sp.hook,
    description: sp.description,
    badges: sp.badges,
    image: sp.image,
    safetyNote: sp.safetyNote,
  };
}

/** All buyable products (active, not archived). Falls back to the seed if Firestore is down or errors. */
export async function getStoredProducts(): Promise<StoredProduct[]> {
  const db = getDb();
  if (!db) return seedAsStoredProducts().filter((p) => p.active && !p.archived);
  try {
    const snap = await db.collection(COLLECTIONS.products).get();
    if (snap.empty) {
      console.warn("[products-store] getStoredProducts: collection is empty, falling back to seed (pre-seed state)");
      return seedAsStoredProducts().filter((p) => p.active && !p.archived);
    }
    const all = snap.docs.map((d) => docToStoredProduct(d.id, d.data() as Record<string, unknown>));
    return all.filter((p) => p.active && !p.archived);
  } catch (err) {
    console.error("[products-store] getStoredProducts Firestore read failed, falling back to seed:", err);
    return seedAsStoredProducts().filter((p) => p.active && !p.archived);
  }
}

/** A single product by slug (its Firestore doc id). Falls back to the seed. */
export async function getStoredProductBySlug(slug: string): Promise<StoredProduct | null> {
  const db = getDb();
  if (!db) return seedAsStoredProducts().find((p) => p.slug === slug) ?? null;
  try {
    const doc = await db.collection(COLLECTIONS.products).doc(slug).get();
    if (!doc.exists) return seedAsStoredProducts().find((p) => p.slug === slug) ?? null;
    return docToStoredProduct(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.error("[products-store] getStoredProductBySlug Firestore read failed, falling back to seed:", err);
    return seedAsStoredProducts().find((p) => p.slug === slug) ?? null;
  }
}
