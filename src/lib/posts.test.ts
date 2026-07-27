import { describe, it, expect } from "vitest";
import {
  validatePostInput,
  docToPost,
  postFreshMs,
  sortNewestFirst,
  postParagraphs,
  postSnippet,
  type Post,
} from "./posts";

const ts = (ms: number) => ({ toMillis: () => ms });

function post(overrides: Partial<Post>): Post {
  return {
    id: "p1",
    title: "T",
    body: "B",
    published: true,
    createdAtMs: null,
    publishedAtMs: null,
    ...overrides,
  };
}

describe("validatePostInput", () => {
  it("accepts a title and body, trimmed", () => {
    expect(validatePostInput({ title: "  Hello  ", body: "  First post.  " })).toEqual({
      ok: true,
      value: { title: "Hello", body: "First post." },
    });
  });

  it("refuses a missing title and a missing body, each with its own message", () => {
    const r = validatePostInput({ title: "   ", body: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });

  it("caps the title at 120 characters and the body at 20000", () => {
    expect(validatePostInput({ title: "x".repeat(121), body: "fine" }).ok).toBe(false);
    expect(validatePostInput({ title: "fine", body: "x".repeat(20001) }).ok).toBe(false);
    expect(validatePostInput({ title: "x".repeat(120), body: "x".repeat(20000) }).ok).toBe(true);
  });
});

describe("docToPost", () => {
  it("reads a full doc", () => {
    expect(
      docToPost("abc", {
        title: "Good food first",
        body: "One.\n\nTwo.",
        published: true,
        createdAt: ts(1000),
        publishedAt: ts(2000),
      }),
    ).toEqual({
      id: "abc",
      title: "Good food first",
      body: "One.\n\nTwo.",
      published: true,
      createdAtMs: 1000,
      publishedAtMs: 2000,
    });
  });

  it("survives an empty doc rather than throwing", () => {
    expect(docToPost("x", {})).toEqual({
      id: "x",
      title: "",
      body: "",
      published: false,
      createdAtMs: null,
      publishedAtMs: null,
    });
  });

  it("treats published as strictly true, because Firestore will store a string", () => {
    expect(docToPost("x", { published: "false" }).published).toBe(false);
    expect(docToPost("x", { published: 1 }).published).toBe(false);
  });
});

describe("postFreshMs and sortNewestFirst", () => {
  it("prefers publishedAt over createdAt, falling back", () => {
    expect(postFreshMs(post({ createdAtMs: 1, publishedAtMs: 9 }))).toBe(9);
    expect(postFreshMs(post({ createdAtMs: 1, publishedAtMs: null }))).toBe(1);
    expect(postFreshMs(post({}))).toBeNull();
  });

  it("sorts newest first, undated posts last, without mutating the input", () => {
    const a = post({ id: "a", createdAtMs: 100 });
    const b = post({ id: "b", publishedAtMs: 300 });
    const c = post({ id: "c" });
    const input = [a, c, b];
    expect(sortNewestFirst(input).map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(input.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });
});

describe("postParagraphs", () => {
  it("splits on newline runs and drops blank lines", () => {
    expect(postParagraphs("One.\n\nTwo.\r\n\r\n\r\nThree.")).toEqual(["One.", "Two.", "Three."]);
  });

  it("treats a single newline as a paragraph break too, since that is what a phone gives", () => {
    expect(postParagraphs("One.\nTwo.")).toEqual(["One.", "Two."]);
  });

  it("returns nothing for an empty body", () => {
    expect(postParagraphs("   ")).toEqual([]);
  });
});

describe("postSnippet", () => {
  it("is the first paragraph", () => {
    expect(postSnippet("First.\n\nSecond.")).toBe("First.");
  });

  it("truncates a long first paragraph on three dots, never an em dash", () => {
    const s = postSnippet("y".repeat(500));
    expect(s.length).toBeLessThanOrEqual(203);
    expect(s.endsWith("...")).toBe(true);
    expect(s.includes(String.fromCharCode(0x2014))).toBe(false);
  });

  it("is empty for an empty body", () => {
    expect(postSnippet("")).toBe("");
  });
});
