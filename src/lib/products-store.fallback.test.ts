import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-admin so getDb() returns a fake db whose reads reject,
// letting us exercise the Firestore-throws fallback path in isolation
// from the pure-function tests in products-store.test.ts.
const getMock = vi.fn();

vi.mock("@/lib/firebase-admin", () => ({
  getDb: () => ({
    collection: () => ({
      get: getMock,
      doc: () => ({ get: getMock }),
    }),
  }),
  COLLECTIONS: { products: "store_products" },
}));

import { getStoredProducts, getStoredProductBySlug } from "./products-store";

describe("getStoredProducts (Firestore read throws)", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("falls back to the seed catalogue when the Firestore read rejects", async () => {
    getMock.mockRejectedValue(new Error("permission-denied"));
    const result = await getStoredProducts();
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.active && !p.archived)).toBe(true);
  });
});

describe("getStoredProducts (Firestore collection empty vs all-archived)", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("falls back to the seed catalogue when the collection is truly empty", async () => {
    getMock.mockResolvedValue({ empty: true, docs: [] });
    const result = await getStoredProducts();
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.active && !p.archived)).toBe(true);
  });

  it("returns an empty list (not the seed) when docs exist but all are archived/inactive", async () => {
    getMock.mockResolvedValue({
      empty: false,
      docs: [
        { id: "a", data: () => ({ name: "A", price: 1, hook: "h", description: "d", image: "/a.png", active: false, archived: false }) },
        { id: "b", data: () => ({ name: "B", price: 2, hook: "h", description: "d", image: "/b.png", active: true, archived: true }) },
      ],
    });
    const result = await getStoredProducts();
    expect(result).toEqual([]);
  });
});

describe("getStoredProductBySlug (Firestore read throws)", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("falls back to the seed product when the Firestore read rejects", async () => {
    getMock.mockRejectedValue(new Error("network error"));
    const result = await getStoredProductBySlug("chicken-feet");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("chicken-feet");
  });

  it("falls back to null when the slug is not in the seed and the read rejects", async () => {
    getMock.mockRejectedValue(new Error("network error"));
    const result = await getStoredProductBySlug("not-a-real-slug");
    expect(result).toBeNull();
  });
});
