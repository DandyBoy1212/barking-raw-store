import { describe, it, expect } from "vitest";
import { slugify, validateProductInput as validate } from "./product-admin";
import { ALL_BADGES, type Pillar } from "@/data/products";

/**
 * B.6 gave validateProductInput a second argument: the badge labels currently in the
 * collection. Almost every test below is about something other than badges, so they
 * go through this wrapper with the seed list as the allowed set, and the tests that
 * are actually about badges call `validate` directly with their own list.
 */
const validateProductInput = (input: Parameters<typeof validate>[0]) =>
  validate(input, ALL_BADGES);

describe("slugify", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(slugify("Beef Trachea Rings")).toBe("beef-trachea-rings");
    expect(slugify("  Pure Meat Tit-bits!  ")).toBe("pure-meat-tit-bits");
    expect(slugify("Salmon   &   Sprats")).toBe("salmon-sprats");
  });
});

describe("validateProductInput", () => {
  const good = {
    name: "Chicken Feet",
    price: 6,
    hook: "crunchy",
    description: "single ingredient",
    badges: [],
    image: "/products/chicken-feet.png",
    pillar: "good-food" as const,
    category: "treats" as const,
  };

  it("accepts a complete input and returns a normalised value", () => {
    const res = validateProductInput(good);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.price).toBe(6);
  });

  it("rejects missing name, non-positive price, and empty copy", () => {
    const res = validateProductInput({ ...good, name: "", price: 0, hook: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("Name is required.");
      expect(res.errors).toContain("Price must be greater than 0.");
      expect(res.errors).toContain("Hook is required.");
    }
  });

  it("coerces a numeric string price", () => {
    const res = validateProductInput({ ...good, price: "7.5" as unknown as number });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.price).toBe(7.5);
  });

  it("rejects a non-finite price", () => {
    const res = validateProductInput({ ...good, price: "Infinity" as unknown as number });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toContain("Price must be greater than 0.");
  });

  it("filters out unknown badge strings, keeping valid ones", () => {
    const res = validateProductInput({
      ...good,
      badges: ["Most Popular", "Not A Badge"] as unknown as typeof good.badges,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.badges).toEqual(["Most Popular"]);
  });
});

const base = {
  name: "Rabbit Ears",
  price: 5,
  hook: "Crunchy",
  description: "A description",
  image: "/products/rabbit-ears.png",
  badges: [],
  category: "treats" as const,
};

describe("validateProductInput pillar", () => {
  it("rejects a product with no pillar, because it would appear on no page", () => {
    const r = validateProductInput(base);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Choose which pillar this product belongs to.");
  });

  it("rejects a pillar that is not one of the four", () => {
    const r = validateProductInput({ ...base, pillar: "out-and-about" as unknown as Pillar });
    expect(r.ok).toBe(false);
  });

  it("accepts one of the four", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.pillar).toBe("good-food");
  });
});

describe("validateProductInput lead time", () => {
  it("defaults to zero", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok && r.value.leadTimeDays).toBe(0);
  });

  it("rejects a negative lead time", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", leadTimeDays: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Lead time must be a whole number of days, 0 or more.");
  });

  it("rejects a fractional lead time", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", leadTimeDays: 2.5 });
    expect(r.ok).toBe(false);
  });
});

describe("validateProductInput members only window", () => {
  it("accepts an ISO date", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "2026-09-01" });
    expect(r.ok && r.value.membersOnlyUntil).toBe("2026-09-01");
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "01/09/2026" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Members only date must be in the form YYYY-MM-DD.");
  });

  it("treats an empty string as no window", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", membersOnlyUntil: "" });
    expect(r.ok && r.value.membersOnlyUntil).toBeUndefined();
  });
});

describe("validateProductInput fulfilment", () => {
  it("defaults to her own stock", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok && r.value.fulfilment).toBe("own-stock");
  });

  it("requires postage on a supplier posted product, so nobody is shipped it for free by accident", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", fulfilment: "supplier-posted" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Supplier posted products need their own postage amount.");
  });

  it("accepts a supplier posted product with postage and an arrival range", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "supplier-posted",
      supplierPostage: 4.5,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.supplierPostage).toBe(4.5);
      expect(r.value.supplierArrivalMaxDays).toBe(5);
    }
  });

  it("rejects an arrival range that runs backwards", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "supplier-posted",
      supplierPostage: 4.5,
      supplierArrivalMinDays: 7,
      supplierArrivalMaxDays: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Arrival range must run from the shorter time to the longer.");
  });

  it("drops supplier fields when the path is her own stock", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      fulfilment: "own-stock",
      supplierPostage: 4.5,
    });
    expect(r.ok && r.value.supplierPostage).toBeUndefined();
  });
});

