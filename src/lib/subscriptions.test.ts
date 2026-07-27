import { describe, it, expect } from "vitest";
import {
  SUBSCRIBE_PERCENT,
  SUBSCRIBE_FREQUENCIES,
  SUBSCRIBE_COUPON_ID,
  POSTAGE_LINE_NAME,
  parseFrequencyWeeks,
  splitSubscribable,
  discounted,
  buildSubscriptionLineItem,
  buildPostageLineItem,
  ensureSubscribeCoupon,
  subscriptionMetadata,
  invoiceToOrder,
  type SubscriptionInvoiceLike,
} from "./subscriptions";
import type { StoredProduct } from "./products-store";

const baseProduct: StoredProduct = {
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

describe("parseFrequencyWeeks", () => {
  it("accepts the three supported frequencies as numbers", () => {
    expect(parseFrequencyWeeks(2)).toBe(2);
    expect(parseFrequencyWeeks(4)).toBe(4);
    expect(parseFrequencyWeeks(8)).toBe(8);
  });

  it("accepts numeric strings, because metadata and JSON both arrive as strings", () => {
    expect(parseFrequencyWeeks("2")).toBe(2);
    expect(parseFrequencyWeeks("8")).toBe(8);
  });

  it("rejects everything else", () => {
    expect(parseFrequencyWeeks(0)).toBeNull();
    expect(parseFrequencyWeeks(3)).toBeNull();
    expect(parseFrequencyWeeks("weekly")).toBeNull();
    expect(parseFrequencyWeeks(null)).toBeNull();
    expect(parseFrequencyWeeks(undefined)).toBeNull();
    expect(parseFrequencyWeeks("")).toBeNull();
  });
});

describe("SUBSCRIBE_FREQUENCIES", () => {
  it("offers exactly every 2, 4 and 8 weeks, labelled in plain English", () => {
    expect(SUBSCRIBE_FREQUENCIES.map((f) => f.weeks)).toEqual([2, 4, 8]);
    expect(SUBSCRIBE_FREQUENCIES.map((f) => f.label)).toEqual([
      "Every 2 weeks",
      "Every 4 weeks",
      "Every 8 weeks",
    ]);
  });
});

describe("splitSubscribable", () => {
  const own = { fulfilment: "own-stock" } as { fulfilment: import("@/data/products").FulfilmentPath };
  const supplier = { fulfilment: "supplier-posted" } as { fulfilment: import("@/data/products").FulfilmentPath };

  it("puts own-stock lines in eligible and supplier-posted in ineligible", () => {
    const items = [
      { product: own, qty: 2 },
      { product: supplier, qty: 1 },
      { product: own, qty: 3 },
    ];
    const { eligible, ineligible } = splitSubscribable(items);
    expect(eligible).toEqual([
      { product: own, qty: 2 },
      { product: own, qty: 3 },
    ]);
    expect(ineligible).toEqual([{ product: supplier, qty: 1 }]);
  });

  it("returns empty arrays for an empty basket", () => {
    expect(splitSubscribable([])).toEqual({ eligible: [], ineligible: [] });
  });
});

describe("discounted", () => {
  it("takes the reserved 10% off", () => {
    expect(SUBSCRIBE_PERCENT).toBe(10);
    expect(discounted(6)).toBe(5.4);
  });

  it("round-trips the spec 6.1 example: 11.11 list becomes the 10.00 bottom price", () => {
    expect(discounted(11.11)).toBe(10);
  });

  it("is pence-safe on awkward floats", () => {
    expect(discounted(0.1)).toBe(0.09);
    expect(discounted(7.55)).toBe(6.8);
  });
});

describe("buildSubscriptionLineItem", () => {
  it("uses the stored recurring price id when one is given", () => {
    const item = buildSubscriptionLineItem(baseProduct, 3, 4, "price_recur");
    expect(item).toEqual({ price: "price_recur", quantity: 3 });
  });

  it("falls back to inline recurring price_data at the full list price", () => {
    const item = buildSubscriptionLineItem(baseProduct, 2, 8);
    expect(item).toEqual({
      quantity: 2,
      price_data: {
        currency: "gbp",
        unit_amount: 600,
        recurring: { interval: "week", interval_count: 8 },
        product_data: { name: "Chicken Feet" },
      },
    });
  });

  it("clamps quantity to 1..50 like the one-off path", () => {
    expect(buildSubscriptionLineItem(baseProduct, 0, 2, "p").quantity).toBe(1);
    expect(buildSubscriptionLineItem(baseProduct, 999, 2, "p").quantity).toBe(50);
  });
});

describe("buildPostageLineItem", () => {
  it("returns null when postage is free", () => {
    expect(buildPostageLineItem(0, 4)).toBeNull();
    expect(buildPostageLineItem(-1, 4)).toBeNull();
  });

  it("builds a recurring postage line at the basket frequency", () => {
    expect(buildPostageLineItem(3.95, 2)).toEqual({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: 395,
        recurring: { interval: "week", interval_count: 2 },
        product_data: { name: POSTAGE_LINE_NAME },
      },
    });
  });
});

