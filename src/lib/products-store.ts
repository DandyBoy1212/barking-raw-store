import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  products as seed,
  ALL_PILLARS,
  type Product,
  type Badge,
  type Pillar,
  type FulfilmentPath,
} from "@/data/products";
import { isMembersOnly } from "@/lib/product-fields";
import { normaliseImages, primaryImageUrl } from "@/lib/product-images";

export type StoredProduct = Product & {
  active: boolean;
  archived: boolean;
  /**
   * Stock and points rate, admin-facing only: deliberately NOT carried into
   * toCatalogue, so shelf counts never ride in every visitor's page payload.
   * Absent stock means untracked; absent rate means loyalty.ts's default.
   */
  stock?: number;
  pointsPerPound?: number;
  stripeProductId?: string;
  stripePriceId?: string;
  /** Recurring subscribe-and-save prices, keyed by frequency in weeks ("2" | "4" | "8"). */
  stripeRecurringPriceIds?: Record<string, string>;
};

/** Normalise a raw Firestore doc into a StoredProduct, applying defaults. */
export function docToStoredProduct(id: string, data: Record<string, unknown>): StoredProduct {
  const rawPrice = Number(data.price ?? 0);

  const rawPillar = String(data.pillar ?? "");
  // A legacy doc predates the pillar field. All nine originals are food, and a
  // product with no pillar would appear on no page at all, which looks like the
  // site working while the product is invisible. Default rather than drop.
  const pillar: Pillar = ALL_PILLARS.includes(rawPillar as Pillar)
    ? (rawPillar as Pillar)
    : "good-food";

  const rawLead = Number(data.leadTimeDays ?? 0);
  const leadTimeDays = Number.isFinite(rawLead) ? Math.max(0, Math.floor(rawLead)) : 0;

  const fulfilment: FulfilmentPath =
    data.fulfilment === "supplier-posted" ? "supplier-posted" : "own-stock";
  const supplier = fulfilment === "supplier-posted";
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  // A legacy doc predates the images list and carries only the single image
  // string; fold it in rather than dropping the photo.
  const images = normaliseImages(data.images, data.image);

  return {
    slug: id,
    name: String(data.name ?? ""),
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    hook: String(data.hook ?? ""),
    description: String(data.description ?? ""),
    badges: Array.isArray(data.badges) ? (data.badges as Badge[]) : [],
    images,
    image: primaryImageUrl(images),
    safetyNote: data.safetyNote ? String(data.safetyNote) : undefined,
    pillar,
    leadTimeDays,
    membersOnlyUntil: data.membersOnlyUntil ? String(data.membersOnlyUntil) : undefined,
    fulfilment,
    supplierPostage: supplier ? num(data.supplierPostage) : undefined,
    supplierArrivalMinDays: supplier ? num(data.supplierArrivalMinDays) : undefined,
    supplierArrivalMaxDays: supplier ? num(data.supplierArrivalMaxDays) : undefined,
    packWeightGrams: num(data.packWeightGrams),
    packPieceCount: num(data.packPieceCount),
    stock: num(data.stock),
    pointsPerPound: num(data.pointsPerPound),
    active: data.active === undefined ? true : Boolean(data.active),
    archived: Boolean(data.archived ?? false),
    stripeProductId: data.stripeProductId ? String(data.stripeProductId) : undefined,
    stripePriceId: data.stripePriceId ? String(data.stripePriceId) : undefined,
    stripeRecurringPriceIds: parseRecurringPriceIds(data.stripeRecurringPriceIds),
  };
}

/** A string-to-string map or nothing; anything else in a doc is dropped, not guessed at. */
function parseRecurringPriceIds(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Persist a freshly minted recurring price id on the product doc. A merge set
 * with a nested map merges keys, so frequencies never clobber each other.
 */
export async function saveRecurringPriceId(
  slug: string,
  weeks: number,
  priceId: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .collection(COLLECTIONS.products)
    .doc(slug)
    .set({ stripeRecurringPriceIds: { [String(weeks)]: priceId } }, { merge: true });
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
    images: sp.images,
    image: sp.image,
    safetyNote: sp.safetyNote,
    pillar: sp.pillar,
    leadTimeDays: sp.leadTimeDays,
    membersOnlyUntil: sp.membersOnlyUntil,
    fulfilment: sp.fulfilment,
    supplierPostage: sp.supplierPostage,
    supplierArrivalMinDays: sp.supplierArrivalMinDays,
    supplierArrivalMaxDays: sp.supplierArrivalMaxDays,
    packWeightGrams: sp.packWeightGrams,
    packPieceCount: sp.packPieceCount,
  };
}

/**
 * Split a catalogue into what anybody may see and what only members may see.
 *
 * Pure and synchronous so the caller decides which half to render. Members only
 * products are filtered out on the server, never hidden with CSS, because the
 * whole value of an early access window is that non-members cannot see it yet.
 */
export function splitByMembersOnly(
  all: StoredProduct[],
  now: Date,
): { open: StoredProduct[]; membersOnly: StoredProduct[] } {
  const open: StoredProduct[] = [];
  const membersOnly: StoredProduct[] = [];
  for (const p of all) (isMembersOnly(p, now) ? membersOnly : open).push(p);
  return { open, membersOnly };
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

/** Every product including archived/inactive, for the admin list. Falls back to the seed. */
export async function getAllStoredProducts(): Promise<StoredProduct[]> {
  const db = getDb();
  if (!db) return seedAsStoredProducts();
  const snap = await db.collection(COLLECTIONS.products).get();
  const all = snap.docs.map((d) => docToStoredProduct(d.id, d.data() as Record<string, unknown>));
  return all.length ? all : seedAsStoredProducts();
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

/**
 * Strict read for admin mutations: no seed fallback.
 * Returns null only when the doc genuinely does not exist; a Firestore read error propagates
 * to the caller rather than silently substituting a seed baseline (which would be missing
 * stripeProductId/stripePriceId and cause mutation routes to bootstrap a duplicate Stripe product).
 */
export async function getStoredProductBySlugStrict(slug: string): Promise<StoredProduct | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection(COLLECTIONS.products).doc(slug).get();
  if (!doc.exists) return null;
  return docToStoredProduct(doc.id, doc.data() as Record<string, unknown>);
}

/** Everything a signed-out visitor may see: buyable, minus anything still in its members window. */
export async function getPublicProducts(now: Date = new Date()): Promise<StoredProduct[]> {
  return splitByMembersOnly(await getStoredProducts(), now).open;
}

/** Everything a member may see and buy: the public catalogue plus the early access drops. */
export async function getMemberProducts(now: Date = new Date()): Promise<StoredProduct[]> {
  const { open, membersOnly } = splitByMembersOnly(await getStoredProducts(), now);
  return [...open, ...membersOnly];
}
