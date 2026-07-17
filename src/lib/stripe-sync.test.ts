import { describe, it, expect } from "vitest";
import {
  priceToPence,
  buildStripeProductParams,
  buildCheckoutLineItem,
  syncProductToStripe,
} from "./stripe-sync";
import type { StoredProduct } from "./products-store";

const base: StoredProduct = {
  slug: "chicken-feet",
  name: "Chicken Feet",
  price: 6,
  hook: "crunchy",
  description: "single ingredient",
  badges: [],
  image: "/products/chicken-feet.png",
  active: true,
  archived: false,
};

describe("priceToPence", () => {
  it("converts pounds to integer pence without float drift", () => {
    expect(priceToPence(6.5)).toBe(650);
    expect(priceToPence(7.55)).toBe(755);
  });
});

describe("buildStripeProductParams", () => {
  it("maps name, description, absolute image and slug metadata", () => {
    const params = buildStripeProductParams(base);
    expect(params.name).toBe("Chicken Feet");
    expect(params.description).toBe("single ingredient");
    expect(params.images).toEqual(["https://barkingraw.dog/products/chicken-feet.png"]);
    expect(params.metadata).toEqual({ slug: "chicken-feet" });
  });
});

describe("buildCheckoutLineItem", () => {
  it("uses the synced Stripe price id when present", () => {
    const item = buildCheckoutLineItem({ ...base, stripePriceId: "price_123" }, 3);
    expect(item).toEqual({ price: "price_123", quantity: 3 });
  });

  it("falls back to server-side price_data when no price id", () => {
    const item = buildCheckoutLineItem(base, 2);
    expect(item).toEqual({
      quantity: 2,
      price_data: {
        currency: "gbp",
        unit_amount: 600,
        product_data: { name: "Chicken Feet" },
      },
    });
  });

  it("clamps quantity to 1..50", () => {
    expect(buildCheckoutLineItem({ ...base, stripePriceId: "p" }, 0).quantity).toBe(1);
    expect(buildCheckoutLineItem({ ...base, stripePriceId: "p" }, 999).quantity).toBe(50);
  });
});

describe("syncProductToStripe", () => {
  it("returns existing ids unchanged (idempotent) without calling Stripe", async () => {
    let calls = 0;
    const fake = {
      products: { create: async () => { calls++; return { id: "x" }; } },
      prices: { create: async () => { calls++; return { id: "y" }; } },
    } as unknown as import("stripe").default;
    const out = await syncProductToStripe(
      fake,
      { ...base, stripeProductId: "prod_1", stripePriceId: "price_1" },
      "https://barkingraw.dog",
    );
    expect(out).toEqual({ stripeProductId: "prod_1", stripePriceId: "price_1" });
    expect(calls).toBe(0);
  });

  it("creates a product then a price when ids are missing", async () => {
    const seen: { productParams?: unknown; priceParams?: unknown } = {};
    const fake = {
      products: {
        create: async (p: unknown) => { seen.productParams = p; return { id: "prod_new" }; },
      },
      prices: {
        create: async (p: unknown) => { seen.priceParams = p; return { id: "price_new" }; },
      },
    } as unknown as import("stripe").default;
    const out = await syncProductToStripe(fake, base, "https://barkingraw.dog");
    expect(out).toEqual({ stripeProductId: "prod_new", stripePriceId: "price_new" });
    expect(seen.priceParams).toEqual({
      product: "prod_new",
      currency: "gbp",
      unit_amount: 600,
    });
  });
});
