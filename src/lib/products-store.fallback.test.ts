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
