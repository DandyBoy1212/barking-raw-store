// The public blog's vocabulary. Deliberately separate from posts.ts, which is
// the members feed Michaela writes from her phone: that stays short, private and
// unindexed, and this is a public page that has to earn a search result.
//
// Everything here is pure: no Firestore, no next/server, no React, so the module
// is trivially unit-testable (mirrors posts.ts and product-admin.ts).

export type Article = {
  /** The URL. Stable once published, because changing it breaks every link to it. */
  slug: string;
  title: string;
  /** The one line under the title, and the search result's description. */
  standfirst: string;
  body: string;
  /** Optional hero photo: a path under /public, or a storage URL. */
  image?: string;
  published: boolean;
  createdAtMs: number | null;
  publishedAtMs: number | null;
};

export type ArticleInput = {
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  image?: string;
};

export const ARTICLE_TITLE_MAX = 120;
/** Long enough to say something, short enough that Google will not truncate it. */
export const ARTICLE_STANDFIRST_MAX = 200;
export const ARTICLE_BODY_MAX = 60000;

/** The URL form of a title. Same rules as the product slug, so the site has one idea of a slug. */
export function slugifyArticle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validate what the editor submits. Errors are sentences Michaela can act on,
 * matching validatePostInput and validateProductInput.
 *
 * The slug is derived from the title when she leaves it blank, which is what
 * she will do every time, but it stays editable: a published article's slug must
 * survive a retitle, because the links to it will not.
 */
export function validateArticleInput(
  input: Record<string, unknown>,
): { ok: true; value: ArticleInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const title = String(input.title ?? "").trim();
  const standfirst = String(input.standfirst ?? "").trim();
  const body = String(input.body ?? "").trim();
  const rawImage = String(input.image ?? "").trim();
  const slug = slugifyArticle(String(input.slug ?? "").trim() || title);

  if (!title) errors.push("Give the article a title.");
  else if (title.length > ARTICLE_TITLE_MAX)
    errors.push(`Keep the title under ${ARTICLE_TITLE_MAX} characters.`);

  if (!standfirst) errors.push("Write the one line that sits under the title.");
  else if (standfirst.length > ARTICLE_STANDFIRST_MAX)
    errors.push(`Keep that line under ${ARTICLE_STANDFIRST_MAX} characters, or Google will cut it off.`);

  if (!body) errors.push("Write something in the body.");
  else if (body.length > ARTICLE_BODY_MAX)
    errors.push("That article is too long to save in one go.");

  // A title of nothing but punctuation slugifies to an empty string, which would
  // claim the /blog index itself as its URL.
  if (title && !slug) errors.push("That title has no letters or numbers to make a web address from.");

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { slug, title, standfirst, body, image: rawImage || undefined } };
}

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Map a Firestore doc to an article, tolerating every shape ever written. */
export function docToArticle(id: string, data: Record<string, unknown>): Article {
  return {
    slug: id,
    title: String(data.title ?? ""),
    standfirst: String(data.standfirst ?? ""),
    body: String(data.body ?? ""),
    image: data.image ? String(data.image) : undefined,
    // Strictly === true, because Firestore will store a string and "false" is truthy.
    published: data.published === true,
    createdAtMs: toMillis(data.createdAt),
    publishedAtMs: toMillis(data.publishedAt),
  };
}

/** When the article last became visible: publish time, else creation time. */
export function articleFreshMs(a: Article): number | null {
  return a.publishedAtMs ?? a.createdAtMs;
}

/** Newest first; an article with no date at all sinks to the bottom. Does not mutate. */
export function sortArticlesNewestFirst(articles: Article[]): Article[] {
  return [...articles].sort(
    (a, b) => (articleFreshMs(b) ?? -Infinity) - (articleFreshMs(a) ?? -Infinity),
  );
}

/**
 * The blog's formatting model, one step richer than the members feed because a
 * public article needs subheadings to be readable at length.
 *
 * A line starting "## " is a heading. Everything else is a paragraph. Any run of
 * newlines is a break, because a phone keyboard gives one return between
 * paragraphs as often as two.
 */
export type ArticleBlock = { kind: "heading" | "paragraph"; text: string };

export function articleBlocks(body: string): ArticleBlock[] {
  return body
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      // "##" with nothing after it counts too, because the trim above has
      // already eaten the space that would otherwise mark it as a heading.
      line === "##" || line.startsWith("## ")
        ? { kind: "heading" as const, text: line.slice(2).trim() }
        : { kind: "paragraph" as const, text: line },
    )
    .filter((b) => b.text.length > 0);
}

/** The date under the title. British order, because the readers are British. */
export function articleDateLabel(ms: number | null): string {
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
