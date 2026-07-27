import { describe, it, expect } from "vitest";
import { SEED_BADGES, SYSTEM_BADGES } from "@/data/badges";
import { SENSITIVITY_BADGE } from "@/data/customers";
import { badgeSlug, canRetireBadge, docToStoredBadge, validateBadgeInput } from "./badge-admin";

describe("SYSTEM_BADGES", () => {
  it("covers every badge a dog sensitivity points at", () => {
    // This is the whole reason system badges exist. If Michaela could retire one of
    // these, the matching ribbon in B.3 would silently stop appearing everywhere.
    for (const badge of Object.values(SENSITIVITY_BADGE)) {
      expect(SYSTEM_BADGES).toContain(badge);
    }
  });

  it("covers Most Popular, which Badge.tsx string-matches to draw the star", () => {
    expect(SYSTEM_BADGES).toContain("Most Popular");
  });

  it("is a subset of the seed badges", () => {
    for (const badge of SYSTEM_BADGES) expect(SEED_BADGES).toContain(badge);
  });
});

describe("badgeSlug", () => {
  it("lower cases, strips punctuation and hyphenates", () => {
    expect(badgeSlug("Gentle on Dodgy Tummies")).toBe("gentle-on-dodgy-tummies");
    expect(badgeSlug("Best for Skin & Coat")).toBe("best-for-skin-coat");
    expect(badgeSlug("  Novel   Protein  ")).toBe("novel-protein");
  });

  it("returns empty for a label with nothing usable in it", () => {
    expect(badgeSlug("   ")).toBe("");
    expect(badgeSlug("!!!")).toBe("");
  });
});

describe("validateBadgeInput", () => {
  const existing = [
    { slug: "most-popular", label: "Most Popular", retired: false, system: true },
  ];

  it("accepts a new label and trims it", () => {
    expect(validateBadgeInput({ label: "  Great for Puppies " }, existing))
      .toEqual({ ok: true, value: { label: "Great for Puppies" } });
  });

  it("refuses an empty label", () => {
    const r = validateBadgeInput({ label: "  " }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("A badge needs a name.");
  });

  it("refuses a label that would collide with an existing badge", () => {
    // Same slug, different capitalisation. Two badges rendering identically would
    // be indistinguishable on a product card.
    const r = validateBadgeInput({ label: "most popular" }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("There is already a badge called that.");
  });

  it("refuses a label that slugs to nothing", () => {
    const r = validateBadgeInput({ label: "!!!" }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("That name cannot be used.");
  });

  it("refuses a label long enough to break the pill layout", () => {
    const r = validateBadgeInput({ label: "x".repeat(41) }, existing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Keep a badge to 40 characters or fewer.");
  });
});

describe("canRetireBadge", () => {
  it("allows retiring an ordinary badge", () => {
    expect(canRetireBadge({ slug: "single-ingredient", label: "Single Ingredient", retired: false, system: false }))
      .toEqual({ ok: true });
  });

  it("names the ribbon a sensitivity badge powers, rather than just refusing", () => {
    // A refusal Michaela cannot understand becomes a support message to Liam, and
    // the whole point of B.6 is that she does not need him for this.
    const r = canRetireBadge({ slug: "gentle-on-dodgy-tummies", label: "Gentle on Dodgy Tummies", retired: false, system: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("Dodgy tummy");
      expect(r.reason).toContain("stop putting it on products");
    }
  });

  it("explains the star for Most Popular, which is protected for a different reason", () => {
    const r = canRetireBadge({ slug: "most-popular", label: "Most Popular", retired: false, system: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("star");
  });
});

describe("docToStoredBadge", () => {
  it("reads a full record", () => {
    expect(docToStoredBadge("novel-protein", { label: "Novel Protein", retired: false, system: true }))
      .toEqual({ slug: "novel-protein", label: "Novel Protein", retired: false, system: true });
  });

  it("defaults a partial record rather than throwing", () => {
    expect(docToStoredBadge("x", {})).toEqual({ slug: "x", label: "", retired: false, system: false });
  });

  it("treats any non-true retired value as active", () => {
    expect(docToStoredBadge("x", { label: "X", retired: "yes" }).retired).toBe(false);
  });
});
