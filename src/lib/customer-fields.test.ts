import { describe, it, expect } from "vitest";
import { ALL_BADGES } from "@/data/products";
import { ALL_SENSITIVITIES, SENSITIVITY_BADGE } from "@/data/customers";
import {
  deriveLifeStage,
  dogOwnerLabel,
  isMemberDoc,
  normaliseAddress,
  validateDogInput,
} from "./customer-fields";

describe("SENSITIVITY_BADGE", () => {
  it("maps every sensitivity onto a badge that exists", () => {
    // Spec section 8.2: each dog field has to power something. A sensitivity with
    // no badge behind it cannot be rendered as a ribbon in B.3, so it would be a
    // field collected and never used.
    for (const s of ALL_SENSITIVITIES) {
      expect(ALL_BADGES).toContain(SENSITIVITY_BADGE[s]);
    }
  });
});

describe("deriveLifeStage", () => {
  const now = new Date("2026-07-25T00:00:00Z");

  it("calls under a year a puppy", () => {
    expect(deriveLifeStage("2026-02-01", now)).toBe("puppy");
  });

  it("calls one to seven an adult", () => {
    expect(deriveLifeStage("2023-07-25", now)).toBe("adult");
  });

  it("calls seven and over a senior", () => {
    expect(deriveLifeStage("2018-01-01", now)).toBe("senior");
  });

  it("returns unknown for a missing or unparseable date rather than guessing", () => {
    expect(deriveLifeStage(undefined, now)).toBe("unknown");
    expect(deriveLifeStage("not a date", now)).toBe("unknown");
  });

  it("returns unknown for a date in the future rather than a negative age", () => {
    expect(deriveLifeStage("2027-01-01", now)).toBe("unknown");
  });
});

describe("dogOwnerLabel", () => {
  // The spec calls this the "Loki's Mum" convention, but the record never stores
  // who is reading: gender is not collected, and one account serves a household
  // (spec 8.3). So the site always renders the neutral form, "Loki's human".
  it("names the first dog, the Loki's Mum convention rendered gender-neutrally", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }])).toBe("Loki's human");
  });

  it("adds an apostrophe only for a name ending in s", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Gus" }])).toBe("Gus' human");
  });

  it("joins two dogs with and, because both names are how she knows them", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }, { id: "d2", name: "Bear" }]))
      .toBe("Loki and Bear's human");
  });

  it("falls back to a plain greeting with no dogs, never to an empty possessive", () => {
    expect(dogOwnerLabel([])).toBe("");
  });
});

describe("validateDogInput", () => {
  it("accepts a dog with nothing but a name, because the rest is asked for in conversation", () => {
    const result = validateDogInput({ name: "  Loki " });
    expect(result).toEqual({ ok: true, value: { name: "Loki" } });
  });

  it("refuses a dog with no name, since a nameless dog cannot be shown or greeted", () => {
    const result = validateDogInput({ name: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("A dog needs a name.");
  });

  it("keeps the fields it understands", () => {
    const result = validateDogInput({
      name: "Bear",
      breed: " Labrador ",
      bornAt: "2020-03-04",
      size: "large",
      weightKg: 32,
      activity: "high",
      sensitivities: ["itchy-skin"],
      allergies: [" Chicken ", "wheat"],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Bear",
        breed: "Labrador",
        bornAt: "2020-03-04",
        size: "large",
        weightKg: 32,
        activity: "high",
        sensitivities: ["itchy-skin"],
        allergies: ["chicken", "wheat"],
      },
    });
  });

  it("drops a value it does not understand instead of failing the whole dog", () => {
    const result = validateDogInput({
      name: "Gus",
      size: "enormous" as never,
      activity: "vigorous" as never,
      sensitivities: ["itchy-skin", "made-up" as never],
      bornAt: "the summer",
      weightKg: -4,
    });
    expect(result).toEqual({ ok: true, value: { name: "Gus", sensitivities: ["itchy-skin"] } });
  });
});

describe("normaliseAddress", () => {
  it("trims every line and upper cases the postcode", () => {
    expect(normaliseAddress({ line1: " 1 High St ", city: " Dundee ", postcode: " dd5 1aa " }))
      .toEqual({ line1: "1 High St", line2: "", city: "Dundee", postcode: "DD5 1AA" });
  });

  it("returns a fully blank address for nothing at all, never undefined fields", () => {
    expect(normaliseAddress(undefined)).toEqual({ line1: "", line2: "", city: "", postcode: "" });
  });
});

describe("validateDogInput photo", () => {
  const signed =
    "https://storage.googleapis.com/barking-raw.firebasestorage.app/dogs/u1/abc.jpg?X-Goog-Signature=x";

  it("keeps a photo on our own storage host", () => {
    const result = validateDogInput({ name: "Loki", photo: signed });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photo).toBe(signed);
  });

  it("drops a photo hosted anywhere else", () => {
    // The photo is echoed back by the client after upload, and step 10.2 puts dog
    // photos on a public page. An arbitrary URL would put arbitrary content there.
    const result = validateDogInput({ name: "Loki", photo: "https://evil.example/x.jpg" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photo).toBeUndefined();
  });

  it("drops a non-https or unparseable photo", () => {
    for (const photo of ["javascript:alert(1)", "http://storage.googleapis.com/x.jpg", "not a url"]) {
      const result = validateDogInput({ name: "Loki", photo });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.photo).toBeUndefined();
    }
  });
});

describe("isMemberDoc", () => {
  it("is true only for an explicit member flag", () => {
    expect(isMemberDoc({ member: true })).toBe(true);
  });

  it("is false for a doc that merely exists", () => {
    // The bug this replaces: membership used to be "a store_customers doc exists",
    // and the A.2 account routes create that doc with set({merge:true}). So adding
    // a dog, or saving an address, made any signed-in user a member and handed them
    // the members-only early access that spec 10.1 says signing up must not grant.
    expect(isMemberDoc({ dogs: [{ id: "dog-1", name: "Freeloader" }] })).toBe(false);
    expect(isMemberDoc({ name: "Nobody", address: { line1: "", postcode: "" } })).toBe(false);
    expect(isMemberDoc({})).toBe(false);
  });

  it("is false for a missing doc", () => {
    expect(isMemberDoc(undefined)).toBe(false);
  });

  it("does not accept a truthy non-true value", () => {
    // Firestore will happily store a string. "false" is truthy.
    expect(isMemberDoc({ member: "false" })).toBe(false);
    expect(isMemberDoc({ member: 1 })).toBe(false);
  });
});
