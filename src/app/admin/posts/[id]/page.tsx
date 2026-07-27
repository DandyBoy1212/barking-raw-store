import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPostById } from "@/lib/posts-store";
import { PostForm } from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <Link href="/admin/posts" style={{ textDecoration: "underline" }}>
          &larr; Back to posts
        </Link>
        <h1 className="display">Edit: {post.title}</h1>
        {!post.published && (
          <p className="notice">This post is unpublished. Saving keeps it unpublished; the list page is where it comes back.</p>
        )}
        <PostForm mode={{ kind: "edit", id }} initial={{ title: post.title, body: post.body }} />
      </div>
    </main>
  );
}
