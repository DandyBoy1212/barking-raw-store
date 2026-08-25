import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getArticleBySlug } from "@/lib/articles-store";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireStaff();
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <main className="band band--paper">
      <div className="wrap">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin/articles">&larr; Blog</Link>
        </p>
        <h1 className="display">Edit article</h1>
        <p style={{ opacity: 0.7 }}>
          {article.published ? (
            <>
              Live at <Link href={`/blog/${article.slug}`}>/blog/{article.slug}</Link>
            </>
          ) : (
            <>Draft. It will live at /blog/{article.slug} once published.</>
          )}
        </p>
        <ArticleForm mode={{ kind: "edit", slug: article.slug }} initial={article} />
      </div>
    </main>
  );
}
