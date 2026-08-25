import { describe, it, expect } from "vitest";
import {
  ARTICLE_STANDFIRST_MAX,
  articleBlocks,
  articleDateLabel,
  articleFreshMs,
  docToArticle,
  slugifyArticle,
  sortArticlesNewestFirst,
  validateArticleInput,
  type Article,
} from "@/lib/articles";

const good = {
  title: "What the label is allowed to hide",
  standfirst: "Three words that legally mean almost nothing.",
  body: "First paragraph.\n\n## A heading\nSecond paragraph.",
};

describe("slugifyArticle", () => {
  it("lowercases, hyphenates and trims", () => {
    expect(slugifyArticle("What The Label Hides")).toBe("what-the-label-hides");
    expect(slugifyArticle("  Four for £20!  ")).toBe("four-for-20");
    expect(slugifyArticle("A   b   c")).toBe("a-b-c");
  });

  it("returns nothing for a title with no letters or numbers", () => {
    expect(slugifyArticle("!!!")).toBe("");
  });
});

describe("validateArticleInput", () => {
  it("accepts a complete article and derives the slug from the title", () => {
    const r = validateArticleInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.slug).toBe("what-the-label-is-allowed-to-hide");
  });

  it("keeps a slug she typed, so a retitle cannot break published links", () => {
    const r = validateArticleInput({ ...good, slug: "the-label-piece" });
    expect(r.ok && r.value.slug).toBe("the-label-piece");
  });

  it("tidies a slug she typed badly", () => {
    expect(validateArticleInput({ ...good, slug: "  The Label Piece  " }).ok).toBe(true);
    const r = validateArticleInput({ ...good, slug: "  The Label Piece  " });
    expect(r.ok && r.value.slug).toBe("the-label-piece");
  });

  it("requires a title", () => {
    const r = validateArticleInput({ ...good, title: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Give the article a title.");
  });

  it("requires the standfirst, since it is the search result's description", () => {
    const r = validateArticleInput({ ...good, standfirst: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Write the one line that sits under the title.");
  });

  it("rejects a standfirst Google would truncate", () => {
    const r = validateArticleInput({ ...good, standfirst: "x".repeat(ARTICLE_STANDFIRST_MAX + 1) });
    expect(r.ok).toBe(false);
  });

  it("requires a body", () => {
    expect(validateArticleInput({ ...good, body: "   " }).ok).toBe(false);
  });

  it("refuses a title that would claim the blog index as its address", () => {
    const r = validateArticleInput({ ...good, title: "!!!" });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContain("That title has no letters or numbers to make a web address from.");
  });

  it("treats a blank image as no image rather than an empty src", () => {
    const r = validateArticleInput({ ...good, image: "  " });
    expect(r.ok && r.value.image).toBeUndefined();
  });

  it("reports every problem at once rather than one at a time", () => {
    const r = validateArticleInput({ title: "", standfirst: "", body: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(3);
  });
});

describe("docToArticle", () => {
  it("reads a full doc", () => {
    const a = docToArticle("the-piece", {
      title: "T",
      standfirst: "S",
      body: "B",
      image: "/x.png",
      published: true,
    });
    expect(a).toMatchObject({ slug: "the-piece", title: "T", published: true, image: "/x.png" });
  });

  it("treats the string \"false\" as unpublished, since a non-empty string is truthy", () => {
    expect(docToArticle("x", { published: "false" }).published).toBe(false);
  });

  it("treats anything but true as unpublished", () => {
    expect(docToArticle("x", { published: 1 }).published).toBe(false);
    expect(docToArticle("x", {}).published).toBe(false);
  });

  it("survives a doc with nothing in it", () => {
    const a = docToArticle("x", {});
    expect(a.title).toBe("");
    expect(a.image).toBeUndefined();
    expect(a.createdAtMs).toBeNull();
  });
});

describe("ordering", () => {
  const at = (slug: string, published: number | null, created: number | null): Article => ({
    slug,
    title: slug,
    standfirst: "",
    body: "",
    published: true,
    publishedAtMs: published,
    createdAtMs: created,
  });

  it("prefers the publish date, so a republished piece surfaces again", () => {
    expect(articleFreshMs(at("a", 200, 100))).toBe(200);
  });

  it("falls back to creation for a draft", () => {
    expect(articleFreshMs(at("a", null, 100))).toBe(100);
  });

  it("sorts newest first and sinks a dateless article", () => {
    const sorted = sortArticlesNewestFirst([
      at("old", 100, 100),
      at("nodate", null, null),
      at("new", 300, 100),
    ]);
    expect(sorted.map((a) => a.slug)).toEqual(["new", "old", "nodate"]);
  });

  it("does not mutate its input", () => {
    const list = [at("a", 100, 100), at("b", 300, 100)];
    sortArticlesNewestFirst(list);
    expect(list.map((a) => a.slug)).toEqual(["a", "b"]);
  });
});

describe("articleBlocks", () => {
  it("splits paragraphs on any run of newlines", () => {
    expect(articleBlocks("one\ntwo\n\n\nthree")).toEqual([
      { kind: "paragraph", text: "one" },
      { kind: "paragraph", text: "two" },
      { kind: "paragraph", text: "three" },
    ]);
  });

  it("reads a leading ## as a heading", () => {
    expect(articleBlocks("## The heading\nA paragraph.")).toEqual([
      { kind: "heading", text: "The heading" },
      { kind: "paragraph", text: "A paragraph." },
    ]);
  });

  it("does not treat a mid-line ## as a heading", () => {
    expect(articleBlocks("not ## a heading")).toEqual([
      { kind: "paragraph", text: "not ## a heading" },
    ]);
  });

  it("drops an empty heading rather than rendering a blank one", () => {
    expect(articleBlocks("## \nreal")).toEqual([{ kind: "paragraph", text: "real" }]);
  });

  it("returns nothing for an empty body", () => {
    expect(articleBlocks("   ")).toEqual([]);
  });
});

describe("articleDateLabel", () => {
  it("writes the date the British way round", () => {
    expect(articleDateLabel(Date.UTC(2026, 7, 26))).toBe("26 August 2026");
  });

  it("says nothing for an article with no date", () => {
    expect(articleDateLabel(null)).toBe("");
  });
});
