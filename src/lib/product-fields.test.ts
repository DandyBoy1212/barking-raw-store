import { describe, it, expect } from "vitest";
import {
  isMembersOnly,
  packSizeLabel,
} from "@/lib/product-fields";

describe("isMembersOnly", () => {
  it("is false when there is no window", () => {
    expect(isMembersOnly({}, new Date("2026-08-01T12:00:00Z"))).toBe(false);
  });

  it("is true before the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-01T12:00:00Z")),
    ).toBe(true);
  });

  it("is false on the day the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-10T00:00:00Z")),
    ).toBe(false);
  });

  it("is false when the date is unparseable, so a typo never hides a product forever", () => {
    expect(isMembersOnly({ membersOnlyUntil: "next tuesday" }, new Date("2026-08-01T12:00:00Z"))).toBe(
      false,
    );
  });
});

describe("packSizeLabel", () => {
  it("is null when nothing is known, so the card shows no empty label", () => {
    expect(packSizeLabel({})).toBeNull();
  });

  it("gives grams on their own", () => {
    expect(packSizeLabel({ packWeightGrams: 100 })).toBe("100g");
  });

  it("switches to kilograms at 1000g, because 15000g is unreadable on a shelf", () => {
    expect(packSizeLabel({ packWeightGrams: 1000 })).toBe("1kg");
    expect(packSizeLabel({ packWeightGrams: 15000 })).toBe("15kg");
    expect(packSizeLabel({ packWeightGrams: 1500 })).toBe("1.5kg");
  });

  it("gives a piece count on its own", () => {
    expect(packSizeLabel({ packPieceCount: 3 })).toBe("3 pieces");
  });

  it("uses the singular for one piece", () => {
    expect(packSizeLabel({ packPieceCount: 1 })).toBe("1 piece");
  });

  it("gives both when both are known, pieces first", () => {
    expect(packSizeLabel({ packPieceCount: 3, packWeightGrams: 150 })).toBe("3 pieces, 150g");
  });

  it("ignores zero and nonsense rather than printing 0g", () => {
    expect(packSizeLabel({ packWeightGrams: 0, packPieceCount: 0 })).toBeNull();
    expect(packSizeLabel({ packWeightGrams: -5 })).toBeNull();
  });
});
