"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      window.localStorage.setItem("br_signin_email", email.trim().toLowerCase());
      await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 460 }}>
        <h1 className="display">Sign in</h1>
        {sent ? (
          <p>Check your email for a sign-in link. You can close this tab.</p>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ display: "block", width: "100%", padding: "0.7rem", marginTop: "0.3rem" }}
              />
            </label>
            <button className="btn btn--solid-ink" disabled={busy} type="submit">
              {busy ? "Sending..." : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
