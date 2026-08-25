import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { appendOrderRow } from "@/lib/sheet";
import { isLocalPostcode } from "@/lib/shipping";
import { invoiceToOrder } from "@/lib/subscriptions";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureCustomer } from "@/lib/auth";
import { docToSaleProduct, type SaleProduct } from "@/lib/stall-sale";
import {
  buildOrderOutcome,
  linesFromPaidItems,
  type OrderCartLine,
  type OrderOutcome,
} from "@/lib/order-earn";

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

/** Every product doc, mapped for the sale maths. One read; the catalogue is small. */
async function readSaleProducts(db: Firestore): Promise<Map<string, SaleProduct>> {
  const snap = await db.collection(COLLECTIONS.products).get();
  return new Map(
    snap.docs.map((d) => [d.id, docToSaleProduct(d.id, d.data() as Record<string, unknown>)]),
  );
}

/** The cart's lines, read tolerantly. An absent or junk cart means no stock changes. */
async function readCartLines(db: Firestore, cartId: string | undefined): Promise<OrderCartLine[]> {
  if (!cartId) return [];
  try {
    const snap = await db.collection(COLLECTIONS.carts).doc(cartId).get();
    const items = snap.data()?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((raw) => ({
        slug: String((raw as Record<string, unknown>)?.slug ?? ""),
        qty: Math.trunc(Number((raw as Record<string, unknown>)?.qty)),
      }))
      .filter((l) => l.slug && Number.isFinite(l.qty) && l.qty > 0);
  } catch (err) {
    console.error("[webhook] cart read failed, stock left untouched:", err);
    return [];
  }
}

/**
 * Write the order, the stock decrements and the points credit in one
 * transaction, gated on the order doc not existing.
 *
 * The gate inside the transaction is the idempotency for Stripe's redeliveries,
 * and it closes the race the old outside-the-transaction check left open: two
 * concurrent deliveries can no longer both see "no order yet" and each apply.
 * Stock is re-read inside for the docs being decremented, so two simultaneous
 * orders for the last bag cannot both write from the same stale snapshot;
 * the clamp at zero is stage 4's rule, never a negative count.
 *
 * Returns false when the order already existed, so the caller skips the sheet.
 */
