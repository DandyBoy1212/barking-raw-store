import { describe, expect, it } from "vitest";
import {
  BUNDLE_PERCENT,
  BUNDLE_SIZES,
  bundleDeliveryProduct,
  bundleLabel,
  bundlePool,
  drawBundle,
  isBundleSize,
  mulberry32,
  parseBundle,
  priceBundle,
  summariseBundleContents,
  validateBundle,
} from "@/lib/pick-and-mix";

const mk = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.replace(/-/g, " "),
  price: 5,
  category: "treats" as const,
  fulfilment: "own-stock" as const,
  leadTimeDays: 0,
  ...over,
});

describe("sizes", () => {
  it("recognises exactly 5, 10 and 20", () => {
    expect(BUNDLE_SIZES).toEqual([5, 10, 20]);
    expect(isBundleSize(5)).toBe(true);
    expect(isBundleSize(10)).toBe(true);
    expect(isBundleSize(20)).toBe(true);
    expect(isBundleSize(15)).toBe(false);
    expect(isBundleSize("10")).toBe(false);
    expect(isBundleSize(null)).toBe(false);
  });
});

describe("bundlePool", () => {
  it("draws from the treat range", () => {
    const pool = bundlePool([
      mk("sprats"),
      mk("chicken-feet"),
      mk("ears-box", { category: "boxes" }),
      mk("squeaky-tennis-ball", { category: "toys" }),
    ]);
    expect(pool.map((p) => p.slug)).toEqual(["sprats", "chicken-feet"]);
  });

  it("never draws a box, because a box inside a bundle is a box inside a box", () => {
    const pool = bundlePool([mk("ears-box", { category: "boxes" })]);
    expect(pool).toHaveLength(0);
  });

  it("never draws a toy, because the bundle is priced and sold as treats", () => {
    const pool = bundlePool([mk("rope", { category: "toys" })]);
    expect(pool).toHaveLength(0);
  });
});

