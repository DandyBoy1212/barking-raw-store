import { describe, it, expect } from "vitest";
import { docToStoredCustomer, nextDogId } from "./customers-store";

describe("docToStoredCustomer", () => {
  it("reads a full record", () => {
    expect(
      docToStoredCustomer("u1", {
        email: "a@b.com",
        name: "Sam",
        phone: "07700 900000",
        address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
        dogs: [{ id: "d1", name: "Loki", breed: "Collie" }],
      }),
    ).toEqual({
      uid: "u1",
      email: "a@b.com",
      name: "Sam",
      phone: "07700 900000",
      address: { line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" },
      dogs: [{ id: "d1", name: "Loki", breed: "Collie" }],
    });
  });

  it("carries the Stripe customer id when the webhook has stored one", () => {
    expect(
      docToStoredCustomer("u1", { email: "a@b.com", stripeCustomerId: "cus_9" }).stripeCustomerId,
    ).toBe("cus_9");
    expect(docToStoredCustomer("u1", { email: "a@b.com" }).stripeCustomerId).toBeUndefined();
  });

  it("reads a legacy doc, keeping lastPostcode as the only address it has", () => {
    // Every customer doc in Firestore today is this shape. Losing lastPostcode would
    // throw away the one piece of address information the site ever collected.
    expect(docToStoredCustomer("u2", { email: "a@b.com", name: "Sam", lastPostcode: "DD5 1AA" }))
      .toEqual({
        uid: "u2",
        email: "a@b.com",
        name: "Sam",
        phone: "",
        address: { line1: "", line2: "", city: "", postcode: "DD5 1AA" },
        dogs: [],
      });
  });

  it("survives an empty doc rather than throwing", () => {
    expect(docToStoredCustomer("u3", {})).toEqual({
      uid: "u3",
      email: "",
      name: "",
      phone: "",
      address: { line1: "", line2: "", city: "", postcode: "" },
      dogs: [],
    });
  });

  it("drops a dog with no id or no name, which cannot be edited or displayed", () => {
    const result = docToStoredCustomer("u4", {
      dogs: [{ id: "d1", name: "Loki" }, { name: "no id" }, { id: "d3" }, "nonsense"],
    });
    expect(result.dogs).toEqual([{ id: "d1", name: "Loki" }]);
  });

  it("ignores a dogs field that is not an array", () => {
    expect(docToStoredCustomer("u5", { dogs: "Loki" }).dogs).toEqual([]);
  });
});

describe("nextDogId", () => {
  it("starts at dog-1", () => {
    expect(nextDogId([])).toBe("dog-1");
  });

  it("never reuses an id, so an edit cannot land on a deleted dog's row", () => {
    // dog-2 was deleted. Reusing it would point an in-flight edit at the wrong dog.
    expect(nextDogId([{ id: "dog-1" }, { id: "dog-3" }])).toBe("dog-4");
  });

  it("ignores an id it did not generate", () => {
    expect(nextDogId([{ id: "imported-abc" }])).toBe("dog-1");
  });
});
