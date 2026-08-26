import { describe, it, expect } from "vitest";
import {
  computeShipping,
  isLocalPostcode,
  amountToFreePostage,
  computeBasketDelivery,
  FLAT_RATE,
} from "./shipping";

describe("isLocalPostcode", () => {
  it("treats DD1 to DD6 as local", () => {
    for (const pc of ["DD1 1AA", "DD2 3XY", "dd5 2bb", " DD6  1AA "]) {
      expect(isLocalPostcode(pc)).toBe(true);
    }
  });
  it("rejects DD7+, DD11 and other areas", () => {
    for (const pc of ["DD7 1AA", "DD11 2AB", "DD9 0AA", "EH51 1AA", "G1 1AA", ""]) {
      expect(isLocalPostcode(pc)).toBe(false);
    }
  });
});

describe("computeShipping", () => {
  it("is free for local postcodes regardless of subtotal", () => {
    expect(computeShipping("DD3 8QT", 5)).toEqual({ cost: 0, free: true, reason: "local" });
  });
  it("is free over GBP 35 for non-local", () => {
    expect(computeShipping("EH51 1AA", 40)).toEqual({ cost: 0, free: true, reason: "threshold" });
  });
  it("charges the flat rate for non-local under threshold", () => {
    expect(computeShipping("DD11 2AB", 12)).toEqual({ cost: FLAT_RATE, free: false, reason: "flat" });
  });
});

describe("amountToFreePostage", () => {
  it("returns remaining spend for non-local under threshold", () => {
    expect(amountToFreePostage("G1 1AA", 28)).toBe(7);
  });
  it("returns 0 when local or already over threshold", () => {
    expect(amountToFreePostage("DD1 1AA", 5)).toBe(0);
    expect(amountToFreePostage("G1 1AA", 40)).toBe(0);
  });
});

describe("computeBasketDelivery", () => {
  const item = (price: number, qty = 1) => ({
    product: { slug: "chicken-feet", name: "Chicken Feet", price },
    qty,
  });

  it("is free to a local postcode whatever the subtotal", () => {
    const d = computeBasketDelivery([item(6)], "DD3 8QW");
    expect(d.cost).toBe(0);
    expect(d.free).toBe(true);
    expect(d.reason).toBe("local");
  });

  it("charges the flat rate elsewhere under the threshold", () => {
    const d = computeBasketDelivery([item(6)], "EH1 1AA");
    expect(d.cost).toBe(3.95);
    expect(d.free).toBe(false);
    expect(d.reason).toBe("flat");
  });

  it("is free over the threshold, counting quantity", () => {
    const d = computeBasketDelivery([item(20, 2)], "EH1 1AA");
    expect(d.cost).toBe(0);
    expect(d.reason).toBe("threshold");
  });

  it("reports what is left to spend for free postage", () => {
    expect(computeBasketDelivery([item(30)], "EH1 1AA").amountToFreePostage).toBe(5);
  });

  it("charges nothing for an empty basket", () => {
    const d = computeBasketDelivery([], "EH1 1AA");
    expect(d.cost).toBe(0);
    expect(d.amountToFreePostage).toBe(0);
  });
});
