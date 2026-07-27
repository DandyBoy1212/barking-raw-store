"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoredBadge } from "@/data/badges";

/**
 * Michaela's badge screen.
 *
 * System badges show what they are for and offer no Rename or Retire, so she does
 * not reach for a button that will only refuse her. The API refuses them anyway,
 * because a disabled button is a hint and not a guard.
 */
export default function BadgeManager({ initial }: { initial: StoredBadge[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError((data.errors ?? ["That did not work."]).join(" "));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("That did not work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="form-error" role="alert" style={{ margin: "1.2rem 0" }}>
          {error}
        </p>
      )}

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="panel__title">Your badges</p>
        {initial.map((badge) => (
          <div key={badge.slug} className="badge-row">
            {editing === badge.slug ? (
              <>
                <label className="field" style={{ flex: 1, minWidth: 220, margin: 0 }}>
                  <span>New name for {badge.label}</span>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} />
                </label>
                <button
                  type="button"
                  className="linkbtn"
                  disabled={busy}
                  onClick={async () => {
                    if (await send(`/api/admin/badges/${badge.slug}`, "PATCH", { label: draft })) {
                      setEditing(null);
                    }
                  }}
                >
                  Save
                </button>
                <button type="button" className="linkbtn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="badge" style={badge.retired ? { opacity: 0.4 } : undefined}>
                  {badge.label}
                </span>
                {badge.retired && <span className="badge-row__note">retired</span>}
                {badge.system && (
                  <span className="badge-row__note">built in, matched to dog profiles</span>
                )}
                {!badge.system && (
                  <span className="badge-row__actions">
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => {
                        setEditing(badge.slug);
                        setDraft(badge.label);
                        setError("");
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="linkbtn"
                      disabled={busy}
                      onClick={() =>
                        send(`/api/admin/badges/${badge.slug}`, "DELETE", {
                          retired: !badge.retired,
                        })
                      }
                    >
                      {badge.retired ? "Put back" : "Retire"}
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/admin/badges", "POST", { label })) setLabel("");
        }}
      >
        <p className="panel__title">Add a badge</p>
        <label className="field">
          <span>What should it say?</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
          <span className="field__hint">
            Keep it short. It has to fit on a pill over a product photo.
          </span>
        </label>
        <p style={{ marginTop: "1.2rem" }}>
          <button className="btn btn--solid-ink btn--block" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add this badge"}
          </button>
        </p>
      </form>
    </>
  );
}
