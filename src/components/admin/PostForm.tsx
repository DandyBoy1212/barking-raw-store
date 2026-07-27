"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = { kind: "create" } | { kind: "edit"; id: string };

/**
 * Michaela's post form, built for her phone (spec 7.2): a title, a body, one
 * button. Same design vocabulary as the product form. A new post goes live the
 * moment it saves; the list page is where unpublishing lives.
 */
export function PostForm({ mode, initial }: { mode: Mode; initial?: { title: string; body: string } }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const url = mode.kind === "create" ? "/api/admin/posts" : `/api/admin/posts/${mode.id}`;
    const method = mode.kind === "create" ? "POST" : "PUT";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (data.ok) router.push("/admin/posts");
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
        <p className="panel__title">The post</p>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </label>
        <label className="field">
          <span>Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={12} />
          <span className="field__hint">
            Plain text. A new line starts a new paragraph, exactly as it reads here.
          </span>
        </label>
      </div>

      <button className="btn btn--solid-ink" disabled={busy} type="submit">
        {busy
          ? "Saving..."
          : mode.kind === "create"
            ? "Publish to the members area"
            : "Save changes"}
      </button>
    </form>
  );
}
