// The shop's category data: which products belong to a shelf, which photo fills
// each circle, and each category's search metadata. Pure, so the filter and the
// photo paths are unit-testable. Replaces the deleted pillars.ts.

import {
  ALL_PRODUCT_CATEGORIES,
  ALL_SHOP_CATEGORIES,
  type ProductCategory,
  type ShopCategory,
} from "@/data/products";

/** The products on one shelf, in catalogue order. */
export function filterByCategory<T extends { category: ProductCategory }>(
  items: T[],
  category: ProductCategory,
): T[] {
  return items.filter((p) => p.category === category);
}

/**
 * True for the three shelves only. Pick and Mix is deliberately excluded: it has
 * its own page and no products of its own, so /shop/pick-and-mix must not be
 * served by the generic category route.
 */
export function isProductCategory(value: string): value is ProductCategory {
  return ALL_PRODUCT_CATEGORIES.includes(value as ProductCategory);
}

/**
 * The categories worth showing a circle for: the shelves that actually have
 * something on them, plus Pick and Mix whenever the treat range does.
 *
 * An empty shelf on a shop's front page reads as a broken site rather than as
 * "coming soon", so a category with nothing in it is not advertised at all. The
 * circle appears by itself the moment the first product lands on that shelf,
 * with no deploy needed.
 */
export function visibleShopCategories<T extends { category: ProductCategory }>(
  products: T[],
): ShopCategory[] {
  const stocked = new Set(products.map((p) => p.category));
  return ALL_SHOP_CATEGORIES.filter((c) =>
    // Pick and Mix owns no products; it draws from the treat range, so it lives
    // and dies with it.
    c === "pick-and-mix" ? stocked.has("treats") : stocked.has(c),
  );
}

/**
 * The photo inside each circle. PLACEHOLDERS for all four: only the old product
 * shots exist in public/ today. Michaela swaps these here, one line each, when
 * the packet, box and pick and mix photographs arrive.
 */
export const CATEGORY_IMAGES: Record<ShopCategory, string> = {
  treats: "/products/whole-sprats.png",
  boxes: "/products/mystery-box.png",
  "pick-and-mix": "/products/chicken-feet.png",
  toys: "/products/rabbit-ears.png",
};

/** Search metadata for the shop and its category pages. Names no other company. */
export const CATEGORY_META: Record<ShopCategory, { title: string; description: string }> = {
  treats: {
    title: "Treat Range | Barking Raw",
    description:
      "Natural single ingredient dog treats, named in full on the pack and posted to your door. Free local delivery, free over GBP 35.",
  },
  boxes: {
    title: "Treat Boxes | Barking Raw",
    description:
      "Hand packed boxes of natural dog treats, chosen for your dog rather than pulled off a shelf.",
  },
  "pick-and-mix": {
    title: "Pick & Mix | Barking Raw",
    description:
      "Choose 5, 10 or 20 items and we pick the assortment. A randomised spread of the treat range, packed by hand.",
  },
  toys: {
    title: "Toys | Barking Raw",
    description: "Ropes, balls and treat dispensers for dogs who would rather play than chew.",
  },
};
