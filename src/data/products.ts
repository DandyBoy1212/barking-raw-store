// Single source of truth for the 9 products. Prices in GBP (pounds).
// Copy drafted from docs/research-dossier.md, honesty-flag compliant.

import type { ProductImage } from "@/lib/product-images";

export type { ProductImage };

/**
 * A badge label.
 *
 * Was a compiled union until B.6. Badges now live in the store_badges collection so
 * Michaela can add her own without a deploy, which means the authority on what is
 * valid is that collection, not this type. validateProductInput is handed the current
 * labels and filters against them.
 */
export type Badge = string;

/** The badges the site shipped with. Seed data, not the list of what is valid. */
export const ALL_BADGES: Badge[] = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];

/**
 * The shelf a product sits on. Every product has exactly one.
 *
 * Deliberately smaller than what the shop navigates by: Pick and Mix is a builder
 * that draws from the treat range, not a shelf, so making it a product category
 * would mean inventing products that do not exist. See ShopCategory.
 */
export type ProductCategory = "treats" | "boxes" | "toys";

export const ALL_PRODUCT_CATEGORIES: ProductCategory[] = ["treats", "boxes", "toys"];

/** What the shop navigates by: the three shelves plus the builder. */
export type ShopCategory = ProductCategory | "pick-and-mix";

export const ALL_SHOP_CATEGORIES: ShopCategory[] = ["treats", "boxes", "pick-and-mix", "toys"];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  treats: "Treat Range",
  boxes: "Treat Boxes",
  "pick-and-mix": "Pick & Mix",
  toys: "Toys",
};

export interface Product {
  slug: string;
  name: string;
  price: number; // GBP
  /** GBP. The price shown struck through beside the real price. Absent means no sale. */
  wasPrice?: number;
  hook: string;
  description: string;
  badges: Badge[];
  /**
   * The photos, in display order, exactly one marked primary. The primary is what
   * Stripe receives, what the basket shows, and what any fulfilment surface uses.
   */
  images: ProductImage[];
  /**
   * Derived: the primary image's URL (a path under /public, or a storage URL).
   * Kept because Stripe sync, the basket and legacy Firestore readers all read a
   * single string. Never set independently of images.
   */
  image: string;
  safetyNote?: string;
  /** Which shelf this product sits on. Required: a product with no shelf is invisible. */
  category: ProductCategory;
  /** ISO date "YYYY-MM-DD". Before this date the product is buyable by members only. */
  membersOnlyUntil?: string;
  /**
   * Pack size. Optional, because the nine originals were sold without one, but
   * a price cannot be compared against a competitor without it. See packSizeLabel.
   */
  packWeightGrams?: number;
  packPieceCount?: number;
  // Storage/sync fields (populated once a product lives in Firestore):
  active?: boolean;
  archived?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
}

/** The seed literals carry a single image; the photo list is derived from it below. */
type SeedProduct = Omit<Product, "images">;

