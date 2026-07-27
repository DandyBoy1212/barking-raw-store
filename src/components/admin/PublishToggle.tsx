"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Unpublish or republish a post, mirroring ArchiveToggle: errors are shown
 * rather than swallowed, because a toggle that silently does nothing is worse
 * than one that says it failed. There is no delete on purpose (spec 7.2).
 */
export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/posts/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (data.ok) router.refresh();
      else setError(data.errors?.[0] || "That did not work.");
    } catch {
      setError("That did not work. You may need to sign in again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textDecoration: "underline",
          color: published ? "#a00" : "inherit",
        }}
      >
        {busy ? "Working..." : published ? "Unpublish" : "Publish"}
      </button>
      {error && <div style={{ color: "#a00", fontSize: "0.8rem" }}>{error}</div>}
    </>
  );
}
