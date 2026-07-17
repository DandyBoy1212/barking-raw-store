import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { appendOrderRow } from "@/lib/sheet";
import { isLocalPostcode } from "@/lib/shipping";
import { FieldValue } from "firebase-admin/firestore";
import { ensureCustomer } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const stripe = new Stripe(secret);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || "", webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      await fulfil(stripe, event.data.object as Stripe.Checkout.Session);
    } catch (err) {
      console.error("[webhook] fulfilment failed:", err);
      // Return 200 so Stripe does not hammer retries; the order is still in Stripe.
    }
  }

  return NextResponse.json({ received: true });
}

async function fulfil(stripe: Stripe, session: Stripe.Checkout.Session) {
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items"],
  });
  const items = (full.line_items?.data || []).map((li) => ({
    name: li.description,
    qty: li.quantity ?? 1,
    amount: (li.amount_total ?? 0) / 100,
  }));

  const shippingAddr =
    (full.customer_details?.address as Stripe.Address | undefined) ?? null;
  const postcode = shippingAddr?.postal_code || (full.metadata?.postcode ?? "");
  const address = shippingAddr
    ? [shippingAddr.line1, shippingAddr.line2, shippingAddr.city, shippingAddr.postal_code]
        .filter(Boolean)
        .join(", ")
    : "";
  const subtotal = (full.amount_subtotal ?? 0) / 100;
  const shipping = (full.total_details?.amount_shipping ?? 0) / 100;
  const total = (full.amount_total ?? 0) / 100;
  const customerName = full.customer_details?.name || "";
  const customerEmail = full.customer_details?.email || full.customer_email || "";
  const local = isLocalPostcode(postcode);
  const itemSummary =
    full.metadata?.itemSummary || items.map((i) => `${i.qty} x ${i.name}`).join(", ");

  const db = getDb();
  if (db) {
    // Idempotent: use the Stripe session id as the doc id.
    const orderRef = db.collection(COLLECTIONS.orders).doc(full.id);
    const existing = await orderRef.get();
    if (existing.exists) return;

    await orderRef.set({
      stripeSessionId: full.id,
      items,
      customer: { name: customerName, email: customerEmail, address, postcode },
      subtotal,
      shipping,
      total,
      local,
      createdAt: FieldValue.serverTimestamp(),
    });

    const cartId = full.metadata?.cartId;
    if (cartId) {
      await db
        .collection(COLLECTIONS.carts)
        .doc(cartId)
        .set({ status: "converted", updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        .catch(() => {});
    }

    // Invisible account: create or match a Firebase user + customer doc for this buyer.
    await ensureCustomer({ email: customerEmail, name: customerName, postcode }).catch((err) => {
      console.error("[webhook] ensureCustomer failed:", err);
    });
  }

  // Append a row to Michaela's fulfilment sheet (append-only).
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  await appendOrderRow([
    full.id.slice(-8),
    now,
    customerName,
    address,
    postcode,
    itemSummary,
    items.reduce((n, i) => n + i.qty, 0),
    subtotal.toFixed(2),
    shipping.toFixed(2),
    total.toFixed(2),
    local ? "LOCAL" : "Post",
  ]);
}