const seedProducts: SeedProduct[] = [
  {
    slug: "mystery-box",
    name: "International Dog Day Mystery Box",
    price: 15,
    hook: "A £15 surprise box of natural treats, packed for YOUR dog.",
    description:
      "A hand-packed mystery box, chosen for your dog — not pulled off a shelf. Tell us at checkout whether yours is a treats dog or a toys dog and about any allergies, and we pack accordingly: natural single-ingredient treats, toys for the players, novel proteins for the itchy ones, gentler chews for the dodgy tummies. Launched for International Dog Day with our friends at Scoop Patrol.",
    badges: ["Single Ingredient"],
    image: "/products/mystery-box.png",
    category: "boxes",
    safetyNote:
      "Contents vary by box. Always tell us about allergies at checkout so we never pack what your dog can't have.",
  },
  {
    slug: "beef-trachea-rings",
    name: "Beef Trachea Rings",
    price: 6.5,
    hook: "Cartilage-rich rings your dog can properly sink into.",
    description:
      "A single-ingredient, air-dried chew that's high in protein, low in fat and satisfyingly chewy. Beef trachea is cartilage, which makes it a natural source of glucosamine and chondroitin, and it's genuinely digestible too. Ideal for dogs who love a longer chew and owners who want one honest ingredient with nothing else along for the ride.",
    badges: ["Natural Joint Support", "Single Ingredient"],
    image: "/products/beef-trachea-rings.png",
    category: "treats",
    safetyNote:
      "Supervise while chewing, and choose a ring size that suits enthusiastic gulpers.",
  },
  {
    slug: "chicken-feet",
    name: "Chicken Feet",
    price: 6.0,
    hook: "Crunchy, collagen-packed and a brilliant starter chew.",
    description:
      "Little and moreish, chicken feet are naturally rich in collagen and a natural source of glucosamine, with a satisfying crunch dogs adore. Air-dried as a single ingredient, they're a great introduction to natural chews for dogs new to the good stuff, and a handy everyday reward for regulars. One honest ingredient, named in full.",
    badges: ["Natural Joint Support", "Single Ingredient"],
    image: "/products/chicken-feet.png",
    category: "treats",
    safetyNote:
      "Only ever dehydrated or raw, never cooked, and supervise while your dog chews.",
  },
  {
    slug: "rabbit-ears",
    name: "Rabbit Ears",
    price: 6.5,
    hook: "Lean, fibrous and a proper novel-protein change of pace.",
    description:
      "Rabbit is a lean, novel-ish protein that suits dogs looking for something different from the usual chicken and beef. These fibrous, air-dried ears give a bit of natural roughage and a light, easy chew. A sensible pick for fussy eaters, rotation feeders, or dogs you're keeping to leaner treats without skimping on interest.",
    badges: ["Novel Protein", "Gentle on Dodgy Tummies"],
    image: "/products/rabbit-ears.png",
    category: "treats",
    safetyNote:
      "A treat, not a wormer, and never a substitute for your dog's worming programme. Supervise while chewing.",
  },
  {
    slug: "rabbit-feet",
    name: "Rabbit Feet",
    price: 6.0,
    hook: "Small, crunchy and gentle novel protein for sensitive dogs.",
    description:
      "Fur-on rabbit feet are lean, low in fat and a genuinely novel protein, which makes them a thoughtful choice for dogs with sensitivities or those on an exclusion-style rotation. Small and crunchy, they're an easy natural treat with a single honest ingredient and no cereal filler hiding underneath.",
    badges: ["Novel Protein", "Single Ingredient"],
    image: "/products/rabbit-feet.png",
    category: "treats",
    safetyNote:
      "Contains small bones, so always supervise and pick the right size for your dog.",
  },
  {
    slug: "duck-wings",
    name: "Duck Wings",
    price: 7.5,
    hook: "A meaty, satisfying raw meaty bone for confident chewers.",
    description:
      "Duck wings are a raw, air-dried meaty bone that's softer than chicken bone, offering natural calcium, phosphorus and joint cartilage in one meaty package. Higher in fat and properly satisfying, they suit bigger dogs and confident chewers already used to raw meaty bones. Real food that gives a determined dog something worthwhile to work on.",
    badges: ["Best for Big Dogs", "Natural Joint Support"],
    image: "/products/duck-wings.png",
    category: "treats",
    safetyNote:
      "Feed raw or air-dried only, never cooked, as cooked bones can splinter. Always supervise.",
  },
  {
    slug: "tripe-sticks",
    name: "Tripe Sticks",
    price: 5.5,
    hook: "The whiff dogs adore, the protein they need.",
    description:
      "Dried tripe sticks are a high-protein, single-ingredient treat with a smell dogs find irresistible and owners find, well, memorable. That famous palatability makes them brilliant for tempting fussy eaters and rewarding gentler tummies with something simple and digestible. No fillers, no sugars, just honestly labelled tripe your dog will come running for.",
    badges: ["Gentle on Dodgy Tummies", "Single Ingredient"],
    image: "/products/tripe-sticks.png",
    category: "treats",
    safetyNote:
      "Store sealed in a cool, dry place, and supervise as with any chew.",
  },
  {
    slug: "whole-sprats",
    name: "Whole Sprats",
    price: 6.5,
    hook: "Tiny whole fish, big omega-3 for skin and coat.",
    description:
      "Our champion for skin and coat. Whole dried sprats are naturally packed with EPA and DHA omega-3, the same fats backed by real vet trials for skin, coat, joints and brain, plus the vitamins that come with eating the whole fish. Feed a few as a shining-coat top-up or a high-value treat. Oily, nutritious, and genuinely good stuff.",
    badges: ["Most Popular", "Best for Skin & Coat"],
    image: "/products/whole-sprats.png",
    category: "treats",
    safetyNote:
      "Oily and calorie-dense, so feed in moderation as part of the daily treat allowance.",
  },
  {
    slug: "salmon-bites",
    name: "Salmon Bites",
    price: 6.0,
    hook: "High-value training treats that love your dog's coat.",
    description:
      "Lean, cooked salmon bites carry the same omega-3 benefits for skin, coat and joints, in a small, high-value morsel perfect for training. Soft enough to hand out quickly and tempting enough that your dog will actually work for them. Cooked and dried, never raw, so all the appeal with none of the risk.",
    badges: ["Best for Skin & Coat", "Great for Training"],
    image: "/products/salmon-bites.png",
    category: "treats",
    safetyNote:
      "Salmon must always be cooked or dried, never raw, as raw salmon can carry a serious illness in dogs.",
  },
  {
    slug: "pure-meat-tit-bits",
    name: "Pure Meat Tit-bits",
    price: 6.0,
    hook: "One ingredient, low calorie, dogs go daft for them.",
    description:
      "The training treat you'll reach for constantly. Single-ingredient, nutrient-dense pure meat, low in calories and high in value, so you can reward often without piling on the extras. Small, honest and irresistible, they're ideal for recall, tricks and everyday good-dog moments. Just meat, named in full, nothing else.",
    badges: ["Great for Training", "Single Ingredient"],
    image: "/products/pure-meat-tit-bits.png",
    category: "treats",
    safetyNote:
      "Keep treats to roughly 10% of daily calories, and go easy if the meat is organ or liver.",
  },
];

export const products: Product[] = seedProducts.map((p) => ({
  ...p,
  images: [{ url: p.image, primary: true }],
}));

export const productBySlug = (slug: string) =>
  products.find((p) => p.slug === slug);
