import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlug } from "@/lib/products-store";
import { archiveStripeProduct } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await ctx.params;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { archived?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }
  const archived = Boolean(body.archived);

  const existing = await getStoredProductBySlug(slug);
  if (!existing) return NextResponse.json({ ok: false, errors: ["Product not found."] }, { status: 404 });

  const secret = process.env.STRIPE_SECRET_KEY;
  try {
    if (secret && existing.stripeProductId) {
      const stripe = new Stripe(secret);
      // Archiving hides in Stripe; unarchiving reactivates.
      if (archived) {
        await archiveStripeProduct(stripe, existing.stripeProductId);
      } else {
        await stripe.products.update(existing.stripeProductId, { active: true });
      }
    }

    await db.collection(COLLECTIONS.products).doc(slug).set(
      { archived, active: !archived, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error("[admin-products] archive toggle failed:", err);
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, archived });
}
