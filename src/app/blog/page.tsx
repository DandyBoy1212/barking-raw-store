import type { Metadata } from "next";
import Link from "next/link";
import { articleDateLabel, articleFreshMs } from "@/lib/articles";
import { listPublishedArticles } from "@/lib/articles-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Barking Raw",
  description:
    "Reading dog food labels, choosing chews, and what we learn running a small natural dog treat shop in Dundee.",
};

/** The blog index. Published articles only, newest first. */
export default async function BlogIndexPage() {
  const articles = await listPublishedArticles();

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="eyebrow">Reading</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          The blog
        </h1>

        {articles.length === 0 ? (
          <p className="notice" style={{ marginTop: "1.6rem" }}>
            Nothing published just yet. Michaela is writing.
          </p>
        ) : (
          <div style={{ marginTop: "2rem", display: "grid", gap: "2rem" }}>
            {articles.map((a) => (
              <article key={a.slug}>
                <h2 style={{ margin: 0 }}>
                  <Link href={`/blog/${a.slug}`}>{a.title}</Link>
                </h2>
                <p style={{ margin: "0.4rem 0 0", opacity: 0.65, fontSize: "0.85rem" }}>
                  {articleDateLabel(articleFreshMs(a))}
                </p>
                <p style={{ marginTop: "0.5rem" }}>{a.standfirst}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
