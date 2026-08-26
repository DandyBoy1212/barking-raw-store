import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  docToArticle,
  sortArticlesNewestFirst,
  type Article,
  type ArticleInput,
} from "@/lib/articles";

// Firestore access for the public blog, mirroring posts-store.ts: server only,
// null-safe when the db is not configured, and read errors degrade to empty
// rather than a broken page. The collection stays small, so sorting happens in
// code and no composite index is ever needed.
//
// The slug is the document id. That makes a duplicate slug impossible by
// construction rather than by a uniqueness check that races, and it means
// reading an article by its URL is one get rather than a query.

/** Every article, newest first, for the admin list. */
export async function listArticles(): Promise<Article[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTIONS.articles).get();
    return sortArticlesNewestFirst(
      snap.docs.map((d) => docToArticle(d.id, d.data() as Record<string, unknown>)),
    );
  } catch (err) {
    console.error("[articles-store] listArticles read failed:", err);
    return [];
  }
}

/** What the public sees: published articles only, newest first. */
export async function listPublishedArticles(): Promise<Article[]> {
  return (await listArticles()).filter((a) => a.published);
}

/** One article by slug, or null. */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const db = getDb();
  if (!db || !slug) return null;
  try {
    const doc = await db.collection(COLLECTIONS.articles).doc(slug).get();
    if (!doc.exists) return null;
    return docToArticle(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.error("[articles-store] getArticleBySlug read failed:", err);
    return null;
  }
}

/**
 * Create an article as a draft.
 *
 * Unlike a members post, which publishes on save because it is a note from a
 * phone, a blog article is a piece of writing that gets a second read before the
 * world sees it. Returns "exists" when the slug is taken, so the editor can say
 * so rather than silently overwriting somebody's published article.
 */
export async function createArticle(
  input: ArticleInput,
): Promise<{ ok: true } | { ok: false; reason: "exists" | "failed" }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "failed" };
  try {
    const ref = db.collection(COLLECTIONS.articles).doc(input.slug);
    if ((await ref.get()).exists) return { ok: false, reason: "exists" };
    await ref.set({
      title: input.title,
      standfirst: input.standfirst,
      body: input.body,
      ...(input.image ? { image: input.image } : {}),
      published: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    console.error("[articles-store] createArticle failed:", err);
    return { ok: false, reason: "failed" };
  }
}

/**
 * Rewrite an article in place. The slug is the document id and is therefore not
 * editable here: changing it would break every link to a published piece, so a
 * new address means a new article.
 */
export async function updateArticle(slug: string, input: ArticleInput): Promise<boolean> {
  const db = getDb();
  if (!db || !slug) return false;
  try {
    await db
      .collection(COLLECTIONS.articles)
      .doc(slug)
      .set(
        {
          title: input.title,
          standfirst: input.standfirst,
          body: input.body,
          ...(input.image ? { image: input.image } : { image: FieldValue.delete() }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return true;
  } catch (err) {
    console.error("[articles-store] updateArticle failed:", err);
    return false;
  }
}

/**
 * Publish or unpublish, never delete. Republishing refreshes publishedAt on
 * purpose, so a piece brought back surfaces at the top of the blog again.
 */
export async function setArticlePublished(slug: string, published: boolean): Promise<boolean> {
  const db = getDb();
  if (!db || !slug) return false;
  try {
    await db
      .collection(COLLECTIONS.articles)
      .doc(slug)
      .set(
        {
          published,
          ...(published ? { publishedAt: FieldValue.serverTimestamp() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return true;
  } catch (err) {
    console.error("[articles-store] setArticlePublished failed:", err);
    return false;
  }
}
