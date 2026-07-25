import { describe, it, expect } from "vitest";
import { buildStallCustomerPatch, stallWelcomeEmailHtml, validateStallRecord } from "./stall-record";
import type { StoredCustomer } from "@/data/customers";

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

const BLANK_CUSTOMER: StoredCustomer = {
  uid: "u1",
  email: "",
  name: "",
  phone: "",
  address: { line1: "", line2: "", city: "", postcode: "" },
  dogs: [],
};

function record(overrides: Record<string, unknown>) {
  const result = validateStallRecord({ clientId: CLIENT_ID, ...overrides }, RECEIVED);
  if (!result.ok) throw new Error("test record did not validate");
  return result.record;
}

describe("buildStallCustomerPatch", () => {
  it("writes a full record onto a blank customer", () => {
    const patch = buildStallCustomerPatch(
      BLANK_CUSTOMER,
      record({
        name: "Sam",
        email: "sam@example.com",
        phone: "07700 900000",
        address: { line1: "1 High St", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ name: "Loki", breed: "Collie" }],
        consent: { marketing: true, photo: false },
        capturedAt: "2026-07-26T08:30:00.000Z",
      }),
      [undefined],
    );
    expect(patch).toEqual({
      email: "sam@example.com",
      name: "Sam",
      phone: "07700 900000",
      address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
      lastPostcode: "DD5 1AA",
      dogs: [{ id: "dog-1", name: "Loki", breed: "Collie" }],
      marketingConsent: true,
      photoConsent: false,
      consentAt: "2026-07-26T08:30:00.000Z",
      stallSignupAt: "2026-07-26T08:30:00.000Z",
    });
  });

  it("never blanks an existing field with a skipped one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      name: "Samantha",
      phone: "07700 111222",
      address: { line1: "2 Low St", line2: "", city: "Dundee", postcode: "DD4 9ZZ" },
    };
    const patch = buildStallCustomerPatch(
      current,
      record({ name: "", phone: "", dogs: [{ name: "Loki" }] }),
      [undefined],
    );
    expect(patch).not.toHaveProperty("name");
    expect(patch).not.toHaveProperty("phone");
    expect(patch).not.toHaveProperty("address");
    expect(patch).not.toHaveProperty("lastPostcode");
  });

  it("lets a fresh non-blank answer win, since the stall conversation is the newest data", () => {
    const current: StoredCustomer = { ...BLANK_CUSTOMER, name: "Sam" };
    const patch = buildStallCustomerPatch(current, record({ name: "Samantha" }), []);
    expect(patch.name).toBe("Samantha");
  });

  it("never overwrites an existing email, because email is identity", () => {
    const current: StoredCustomer = { ...BLANK_CUSTOMER, email: "old@example.com" };
    const patch = buildStallCustomerPatch(
      current,
      record({ name: "Sam", email: "new@example.com" }),
      [],
    );
    expect(patch).not.toHaveProperty("email");
  });

  it("merges a partial address field by field over the existing one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      address: { line1: "2 Low St", line2: "", city: "Dundee", postcode: "" },
    };
    const patch = buildStallCustomerPatch(current, record({ address: { postcode: "DD5 1AA" } }), []);
    expect(patch.address).toEqual({
      line1: "2 Low St",
      line2: "",
      city: "Dundee",
      postcode: "DD5 1AA",
    });
    expect(patch.lastPostcode).toBe("DD5 1AA");
  });

  it("appends dogs after the existing ids, never reusing one", () => {
    const current: StoredCustomer = {
      ...BLANK_CUSTOMER,
      dogs: [
        { id: "dog-1", name: "Old" },
        { id: "dog-3", name: "Older" },
      ],
    };
    const patch = buildStallCustomerPatch(
      current,
      record({ dogs: [{ name: "Loki" }, { name: "Bear" }] }),
      [undefined, undefined],
    );
    expect(patch.dogs).toEqual([
      { id: "dog-1", name: "Old" },
      { id: "dog-3", name: "Older" },
      { id: "dog-4", name: "Loki" },
      { id: "dog-5", name: "Bear" },
    ]);
  });

  it("attaches an uploaded photo url to its dog and leaves the others alone", () => {
    const patch = buildStallCustomerPatch(
      BLANK_CUSTOMER,
      record({ dogs: [{ name: "Loki" }, { name: "Bear" }] }),
      ["https://storage.googleapis.com/b/loki.jpg", undefined],
    );
    expect(patch.dogs).toEqual([
      { id: "dog-1", name: "Loki", photo: "https://storage.googleapis.com/b/loki.jpg" },
      { id: "dog-2", name: "Bear" },
    ]);
  });

  it("records unticked consent as an explicit false with its timestamp", () => {
    const patch = buildStallCustomerPatch(
      BLANK_CUSTOMER,
      record({ name: "Sam", capturedAt: "2026-07-26T08:30:00.000Z" }),
      [],
    );
    expect(patch.marketingConsent).toBe(false);
    expect(patch.photoConsent).toBe(false);
    expect(patch.consentAt).toBe("2026-07-26T08:30:00.000Z");
  });
});

describe("stallWelcomeEmailHtml", () => {
  it("carries the magic link and greets by name when there is one", () => {
    const html = stallWelcomeEmailHtml("https://example.com/link", "Sam");
    expect(html).toContain("https://example.com/link");
    expect(html).toContain("Hi Sam,");
  });

  it("escapes a hostile name rather than interpolating it as markup", () => {
    const html = stallWelcomeEmailHtml("https://example.com/link", "<script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
