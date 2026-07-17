import { describe, it, expect } from "vitest";
import { slugify, validateProductInput } from "./product-admin";

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
});
