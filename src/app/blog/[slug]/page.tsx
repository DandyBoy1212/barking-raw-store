import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleBlocks, articleDateLabel, articleFreshMs } from "@/lib/articles";
import { getArticleBySlug } from "@/lib/articles-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published) return {};
  return {
    title: `${article.title} | Barking Raw`,
    description: article.standfirst,
    openGraph: {
      title: article.title,
      description: article.standfirst,
      type: "article",
      ...(article.image ? { images: [article.image] } : {}),
    },
  };
}

/**
 * One article. A draft 404s rather than rendering, because "unpublished" has to
 * mean the same thing to a person with the link as it does to the blog index.
 */
export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article || !article.published) notFound();

  const blocks = articleBlocks(article.body);

  return (
    <main className="band band--paper">
      <article className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">
          <Link href="/blog">Blog</Link>
        </p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>
          {article.title}
        </h1>
        <p style={{ fontSize: "1.15rem", marginTop: "1rem" }}>{article.standfirst}</p>
        <p style={{ margin: "0.6rem 0 0", opacity: 0.65, fontSize: "0.85rem" }}>
          {articleDateLabel(articleFreshMs(article))}
        </p>

        {article.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt=""
            style={{ width: "100%", height: "auto", borderRadius: 10, margin: "1.8rem 0" }}
          />
        )}

        <div style={{ marginTop: article.image ? 0 : "1.8rem" }}>
          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <h2 key={i} style={{ marginTop: "2rem" }}>
                {b.text}
              </h2>
            ) : (
              <p key={i} style={{ marginTop: "1rem" }}>
                {b.text}
              </p>
            ),
          )}
        </div>

        <p style={{ marginTop: "2.4rem" }}>
          <Link className="btn btn--solid-ink" href="/shop">
            Have a look round the shop
          </Link>
        </p>
      </article>
    </main>
  );
}
