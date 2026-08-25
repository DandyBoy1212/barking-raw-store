import { describe, it, expect } from "vitest";
import { planCategoryPatch, DELETE } from "./backfill-product-categories.mjs";

describe("planCategoryPatch", () => {
  it("maps the Dog Day mystery box onto the boxes shelf", () => {
    const plan = planCategoryPatch("mystery-box", { pillar: "good-food", fulfilment: "own-stock" });
    expect(plan.patch.category).toBe("boxes");
    expect(plan.archive).toBe(false);
  });

  it("maps every other product onto the treat range", () => {
    const plan = planCategoryPatch("chicken-feet", {
      pillar: "good-food",
      fulfilment: "own-stock",
    });
    expect(plan.patch.category).toBe("treats");
  });

  it("deletes every retired field", () => {
    const plan = planCategoryPatch("chicken-feet", {
      pillar: "good-food",
      fulfilment: "own-stock",
      leadTimeDays: 0,
      supplierPostage: 2,
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    for (const field of [
      "pillar",
      "fulfilment",
      "leadTimeDays",
      "supplierPostage",
      "supplierArrivalMinDays",
      "supplierArrivalMaxDays",
    ]) {
      expect(plan.patch[field]).toBe(DELETE);
    }
  });

  it("archives a supplier posted product rather than passing it off as own stock", () => {
    const plan = planCategoryPatch("someone-elses-thing", { fulfilment: "supplier-posted" });
    expect(plan.archive).toBe(true);
    expect(plan.patch.archived).toBe(true);
  });

  it("keeps a category already set rather than overwriting it from the slug", () => {
    const plan = planCategoryPatch("mystery-box", { category: "treats", pillar: "good-food" });
    expect(plan.patch.category).toBe("treats");
  });

  it("is idempotent: an already migrated doc plans no write", () => {
    expect(planCategoryPatch("chicken-feet", { category: "treats" })).toBeNull();
  });
});
