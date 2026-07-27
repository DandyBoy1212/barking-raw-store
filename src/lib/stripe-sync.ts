import type Stripe from "stripe";
import type { StoredProduct } from "@/lib/products-store";
import { primaryImageUrl } from "@/lib/product-images";

/** Pounds to integer pence, rounded, avoiding float drift. */
export function priceToPence(price: number): number {
  return Math.round(price * 100);
}

/** Turn a relative /public image path into an absolute URL Stripe can fetch. */
function absoluteImage(image: string, siteUrl: string): string {
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  return `${siteUrl.replace(/\/$/, "")}${image.startsWith("/") ? "" : "/"}${image}`;
}

export function buildStripeProductParams(sp: StoredProduct, siteUrl = "https://barkingraw.dog") {
  // A Stripe product takes one image, and it is always the primary. The legacy
  // single field is the fallback for a doc that somehow lost its list.
  const img = absoluteImage(primaryImageUrl(sp.images) || sp.image, siteUrl);
  return {
    name: sp.name,
    description: sp.description,
    images: img ? [img] : [],
    metadata: { slug: sp.slug },
  };
}

/** Prefer the synced Stripe price id; fall back to a server-computed price_data line. */
export function buildCheckoutLineItem(
  sp: StoredProduct,
  qty: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  const quantity = Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
  if (sp.stripePriceId) {
    return { price: sp.stripePriceId, quantity };
  }
  return {
    quantity,
    price_data: {
      currency: "gbp",
      unit_amount: priceToPence(sp.price),
      product_data: { name: sp.name },
    },
  };
}

/**
 * Ensure a Stripe Product + Price exist for this product. Idempotent: if both ids
 * are already set, returns them untouched. Otherwise creates the Product then the Price.
 * (Editing an existing product's price is Stage 3 work.)
 */
export async function syncProductToStripe(
  stripe: Stripe,
  sp: StoredProduct,
  siteUrl = "https://barkingraw.dog",
): Promise<{ stripeProductId: string; stripePriceId: string }> {
  if (sp.stripeProductId && sp.stripePriceId) {
    return { stripeProductId: sp.stripeProductId, stripePriceId: sp.stripePriceId };
  }
  const product = await stripe.products.create(buildStripeProductParams(sp, siteUrl));
  const price = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: priceToPence(sp.price),
  });
  return { stripeProductId: product.id, stripePriceId: price.id };
}

/** Params for a subscribe-and-save recurring Price: FULL list price, the coupon discounts. */
export function buildRecurringPriceParams(sp: StoredProduct, weeks: number) {
  return {
    product: sp.stripeProductId as string,
    currency: "gbp",
    unit_amount: priceToPence(sp.price),
    recurring: { interval: "week" as const, interval_count: weeks },
  };
}

/**
 * The recurring Price for this product at this frequency, created on demand the
 * first time a subscription checkout needs it. Returns the stored id untouched
 * when one exists, and null for a product never synced to Stripe (the checkout
 * falls back to inline price_data, mirroring buildCheckoutLineItem).
 */
export async function ensureRecurringPrice(
  stripe: Stripe,
  sp: StoredProduct,
  weeks: number,
): Promise<string | null> {
  const stored = sp.stripeRecurringPriceIds?.[String(weeks)];
  if (stored) return stored;
  if (!sp.stripeProductId) return null;
  const price = await stripe.prices.create(buildRecurringPriceParams(sp, weeks));
  return price.id;
}

/** True when the two prices differ once rounded to pence. */
export function priceChanged(prevPrice: number, nextPrice: number): boolean {
  return priceToPence(prevPrice) !== priceToPence(nextPrice);
}

/**
 * Update an existing Stripe product to match `next`. Stripe Prices are immutable,
 * so when the price changes we create a new Price, make it the default, and archive
 * the old one. Recurring subscribe-and-save prices are deactivated too, and the
 * map cleared, so the next subscription checkout mints fresh ones at the new
 * price. Subscriptions already running keep the price they signed up at, which
 * is deliberate grandfathering (spec 6.1). Returns the ids to store.
 */
export async function applyStripeProductUpdate(
  stripe: Stripe,
  existing: StoredProduct,
  next: StoredProduct,
  siteUrl = "https://barkingraw.dog",
): Promise<{
  stripeProductId: string;
  stripePriceId: string;
  stripeRecurringPriceIds: Record<string, string>;
}> {
  const productId = existing.stripeProductId;
  const oldPriceId = existing.stripePriceId;
  const recurring = existing.stripeRecurringPriceIds ?? {};
  if (!productId) {
    // No Stripe product yet (for example an item created before sync): create fresh.
    const ids = await syncProductToStripe(
      stripe,
      { ...next, stripeProductId: undefined, stripePriceId: undefined },
      siteUrl,
    );
    return { ...ids, stripeRecurringPriceIds: {} };
  }

  await stripe.products.update(productId, buildStripeProductParams(next, siteUrl));

  if (!oldPriceId || priceChanged(existing.price, next.price)) {
    const price = await stripe.prices.create({
      product: productId,
      currency: "gbp",
      unit_amount: priceToPence(next.price),
    });
    await stripe.products.update(productId, { default_price: price.id });
    if (oldPriceId) await stripe.prices.update(oldPriceId, { active: false });
    for (const id of Object.values(recurring)) {
      await stripe.prices.update(id, { active: false });
    }
    return { stripeProductId: productId, stripePriceId: price.id, stripeRecurringPriceIds: {} };
  }

  return {
    stripeProductId: productId,
    stripePriceId: oldPriceId,
    stripeRecurringPriceIds: recurring,
  };
}

/** Archive a product in Stripe (hides it without deleting). */
export async function archiveStripeProduct(stripe: Stripe, stripeProductId: string): Promise<void> {
  await stripe.products.update(stripeProductId, { active: false });
}
