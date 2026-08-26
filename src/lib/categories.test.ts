import { describe, it, expect } from "vitest";
import {
  filterByCategory,
  isProductCategory,
  CATEGORY_META,
  CATEGORY_IMAGES,
  visibleShopCategories,
} from "@/lib/categories";
import { ALL_SHOP_CATEGORIES } from "@/data/products";

describe("filterByCategory", () => {
  const items = [
    { slug: "chicken-feet", category: "treats" as const },
    { slug: "ears-box", category: "boxes" as const },
    { slug: "rope", category: "toys" as const },
  ];

  it("returns only the shelf asked for", () => {
    expect(filterByCategory(items, "treats").map((i) => i.slug)).toEqual(["chicken-feet"]);
  });

  it("keeps catalogue order", () => {
    const many = [
      { slug: "b", category: "treats" as const },
      { slug: "a", category: "treats" as const },
    ];
    expect(filterByCategory(many, "treats").map((i) => i.slug)).toEqual(["b", "a"]);
  });

  it("returns an empty list for a shelf with nothing on it", () => {
    expect(filterByCategory([], "toys")).toEqual([]);
  });
});

describe("isProductCategory", () => {
  it("accepts the three shelves", () => {
    expect(isProductCategory("treats")).toBe(true);
    expect(isProductCategory("boxes")).toBe(true);
    expect(isProductCategory("toys")).toBe(true);
  });

  it("rejects pick-and-mix, which has its own page rather than a product list", () => {
    expect(isProductCategory("pick-and-mix")).toBe(false);
  });

  it("rejects anything invented", () => {
    expect(isProductCategory("sundries")).toBe(false);
  });
});

describe("category presentation", () => {
  it("gives every shop category a title, a description and an image", () => {
    for (const c of ALL_SHOP_CATEGORIES) {
      expect(CATEGORY_META[c].title).toBeTruthy();
      expect(CATEGORY_META[c].description).toBeTruthy();
      expect(CATEGORY_IMAGES[c]).toMatch(/^\//);
    }
  });
});

describe("visibleShopCategories", () => {
  const p = (category: "treats" | "boxes" | "toys") => ({ category });

  it("shows every circle when all three shelves are stocked", () => {
    expect(visibleShopCategories([p("treats"), p("boxes"), p("toys")])).toEqual([
      "treats",
      "boxes",
      "pick-and-mix",
      "toys",
    ]);
  });

  it("hides a shelf with nothing on it, rather than advertising an empty page", () => {
    expect(visibleShopCategories([p("treats"), p("boxes")])).toEqual([
      "treats",
      "boxes",
      "pick-and-mix",
    ]);
  });

  it("drops Pick and Mix with the treat range, since it draws from it", () => {
    expect(visibleShopCategories([p("boxes"), p("toys")])).toEqual(["boxes", "toys"]);
  });

  it("shows nothing at all for an empty catalogue", () => {
    expect(visibleShopCategories([])).toEqual([]);
  });

  it("keeps the agreed order rather than the order products happen to arrive in", () => {
    expect(visibleShopCategories([p("toys"), p("boxes"), p("treats")])).toEqual([
      "treats",
      "boxes",
      "pick-and-mix",
      "toys",
    ]);
  });
});
