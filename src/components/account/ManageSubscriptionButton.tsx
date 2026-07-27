"use client";

import { useState } from "react";

/**
 * Hands the customer to Stripe's billing portal, where pausing, cancelling and
 * card changes are Stripe's problem, not ours. Rendered only when the account
 * has a Stripe customer id, so the happy path is the only path.
 */
export default function ManageSubscriptionButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/billing-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not available just now.");
      if (data.url) window.location.href = data.url;
      else throw new Error("Not available just now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn--solid-ink" onClick={openPortal} disabled={busy}>
        {busy ? "One moment…" : "Manage your repeating order"}
      </button>
      {error && (
        <p className="notice" style={{ color: "#b00", marginTop: "0.6rem" }}>
          {error}
        </p>
      )}
    </>
  );
}
