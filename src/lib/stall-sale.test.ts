import { describe, it, expect } from "vitest";
import {
  buildSaleOutcome,
  docToSaleProduct,
  validateStallSale,
  type SaleProduct,
  type StallSale,
} from "./stall-sale";

const CLIENT_ID = "5a1c9b1e-8a4d-4f6b-9c1e-2b7a8d3e5f61";
const RECEIVED = "2026-07-26T10:00:00.000Z";

function sale(overrides: Record<string, unknown> = {}): StallSale {
  const result = validateStallSale(
    {
      clientId: CLIENT_ID,
      recordedAt: "2026-07-26T09:30:00.000Z",
      lines: [{ slug: "beef-chunks", qty: 2 }],
      payment: "cash",
      ...overrides,
    },
    RECEIVED,
  );
  if (!result.ok) throw new Error(`test sale did not validate: ${result.errors.join(" ")}`);
  return result.sale;
}

describe("validateStallSale", () => {
  it("accepts a full sale and normalises it", () => {
    const result = validateStallSale(
      {
        clientId: CLIENT_ID,
        recordedAt: "2026-07-26T09:30:00.000Z",
        customer: { uid: "u1", email: " Sam@Example.COM ", name: "  Sam " },
        lines: [{ slug: " Beef-Chunks ", qty: 2.9 }],
        payment: "card",
      },
      RECEIVED,
    );
    expect(result).toEqual({
      ok: true,
      sale: {
        clientId: CLIENT_ID,
        recordedAt: "2026-07-26T09:30:00.000Z",
        customer: { uid: "u1", email: "sam@example.com", name: "Sam" },
        lines: [{ slug: "beef-chunks", qty: 2 }],
        payment: "card",
      },
    });
  });

  it("refuses a sale without a usable clientId, since sync cannot be idempotent without one", () => {
    const result = validateStallSale({ clientId: "nope!", lines: [{ slug: "a-b", qty: 1 }], payment: "cash" }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("A record needs its client id.");
  });

  it("refuses a sale with nothing sold", () => {
    const result = validateStallSale({ clientId: CLIENT_ID, lines: [], payment: "cash" }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Nothing sold.");
  });

  it("refuses a payment that is neither cash nor card", () => {
    const result = validateStallSale(
      { clientId: CLIENT_ID, lines: [{ slug: "a-b", qty: 1 }], payment: "iou" },
      RECEIVED,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("How was it paid?");
  });

  it("drops junk lines but keeps the good ones", () => {
    const result = validateStallSale(
      {
        clientId: CLIENT_ID,
        lines: [
          { slug: "beef-chunks", qty: 1 },
          { slug: "NOT A SLUG!!", qty: 1 },
          { slug: "duck-wings", qty: 0 },
          { slug: "duck-wings", qty: 200 },
          "junk",
        ],
        payment: "cash",
      },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sale.lines).toEqual([{ slug: "beef-chunks", qty: 1 }]);
  });

  it("merges duplicate slugs by summing quantities, capped at ninety nine", () => {
    const result = validateStallSale(
      {
        clientId: CLIENT_ID,
        lines: [
          { slug: "beef-chunks", qty: 60 },
          { slug: "beef-chunks", qty: 60 },
        ],
        payment: "cash",
      },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sale.lines).toEqual([{ slug: "beef-chunks", qty: 99 }]);
  });

  it("degrades a junk customer to an anonymous one rather than failing the sale", () => {
    const result = validateStallSale(
      {
        clientId: CLIENT_ID,
        customer: { uid: "has spaces!", email: "not-an-email", name: 42 },
        lines: [{ slug: "beef-chunks", qty: 1 }],
        payment: "cash",
      },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sale.customer).toEqual({ uid: "", email: "", name: "42" });
  });

  it("falls back to receivedAt when recordedAt is unparseable", () => {
    const s = sale({ recordedAt: "last sunday" });
    expect(s.recordedAt).toBe(RECEIVED);
  });

  it("refuses a non-object body", () => {
    expect(validateStallSale("stuff", RECEIVED).ok).toBe(false);
    expect(validateStallSale(null, RECEIVED).ok).toBe(false);
  });
});

describe("docToSaleProduct", () => {
  it("reads price, earn override and stock tolerantly", () => {
    expect(
      docToSaleProduct("beef-chunks", {
        name: "Beef Chunks",
        price: 3.75,
        pointsPerPound: 25,
        stock: 7.9,
      }),
    ).toEqual({ slug: "beef-chunks", name: "Beef Chunks", price: 3.75, pointsPerPound: 25, stock: 7 });
  });

  it("treats a missing stock as untracked, not zero", () => {
    const p = docToSaleProduct("beef-chunks", { name: "Beef", price: 3 });
    expect(p.stock).toBeUndefined();
    expect(p.pointsPerPound).toBeUndefined();
  });

  it("zeroes a junk price and drops junk overrides", () => {
    const p = docToSaleProduct("x", { price: "lots", pointsPerPound: -1, stock: -4 });
    expect(p.price).toBe(0);
    expect(p.pointsPerPound).toBeUndefined();
    expect(p.stock).toBeUndefined();
  });
});

describe("buildSaleOutcome", () => {
  const products = new Map<string, SaleProduct>([
    ["beef-chunks", { slug: "beef-chunks", name: "Beef Chunks", price: 3.75, stock: 5 }],
    ["duck-wings", { slug: "duck-wings", name: "Duck Wings", price: 0.99, pointsPerPound: 20 }],
  ]);

  it("prices each line from the shelf, never the client, and floors the points", () => {
    const result = buildSaleOutcome(
      sale({
        lines: [
          { slug: "beef-chunks", qty: 2 },
          { slug: "duck-wings", qty: 1 },
        ],
      }),
      products,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.items).toEqual([
      { slug: "beef-chunks", name: "Beef Chunks", qty: 2, amount: 7.5, points: 75 },
      { slug: "duck-wings", name: "Duck Wings", qty: 1, amount: 0.99, points: 19 },
    ]);
    expect(result.outcome.total).toBe(8.49);
    expect(result.outcome.points).toBe(94);
  });

  it("decrements only tracked stock, clamped at zero", () => {
    const result = buildSaleOutcome(
      sale({
        lines: [
          { slug: "beef-chunks", qty: 9 },
          { slug: "duck-wings", qty: 1 },
        ],
      }),
      products,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome.stockChanges).toEqual([{ slug: "beef-chunks", stock: 0 }]);
  });

  it("fails naming every product that is not on the shelf list", () => {
    const result = buildSaleOutcome(
      sale({ lines: [{ slug: "gone-away", qty: 1 }, { slug: "beef-chunks", qty: 1 }] }),
      products,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["Not on the shelf list: gone-away"]);
  });
});
