import { describe, it, expect } from "vitest";
import {
  priceToPence,
  buildStripeProductParams,
  buildCheckoutLineItem,
  syncProductToStripe,
  priceChanged,
  applyStripeProductUpdate,
  archiveStripeProduct,
  buildRecurringPriceParams,
  ensureRecurringPrice,
} from "./stripe-sync";
import type { StoredProduct } from "./products-store";

const base: StoredProduct = {
  slug: "chicken-feet",
  name: "Chicken Feet",
  price: 6,
  hook: "crunchy",
  description: "single ingredient",
  badges: [],
  images: [{ url: "/products/chicken-feet.png", primary: true }],
  image: "/products/chicken-feet.png",
  pillar: "good-food",
  leadTimeDays: 0,
  fulfilment: "own-stock",
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

  it("sends the primary photo to Stripe, whichever position it holds", () => {
    const params = buildStripeProductParams(
      {
        ...base,
        image: "/products/chicken-feet.png",
        images: [
          { url: "/products/other.png", primary: false },
          { url: "/products/primary.png", primary: true },
        ],
      },
      "https://example.com",
    );
    expect(params.images).toEqual(["https://example.com/products/primary.png"]);
  });

  it("falls back to the legacy single image when the list is empty", () => {
    const params = buildStripeProductParams(
      { ...base, images: [], image: "/products/chicken-feet.png" },
      "https://example.com",
    );
    expect(params.images).toEqual(["https://example.com/products/chicken-feet.png"]);
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

describe("priceChanged", () => {
  it("compares in pence to avoid float noise", () => {
    expect(priceChanged(6.5, 6.5)).toBe(false);
    expect(priceChanged(6.5, 7)).toBe(true);
    expect(priceChanged(6.1, 6.10001)).toBe(false);
  });
});

describe("applyStripeProductUpdate", () => {
  const existing: StoredProduct = {
    slug: "chicken-feet",
    name: "Chicken Feet",
    price: 6,
    hook: "h",
    description: "d",
    badges: [],
    images: [{ url: "/products/chicken-feet.png", primary: true }],
    image: "/products/chicken-feet.png",
    pillar: "good-food",
    leadTimeDays: 0,
    fulfilment: "own-stock",
    active: true,
    archived: false,
    stripeProductId: "prod_1",
    stripePriceId: "price_old",
  };

  it("updates the product but keeps the price id when the price is unchanged", async () => {
    const calls: string[] = [];
    const fake = {
      products: {
        update: async (id: string) => { calls.push(`product.update:${id}`); return { id }; },
      },
      prices: {
        create: async () => { calls.push("price.create"); return { id: "price_new" }; },
        update: async () => { calls.push("price.update"); return { id: "price_old" }; },
      },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing }, "https://barkingraw.dog");
    expect(out).toEqual({
      stripeProductId: "prod_1",
      stripePriceId: "price_old",
      stripeRecurringPriceIds: {},
    });
    expect(calls).toEqual(["product.update:prod_1"]);
  });

  it("creates a new price, sets it default, and archives the old one on a price change", async () => {
    const calls: string[] = [];
    const fake = {
      products: {
        update: async (id: string, params: Record<string, unknown>) => {
          calls.push(`product.update:${id}:${params.default_price ?? "fields"}`);
          return { id };
        },
      },
      prices: {
        create: async () => { calls.push("price.create"); return { id: "price_new" }; },
        update: async (id: string, params: Record<string, unknown>) => {
          calls.push(`price.update:${id}:active=${params.active}`);
          return { id };
        },
      },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing, price: 7 }, "https://barkingraw.dog");
    expect(out).toEqual({
      stripeProductId: "prod_1",
      stripePriceId: "price_new",
      stripeRecurringPriceIds: {},
    });
    expect(calls).toEqual([
      "product.update:prod_1:fields",
      "price.create",
      "product.update:prod_1:price_new",
      "price.update:price_old:active=false",
    ]);
  });
});

describe("buildRecurringPriceParams", () => {
  it("prices the recurring interval at the FULL list price (the coupon discounts, not the price)", () => {
    expect(
      buildRecurringPriceParams({ ...base, stripeProductId: "prod_1", price: 6.5 }, 4),
    ).toEqual({
      product: "prod_1",
      currency: "gbp",
      unit_amount: 650,
      recurring: { interval: "week", interval_count: 4 },
    });
  });
});

describe("ensureRecurringPrice", () => {
  it("returns the stored id for that frequency without calling Stripe", async () => {
    let calls = 0;
    const fake = {
      prices: { create: async () => { calls++; return { id: "price_new" }; } },
    } as unknown as import("stripe").default;
    const id = await ensureRecurringPrice(
      fake,
      { ...base, stripeProductId: "prod_1", stripeRecurringPriceIds: { "4": "price_r4" } },
      4,
    );
    expect(id).toBe("price_r4");
    expect(calls).toBe(0);
  });

  it("creates a recurring price on demand when that frequency has none", async () => {
    let seen: unknown = null;
    const fake = {
      prices: { create: async (p: unknown) => { seen = p; return { id: "price_r8" }; } },
    } as unknown as import("stripe").default;
    const id = await ensureRecurringPrice(
      fake,
      { ...base, stripeProductId: "prod_1", stripeRecurringPriceIds: { "4": "price_r4" } },
      8,
    );
    expect(id).toBe("price_r8");
    expect(seen).toEqual({
      product: "prod_1",
      currency: "gbp",
      unit_amount: 600,
      recurring: { interval: "week", interval_count: 8 },
    });
  });

  it("returns null when the product has never been synced to Stripe", async () => {
    let calls = 0;
    const fake = {
      prices: { create: async () => { calls++; return { id: "x" }; } },
    } as unknown as import("stripe").default;
    expect(await ensureRecurringPrice(fake, base, 2)).toBeNull();
    expect(calls).toBe(0);
  });
});

describe("applyStripeProductUpdate with recurring prices", () => {
  const existing: StoredProduct = {
    slug: "chicken-feet",
    name: "Chicken Feet",
    price: 6,
    hook: "h",
    description: "d",
    badges: [],
    images: [{ url: "/products/chicken-feet.png", primary: true }],
    image: "/products/chicken-feet.png",
    pillar: "good-food",
    leadTimeDays: 0,
    fulfilment: "own-stock",
    active: true,
    archived: false,
    stripeProductId: "prod_1",
    stripePriceId: "price_old",
    stripeRecurringPriceIds: { "2": "price_r2", "8": "price_r8" },
  };

  it("keeps the recurring prices when the price is unchanged", async () => {
    const fake = {
      products: { update: async (id: string) => ({ id }) },
      prices: { create: async () => ({ id: "n" }), update: async (id: string) => ({ id }) },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing }, "https://barkingraw.dog");
    expect(out.stripeRecurringPriceIds).toEqual({ "2": "price_r2", "8": "price_r8" });
  });

  it("deactivates every recurring price and clears the map on a price change", async () => {
    const deactivated: string[] = [];
    const fake = {
      products: { update: async (id: string) => ({ id }) },
      prices: {
        create: async () => ({ id: "price_new" }),
        update: async (id: string, params: Record<string, unknown>) => {
          if (params.active === false) deactivated.push(id);
          return { id };
        },
      },
    } as unknown as import("stripe").default;
    const out = await applyStripeProductUpdate(fake, existing, { ...existing, price: 7 }, "https://barkingraw.dog");
    expect(out.stripeRecurringPriceIds).toEqual({});
    expect(deactivated).toEqual(expect.arrayContaining(["price_old", "price_r2", "price_r8"]));
    expect(deactivated).toHaveLength(3);
  });
});

describe("archiveStripeProduct", () => {
  it("sets the Stripe product inactive", async () => {
    let seen = "";
    const fake = {
      products: { update: async (id: string, p: Record<string, unknown>) => { seen = `${id}:${p.active}`; return { id }; } },
    } as unknown as import("stripe").default;
    await archiveStripeProduct(fake, "prod_9");
    expect(seen).toBe("prod_9:false");
  });
});
