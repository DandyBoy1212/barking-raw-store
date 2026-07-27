import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listPosts } from "@/lib/posts-store";
import { postFreshMs, postSnippet, type Post } from "@/lib/posts";
import { PublishToggle } from "@/components/admin/PublishToggle";

export const dynamic = "force-dynamic";

function when(p: Post): string {
  const ms = postFreshMs(p);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminPostsPage() {
  await requireStaff();
  const posts = await listPosts();
  const cell = { padding: "0.5rem 0.6rem", verticalAlign: "top" as const };

  return (
    <main className="band band--paper">
      <div className="wrap">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin">&larr; Admin</Link>
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="display">Posts</h1>
          <Link className="btn btn--solid-ink" href="/admin/posts/new">
            New post
          </Link>
        </div>

        {posts.length === 0 ? (
          <p className="notice" style={{ marginTop: "1.5rem" }}>
            No posts yet. Write the first one and it appears in the members area the moment
            it saves. A handful banked before launch means the page is never empty.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={cell}>Title</th>
                  <th style={cell}>Date</th>
                  <th style={cell}>Shows as</th>
                  <th style={cell}></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid #ddd" }}>
                    <td style={cell}>
                      <b>{p.title}</b>
                      <div style={{ fontSize: "0.85rem", opacity: 0.65 }}>{postSnippet(p.body, 90)}</div>
                    </td>
                    <td style={cell}>{when(p)}</td>
                    <td style={cell}>{p.published ? "Live in the members area" : "Unpublished"}</td>
                    <td style={cell}>
                      <Link href={`/admin/posts/${p.id}`}>Edit</Link>
                      <span style={{ margin: "0 0.5rem", opacity: 0.4 }}>|</span>
                      <PublishToggle id={p.id} published={p.published} />
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
