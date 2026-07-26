import { describe, it, expect } from "vitest";
import {
  normaliseImages,
  primaryImageUrl,
  setPrimary,
  moveImage,
  removeImage,
  cycleIndex,
} from "@/lib/product-images";

describe("normaliseImages", () => {
  it("folds a legacy single image into a one-entry primary list", () => {
    expect(normaliseImages(undefined, "/products/a.png")).toEqual([
      { url: "/products/a.png", primary: true },
    ]);
  });

  it("returns an empty list when nothing is known", () => {
    expect(normaliseImages(undefined, undefined)).toEqual([]);
    expect(normaliseImages([], "")).toEqual([]);
    expect(normaliseImages("nonsense", 42)).toEqual([]);
  });

  it("marks the first image primary when none is marked", () => {
    expect(normaliseImages([{ url: "/a.png" }, { url: "/b.png" }])).toEqual([
      { url: "/a.png", primary: true },
      { url: "/b.png", primary: false },
    ]);
  });

  it("keeps the first marked primary and demotes any others", () => {
    expect(
      normaliseImages([
        { url: "/a.png" },
        { url: "/b.png", primary: true },
        { url: "/c.png", primary: true },
      ]),
    ).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
      { url: "/c.png", primary: false },
    ]);
  });

  it("tolerates plain string entries and drops junk", () => {
    expect(normaliseImages(["/a.png", { url: "  " }, null, { url: "/b.png" }])).toEqual([
      { url: "/a.png", primary: true },
      { url: "/b.png", primary: false },
    ]);
  });

  it("prefers the list over the legacy string when both exist", () => {
    expect(normaliseImages([{ url: "/new.png" }], "/old.png")).toEqual([
      { url: "/new.png", primary: true },
    ]);
  });
});

describe("primaryImageUrl", () => {
  it("returns the primary's url", () => {
    expect(
      primaryImageUrl([
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
      ]),
    ).toBe("/b.png");
  });

  it("falls back to the first image, then to an empty string", () => {
    expect(primaryImageUrl([{ url: "/a.png", primary: false }])).toBe("/a.png");
    expect(primaryImageUrl([])).toBe("");
  });
});

describe("setPrimary", () => {
  it("moves the primary flag to the given index", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(setPrimary(imgs, 1)).toEqual([
      { url: "/a.png", primary: false },
      { url: "/b.png", primary: true },
    ]);
  });

  it("ignores an out-of-range index", () => {
    const imgs = normaliseImages(["/a.png"]);
    expect(setPrimary(imgs, 5)).toEqual(imgs);
  });
});

describe("moveImage", () => {
  it("reorders without losing the primary flag", () => {
    const imgs = normaliseImages(["/a.png", "/b.png", "/c.png"]);
    expect(moveImage(imgs, 0, 2)).toEqual([
      { url: "/b.png", primary: false },
      { url: "/c.png", primary: false },
      { url: "/a.png", primary: true },
    ]);
  });

  it("ignores an out-of-range move", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(moveImage(imgs, 0, 9)).toEqual(imgs);
    expect(moveImage(imgs, -1, 1)).toEqual(imgs);
  });
});

describe("removeImage", () => {
  it("promotes the first remaining image when the primary is removed", () => {
    const imgs = normaliseImages(["/a.png", "/b.png"]);
    expect(removeImage(imgs, 0)).toEqual([{ url: "/b.png", primary: true }]);
  });

  it("keeps the primary when another image is removed", () => {
    const imgs = setPrimary(normaliseImages(["/a.png", "/b.png", "/c.png"]), 2);
    expect(removeImage(imgs, 0)).toEqual([
      { url: "/b.png", primary: false },
      { url: "/c.png", primary: true },
    ]);
  });

  it("returns an empty list when the last image is removed", () => {
    expect(removeImage(normaliseImages(["/a.png"]), 0)).toEqual([]);
  });
});

describe("cycleIndex", () => {
  it("wraps in both directions", () => {
    expect(cycleIndex(0, 1, 3)).toBe(1);
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(cycleIndex(0, -1, 3)).toBe(2);
  });

  it("stays at zero for a single image", () => {
    expect(cycleIndex(0, 1, 1)).toBe(0);
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });
});
