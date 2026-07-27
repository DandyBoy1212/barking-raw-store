import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_PILLARS, type Pillar } from "@/data/products";
import { filterByPillar, RING_PHOTOS, PILLAR_META } from "@/lib/pillars";

describe("filterByPillar", () => {
  const items: { slug: string; pillar: Pillar }[] = [
    { slug: "a", pillar: "good-food" },
    { slug: "b", pillar: "cosy-sleep" },
    { slug: "c", pillar: "good-food" },
  ];

  it("keeps only the pillar's products, in order", () => {
    expect(filterByPillar(items, "good-food").map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("returns an empty list for an unstocked pillar", () => {
    expect(filterByPillar(items, "comfy-walks")).toEqual([]);
  });
});

describe("RING_PHOTOS", () => {
  it("names an existing file under public/ for every pillar", () => {
    for (const pillar of ALL_PILLARS) {
      const rel = RING_PHOTOS[pillar];
      expect(rel.startsWith("/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", rel))).toBe(true);
    }
  });
});

describe("PILLAR_META", () => {
  it("gives every pillar a title and description, with no em dashes", () => {
    for (const pillar of ALL_PILLARS) {
      const meta = PILLAR_META[pillar];
      expect(meta.title.length).toBeGreaterThan(10);
      expect(meta.description.length).toBeGreaterThan(50);
      expect(meta.title).not.toMatch(/—/);
      expect(meta.description).not.toMatch(/—/);
    }
  });
});