describe("validateProductInput images", () => {
  const withPillar = { ...base, pillar: "good-food" as const };

  it("accepts an images list and derives the primary image", () => {
    const r = validateProductInput({
      ...withPillar,
      image: undefined,
      images: [{ url: "/a.png", primary: false }, { url: "/b.png", primary: true }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.images).toEqual([
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
      ]);
      expect(r.value.image).toBe("/b.png");
    }
  });

  it("folds a legacy single image into the list", () => {
    const r = validateProductInput(withPillar);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.images).toEqual([{ url: "/products/rabbit-ears.png", primary: true }]);
      expect(r.value.image).toBe("/products/rabbit-ears.png");
    }
  });

  it("rejects a product with no photos at all", () => {
    const r = validateProductInput({ ...withPillar, image: undefined, images: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("At least one photo is required.");
  });
});

describe("validateProductInput pack size", () => {
  it("leaves both undefined when neither is given, since the nine originals have none", () => {
    const r = validateProductInput({ ...base, pillar: "good-food" });
    expect(r.ok && r.value.packWeightGrams).toBeUndefined();
    expect(r.ok && r.value.packPieceCount).toBeUndefined();
  });

  it("accepts a weight and a piece count", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      packWeightGrams: 150,
      packPieceCount: 3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.packWeightGrams).toBe(150);
      expect(r.value.packPieceCount).toBe(3);
    }
  });

  it("treats an empty string as not known rather than as zero", () => {
    const r = validateProductInput({
      ...base,
      pillar: "good-food",
      packWeightGrams: "" as unknown as number,
    });
    expect(r.ok && r.value.packWeightGrams).toBeUndefined();
  });

  it("rejects a zero or negative weight rather than storing a nonsense pack", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", packWeightGrams: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Pack weight must be a whole number above 0, or left blank.");
  });

  it("rejects a fractional piece count", () => {
    const r = validateProductInput({ ...base, pillar: "good-food", packPieceCount: 2.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Piece count must be a whole number above 0, or left blank.");
  });
});

describe("validateProductInput badges", () => {
  const allowed = ["Most Popular", "Single Ingredient"];
  const withBadges = (badges: string[]) => ({
    name: "Beef Trachea Rings",
    price: 6.5,
    hook: "One ingredient",
    description: "Beef trachea, dried.",
    images: [{ url: "https://storage.googleapis.com/x/a.png", primary: true }],
    pillar: "good-food" as const,
    category: "treats" as const,
    badges,
  });

  it("keeps a badge that is currently on the list", () => {
    const r = validate(withBadges(["Most Popular"]), allowed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Most Popular"]);
  });

  it("drops a badge that is not on the list", () => {
    // Retired or invented. Either way it must not reach the product, or the card
    // renders a badge nobody can manage.
    const r = validate(withBadges(["Most Popular", "Made Up"]), allowed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Most Popular"]);
  });

  it("accepts a badge Michaela added that was never in the old compiled union", () => {
    // The entire point of B.6.
    const r = validate(withBadges(["Great for Puppies"]), [...allowed, "Great for Puppies"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual(["Great for Puppies"]);
  });

  it("drops everything when the allowed list is empty", () => {
    const r = validate(withBadges(["Most Popular"]), []);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.badges).toEqual([]);
  });
});

describe("validateProductInput stock and points rate", () => {
  const withPillar = { ...base, pillar: "good-food" as const };

  it("accepts blank as untracked stock and default rate", () => {
    const r = validateProductInput(withPillar);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stock).toBeUndefined();
      expect(r.value.pointsPerPound).toBeUndefined();
    }
  });

  it("accepts zero for both, which mean sold out and no points, not blank", () => {
    const r = validateProductInput({ ...withPillar, stock: 0, pointsPerPound: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stock).toBe(0);
      expect(r.value.pointsPerPound).toBe(0);
    }
  });

  it("accepts a positive count and rate", () => {
    const r = validateProductInput({ ...withPillar, stock: 24, pointsPerPound: 15 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stock).toBe(24);
      expect(r.value.pointsPerPound).toBe(15);
    }
  });

  it("rejects negative or fractional stock", () => {
    for (const stock of [-1, 2.5]) {
      const r = validateProductInput({ ...withPillar, stock });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects a negative points rate", () => {
    const r = validateProductInput({ ...withPillar, pointsPerPound: -5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Points per pound must be 0 or more, or left blank.");
  });
});

describe("validateProductInput sort order", () => {
  const withPillar = { ...base, pillar: "good-food" as const };

  it("accepts blank as unordered and a position from 1 up", () => {
    const blank = validateProductInput(withPillar);
    expect(blank.ok && blank.value.sortOrder).toBeUndefined();
    const first = validateProductInput({ ...withPillar, sortOrder: 1 });
    expect(first.ok && first.value.sortOrder).toBe(1);
  });

  it("rejects zero, negatives and fractions, since Michaela counts from 1", () => {
    for (const sortOrder of [0, -1, 2.5]) {
      expect(validateProductInput({ ...withPillar, sortOrder }).ok).toBe(false);
    }
  });
});

describe("validateProductInput category", () => {
  const good = {
    name: "Ears Box",
    price: 12,
    hook: "a box of ears",
    description: "different ears in one box",
    badges: [],
    image: "/products/mystery-box.png",
    pillar: "good-food" as const,
  };

  it("accepts a valid category", () => {
    const res = validateProductInput({ ...good, category: "boxes" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.category).toBe("boxes");
  });

  it("rejects a missing category with a sentence she can act on", () => {
    const res = validateProductInput({ ...good, category: undefined });
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.errors).toContain("Choose which part of the shop this product belongs to.");
  });

  it("rejects an invented category", () => {
    expect(validateProductInput({ ...good, category: "sundries" }).ok).toBe(false);
  });

  it("rejects pick-and-mix, which is a builder rather than a shelf", () => {
    expect(validateProductInput({ ...good, category: "pick-and-mix" }).ok).toBe(false);
  });
});
