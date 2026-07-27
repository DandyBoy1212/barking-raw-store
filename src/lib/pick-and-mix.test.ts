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
  priceBundle,
  summariseBundleContents,
} from "@/lib/pick-and-mix";

const mk = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.replace(/-/g, " "),
  price: 5,
  pillar: "good-food" as const,
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
  it("keeps only own-stock, good-food, zero lead time products", () => {
    const pool = bundlePool([
      mk("sprats"),
      mk("supplier-chew", { fulfilment: "supplier-posted" }),
      mk("shampoo", { pillar: "healthy-body" }),
      mk("big-kibble", { leadTimeDays: 14 }),
    ]);
    expect(pool.map((p) => p.slug)).toEqual(["sprats"]);
  });

  it("treats a missing leadTimeDays as zero", () => {
    const pool = bundlePool([mk("sprats", { leadTimeDays: undefined })]);
    expect(pool).toHaveLength(1);
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
