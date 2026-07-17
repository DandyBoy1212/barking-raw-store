import type Stripe from "stripe";
import type { StoredProduct } from "@/lib/products-store";

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
  const img = absoluteImage(sp.image, siteUrl);
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

/** True when the two prices differ once rounded to pence. */
export function priceChanged(prevPrice: number, nextPrice: number): boolean {
  return priceToPence(prevPrice) !== priceToPence(nextPrice);
}

/**
 * Update an existing Stripe product to match `next`. Stripe Prices are immutable,
 * so when the price changes we create a new Price, make it the default, and archive
 * the old one. Returns the ids that should be stored on the product.
 */
export async function applyStripeProductUpdate(
  stripe: Stripe,
  existing: StoredProduct,
  next: StoredProduct,
  siteUrl = "https://barkingraw.dog",
): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const productId = existing.stripeProductId;
  const oldPriceId = existing.stripePriceId;
  if (!productId) {
    // No Stripe product yet (for example an item created before sync): create fresh.
    return syncProductToStripe(stripe, { ...next, stripeProductId: undefined, stripePriceId: undefined }, siteUrl);
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
    return { stripeProductId: productId, stripePriceId: price.id };
  }

  return { stripeProductId: productId, stripePriceId: oldPriceId };
}

/** Archive a product in Stripe (hides it without deleting). */
export async function archiveStripeProduct(stripe: Stripe, stripeProductId: string): Promise<void> {
  await stripe.products.update(stripeProductId, { active: false });
}
