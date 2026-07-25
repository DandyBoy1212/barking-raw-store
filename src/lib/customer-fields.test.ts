import { describe, it, expect } from "vitest";
import { ALL_BADGES } from "@/data/products";
import { ALL_SENSITIVITIES, SENSITIVITY_BADGE } from "@/data/customers";
import { deriveLifeStage, dogOwnerLabel } from "./customer-fields";

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
  it("names the first dog, which is the Loki's Mum convention in spec section 8.2", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }])).toBe("Loki's Mum");
  });

  it("adds an apostrophe only for a name ending in s", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Gus" }])).toBe("Gus' Mum");
  });

  it("joins two dogs with and, because both names are how she knows them", () => {
    expect(dogOwnerLabel([{ id: "d1", name: "Loki" }, { id: "d2", name: "Bear" }]))
      .toBe("Loki and Bear's Mum");
  });

  it("falls back to a plain greeting with no dogs, never to an empty possessive", () => {
    expect(dogOwnerLabel([])).toBe("");
  });
});
