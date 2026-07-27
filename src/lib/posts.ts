// Pure post logic: no Firestore, no next/server, no node built-ins, so it is
// trivially unit-testable and safe to import from any component (mirrors
// subscribers.ts). The vocabulary for Michaela's members area posts, spec 7.2:
// title and body, plain and simple, written from her phone.

export type Post = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  createdAtMs: number | null;
  publishedAtMs: number | null;
};

export type PostInput = { title: string; body: string };

export const POST_TITLE_MAX = 120;
export const POST_BODY_MAX = 20000;

/** Validate what the admin form submits. Errors are sentences she can act on. */
export function validatePostInput(
  input: Record<string, unknown>,
): { ok: true; value: PostInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title) errors.push("Give the post a title.");
  else if (title.length > POST_TITLE_MAX) errors.push("Keep the title under 120 characters.");
  if (!body) errors.push("Write something in the body.");
  else if (body.length > POST_BODY_MAX) errors.push("That post is too long to save in one go.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { title, body } };
}

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Map a Firestore doc to a post, tolerating every shape ever written. */
export function docToPost(id: string, data: Record<string, unknown>): Post {
  return {
    id,
    title: String(data.title ?? ""),
    body: String(data.body ?? ""),
    // Strictly === true, because Firestore will store a string and "false" is truthy.
    published: data.published === true,
    createdAtMs: toMillis(data.createdAt),
    publishedAtMs: toMillis(data.publishedAt),
  };
}

/**
 * When the post last became visible: publish time, else creation time. This is
 * what "newest first" and "new this week" both mean, so a republished post
 * surfaces again rather than staying buried at its original date.
 */
export function postFreshMs(p: Post): number | null {
  return p.publishedAtMs ?? p.createdAtMs;
}

/** Newest first; a post with no date at all sinks to the bottom. Does not mutate. */
export function sortNewestFirst(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => (postFreshMs(b) ?? -Infinity) - (postFreshMs(a) ?? -Infinity));
}

/**
 * Paragraphs for rendering: any run of newlines is a break, because a phone
 * keyboard gives one return between paragraphs as often as two. No rich text
 * in v1 (spec 7.5), so this is the whole formatting model.
 */
export function postParagraphs(body: string): string[] {
  return body
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The first paragraph, truncated for the digest email. Plain dots, never an em dash. */
export function postSnippet(body: string, max = 200): string {
  const first = postParagraphs(body)[0] ?? "";
  return first.length > max ? `${first.slice(0, max)}...` : first;
}
