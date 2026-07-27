import { describe, it, expect } from "vitest";
import {
  SUBSCRIBE_PERCENT,
  SUBSCRIBE_FREQUENCIES,
  parseFrequencyWeeks,
  splitSubscribable,
  discounted,
} from "./subscriptions";

describe("parseFrequencyWeeks", () => {
  it("accepts the three supported frequencies as numbers", () => {
    expect(parseFrequencyWeeks(2)).toBe(2);
    expect(parseFrequencyWeeks(4)).toBe(4);
    expect(parseFrequencyWeeks(8)).toBe(8);
  });

  it("accepts numeric strings, because metadata and JSON both arrive as strings", () => {
    expect(parseFrequencyWeeks("2")).toBe(2);
    expect(parseFrequencyWeeks("8")).toBe(8);
  });

  it("rejects everything else", () => {
    expect(parseFrequencyWeeks(0)).toBeNull();
    expect(parseFrequencyWeeks(3)).toBeNull();
    expect(parseFrequencyWeeks("weekly")).toBeNull();
    expect(parseFrequencyWeeks(null)).toBeNull();
    expect(parseFrequencyWeeks(undefined)).toBeNull();
    expect(parseFrequencyWeeks("")).toBeNull();
  });
});

describe("SUBSCRIBE_FREQUENCIES", () => {
  it("offers exactly every 2, 4 and 8 weeks, labelled in plain English", () => {
    expect(SUBSCRIBE_FREQUENCIES.map((f) => f.weeks)).toEqual([2, 4, 8]);
    expect(SUBSCRIBE_FREQUENCIES.map((f) => f.label)).toEqual([
      "Every 2 weeks",
      "Every 4 weeks",
      "Every 8 weeks",
    ]);
  });
});

describe("splitSubscribable", () => {
  const own = { fulfilment: "own-stock" as const };
  const supplier = { fulfilment: "supplier-posted" as const };

  it("puts own-stock lines in eligible and supplier-posted in ineligible", () => {
    const items = [
      { product: own, qty: 2 },
      { product: supplier, qty: 1 },
      { product: own, qty: 3 },
    ];
    const { eligible, ineligible } = splitSubscribable(items);
    expect(eligible).toEqual([
      { product: own, qty: 2 },
      { product: own, qty: 3 },
    ]);
    expect(ineligible).toEqual([{ product: supplier, qty: 1 }]);
  });

  it("returns empty arrays for an empty basket", () => {
    expect(splitSubscribable([])).toEqual({ eligible: [], ineligible: [] });
  });
});

describe("discounted", () => {
  it("takes the reserved 10% off", () => {
    expect(SUBSCRIBE_PERCENT).toBe(10);
    expect(discounted(6)).toBe(5.4);
  });

  it("round-trips the spec 6.1 example: 11.11 list becomes the 10.00 bottom price", () => {
    expect(discounted(11.11)).toBe(10);
  });

  it("is pence-safe on awkward floats", () => {
    expect(discounted(0.1)).toBe(0.09);
    expect(discounted(7.55)).toBe(6.8);
  });
});
