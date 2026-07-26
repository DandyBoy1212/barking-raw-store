import { describe, it, expect } from "vitest";
import { planImagePatch } from "./backfill-product-images.mjs";

describe("planImagePatch", () => {
  it("folds a legacy single image into the list", () => {
    expect(planImagePatch({ image: "/a.png" })).toEqual({
      images: [{ url: "/a.png", primary: true }],
      image: "/a.png",
    });
  });

  it("is idempotent: an already-migrated doc plans no write", () => {
    const doc = { image: "/a.png", images: [{ url: "/a.png", primary: true }] };
    expect(planImagePatch(doc)).toBeNull();
  });

  it("repairs a list with no primary and realigns the derived image", () => {
    expect(
      planImagePatch({ image: "/stale.png", images: [{ url: "/a.png" }, { url: "/b.png" }] }),
    ).toEqual({
      images: [
        { url: "/a.png", primary: true },
        { url: "/b.png", primary: false },
      ],
      image: "/a.png",
    });
  });

  it("keeps the first marked primary and demotes the rest", () => {
    expect(
      planImagePatch({
        image: "/b.png",
        images: [
          { url: "/a.png", primary: false },
          { url: "/b.png", primary: true },
          { url: "/c.png", primary: true },
        ],
      }),
    ).toEqual({
      images: [
        { url: "/a.png", primary: false },
        { url: "/b.png", primary: true },
        { url: "/c.png", primary: false },
      ],
      image: "/b.png",
    });
  });

  it("plans nothing for a doc with no image data at all", () => {
    expect(planImagePatch({})).toBeNull();
    expect(planImagePatch({ image: "  " })).toBeNull();
  });
});
