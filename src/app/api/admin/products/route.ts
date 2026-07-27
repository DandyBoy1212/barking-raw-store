import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlugStrict, type StoredProduct } from "@/lib/products-store";
import { slugify, validateProductInput } from "@/lib/product-admin";
import { getActiveBadgeLabels } from "@/lib/badges-store";
import { syncProductToStripe } from "@/lib/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requireStaff();
  const secret = process.env.STRIPE_SECRET_KEY;
  const db = getDb();
  if (!secret || !db) return NextResponse.json({ ok: false, errors: ["Service not configured."] }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad request."] }, { status: 400 });
  }

  const allowedBadges = await getActiveBadgeLabels();
  const parsed = validateProductInput(body, allowedBadges);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const slug = slugify(parsed.value.name);
  if (!slug) return NextResponse.json({ ok: false, errors: ["Could not derive a slug from the name."] }, { status: 400 });
  try {
    if (await getStoredProductBySlugStrict(slug)) {
      return NextResponse.json({ ok: false, errors: ["A product with this name already exists."] }, { status: 409 });
    }
  } catch (err) {
    console.error("[admin-products] duplicate-slug pre-check Firestore read failed:", err);
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const draft: StoredProduct = { slug, ...parsed.value, active: true, archived: false };

  let ids: { stripeProductId: string; stripePriceId: string };
  try {
    ids = await syncProductToStripe(stripe, draft, siteUrl);
  } catch (err) {
    console.error("[admin-products] Stripe sync failed:", err);
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  try {
    // create() (not set()) so a concurrent create of the same slug fails rather than being overwritten.
    await db.collection(COLLECTIONS.products).doc(slug).create({
      name: draft.name,
      price: draft.price,
      hook: draft.hook,
      description: draft.description,
      badges: draft.badges,
      images: draft.images,
      image: draft.image,
      ...(draft.safetyNote ? { safetyNote: draft.safetyNote } : {}),
      pillar: draft.pillar,
      leadTimeDays: draft.leadTimeDays,
      ...(draft.membersOnlyUntil ? { membersOnlyUntil: draft.membersOnlyUntil } : {}),
      fulfilment: draft.fulfilment,
      ...(draft.supplierPostage !== undefined ? { supplierPostage: draft.supplierPostage } : {}),
      ...(draft.supplierArrivalMinDays !== undefined
        ? { supplierArrivalMinDays: draft.supplierArrivalMinDays }
        : {}),
      ...(draft.supplierArrivalMaxDays !== undefined
        ? { supplierArrivalMaxDays: draft.supplierArrivalMaxDays }
        : {}),
      ...(draft.packWeightGrams !== undefined ? { packWeightGrams: draft.packWeightGrams } : {}),
      ...(draft.packPieceCount !== undefined ? { packPieceCount: draft.packPieceCount } : {}),
      ...(draft.stock !== undefined ? { stock: draft.stock } : {}),
      ...(draft.pointsPerPound !== undefined ? { pointsPerPound: draft.pointsPerPound } : {}),
      active: true,
      archived: false,
      stripeProductId: ids.stripeProductId,
      stripePriceId: ids.stripePriceId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[admin-products] Firestore create failed after Stripe sync:", err);
    // Best effort: archive the just-created Stripe product so it is not orphaned.
    try {
      await stripe.products.update(ids.stripeProductId, { active: false });
    } catch (cleanupErr) {
      console.error("[admin-products] failed to archive orphaned Stripe product:", cleanupErr);
    }
    const alreadyExists =
      (err as { code?: number }).code === 6 ||
      String((err as { message?: string }).message ?? err).includes("ALREADY_EXISTS");
    if (alreadyExists) {
      return NextResponse.json(
        { ok: false, errors: ["A product with this name already exists."] },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, errors: ["Save failed."] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug });
}
