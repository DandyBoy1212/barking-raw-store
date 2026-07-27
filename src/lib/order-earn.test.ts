import { describe, it, expect } from "vitest";
import type { SaleProduct } from "./stall-sale";
import { buildOrderOutcome } from "./order-earn";

const products = new Map<string, SaleProduct>([
  ["chicken-feet", { slug: "chicken-feet", name: "Chicken Feet", price: 6, stock: 10 }],
  ["whole-sprats", { slug: "whole-sprats", name: "Whole Sprats", price: 6.5 }],
  ["beef-trachea-rings", { slug: "beef-trachea-rings", name: "Beef Trachea Rings", price: 6.5, pointsPerPound: 0, stock: 2 }],
]);

describe("buildOrderOutcome points", () => {
  it("earns on the amount actually paid, joined to the product by name", () => {
    // The customer paid 10.80 for chicken feet after a 10% code. 10 points per
    // pound (the default rate) on money taken, never on the shelf price: spec 6.1,
    // a discount that still earns full points is margin given twice.
    const outcome = buildOrderOutcome(
      [{ slug: "chicken-feet", qty: 2 }],
      [{ name: "Chicken Feet", qty: 2, amount: 10.8 }],
      products,
    );
    expect(outcome.points).toBe(108);
    expect(outcome.pointItems).toEqual([
      { slug: "chicken-feet", name: "Chicken Feet", amount: 10.8, points: 108 },
    ]);
  });

  it("honours a deliberate zero rate", () => {
    const outcome = buildOrderOutcome(
      [{ slug: "beef-trachea-rings", qty: 1 }],
      [{ name: "Beef Trachea Rings", qty: 1, amount: 6.5 }],
      products,
    );
    expect(outcome.points).toBe(0);
    expect(outcome.pointItems).toEqual([]);
  });

  it("collects an unmatched line and earns nothing on it", () => {
    // A pick-and-mix bundle line matches no product name. It neither earns nor
    // throws: it is reported so the webhook can log it.
    const outcome = buildOrderOutcome(
      [],
      [{ name: "Pick & Mix (10 treats)", qty: 1, amount: 18.5 }],
      products,
    );
    expect(outcome.points).toBe(0);
    expect(outcome.unmatched).toEqual(["Pick & Mix (10 treats)"]);
  });

  it("ignores junk amounts rather than inventing negative points", () => {
    const outcome = buildOrderOutcome(
      [],
      [
        { name: "Chicken Feet", qty: 1, amount: -4 },
        { name: "Whole Sprats", qty: 1, amount: Number.NaN },
      ],
      products,
    );
    expect(outcome.points).toBe(0);
    expect(outcome.pointItems).toEqual([]);
  });
});

describe("buildOrderOutcome stock", () => {
  it("decrements tracked products from cart lines and clamps at zero", () => {
    const outcome = buildOrderOutcome(
      [
        { slug: "chicken-feet", qty: 3 },
        { slug: "beef-trachea-rings", qty: 5 },
      ],
      [],
      products,
    );
    expect(outcome.stockChanges).toEqual([
      { slug: "chicken-feet", stock: 7 },
      { slug: "beef-trachea-rings", stock: 0 },
    ]);
  });

  it("writes nothing for an untracked product", () => {
    // Absent stock means untracked, stage 4's rule: the product sells without a
    // count and nothing is written back.
    const outcome = buildOrderOutcome([{ slug: "whole-sprats", qty: 2 }], [], products);
    expect(outcome.stockChanges).toEqual([]);
  });

  it("ignores a cart line that is not a product, which is how bundle lines ride", () => {
    const outcome = buildOrderOutcome([{ slug: "pick-and-mix-10", qty: 1 }], [], products);
    expect(outcome.stockChanges).toEqual([]);
  });

  it("ignores junk quantities", () => {
    const outcome = buildOrderOutcome(
      [
        { slug: "chicken-feet", qty: 0 },
        { slug: "beef-trachea-rings", qty: -2 },
      ],
      [],
      products,
    );
    expect(outcome.stockChanges).toEqual([]);
  });
});

describe("buildOrderOutcome empty", () => {
  it("produces an empty outcome from nothing, never a throw", () => {
    expect(buildOrderOutcome([], [], new Map())).toEqual({
      points: 0,
      pointItems: [],
      stockChanges: [],
      unmatched: [],
    });
  });
});
