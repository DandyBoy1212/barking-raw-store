import { describe, it, expect } from "vitest";
import { docToStoredCustomer } from "./customers-store";

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