describe("ensureSubscribeCoupon", () => {
  it("returns the fixed id without creating when the coupon already exists", async () => {
    const calls: string[] = [];
    const fake = {
      coupons: {
        retrieve: async (id: string) => { calls.push(`retrieve:${id}`); return { id }; },
        create: async () => { calls.push("create"); return { id: "x" }; },
      },
    } as unknown as import("stripe").default;
    const id = await ensureSubscribeCoupon(fake);
    expect(id).toBe(SUBSCRIBE_COUPON_ID);
    expect(calls).toEqual([`retrieve:${SUBSCRIBE_COUPON_ID}`]);
  });

  it("creates the forever 10% coupon on first use", async () => {
    let created: Record<string, unknown> | null = null;
    const fake = {
      coupons: {
        retrieve: async () => { throw new Error("No such coupon"); },
        create: async (p: Record<string, unknown>) => { created = p; return { id: p.id }; },
      },
    } as unknown as import("stripe").default;
    const id = await ensureSubscribeCoupon(fake);
    expect(id).toBe(SUBSCRIBE_COUPON_ID);
    expect(created).toEqual({
      id: SUBSCRIBE_COUPON_ID,
      percent_off: 10,
      duration: "forever",
      name: "Subscribe and save 10%",
    });
  });
});

describe("subscriptionMetadata", () => {
  it("stringifies everything, because Stripe metadata values are strings", () => {
    expect(
      subscriptionMetadata({
        weeks: 4,
        postcode: "DD5 1AB",
        itemSummary: "2 x Chicken Feet",
        postagePence: 395,
      }),
    ).toEqual({
      br_frequency_weeks: "4",
      br_postcode: "DD5 1AB",
      br_item_summary: "2 x Chicken Feet",
      br_postage_pence: "395",
    });
  });

  it("caps the item summary at 480 characters, matching the one-off metadata cap", () => {
    const meta = subscriptionMetadata({
      weeks: 2,
      postcode: "",
      itemSummary: "x".repeat(600),
      postagePence: 0,
    });
    expect(meta.br_item_summary.length).toBe(480);
    expect(meta.br_postage_pence).toBe("0");
  });
});

