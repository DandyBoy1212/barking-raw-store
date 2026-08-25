import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listArticles } from "@/lib/articles-store";
import { articleDateLabel, articleFreshMs } from "@/lib/articles";
import { ArticlePublishToggle } from "@/components/admin/ArticlePublishToggle";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  await requireStaff();
  const articles = await listArticles();
  const cell = { padding: "0.5rem 0.6rem", verticalAlign: "top" as const };

  return (
    <main className="band band--paper">
      <div className="wrap">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin">&larr; Admin</Link>
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="display">Blog</h1>
          <Link className="btn btn--solid-ink" href="/admin/articles/new">
            New article
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="notice" style={{ marginTop: "1.5rem" }}>
            Nothing written yet. An article saves as a draft, so you can write it, read it back,
            and publish it when you are happy with it.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={cell}>Title</th>
                  <th style={cell}>Address</th>
                  <th style={cell}>Date</th>
                  <th style={cell}>Shows as</th>
                  <th style={cell}></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.slug} style={{ borderTop: "1px solid #ddd" }}>
                    <td style={cell}>
                      <b>{a.title}</b>
                      <div style={{ fontSize: "0.85rem", opacity: 0.65 }}>{a.standfirst}</div>
                    </td>
                    <td style={cell}>
                      <code style={{ fontSize: "0.8rem" }}>/blog/{a.slug}</code>
                    </td>
                    <td style={cell}>{articleDateLabel(articleFreshMs(a))}</td>
                    <td style={cell}>{a.published ? "Live on the blog" : "Draft"}</td>
                    <td style={cell}>
                      <Link href={`/admin/articles/${a.slug}`}>Edit</Link>
                      <span style={{ margin: "0 0.5rem", opacity: 0.4 }}>|</span>
                      <ArticlePublishToggle slug={a.slug} published={a.published} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
