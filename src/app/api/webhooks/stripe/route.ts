import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { appendOrderRow } from "@/lib/sheet";
import { isLocalPostcode } from "@/lib/shipping";
import { invoiceToOrder } from "@/lib/subscriptions";
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

  if (event.type === "invoice.paid") {
    try {
      await fulfilRecurring(event.data.object as Stripe.Invoice);
    } catch (err) {
      console.error("[webhook] recurring fulfilment failed:", err);
      // Same policy: 200, the invoice is still in Stripe.
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

  // A subscription session's money lands via invoice.paid, which fires for the
  // first cycle and every renewal alike. Writing the order here too would record
  // the first cycle twice, so this handler only closes the cart and secures the
  // account (with the Stripe customer id, which the billing portal needs).
  if (full.mode === "subscription") {
    if (db) {
      const cartId = full.metadata?.cartId;
      if (cartId) {
        await db
          .collection(COLLECTIONS.carts)
          .doc(cartId)
          .set({ status: "converted", updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          .catch(() => {});
      }
      await ensureCustomer({
        email: customerEmail,
        name: customerName,
        postcode,
        stripeCustomerId: typeof full.customer === "string" ? full.customer : full.customer?.id,
      }).catch((err) => {
        console.error("[webhook] ensureCustomer failed:", err);
      });
    }
    return;
  }

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

/**
 * Every paid subscription invoice, first cycle and renewal alike, becomes an
 * order in store_orders and a row on the fulfilment sheet, in the same shape as
 * a one-off, so nothing downstream forks. Idempotent on the invoice id.
 */
async function fulfilRecurring(invoice: Stripe.Invoice) {
  const order = invoiceToOrder(invoice);
  if (!order) return; // Not a subscription invoice: nothing of ours to fulfil.

  const local = isLocalPostcode(order.customer.postcode);

  const db = getDb();
  if (db) {
    const orderRef = db.collection(COLLECTIONS.orders).doc(order.invoiceId);
    const existing = await orderRef.get();
    if (existing.exists) return;

    await orderRef.set({
      stripeInvoiceId: order.invoiceId,
      stripeSubscriptionId: order.subscriptionId,
      subscription: true,
      ...(order.frequencyWeeks ? { frequencyWeeks: order.frequencyWeeks } : {}),
      items: order.items,
      customer: order.customer,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      local,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Membership contract: a paid subscription order grants member: true through
    // the same path as a one-off order.
    await ensureCustomer({
      email: order.customer.email,
      name: order.customer.name,
      postcode: order.customer.postcode,
      stripeCustomerId: order.stripeCustomerId,
    }).catch((err) => {
      console.error("[webhook] ensureCustomer failed:", err);
    });
  }

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  await appendOrderRow([
    order.invoiceId.slice(-8),
    now,
    order.customer.name,
    order.customer.address,
    order.customer.postcode,
    order.itemSummary,
    order.items.reduce((n, i) => n + i.qty, 0),
    order.subtotal.toFixed(2),
    order.shipping.toFixed(2),
    order.total.toFixed(2),
    local ? "LOCAL" : "Post",
  ]);
}
