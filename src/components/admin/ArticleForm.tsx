"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ARTICLE_STANDFIRST_MAX,
  ARTICLE_TITLE_MAX,
  slugifyArticle,
  type Article,
} from "@/lib/articles";

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

/**
 * The blog editor.
 *
 * Richer than the members post form on purpose: a public article needs a
 * standfirst that doubles as its search description, a hero photo, and
 * subheadings. It stays plain text with one convention rather than a rich text
 * editor, because a formatting toolbar is a whole extra thing to maintain and
 * "## " is a rule you can explain in a sentence.
 */
export function ArticleForm({ mode, initial }: { mode: Mode; initial?: Article }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [standfirst, setStandfirst] = useState(initial?.standfirst ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // What the address will be if she leaves the slug box alone. Shown live so the
  // URL is never a surprise after publishing.
  const effectiveSlug = mode.kind === "edit" ? mode.slug : slug.trim() || slugifyArticle(title);

  async function uploadHero(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/image", { method: "POST", body: fd });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (!data.ok) {
        setErrors([data.error || "Photo upload failed."]);
        return;
      }
      setImage(data.url as string);
    } catch {
      setErrors(["Photo upload failed. You may need to sign in again."]);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const payload = { title, standfirst, body, image, slug: effectiveSlug };
    const url =
      mode.kind === "create" ? "/api/admin/articles" : `/api/admin/articles/${mode.slug}`;
    const method = mode.kind === "create" ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (data.ok) router.push("/admin/articles");
      else setErrors(data.errors || ["Save failed."]);
    } catch {
      setErrors(["Save failed. You may need to sign in again."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 720 }}>
      {errors.length > 0 && (
        <div className="form-error" role="alert" style={{ marginBottom: "1.3rem" }}>
          {errors.map((er) => (
            <p key={er}>{er}</p>
          ))}
        </div>
      )}

      <div className="panel">
        <p className="panel__title">The article</p>
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={ARTICLE_TITLE_MAX}
            required
          />
        </label>
        <label className="field">
          <span>The line under the title</span>
          <input
            value={standfirst}
            onChange={(e) => setStandfirst(e.target.value)}
            maxLength={ARTICLE_STANDFIRST_MAX}
            required
          />
          <span className="field__hint">
            This is also what Google shows under the link, so make it a reason to click.{" "}
            {ARTICLE_STANDFIRST_MAX - standfirst.length} characters left.
          </span>
        </label>
        <label className="field">
          <span>Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} required />
          <span className="field__hint">
            One blank line between paragraphs. Start a line with ## to make it a subheading.
          </span>
        </label>
      </div>

      <div className="panel">
        <p className="panel__title">Where it lives</p>
        <label className="field">
          <span>Web address</span>
          <input
            value={mode.kind === "edit" ? mode.slug : slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={mode.kind === "edit"}
            placeholder={slugifyArticle(title) || "made-from-the-title"}
          />
          <span className="field__hint">
            {mode.kind === "edit"
              ? "The address cannot change once an article exists, because every link to it would break. A new address means a new article."
              : `It will live at /blog/${effectiveSlug || "..."}. Leave this blank to make it from the title.`}
          </span>
        </label>
      </div>

      <div className="panel">
        <p className="panel__title">Photo</p>
        {image ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              style={{ maxWidth: 260, height: "auto", borderRadius: 8, display: "block" }}
            />
            <button
              type="button"
              className="btn"
              style={{ marginTop: "0.6rem" }}
              onClick={() => setImage("")}
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label className="field">
            <span>Add a photo</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadHero(file);
              }}
            />
            <span className="field__hint">
              Optional. It sits under the title and is what gets shown when the article is shared.
            </span>
          </label>
        )}
      </div>

      <button className="btn btn--solid-ink" type="submit" disabled={busy || uploading}>
        {busy ? "Saving..." : mode.kind === "create" ? "Save as draft" : "Save changes"}
      </button>
      {mode.kind === "create" && (
        <p className="field__hint" style={{ marginTop: "0.6rem" }}>
          It saves unpublished. Read it back on the list, then publish it when you are happy.
        </p>
      )}
    </form>
  );
}
