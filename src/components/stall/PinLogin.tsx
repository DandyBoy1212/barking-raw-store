"use client";

import { useState } from "react";

/**
 * The stall day gate. The PIN goes to the server and never lives in this bundle;
 * on success the server sets the scoped stall cookie and a reload renders the form.
 */
export default function PinLogin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stall/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That PIN is not right.");
        return;
      }
      window.location.reload();
    } catch {
      setError("No connection. The PIN check needs signal, so try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} style={{ maxWidth: 420, margin: "0 auto" }}>
      <p className="panel__title">Stall day PIN</p>
      <label className="field">
        <span>Enter the PIN to open the signup form</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ fontSize: "1.6rem", textAlign: "center", letterSpacing: "0.4em" }}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p style={{ marginTop: "1.2rem" }}>
        <button
          className="btn btn--solid-ink btn--block"
          type="submit"
          disabled={busy || !pin}
          style={{ fontSize: "1.1rem", padding: "1rem" }}
        >
          {busy ? "Checking..." : "Open the form"}
        </button>
      </p>
    </form>
  );
}
