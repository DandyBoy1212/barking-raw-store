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

const chew = {
  slug: "chicken-feet",
  name: "Chicken Feet",
  price: 6,
  fulfilment: "own-stock" as const,
  leadTimeDays: 0,
};

const bed = {
  slug: "orthopaedic-bed",
  name: "Orthopaedic Bed",
  price: 45,
  fulfilment: "supplier-posted" as const,
  leadTimeDays: 0,
  supplierPostage: 5.99,
  supplierArrivalMinDays: 3,
  supplierArrivalMaxDays: 5,
};

const mat = {
  slug: "snuffle-mat",
  name: "Snuffle Mat",
  price: 18,
  fulfilment: "supplier-posted" as const,
  leadTimeDays: 0,
  supplierPostage: 3.5,
  supplierArrivalMinDays: 2,
  supplierArrivalMaxDays: 4,
};

describe("computeBasketDelivery", () => {
  it("an own stock only basket behaves exactly as the old flat rule", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 2 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.total).toBe(3.95);
    expect(d.parcels[0].label).toBe("From Barking Raw");
  });

  it("keeps free local delivery for DD1 to DD6", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 1 }], "DD5 1AB");
    expect(d.total).toBe(0);
  });

  it("gives each supplier posted line its own parcel and its own postage", () => {
    const d = computeBasketDelivery(
      [{ product: bed, qty: 1 }, { product: mat, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels).toHaveLength(2);
    expect(d.total).toBeCloseTo(9.49, 2);
  });

  it("charges supplier postage once per line, not per unit", () => {
    const d = computeBasketDelivery([{ product: bed, qty: 3 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.total).toBeCloseTo(5.99, 2);
  });

  it("a mixed basket is two parcels with two arrival notes", () => {
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: bed, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels).toHaveLength(2);
    expect(d.parcels[1].note).toBe("Posts separately, arrives in 3 to 5 days");
  });

  it("applies the free over GBP 35 threshold to the own stock subtotal only", () => {
    // GBP 45 of supplier posted goods must not buy free postage on a GBP 6 chew.
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: bed, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.ownStockSubtotal).toBe(6);
    expect(d.parcels[0].cost).toBe(3.95);
  });

  it("frees the own stock parcel once its own subtotal passes GBP 35", () => {
    const d = computeBasketDelivery([{ product: chew, qty: 6 }], "EH1 1AA");
    expect(d.parcels[0].cost).toBe(0);
    expect(d.amountToFreePostage).toBe(0);
  });

  it("carries the longest own stock lead time as the parcel note", () => {
    const kibble = { ...chew, slug: "kibble-15kg", name: "Kibble 15kg", leadTimeDays: 14 };
    const d = computeBasketDelivery(
      [{ product: chew, qty: 1 }, { product: kibble, qty: 1 }],
      "EH1 1AA",
    );
    expect(d.parcels[0].note).toBe("Ordered in for you, dispatches in 14 days");
  });

  it("produces no own stock parcel when the basket is supplier posted only", () => {
    const d = computeBasketDelivery([{ product: bed, qty: 1 }], "EH1 1AA");
    expect(d.parcels).toHaveLength(1);
    expect(d.parcels[0].label).toBe("Orthopaedic Bed");
  });

  it("an empty basket costs nothing and has no parcels", () => {
    const d = computeBasketDelivery([], "EH1 1AA");
    expect(d.parcels).toEqual([]);
    expect(d.total).toBe(0);
  });

  it("treats a supplier posted product with no postage set as free rather than NaN", () => {
    const unknown = { ...bed, supplierPostage: undefined };
    const d = computeBasketDelivery([{ product: unknown, qty: 1 }], "EH1 1AA");
    expect(d.total).toBe(0);
  });
});
