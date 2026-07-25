import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlugStrict, type StoredProduct } from "@/lib/products-store";
import { validateProductInput } from "@/lib/product-admin";
import { applyStripeProductUpdate } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await ctx.params;
  const secret = process.env.STRIPE_SECRET_KEY;
  const db = getDb();
  if (!secret || !db) return NextResponse.json({ ok: false, errors: ["Service not configured."] }, { status: 503 });

  let existing: StoredProduct | null;
  try {
    existing = await getStoredProductBySlugStrict(slug);
  } catch (err) {
    console.error("[admin-products] Firestore read failed:", err);
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ ok: false, errors: ["Product not found."] }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }
  const parsed = validateProductInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const next: StoredProduct = { ...existing, ...parsed.value };
  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";

  let ids: { stripeProductId: string; stripePriceId: string };
  try {
    ids = await applyStripeProductUpdate(stripe, existing, next, siteUrl);
  } catch (err) {
    console.error("[admin-products] Stripe update failed:", err);
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  try {
    await db.collection(COLLECTIONS.products).doc(slug).set(
      {
        name: next.name,
        price: next.price,
        hook: next.hook,
        description: next.description,
        badges: next.badges,
        image: next.image,
        ...(next.safetyNote ? { safetyNote: next.safetyNote } : { safetyNote: FieldValue.delete() }),
        pillar: next.pillar,
        leadTimeDays: next.leadTimeDays,
        ...(next.membersOnlyUntil
          ? { membersOnlyUntil: next.membersOnlyUntil }
          : { membersOnlyUntil: FieldValue.delete() }),
        fulfilment: next.fulfilment,
        ...(next.supplierPostage !== undefined
          ? { supplierPostage: next.supplierPostage }
          : { supplierPostage: FieldValue.delete() }),
        ...(next.supplierArrivalMinDays !== undefined
          ? { supplierArrivalMinDays: next.supplierArrivalMinDays }
          : { supplierArrivalMinDays: FieldValue.delete() }),
        ...(next.supplierArrivalMaxDays !== undefined
          ? { supplierArrivalMaxDays: next.supplierArrivalMaxDays }
          : { supplierArrivalMaxDays: FieldValue.delete() }),
        stripeProductId: ids.stripeProductId,
        stripePriceId: ids.stripePriceId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("[admin-products] Firestore update failed after Stripe sync:", err);
    if (ids.stripePriceId !== existing.stripePriceId) {
      // The Stripe price already rolled to ids.stripePriceId (from existing.stripePriceId)
      // but the Firestore doc for this slug was not updated to match. No automatic rollback
      // is attempted here: reconciling which price is authoritative after a failed write
      // needs a human to look at both sides.
      console.error(
        `[admin-products] RECONCILIATION NEEDED: slug="${slug}" Stripe default price rolled from ` +
          `"${existing.stripePriceId ?? "none"}" to "${ids.stripePriceId}" but the Firestore write failed. ` +
          `Firestore still references the old price id. Manual reconciliation required.`,
      );
    }
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug });
}