async function applyOrderTransaction(
  db: Firestore,
  orderId: string,
  orderDoc: Record<string, unknown>,
  outcome: OrderOutcome,
  qtyBySlug: Map<string, number>,
  customerUid: string | null,
): Promise<boolean> {
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists) return false;

    const freshStock = new Map<string, number>();
    for (const change of outcome.stockChanges) {
      const snap = await tx.get(db.collection(COLLECTIONS.products).doc(change.slug));
      const n = Number(snap.data()?.stock);
      if (Number.isFinite(n) && n >= 0) freshStock.set(change.slug, Math.trunc(n));
    }

    tx.set(orderRef, {
      ...orderDoc,
      ...(outcome.points > 0 ? { points: outcome.points, pointItems: outcome.pointItems } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    for (const [slug, current] of freshStock) {
      const qty = qtyBySlug.get(slug) ?? 0;
      tx.set(
        db.collection(COLLECTIONS.products).doc(slug),
        { stock: Math.max(0, current - qty), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }

    if (customerUid && outcome.points > 0) {
      tx.set(
        db.collection(COLLECTIONS.customers).doc(customerUid),
        { pointsBalance: FieldValue.increment(outcome.points), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    return true;
  });
}

async function fulfil(stripe: Stripe, session: Stripe.Checkout.Session) {
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items"],
  });
  const items = (full.line_items?.data || []).map((li) => ({
    // Stripe types description as nullable; a blank name matches no product and
    // simply earns nothing, the safe direction.
    name: li.description ?? "",
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

  // The checkout form's allergy answer (custom_fields, optional). Captured on
  // the durable order record AND the fulfilment sheet: we pack food for a
  // specific dog, so this must be visible wherever a box is packed from.
  const dogAllergies =
    full.custom_fields?.find((f) => f.key === "dog_allergies")?.text?.value ?? "";

  if (db) {
    // Each Pick & Mix bundle's full contents, one metadata key per bundle
    // (numeric order, so bundle_10 never sorts before bundle_2). This is the
    // durable record of what was in the bag: the sheet's item summary lists it
    // too, but that value is capped and a very long basket could truncate it.
    const bundles = Object.keys(full.metadata || {})
      .filter((k) => /^bundle_\d+$/.test(k))
      .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
      .map((k) => full.metadata![k]);

    // Invisible account first (it touches Firebase Auth, so it cannot live
    // inside the Firestore transaction), keeping the uid for the points credit.
    const uid = await ensureCustomer({ email: customerEmail, name: customerName, postcode }).catch(
      (err) => {
        console.error("[webhook] ensureCustomer failed:", err);
        return null;
      },
    );

    // Points on the amounts paid, stock from the cart's exact slugs (stage 4/5,
    // the same maths as a stall sale). An unmatched name is a bundle line or a
    // product renamed since checkout: it earns nothing, deliberately.
    const cartId = full.metadata?.cartId;
    const [products, cartLines] = await Promise.all([
      readSaleProducts(db),
      readCartLines(db, cartId),
    ]);
    const outcome = buildOrderOutcome(cartLines, items, products);
    if (outcome.unmatched.length) {
      console.info("[webhook] lines earning no points (bundle or renamed):", outcome.unmatched);
    }
    const qtyBySlug = new Map<string, number>();
    for (const line of cartLines) {
      qtyBySlug.set(line.slug, (qtyBySlug.get(line.slug) ?? 0) + line.qty);
    }

    const created = await applyOrderTransaction(
      db,
      full.id,
      {
        stripeSessionId: full.id,
        ...(bundles.length ? { bundles } : {}),
        items,
        customer: { name: customerName, email: customerEmail, address, postcode },
        subtotal,
        shipping,
        total,
        local,
        ...(dogAllergies ? { dogAllergies } : {}),
      },
      outcome,
      qtyBySlug,
      uid,
    );
    if (!created) return; // Redelivery: everything below already happened once.

    if (cartId) {
      await db
        .collection(COLLECTIONS.carts)
        .doc(cartId)
        .set({ status: "converted", updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        .catch(() => {});
    }
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
    // Two empty pads keep the allergies value clear of the manual
    // "Packed"/"Posted" columns after "Local?" — writing into them would
    // shift Michaela's ticks. New column's header is added by hand.
    "",
    "",
    dogAllergies,
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
    // Membership contract: a paid subscription order grants member: true through
    // the same path as a one-off order. First, so the uid exists for the points.
    const uid = await ensureCustomer({
      email: order.customer.email,
      name: order.customer.name,
      postcode: order.customer.postcode,
      stripeCustomerId: order.stripeCustomerId,
    }).catch((err) => {
      console.error("[webhook] ensureCustomer failed:", err);
      return null;
    });

    // A subscription invoice carries no cart, so its stock lines synthesise
    // from the same name join the points use. Every renewal earns and depletes
    // like the sale it is.
    const products = await readSaleProducts(db);
    const lines = linesFromPaidItems(order.items, products);
    const outcome = buildOrderOutcome(lines, order.items, products);
    if (outcome.unmatched.length) {
      console.info("[webhook] subscription lines earning no points:", outcome.unmatched);
    }
    const qtyBySlug = new Map<string, number>();
    for (const line of lines) qtyBySlug.set(line.slug, (qtyBySlug.get(line.slug) ?? 0) + line.qty);

    const created = await applyOrderTransaction(
      db,
      order.invoiceId,
      {
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
      },
      outcome,
      qtyBySlug,
      uid,
    );
    if (!created) return; // Redelivered invoice: the sheet row already exists.
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
