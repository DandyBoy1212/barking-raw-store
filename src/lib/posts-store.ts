import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { docToPost, sortNewestFirst, type Post, type PostInput } from "@/lib/posts";

// Firestore access for Michaela's posts, mirroring customers-store.ts: server
// only, null-safe when the db is not configured, and read errors degrade to
// empty rather than a broken page. The collection stays small (a post a week),
// so sorting happens in code and no composite index is ever needed.

/** Every post, newest first, for the admin list. */
export async function listPosts(): Promise<Post[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(COLLECTIONS.posts).get();
    return sortNewestFirst(snap.docs.map((d) => docToPost(d.id, d.data() as Record<string, unknown>)));
  } catch (err) {
    console.error("[posts-store] listPosts read failed:", err);
    return [];
  }
}

/** What members see: published posts only, newest first. */
export async function listPublishedPosts(): Promise<Post[]> {
  return (await listPosts()).filter((p) => p.published);
}

/** One post by id, or null. */
export async function getPostById(id: string): Promise<Post | null> {
  const db = getDb();
  if (!db || !id) return null;
  try {
    const doc = await db.collection(COLLECTIONS.posts).doc(id).get();
    if (!doc.exists) return null;
    return docToPost(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.error("[posts-store] getPostById read failed:", err);
    return null;
  }
}

/**
 * Create a post, published immediately. Spec 7.2's flow is title, body,
 * publish, from a phone; a separate draft step would be an extra tap. The
 * unpublish toggle is the undo. Returns the new id, or null when the write failed.
 */
export async function createPost(input: PostInput): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const ref = await db.collection(COLLECTIONS.posts).add({
      title: input.title,
      body: input.body,
      published: true,
      createdAt: FieldValue.serverTimestamp(),
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    console.error("[posts-store] createPost failed:", err);
    return null;
  }
}

/** Rewrite a post's title and body. True when the write went through. */
export async function updatePost(id: string, input: PostInput): Promise<boolean> {
  const db = getDb();
  if (!db || !id) return false;
  try {
    await db.collection(COLLECTIONS.posts).doc(id).set(
      { title: input.title, body: input.body, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("[posts-store] updatePost failed:", err);
    return false;
  }
}

/**
 * Unpublish or republish, never delete. Republishing refreshes publishedAt on
 * purpose: the post surfaces at the top of the members page again and counts
 * as news for that week's digest, which is what bringing a post back means.
 */
export async function setPostPublished(id: string, published: boolean): Promise<boolean> {
  const db = getDb();
  if (!db || !id) return false;
  try {
    await db.collection(COLLECTIONS.posts).doc(id).set(
      {
        published,
        ...(published ? { publishedAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error("[posts-store] setPostPublished failed:", err);
    return false;
  }
}
