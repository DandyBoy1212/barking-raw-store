import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { computeBasketDelivery } from "@/lib/shipping";
import { isMembersOnly } from "@/lib/product-fields";
import { currentUserIsMember } from "@/lib/membership";
import { getStoredProducts, type StoredProduct } from "@/lib/products-store";
import { buildCheckoutLineItem } from "@/lib/stripe-sync";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface Line {
  slug: string;
  qty: number;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Checkout isn't switched on yet. (Add Michaela's Stripe key to go live.)" },
      { status: 503 },
    );
  }
  const stripe = new Stripe(secret);

  let body: { lines?: Line[]; name?: string; email?: string; postcode?: string; discountCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { lines = [], name = "", email = "", postcode = "", discountCode = "" } = body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
  }

  const origin =
    req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  // Build line items from SERVER-SIDE products. Never trust prices from the client.
  const catalogue = await getStoredProducts();
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  const summary: string[] = [];
  const deliveryItems: { product: StoredProduct; qty: number }[] = [];
  const isMember = await currentUserIsMember();
  const now = new Date();
  for (const l of lines) {
    const p = bySlug.get(l.slug);
    if (!p || !p.active || p.archived) continue;
    // Early access is the members area's strongest perk, so it is enforced here and
    // not only by hiding the product. A hand-built request must not get through.
    if (!isMember && isMembersOnly(p, now)) {
      return NextResponse.json(
        { error: `${p.name} is available to members only just now.` },
        { status: 403 },
      );
    }
    const qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    subtotal += p.price * qty;
    summary.push(`${qty} x ${p.name}`);
    line_items.push(buildCheckoutLineItem(p, qty));
    deliveryItems.push({ product: p, qty });
  }
  if (line_items.length === 0) {
    return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });
  }

  const delivery = computeBasketDelivery(deliveryItems, postcode);

  // Optional recovery discount code (validated server-side against Firestore).
  const db = getDb();
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
  if (discountCode && db) {
    const snap = await db.collection(COLLECTIONS.discountCodes).doc(discountCode.toUpperCase()).get();
    const data = snap.data();
    const valid =
      snap.exists && data && !data.used && (!data.expiresAt || data.expiresAt.toMillis() > Date.now());
    if (valid) {
      const coupon = await stripe.coupons.create({
        percent_off: data!.percent,
        duration: "once",
        name: `Barking Raw ${data!.percent}% welcome back`,
      });
      discounts.push({ coupon: coupon.id });
    }
  }

  // Record the cart so the abandoned-cart job can chase it if payment is not completed.
  let cartId = "";
  if (db) {
    const ref = await db.collection(COLLECTIONS.carts).add({
      items: lines,
      name,
      email,
      postcode,
      subtotal,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    cartId = ref.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: email || undefined,
    shipping_address_collection: { allowed_countries: ["GB"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name:
            delivery.total === 0
              ? "Free delivery"
              : delivery.parcels.length > 1
                ? `Delivery (${delivery.parcels.length} parcels)`
                : "UK postage",
          fixed_amount: { amount: Math.round(delivery.total * 100), currency: "gbp" },
        },
      },
    ],
    ...(discounts.length ? { discounts } : { allow_promotion_codes: true }),
    metadata: {
      cartId,
      postcode,
      itemSummary: summary.join(", "),
      // Stripe metadata values are strings and capped at 500 characters, so this is a
      // short breakdown for reconciliation, not a full record.
      deliveryBreakdown: delivery.parcels
        .map((p) => `${p.label}: ${p.cost.toFixed(2)}`)
        .join("; ")
        .slice(0, 480),
      parcelCount: String(delivery.parcels.length),
    },
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#products`,
  });

  return NextResponse.json({ url: session.url });
}