describe("mulberry32", () => {
  it("is deterministic for a seed and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe("drawBundle", () => {
  const pool = ["a", "b", "c", "d"];

  it("draws exactly the asked-for count, all from the pool", () => {
    const items = drawBundle(pool, 10, mulberry32(1));
    expect(items).toHaveLength(10);
    for (const s of items) expect(pool).toContain(s);
  });

  it("is deterministic for the same seed and varies across seeds", () => {
    expect(drawBundle(pool, 5, mulberry32(7))).toEqual(drawBundle(pool, 5, mulberry32(7)));
    const draws = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => drawBundle(pool, 5, mulberry32(s)).join(",")),
    );
    expect(draws.size).toBeGreaterThan(1);
  });

  it("spreads the draw: per-product counts never differ by more than one", () => {
    for (const seed of [1, 2, 3]) {
      for (const size of [5, 10, 20] as const) {
        const items = drawBundle(pool, size, mulberry32(seed));
        const counts = new Map<string, number>();
        for (const s of items) counts.set(s, (counts.get(s) ?? 0) + 1);
        const values = [...counts.values()];
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a 5 from a pool of 9 is 5 distinct products", () => {
    const nine = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const items = drawBundle(nine, 5, mulberry32(3));
    expect(new Set(items).size).toBe(5);
  });

  it("returns empty for an empty pool", () => {
    expect(drawBundle([], 5, mulberry32(1))).toEqual([]);
  });
});

describe("priceBundle", () => {
  const bySlug = new Map([
    ["a", { price: 6.5 }],
    ["b", { price: 4.0 }],
  ]);

  it("charges the real sum less the stated percentage, in exact pence", () => {
    // 2 x 6.50 + 1 x 4.00 = 17.00 list; 5% off = 16.15
    const priced = priceBundle(["a", "a", "b"], bySlug);
    expect(priced).toEqual({ list: 17, price: 16.15, saving: 0.85 });
  });

  it("never drifts on awkward floats", () => {
    const awkward = new Map([
      ["a", { price: 0.1 }],
      ["b", { price: 0.2 }],
    ]);
    const priced = priceBundle(["a", "b"], awkward);
    // 30 pence list, 5% off is 28.5 rounded to 29 pence.
    expect(priced).toEqual({ list: 0.3, price: 0.29, saving: 0.01 });
  });

  it("refuses a selection containing an unknown slug", () => {
    expect(priceBundle(["a", "ghost"], bySlug)).toBeNull();
  });

  it("refuses an empty selection", () => {
    expect(priceBundle([], bySlug)).toBeNull();
  });

  it("states the percentage it charges", () => {
    expect(BUNDLE_PERCENT).toBe(5);
  });
});

describe("labels and summaries", () => {
  it("names the line for the drawer, the sheet and Stripe", () => {
    expect(bundleLabel(10)).toBe("Pick & Mix (10 items)");
  });

  it("aggregates contents by product, most of a thing first", () => {
    const names = new Map([
      ["chicken-feet", { name: "Chicken Feet" }],
      ["sprats", { name: "Whole Sprats" }],
    ]);
    const text = summariseBundleContents(["sprats", "chicken-feet", "chicken-feet"], names);
    expect(text).toBe("2 x Chicken Feet, 1 x Whole Sprats");
  });

  it("falls back to the slug for a name it cannot resolve", () => {
    expect(summariseBundleContents(["ghost"], new Map())).toBe("1 x ghost");
  });
});

describe("parseBundle", () => {
  it("accepts a well-shaped bundle", () => {
    expect(parseBundle({ size: 5, items: ["a", "b", "c", "d", "e"] })).toEqual({
      size: 5,
      items: ["a", "b", "c", "d", "e"],
    });
  });

  it.each([
    [null],
    ["ten"],
    [{ size: 15, items: [] }],
    [{ size: "10", items: [] }],
    [{ size: 5 }],
    [{ size: 5, items: "abcde" }],
    [{ size: 5, items: [1, 2, 3, 4, 5] }],
    [{ size: 5, items: ["a", "", "c", "d", "e"] }],
  ])("rejects %j", (raw) => {
    expect(parseBundle(raw)).toBeNull();
  });
});

describe("validateBundle", () => {
  const catalogue = [
    mk("sprats"),
    mk("chicken-feet"),
    mk("ears-box", { category: "boxes" }),
    mk("squeaky-tennis-ball", { category: "toys" }),
    mk("members-treat", { membersOnlyUntil: "2999-01-01" }),
  ];
  const now = new Date("2026-07-26T12:00:00Z");
  const opts = { isMember: false, now };
  const five = (slug: string) => ({
    size: 5 as const,
    items: [slug, "sprats", "sprats", "chicken-feet", "chicken-feet"],
  });

  it("accepts a bundle drawn from the honest pool", () => {
    expect(validateBundle(five("sprats"), catalogue, opts)).toEqual({ ok: true });
  });

  it("rejects an item count that does not match the size", () => {
    const verdict = validateBundle({ size: 10, items: ["sprats"] }, catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(400);
  });

  it.each([
    ["a slug the catalogue does not carry", "ghost"],
    ["a box, which would be a box inside a box", "ears-box"],
    ["a toy, because the bundle is sold as treats", "squeaky-tennis-ball"],
  ])("rejects %s with a 400", (_desc, slug) => {
    const verdict = validateBundle(five(slug), catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(400);
  });

  it("refuses a members-only item to a non-member with a 403", () => {
    const verdict = validateBundle(five("members-treat"), catalogue, opts);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.status).toBe(403);
  });

  it("allows the same item to a member while the window holds", () => {
    expect(validateBundle(five("members-treat"), catalogue, { isMember: true, now })).toEqual({
      ok: true,
    });
  });

  it("allows everyone the item once the window has passed", () => {
    const later = new Date("2999-06-01T00:00:00Z");
    expect(
      validateBundle(five("members-treat"), catalogue, { isMember: false, now: later }),
    ).toEqual({ ok: true });
  });
});

describe("bundleDeliveryProduct", () => {
  it("is own-stock, zero lead, priced at what the customer pays", () => {
    expect(bundleDeliveryProduct("pick-and-mix-x", 10, 16.15)).toEqual({
      slug: "pick-and-mix-x",
      name: "Pick & Mix (10 items)",
      price: 16.15,
      fulfilment: "own-stock",
      leadTimeDays: 0,
    });
  });
});
