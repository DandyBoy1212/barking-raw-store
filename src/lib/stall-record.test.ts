import { describe, it, expect } from "vitest";
import { validateStallRecord } from "./stall-record";

const CLIENT_ID = "3f2c9b1e-8a4d-4f6b-9c1e-2b7a8d3e5f60";
const RECEIVED = "2026-07-26T09:00:00.000Z";

describe("validateStallRecord", () => {
  it("accepts a full record and normalises it", () => {
    const result = validateStallRecord(
      {
        clientId: CLIENT_ID,
        capturedAt: "2026-07-26T08:30:00.000Z",
        name: "  Sam ",
        email: " Sam@Example.COM ",
        phone: " 07700 900000 ",
        address: { line1: " 1 High St ", city: " Dundee ", postcode: " dd5 1aa " },
        dogs: [{ name: "Loki", breed: "Collie", photoData: "data:image/jpeg;base64,abc" }],
        consent: { marketing: true, photo: true },
      },
      RECEIVED,
    );
    expect(result).toEqual({
      ok: true,
      record: {
        clientId: CLIENT_ID,
        capturedAt: "2026-07-26T08:30:00.000Z",
        name: "Sam",
        email: "sam@example.com",
        phone: "07700 900000",
        address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ value: { name: "Loki", breed: "Collie" }, photoData: "data:image/jpeg;base64,abc" }],
        consent: { marketing: true, photo: true },
      },
    });
  });

  it("refuses a record without a usable clientId, since sync cannot be idempotent without one", () => {
    const result = validateStallRecord({ clientId: "nope!", name: "Sam" }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("A record needs its client id.");
  });

  it("refuses a completely empty record, because there is nothing to save", () => {
    const result = validateStallRecord({ clientId: CLIENT_ID }, RECEIVED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Nothing to save.");
  });

  it("keeps a record that only has a phone number, since every other field is skippable", () => {
    const result = validateStallRecord({ clientId: CLIENT_ID, phone: "07700 900000" }, RECEIVED);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.phone).toBe("07700 900000");
      expect(result.record.email).toBe("");
      expect(result.record.dogs).toEqual([]);
    }
  });

  it("drops an email with no @ rather than failing the record", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", email: "not-an-email" },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.email).toBe("");
  });

  it("drops a nameless dog but keeps the record, mirroring the A.2 read-side rule", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", dogs: [{ breed: "Collie" }, { name: "Bear" }] },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Bear" } }]);
  });

  it("strips photoData that is not an inline image, keeping the dog", () => {
    const result = validateStallRecord(
      {
        clientId: CLIENT_ID,
        dogs: [{ name: "Loki", photoData: "https://evil.example/x.jpg" }],
      },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Loki" } }]);
  });

  it("strips photoData over the size cap, keeping the dog", () => {
    const big = `data:image/jpeg;base64,${"a".repeat(2_900_000)}`;
    const result = validateStallRecord(
      { clientId: CLIENT_ID, dogs: [{ name: "Loki", photoData: big }] },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.dogs).toEqual([{ value: { name: "Loki" } }]);
  });

  it("treats anything but true as unticked consent, so consent can only be given deliberately", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", consent: { marketing: "yes", photo: 1 } },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.consent).toEqual({ marketing: false, photo: false });
  });

  it("falls back to receivedAt when capturedAt is missing or unparseable", () => {
    const result = validateStallRecord(
      { clientId: CLIENT_ID, name: "Sam", capturedAt: "last sunday" },
      RECEIVED,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.capturedAt).toBe(RECEIVED);
  });

  it("refuses a non-object body", () => {
    expect(validateStallRecord("stuff", RECEIVED).ok).toBe(false);
    expect(validateStallRecord(null, RECEIVED).ok).toBe(false);
  });
});
