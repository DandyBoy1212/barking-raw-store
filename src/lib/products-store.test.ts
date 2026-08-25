import { describe, it, expect } from "vitest";
import {
  docToStoredProduct,
  sortStoredProducts,
  seedAsStoredProducts,
  splitByMembersOnly,
  toCatalogue,
} from "./products-store";

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

  it("parses the recurring price map, keeping only string values", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: 1,
      stripeRecurringPriceIds: { "2": "price_r2", "4": 7, "8": "price_r8", junk: null },
    });
    expect(sp.stripeRecurringPriceIds).toEqual({ "2": "price_r2", "8": "price_r8" });
  });

  it("leaves the recurring price map undefined when absent or malformed", () => {
    expect(docToStoredProduct("x", { name: "X", price: 1 }).stripeRecurringPriceIds).toBeUndefined();
    expect(
      docToStoredProduct("x", { name: "X", price: 1, stripeRecurringPriceIds: "nope" })
        .stripeRecurringPriceIds,
    ).toBeUndefined();
  });

  it("guards a non-finite price to 0 instead of yielding NaN", () => {
    const sp = docToStoredProduct("bad-price", {
      name: "Bad Price",
      price: "not a number",
      hook: "h",
      description: "d",
      image: "/bad-price.png",
    });
    expect(sp.price).toBe(0);
    expect(Number.isFinite(sp.price)).toBe(true);
  });
});

describe("seedAsStoredProducts", () => {
  it("maps every seed product to an active, non-archived stored product", () => {
    // 9 treats, the Dog Day mystery box, the two new mystery boxes, and 4 toys.
    const all = seedAsStoredProducts();
    expect(all).toHaveLength(16);
    expect(all.every((p) => p.active && !p.archived)).toBe(true);
    expect(all.every((p) => p.stripePriceId === undefined)).toBe(true);
  });

  it("puts every seed product on a shelf, so none of them is invisible", () => {
    for (const p of seedAsStoredProducts()) {
      expect(["treats", "boxes", "toys"]).toContain(p.category);
    }
  });

  it("stocks all three shelves", () => {
    const shelves = new Set(seedAsStoredProducts().map((p) => p.category));
    expect([...shelves].sort()).toEqual(["boxes", "toys", "treats"]);
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

describe("docToStoredProduct new fields", () => {
  it("defaults a legacy doc with no members window to none", () => {
    const p = docToStoredProduct("chicken-feet", { name: "Chicken Feet", price: 6 });
    expect(p.membersOnlyUntil).toBeUndefined();
  });

  it("keeps a members only window", () => {
    const p = docToStoredProduct("x", { name: "X", price: 1, membersOnlyUntil: "2026-09-01" });
    expect(p.membersOnlyUntil).toBe("2026-09-01");
  });
});

describe("toCatalogue new fields", () => {
  it("carries the new fields through to the client shape", () => {
    const stored = docToStoredProduct("x", {
      name: "X",
      price: 1,
      category: "boxes",
      membersOnlyUntil: "2026-09-01",
    });
    const c = toCatalogue(stored);
    expect(c.category).toBe("boxes");
    expect(c.membersOnlyUntil).toBe("2026-09-01");
  });
});

describe("docToStoredProduct images", () => {
  it("folds a legacy doc's single image into the images list", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: 1,
      hook: "h",
      description: "d",
      image: "/x.png",
    });
    expect(sp.images).toEqual([{ url: "/x.png", primary: true }]);
    expect(sp.image).toBe("/x.png");
  });

  it("respects a stored images list and derives image from its primary", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: 1,
      hook: "h",
      description: "d",
      image: "/stale.png",
      images: [{ url: "/a.png" }, { url: "/b.png", primary: true }],
    });
    expect(sp.images).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
    ]);
    expect(sp.image).toBe("/b.png");
  });

  it("passes images through toCatalogue", () => {
    const sp = docToStoredProduct("x", {
      name: "X",
      price: 1,
      hook: "h",
      description: "d",
      image: "/x.png",
    });
    expect(toCatalogue(sp).images).toEqual([{ url: "/x.png", primary: true }]);
  });
});

describe("seed images", () => {
  it("gives every seed product a one-entry primary list matching its image", () => {
    for (const sp of seedAsStoredProducts()) {
      expect(sp.images).toEqual([{ url: sp.image, primary: true }]);
    }
  });
});

describe("splitByMembersOnly", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("puts an open product in open and an unexpired window in membersOnly", () => {
    const open = docToStoredProduct("a", { name: "A", price: 1 });
    const early = docToStoredProduct("b", { name: "B", price: 1, membersOnlyUntil: "2026-09-01" });
    const result = splitByMembersOnly([open, early], now);
    expect(result.open.map((p) => p.slug)).toEqual(["a"]);
    expect(result.membersOnly.map((p) => p.slug)).toEqual(["b"]);
  });

  it("releases a product with no manual step once its window has passed", () => {
    const past = docToStoredProduct("c", { name: "C", price: 1, membersOnlyUntil: "2026-07-01" });
    const result = splitByMembersOnly([past], now);
    expect(result.open.map((p) => p.slug)).toEqual(["c"]);
    expect(result.membersOnly).toEqual([]);
  });
});

describe("docToStoredProduct stock and points rate", () => {
  it("reads them tolerantly and leaves junk absent", () => {
    const good = docToStoredProduct("x", { name: "X", price: 5, stock: 7, pointsPerPound: 0 });
    expect(good.stock).toBe(7);
    expect(good.pointsPerPound).toBe(0);
    const junk = docToStoredProduct("y", { name: "Y", price: 5, stock: "lots", pointsPerPound: -3 });
    expect(junk.stock).toBeUndefined();
    expect(junk.pointsPerPound).toBeUndefined();
  });
});

describe("sortStoredProducts", () => {
  const p = (slug: string, sortOrder?: number) =>
    docToStoredProduct(slug, { name: slug.toUpperCase(), price: 5, ...(sortOrder ? { sortOrder } : {}) });

  it("puts ordered products first, ascending, then the rest alphabetically", () => {
    // The curated shelf comes first in Michaela's order; anything she has not
    // placed follows alphabetically rather than in Firestore's doc-id accident.
    const sorted = sortStoredProducts([p("zebra"), p("apple"), p("last", 9), p("first", 1)]);
    expect(sorted.map((x) => x.slug)).toEqual(["first", "last", "apple", "zebra"]);
  });

  it("breaks a sort-order tie alphabetically, so the order is stable", () => {
    const sorted = sortStoredProducts([p("beta", 3), p("alpha", 3)]);
    expect(sorted.map((x) => x.slug)).toEqual(["alpha", "beta"]);
  });
});

describe("docToStoredProduct category", () => {
  it("reads the category from the doc", () => {
    const p = docToStoredProduct("ears-box", { name: "Ears Box", price: 12, category: "boxes" });
    expect(p.category).toBe("boxes");
  });

  it("defaults a doc written before the migration to treats", () => {
    const p = docToStoredProduct("chicken-feet", { name: "Chicken Feet", price: 6 });
    expect(p.category).toBe("treats");
  });

  it("defaults an unrecognised category to treats rather than dropping the product", () => {
    const p = docToStoredProduct("odd", { name: "Odd", price: 1, category: "sundries" });
    expect(p.category).toBe("treats");
  });

  it("carries the category through to the client catalogue", () => {
    const stored = docToStoredProduct("ears-box", {
      name: "Ears Box",
      price: 12,
      category: "boxes",
    });
    expect(toCatalogue(stored).category).toBe("boxes");
  });
});
