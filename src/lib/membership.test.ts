import { describe, it, expect, beforeEach, vi } from "vitest";

// The members area leans entirely on these two helpers, so this file proves
// the gate itself rather than trusting it: membership is the explicit flag,
// not "a customer doc exists" (the escalation fixed in bfc1bb5), and the staff
// short-circuit is real rather than assumed.

const { getSessionUserMock, getDbMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("@/lib/firebase-admin", () => ({
  getDb: getDbMock,
  COLLECTIONS: { customers: "store_customers" },
}));

import { isMemberUid, currentUserIsMember } from "./membership";

/** A fake Firestore whose customer doc read resolves with the given data. */
function dbWithCustomerDoc(data: Record<string, unknown> | undefined) {
  return {
    collection: () => ({
      doc: () => ({ get: async () => ({ data: () => data }) }),
    }),
  };
}

// The exact shape the account routes write: upsertDog and updateCustomerDetails
// set({merge: true}) this into existence without any member flag. If this shape
// ever passes the gate again, any signed-in visitor can self-grant early access.
const accountCreatedDoc = {
  email: "sam@example.com",
  name: "Sam",
  phone: "07700 900000",
  address: { line1: "", line2: "", city: "", postcode: "DD5 1AA" },
  dogs: [{ id: "dog-1", name: "Loki" }],
  updatedAt: { toMillis: () => 1 },
};

beforeEach(() => {
  getSessionUserMock.mockReset();
  getDbMock.mockReset();
});

describe("isMemberUid", () => {
  it("admits a customer doc carrying member: true", async () => {
    getDbMock.mockReturnValue(dbWithCustomerDoc({ ...accountCreatedDoc, member: true }));
    await expect(isMemberUid("u1")).resolves.toBe(true);
  });

  it("refuses the doc the account routes create, which has no flag", async () => {
    getDbMock.mockReturnValue(dbWithCustomerDoc(accountCreatedDoc));
    await expect(isMemberUid("u1")).resolves.toBe(false);
  });

  it("refuses when there is no doc at all", async () => {
    getDbMock.mockReturnValue(dbWithCustomerDoc(undefined));
    await expect(isMemberUid("u1")).resolves.toBe(false);
  });

  it("refuses a flag that is not strictly true, because Firestore will store a string", async () => {
    getDbMock.mockReturnValue(dbWithCustomerDoc({ member: "true" }));
    await expect(isMemberUid("u1")).resolves.toBe(false);
  });

  it("refuses when the database is not configured", async () => {
    getDbMock.mockReturnValue(null);
    await expect(isMemberUid("u1")).resolves.toBe(false);
  });
});

describe("currentUserIsMember", () => {
  it("refuses a signed-out visitor", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(currentUserIsMember()).resolves.toBe(false);
  });

  it("admits staff without a customer lookup (proven: the db would refuse)", async () => {
    getSessionUserMock.mockResolvedValue({ uid: "m1", email: "m@b.dog", staff: true });
    getDbMock.mockReturnValue(null);
    await expect(currentUserIsMember()).resolves.toBe(true);
  });

  it("refuses a signed-in non-member whose doc came from the account page", async () => {
    getSessionUserMock.mockResolvedValue({ uid: "u1", email: "sam@example.com", staff: false });
    getDbMock.mockReturnValue(dbWithCustomerDoc(accountCreatedDoc));
    await expect(currentUserIsMember()).resolves.toBe(false);
  });

  it("admits a signed-in customer whose doc carries the flag", async () => {
    getSessionUserMock.mockResolvedValue({ uid: "u1", email: "sam@example.com", staff: false });
    getDbMock.mockReturnValue(dbWithCustomerDoc({ ...accountCreatedDoc, member: true }));
    await expect(currentUserIsMember()).resolves.toBe(true);
  });
});
