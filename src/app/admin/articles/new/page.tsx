import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin/articles">&larr; Blog</Link>
        </p>
        <h1 className="display">New article</h1>
        <ArticleForm mode={{ kind: "create" }} />
      </div>
    </main>
  );
}
