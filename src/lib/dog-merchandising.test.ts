import { describe, it, expect } from "vitest";
import { ALL_SENSITIVITIES, type Dog } from "@/data/customers";
import {
  MAX_CARD_RIBBONS,
  RIBBON_WORDING,
  productRibbons,
} from "./dog-merchandising";

const dog = (over: Partial<Dog>): Dog => ({ id: "dog-1", name: "Loki", ...over });
const sprats = { name: "Whole Sprats", badges: ["Most Popular", "Best for Skin & Coat"] as const };
const chickenFeet = {
  name: "Chicken Feet",
  badges: ["Natural Joint Support", "Single Ingredient"] as const,
};

describe("RIBBON_WORDING", () => {
  it("has a line for every sensitivity, so no profile answer is collected and never shown", () => {
    for (const s of ALL_SENSITIVITIES) {
      expect(RIBBON_WORDING[s]("Loki")).toContain("Loki");
    }
  });

  it("gives a name ending in s a bare apostrophe, matching the greeting rule", () => {
    expect(RIBBON_WORDING["itchy-skin"]("Gus")).toBe("Good for Gus' coat");
  });
});

describe("productRibbons", () => {
  it("shows nothing with no dogs, so signed-out cards are exactly today's cards", () => {
    expect(productRibbons([], sprats)).toEqual([]);
  });

  it("shows nothing for a dog with no sensitivities or allergies", () => {
    expect(productRibbons([dog({})], sprats)).toEqual([]);
  });

  it("turns a matched sensitivity into a suit ribbon with the dog's name", () => {
    const out = productRibbons([dog({ sensitivities: ["itchy-skin"] })], sprats);
    expect(out).toEqual([{ key: "dog-1-suit", kind: "suit", text: "Good for Loki's coat" }]);
  });

  it("shows no suit ribbon when the mapped badge is not on the product", () => {
    expect(productRibbons([dog({ sensitivities: ["sensitive-tummy"] })], sprats)).toEqual([]);
  });

  it("caps a dog at one ribbon even when two sensitivities match", () => {
    const rabbitEars = {
      name: "Rabbit Ears",
      badges: ["Novel Protein", "Gentle on Dodgy Tummies"] as const,
    };
    const out = productRibbons(
      [dog({ sensitivities: ["sensitive-tummy", "common-proteins"] })],
      rabbitEars,
    );
    expect(out).toEqual([{ key: "dog-1-suit", kind: "suit", text: "Gentle for Loki" }]);
  });

  it("gives each matching dog a ribbon, in the order the dogs are stored", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-2", name: "Bear", sensitivities: ["itchy-skin"] }),
      ],
      sprats,
    );
    expect(out.map((r) => r.text)).toEqual(["Good for Loki's coat", "Good for Bear's coat"]);
  });

  it("caps the card at MAX_CARD_RIBBONS ribbons", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-2", name: "Bear", sensitivities: ["itchy-skin"] }),
        dog({ id: "dog-3", name: "Nell", sensitivities: ["itchy-skin"] }),
      ],
      sprats,
    );
    expect(out).toHaveLength(MAX_CARD_RIBBONS);
    expect(out.map((r) => r.text)).toEqual(["Good for Loki's coat", "Good for Bear's coat"]);
  });

  it("turns an allergy whose word appears in the product name into a caution", () => {
    const out = productRibbons([dog({ allergies: ["chicken"] })], chickenFeet);
    expect(out).toEqual([{ key: "dog-1-caution", kind: "caution", text: "Not one for Loki" }]);
  });

  it("matches whole words only, so chick does not condemn chicken", () => {
    expect(productRibbons([dog({ allergies: ["chick"] })], chickenFeet)).toEqual([]);
  });

  it("matches the name case-insensitively", () => {
    const out = productRibbons([dog({ allergies: ["CHICKEN"] })], chickenFeet);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("caution");
  });

  it("never matches the description, only the name", () => {
    // The Rabbit Ears description mentions chicken while containing none, which is
    // exactly why descriptions are out of bounds. The function never sees one.
    const rabbitEars = { name: "Rabbit Ears", badges: ["Novel Protein"] as const };
    expect(productRibbons([dog({ allergies: ["chicken"] })], rabbitEars)).toEqual([]);
  });

  it("lets a caution suppress the same dog's suit ribbon", () => {
    const out = productRibbons(
      [dog({ sensitivities: ["stiff-joints"], allergies: ["chicken"] })],
      chickenFeet,
    );
    expect(out).toEqual([{ key: "dog-1-caution", kind: "caution", text: "Not one for Loki" }]);
  });

  it("sorts cautions before suits across dogs, and cautions take the capped slots", () => {
    const out = productRibbons(
      [
        dog({ sensitivities: ["stiff-joints"] }),
        dog({ id: "dog-2", name: "Bear", allergies: ["chicken"] }),
      ],
      chickenFeet,
    );
    expect(out.map((r) => r.kind)).toEqual(["caution", "suit"]);
  });

  it("skips a dog whose name is blank, because a ribbon with no name says nothing", () => {
    expect(productRibbons([dog({ name: "  ", sensitivities: ["itchy-skin"] })], sprats)).toEqual([]);
  });

  it("does not choke on an allergy token that is regex-hostile", () => {
    expect(productRibbons([dog({ allergies: ["(beef)"] })], chickenFeet)).toEqual([]);
  });
});
