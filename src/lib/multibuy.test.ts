import { describe, it, expect } from "vitest";
import { computeMultibuy, MULTIBUY_PRICE, MULTIBUY_QTY } from "@/lib/multibuy";

const treat = (price: number, qty = 1) => ({
  product: { price, category: "treats" as const },
  qty,
});
const box = (price: number, qty = 1) => ({
  product: { price, category: "boxes" as const },
  qty,
});
const toy = (price: number, qty = 1) => ({
  product: { price, category: "toys" as const },
  qty,
});

describe("the offer's terms", () => {
  it("is four for twenty pounds", () => {
    expect(MULTIBUY_QTY).toBe(4);
    expect(MULTIBUY_PRICE).toBe(20);
  });
});

describe("computeMultibuy", () => {
  it("does nothing to a basket with fewer than four treats", () => {
    const m = computeMultibuy([treat(6.5, 3)]);
    expect(m.groups).toBe(0);
    expect(m.saving).toBe(0);
  });

  it("prices four treats at twenty pounds", () => {
    // 6.50 + 6.50 + 6.00 + 6.00 = 25.00, so the saving is 5.00
    const m = computeMultibuy([treat(6.5, 2), treat(6, 2)]);
    expect(m.groups).toBe(1);
    expect(m.saving).toBe(5);
  });

  it("repeats for every four, and leaves the remainder at full price", () => {
    // Nine treats at 7.50. Two groups of four discounted, one left over.
    // Each group lists at 30.00, so each saves 10.00.
    const m = computeMultibuy([treat(7.5, 9)]);
    expect(m.groups).toBe(2);
    expect(m.saving).toBe(20);
  });

  it("groups the dearest treats first, so the customer saves the most", () => {
    // Five treats: 7.50, 7.50, 7.50, 7.50, 5.50. Grouping the dearest four
    // lists at 30.00 and saves 10.00. Grouping the cheapest four would list at
    // 26.00 and save only 6.00.
    const m = computeMultibuy([treat(7.5, 4), treat(5.5, 1)]);
    expect(m.saving).toBe(10);
  });

  it("never charges more than the treats are worth", () => {
    // Four at 4.50 is 18.00. The offer must not turn that into 20.00.
    const m = computeMultibuy([treat(4.5, 4)]);
    expect(m.groups).toBe(1);
    expect(m.saving).toBe(0);
  });

  it("discounts a dear group while leaving a cheap group alone", () => {
    // Four at 7.50 (30.00, saves 10.00) and four at 4.00 (16.00, saves nothing).
    const m = computeMultibuy([treat(7.5, 4), treat(4, 4)]);
    expect(m.groups).toBe(2);
    expect(m.saving).toBe(10);
  });

  it("never lets a box into a group", () => {
    // Three treats and a box is not four treats.
    const m = computeMultibuy([treat(6.5, 3), box(7.5)]);
    expect(m.groups).toBe(0);
    expect(m.saving).toBe(0);
  });

  it("never lets a toy into a group", () => {
    const m = computeMultibuy([treat(6.5, 3), toy(4)]);
    expect(m.groups).toBe(0);
  });

  it("ignores boxes and toys sitting alongside a real group", () => {
    const withOthers = computeMultibuy([treat(6.5, 4), box(15), toy(2)]);
    const alone = computeMultibuy([treat(6.5, 4)]);
    expect(withOthers.saving).toBe(alone.saving);
  });

  it("counts quantity, not lines", () => {
    expect(computeMultibuy([treat(6.5, 4)]).groups).toBe(1);
    expect(computeMultibuy([treat(6.5), treat(6.5), treat(6.5), treat(6.5)]).groups).toBe(1);
  });

  it("says how many more treats would complete the next group", () => {
    expect(computeMultibuy([treat(6.5, 1)]).toNextGroup).toBe(3);
    expect(computeMultibuy([treat(6.5, 3)]).toNextGroup).toBe(1);
    expect(computeMultibuy([treat(6.5, 5)]).toNextGroup).toBe(3);
  });

  it("does not nag when no group is part-built", () => {
    expect(computeMultibuy([]).toNextGroup).toBe(0);
    expect(computeMultibuy([treat(6.5, 4)]).toNextGroup).toBe(0);
    expect(computeMultibuy([box(15), toy(2)]).toNextGroup).toBe(0);
  });

  it("does not drift on awkward prices", () => {
    // 6.66 x 4 = 26.64, so the saving is exactly 6.64 and not 6.639999...
    expect(computeMultibuy([treat(6.66, 4)]).saving).toBe(6.64);
  });

  it("ignores a nonsense quantity rather than inventing units", () => {
    expect(computeMultibuy([treat(6.5, -3)]).groups).toBe(0);
    expect(computeMultibuy([treat(6.5, 4.7)]).groups).toBe(1);
  });
});
