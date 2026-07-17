import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { getStoredProductBySlug, type StoredProduct } from "@/lib/products-store";
import { slugify, validateProductInput } from "@/lib/product-admin";
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

  const parsed = validateProductInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const slug = slugify(parsed.value.name);
  if (!slug) return NextResponse.json({ ok: false, errors: ["Could not derive a slug from the name."] }, { status: 400 });
  if (await getStoredProductBySlug(slug)) {
    return NextResponse.json({ ok: false, errors: ["A product with this name already exists."] }, { status: 409 });
  }

  const stripe = new Stripe(secret);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const draft: StoredProduct = { slug, ...parsed.value, active: true, archived: false };
  const ids = await syncProductToStripe(stripe, draft, siteUrl);

  await db.collection(COLLECTIONS.products).doc(slug).set({
    name: draft.name,
    price: draft.price,
    hook: draft.hook,
    description: draft.description,
    badges: draft.badges,
    image: draft.image,
    ...(draft.safetyNote ? { safetyNote: draft.safetyNote } : {}),
    active: true,
    archived: false,
    stripeProductId: ids.stripeProductId,
    stripePriceId: ids.stripePriceId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, slug });
}
