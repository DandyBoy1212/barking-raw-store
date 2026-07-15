import { describe, it, expect } from "vitest";
import {
  computeShipping,
  isLocalPostcode,
  amountToFreePostage,
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
