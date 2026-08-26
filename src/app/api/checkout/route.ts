import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { computeBasketDelivery, type DeliveryProduct } from "@/lib/shipping";
import {
  bundleDeliveryProduct,
  bundleLabel,
  parseBundle,
  priceBundle,
  summariseBundleContents,
  validateBundle,
} from "@/lib/pick-and-mix";
import { isMembersOnly } from "@/lib/product-fields";
import { currentUserIsMember } from "@/lib/membership";
import { getStoredProducts, saveRecurringPriceId, type StoredProduct } from "@/lib/products-store";
import { buildCheckoutLineItem, ensureRecurringPrice, priceToPence } from "@/lib/stripe-sync";
import {
  buildPostageLineItem,
  buildSubscriptionLineItem,
  ensureSubscribeCoupon,
  parseFrequencyWeeks,
  splitSubscribable,
  subscriptionMetadata,
} from "@/lib/subscriptions";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface Line {
  slug: string;
  qty: number;
  /** Present on a Pick & Mix line: the frozen draw, re-validated server-side. */
  bundle?: unknown;
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

  let body: {
    lines?: Line[];
    name?: string;
    email?: string;
    postcode?: string;
    discountCode?: string;
    frequencyWeeks?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { lines = [], name = "", email = "", postcode = "", discountCode = "" } = body;
  const frequencyWeeks = parseFrequencyWeeks(body.frequencyWeeks);
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
  const bundleContents: string[] = [];
  const bundleDeliveryItems: { product: DeliveryProduct; qty: number }[] = [];
  const isMember = await currentUserIsMember();
  const now = new Date();
  for (const l of lines) {
    // A Pick & Mix line: the client's draw is a claim, not a price. It is
    // re-validated against the live catalogue and re-priced server-side, and
    // tampering refuses the whole checkout rather than silently repricing.
    if (l.bundle !== undefined) {
      const sel = parseBundle(l.bundle);
      if (!sel) {
        return NextResponse.json(
          { error: "That Pick & Mix bundle does not match what we offer. Please draw a fresh one." },
          { status: 400 },
        );
      }
      const verdict = validateBundle(sel, catalogue, { isMember, now });
      if (!verdict.ok) {
        return NextResponse.json({ error: verdict.error }, { status: verdict.status });
      }
      const priced = priceBundle(sel.items, bySlug);
      if (!priced) {
        return NextResponse.json(
          { error: "That Pick & Mix bundle does not match what we offer. Please draw a fresh one." },
          { status: 400 },
        );
      }
      const contents = summariseBundleContents(sel.items, bySlug);
      subtotal += priced.price;
      summary.push(`${bundleLabel(sel.size)}: ${contents}`);
      bundleContents.push(`${bundleLabel(sel.size)}: ${contents}`);
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: priceToPence(priced.price),
          product_data: {
            name: bundleLabel(sel.size),
            // The contents on the Stripe line itself, so the dashboard shows
            // what was in the bag without opening the sheet. Stripe caps this.
            description: contents.slice(0, 250),
          },
        },
      });
      bundleDeliveryItems.push({
        product: bundleDeliveryProduct(
          `pick-and-mix-${sel.size}-${bundleContents.length}`,
          sel.size,
          priced.price,
        ),
        qty: 1,
      });
      continue;
    }
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

  // A bundle's saving is already in its price, and section 6 exists precisely
  // so discounts never stack: while one is in the basket there is no repeat
  // order and no discount code. The drawer says the same; a hand-built request
  // must hit the same wall.
  const hasBundle = bundleContents.length > 0;
  if (frequencyWeeks && hasBundle) {
    return NextResponse.json(
      { error: "A Pick & Mix bundle is a one-off order. Remove it to set up a repeat order." },
      { status: 400 },
    );
  }

  // A repeating order covers own stock only (spec 4.4): supplier-posted lines
  // carry the supplier's price, postage and availability, so an automatic
  // recurring charge for them is a promise we cannot keep. The UI says the same
  // thing, but a hand-built request must hit the same wall.
  if (frequencyWeeks && splitSubscribable(deliveryItems).ineligible.length > 0) {
    return NextResponse.json(
      {
        error:
          "Repeat orders cover items posted from Barking Raw only. Remove the items that post separately, or choose a one-off order.",
      },
      { status: 400 },
    );
  }

  const delivery = computeBasketDelivery([...deliveryItems, ...bundleDeliveryItems], postcode);

  // Optional recovery discount code (validated server-side against Firestore).
  // Never on a subscription: the reserved 10% is the deal, and section 6 exists
  // precisely so discounts do not stack.
  const db = getDb();
  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
  if (discountCode && db && !frequencyWeeks && !hasBundle) {
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
      ...(frequencyWeeks ? { subscribeWeeks: frequencyWeeks } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    cartId = ref.id;
  }

  if (frequencyWeeks) {
    // Subscription checkout: recurring Prices at full list price, one visible
    // 10% coupon (never 90% prices, so Michaela's dashboard shows the discount),
    // and postage as a recurring line because subscription mode cannot repeat a
    // one-off shipping rate every cycle.
    const sub_line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    for (const { product, qty } of deliveryItems) {
      let recurringPriceId: string | undefined;
      try {
        const ensured = await ensureRecurringPrice(stripe, product, frequencyWeeks);
        if (ensured) {
          recurringPriceId = ensured;
          if (product.stripeRecurringPriceIds?.[String(frequencyWeeks)] !== ensured) {
            // Persist so the next subscriber reuses it; losing the write only
            // costs a duplicate Price later, never the checkout.
            await saveRecurringPriceId(product.slug, frequencyWeeks, ensured).catch((err) =>
              console.error("[checkout] saveRecurringPriceId failed:", err),
            );
          }
        }
      } catch (err) {
        console.error("[checkout] ensureRecurringPrice failed, using inline price_data:", err);
      }
      sub_line_items.push(buildSubscriptionLineItem(product, qty, frequencyWeeks, recurringPriceId));
    }
    const postagePence = Math.round(delivery.total * 100);
    const postageLine = buildPostageLineItem(delivery.total, frequencyWeeks);
    if (postageLine) sub_line_items.push(postageLine);

    const coupon = await ensureSubscribeCoupon(stripe);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: sub_line_items,
      customer_email: email || undefined,
      shipping_address_collection: { allowed_countries: ["GB"] },
      discounts: [{ coupon }],
      subscription_data: {
        metadata: subscriptionMetadata({
          weeks: frequencyWeeks,
          postcode,
          itemSummary: summary.join(", "),
          postagePence,
        }),
      },
      metadata: {
        cartId,
        postcode,
        itemSummary: summary.join(", ").slice(0, 480),
        subscribeWeeks: String(frequencyWeeks),
      },
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#products`,
    });
    return NextResponse.json({ url: session.url });
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
    ...(discounts.length ? { discounts } : hasBundle ? {} : { allow_promotion_codes: true }),
    metadata: {
      cartId,
      postcode,
      // Stripe rejects any metadata value over 500 characters, which would fail
      // the whole session, so the summary is capped and each bundle's full
      // contents ride in their own key for the order doc.
      itemSummary: summary.join(", ").slice(0, 480),
      ...Object.fromEntries(bundleContents.map((c, i) => [`bundle_${i + 1}`, c.slice(0, 480)])),
      // Stripe metadata values are strings and capped at 500 characters, so this is a
      // short breakdown for reconciliation, not a full record.
      deliveryBreakdown: delivery.parcels
        .map((p) => `${p.label}: ${p.cost.toFixed(2)}`)
        .join("; ")
        .slice(0, 480),
      parcelCount: String(delivery.parcels.length),
    },
    // Allergies at the point of payment, on every one-off order. We pack food
    // for a specific dog (the mystery box makes this explicit), so the safest
    // moment to ask is the one form every buyer must complete. Optional: a
    // treats-for-the-office buyer has nothing to declare.
    custom_fields: [
      {
        key: "dog_allergies",
        label: { type: "custom", custom: "Your dog's allergies (so we pack safely)" },
        type: "text",
        optional: true,
      },
      {
        key: "treat_preference",
        label: { type: "custom", custom: "More of a toys dog or a treats dog?" },
        type: "dropdown",
        dropdown: {
          options: [
            { label: "Treats, every time", value: "treats" },
            { label: "Toys all the way", value: "toys" },
            { label: "A bit of both", value: "both" },
          ],
        },
        optional: true,
      },
    ],
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#products`,
  });

  return NextResponse.json({ url: session.url });
}
