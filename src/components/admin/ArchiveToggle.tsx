"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Archive or restore a product.
 *
 * The API route has existed since the admin was built but nothing ever called it,
 * so archiving was only possible by hitting the endpoint by hand. Errors are shown
 * rather than swallowed, matching ProductForm: a save that silently does nothing is
 * worse than one that says it failed.
 */
export function ArchiveToggle({ slug, archived }: { slug: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
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
          color: archived ? "inherit" : "#a00",
        }}
      >
        {busy ? "Working..." : archived ? "Restore" : "Archive"}
      </button>
      {error && <div style={{ color: "#a00", fontSize: "0.8rem" }}>{error}</div>}
    </>
  );
}
