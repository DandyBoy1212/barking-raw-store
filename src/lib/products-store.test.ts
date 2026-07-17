import { describe, it, expect } from "vitest";
import { docToStoredProduct, seedAsStoredProducts, toCatalogue } from "./products-store";

describe("docToStoredProduct", () => {
  it("applies defaults for a minimal doc", () => {
    const sp = docToStoredProduct("chicken-feet", {
      name: "Chicken Feet",
      price: 6,
      hook: "h",
      description: "d",
      image: "/products/chicken-feet.png",
    });
    expect(sp).toMatchObject({
      slug: "chicken-feet",
      name: "Chicken Feet",
      price: 6,
      badges: [],
      active: true,
      archived: false,
    });
    expect(sp.stripeProductId).toBeUndefined();
  });

  it("preserves explicit flags, ids, badges and coerces price to a number", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: "7.5",
      hook: "h",
      description: "d",
      image: "/x.png",
      badges: ["Most Popular"],
      active: false,
      archived: true,
      stripeProductId: "prod_1",
      stripePriceId: "price_1",
      safetyNote: "care",
    });
    expect(sp.price).toBe(7.5);
    expect(sp.badges).toEqual(["Most Popular"]);
    expect(sp.active).toBe(false);
    expect(sp.archived).toBe(true);
    expect(sp.stripeProductId).toBe("prod_1");
    expect(sp.stripePriceId).toBe("price_1");
    expect(sp.safetyNote).toBe("care");
  });
});

describe("seedAsStoredProducts", () => {
  it("maps all 9 seed products to active, non-archived stored products", () => {
    const all = seedAsStoredProducts();
    expect(all).toHaveLength(9);
    expect(all.every((p) => p.active && !p.archived)).toBe(true);
    expect(all.every((p) => p.stripePriceId === undefined)).toBe(true);
  });
});

describe("toCatalogue", () => {
  it("strips server-only fields, keeping the UI shape", () => {
    const [sp] = seedAsStoredProducts();
    const cat = toCatalogue({ ...sp, stripeProductId: "prod_1", stripePriceId: "price_1" });
    expect(cat).not.toHaveProperty("stripeProductId");
    expect(cat).not.toHaveProperty("stripePriceId");
    expect(cat.slug).toBe(sp.slug);
    expect(cat.price).toBe(sp.price);
  });
});
