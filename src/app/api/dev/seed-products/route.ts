import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { seedAsStoredProducts, docToStoredProduct } from "@/lib/products-store";
import { syncProductToStripe } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same bearer pattern as the cron routes: no secret set means allow (dev only).
// In production, an unset secret fails closed rather than opening the route to everyone.
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.SEED_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "no stripe key" }, { status: 503 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "no db" }, { status: 503 });

  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const out: Array<{ slug: string; stripeProductId: string; stripePriceId: string }> = [];

  for (const [seedIndex, seedSp] of seedAsStoredProducts().entries()) {
    const ref = db.collection(COLLECTIONS.products).doc(seedSp.slug);
    // Re-read any existing doc so a re-run stays idempotent (keeps existing Stripe ids).
    const existing = await ref.get();
    const current = existing.exists
      ? docToStoredProduct(existing.id, existing.data() as Record<string, unknown>)
      : seedSp;

    const ids = await syncProductToStripe(stripe, current, siteUrl);

    await ref.set(
      {
        name: seedSp.name,
        price: seedSp.price,
        hook: seedSp.hook,
        description: seedSp.description,
        badges: seedSp.badges,
        images: seedSp.images,
        image: seedSp.image,
        // The A.1 fields. Leaving them out meant every fresh seed needed the
        // backfill script run after it before the pillar pages showed anything.
        category: seedSp.category,
        leadTimeDays: seedSp.leadTimeDays,
        fulfilment: seedSp.fulfilment,
        // The nine originals keep their curated order (Beef Trachea Rings first,
        // Pure Meat Tit-bits last) instead of falling back to alphabetical.
        sortOrder: seedIndex + 1,
        ...(seedSp.membersOnlyUntil ? { membersOnlyUntil: seedSp.membersOnlyUntil } : {}),
        ...(seedSp.safetyNote ? { safetyNote: seedSp.safetyNote } : {}),
        active: true,
        archived: false,
        stripeProductId: ids.stripeProductId,
        stripePriceId: ids.stripePriceId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
    out.push({ slug: seedSp.slug, ...ids });
  }

  return NextResponse.json({ seeded: out.length, products: out });
}