describe("invoiceToOrder", () => {
  const paidInvoice: SubscriptionInvoiceLike = {
    id: "in_1ABCDEFGH",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: "sub_123",
        metadata: {
          br_frequency_weeks: "4",
          br_postcode: "DD5 1AB",
          br_item_summary: "2 x Chicken Feet, 1 x Duck Necks",
          br_postage_pence: "395",
        },
      },
    },
    customer: "cus_9",
    customer_name: "Sam Smith",
    customer_email: "sam@example.com",
    customer_address: { line1: "1 Bark Lane", city: "Dundee", postal_code: "DD9 9ZZ" },
    customer_shipping: {
      address: { line1: "2 Paw Street", line2: "Flat 3", city: "Dundee", postal_code: "DD5 1AB" },
    },
    subtotal: 2595, // 12.00 + 10.00 goods + 3.95 postage, pre-discount, in pence
    total: 2336, // after the 10% coupon
    lines: {
      data: [
        { description: "Chicken Feet", quantity: 2, amount: 1200 },
        { description: "Duck Necks", quantity: 1, amount: 1000 },
        { description: "UK postage", quantity: 1, amount: 395 },
      ],
    },
  };

  it("returns null for anything that is not a subscription invoice", () => {
    expect(invoiceToOrder({ ...paidInvoice, parent: null })).toBeNull();
    expect(
      invoiceToOrder({
        ...paidInvoice,
        parent: { type: "quote_details", subscription_details: null },
      }),
    ).toBeNull();
  });

  it("maps goods lines to items and splits postage out by its own line", () => {
    const order = invoiceToOrder(paidInvoice)!;
    expect(order.items).toEqual([
      { name: "Chicken Feet", qty: 2, amount: 12 },
      { name: "Duck Necks", qty: 1, amount: 10 },
    ]);
    expect(order.shipping).toBe(3.95);
    expect(order.subtotal).toBe(22); // pre-discount goods only
    expect(order.total).toBe(23.36); // what was actually paid
  });

  it("keeps the money right when there is no postage line", () => {
    const free = invoiceToOrder({
      ...paidInvoice,
      subtotal: 2200,
      total: 1980,
      lines: {
        data: [
          { description: "Chicken Feet", quantity: 2, amount: 1200 },
          { description: "Duck Necks", quantity: 1, amount: 1000 },
        ],
      },
    })!;
    expect(free.shipping).toBe(0);
    expect(free.subtotal).toBe(22);
    expect(free.total).toBe(19.8);
  });

  it("carries the ids the webhook needs for idempotency and the portal", () => {
    const order = invoiceToOrder(paidInvoice)!;
    expect(order.invoiceId).toBe("in_1ABCDEFGH");
    expect(order.subscriptionId).toBe("sub_123");
    expect(order.stripeCustomerId).toBe("cus_9");
    expect(order.frequencyWeeks).toBe(4);
  });

  it("accepts expanded subscription and customer objects", () => {
    const order = invoiceToOrder({
      ...paidInvoice,
      customer: { id: "cus_obj" },
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: { id: "sub_obj" }, metadata: {} },
      },
    })!;
    expect(order.subscriptionId).toBe("sub_obj");
    expect(order.stripeCustomerId).toBe("cus_obj");
    expect(order.frequencyWeeks).toBeNull();
  });

  it("prefers the shipping address postcode, then billing, then metadata", () => {
    expect(invoiceToOrder(paidInvoice)!.customer.postcode).toBe("DD5 1AB");
    expect(invoiceToOrder(paidInvoice)!.customer.address).toBe(
      "2 Paw Street, Flat 3, Dundee, DD5 1AB",
    );
    const noShipping = invoiceToOrder({ ...paidInvoice, customer_shipping: null })!;
    expect(noShipping.customer.postcode).toBe("DD9 9ZZ");
    expect(noShipping.customer.address).toBe("1 Bark Lane, Dundee, DD9 9ZZ");
    const bare = invoiceToOrder({
      ...paidInvoice,
      customer_shipping: null,
      customer_address: null,
    })!;
    expect(bare.customer.postcode).toBe("DD5 1AB"); // the metadata fallback
    expect(bare.customer.address).toBe("");
  });

  it("prefers the metadata item summary and falls back to the mapped lines", () => {
    expect(invoiceToOrder(paidInvoice)!.itemSummary).toBe("2 x Chicken Feet, 1 x Duck Necks");
    const noMeta = invoiceToOrder({
      ...paidInvoice,
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123", metadata: null },
      },
    })!;
    expect(noMeta.itemSummary).toBe("2 x Chicken Feet, 1 x Duck Necks");
    expect(noMeta.shipping).toBe(3.95); // postage splits by its line, not by metadata
    expect(noMeta.customer.postcode).toBe("DD5 1AB"); // still from the shipping address
  });

  it("copes with a missing customer name and email", () => {
    const order = invoiceToOrder({ ...paidInvoice, customer_name: null, customer_email: null })!;
    expect(order.customer.name).toBe("");
    expect(order.customer.email).toBe("");
  });
});
