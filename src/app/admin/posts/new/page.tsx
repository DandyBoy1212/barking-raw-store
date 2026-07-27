import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PostForm } from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <Link href="/admin/posts" style={{ textDecoration: "underline" }}>
          &larr; Back to posts
        </Link>
        <h1 className="display">New post</h1>
        <PostForm mode={{ kind: "create" }} />
      </div>
    </main>
  );
}
