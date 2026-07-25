"use client";

import { useState } from "react";
import { CONSENT_TEXT, type CaptureSource } from "@/lib/subscribers";

/**
 * The email capture form (spec section 5). One list behind it; the source prop
 * tags where the contact came from so the follow up matches the offer they saw.
 * The consent box starts UNTICKED and its wording comes from CONSENT_TEXT, the
 * same constant the server stores, so the label and the record cannot drift.
 * Signing up here does not grant membership (spec 10.1).
 */
export function EmailCapture(props: { source: CaptureSource; heading: string; sub: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: props.source, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || "That did not go through. Try again in a minute.");
        setState("error");
        return;
      }
      setMessage(
        consent
          ? "Lovely. Keep an eye on your inbox."
          : "Saved. Tick the box next time if you would like the emails.",
      );
      setState("done");
    } catch {
      setMessage("That did not go through. Try again in a minute.");
      setState("error");
    }
  }

  return (
    <section className="band band--ink">
      <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
        <h2 className="display">{props.heading}</h2>
        <p style={{ margin: "0.8rem auto 1.6rem", opacity: 0.85 }}>{props.sub}</p>
        {state === "done" ? (
          <p style={{ fontWeight: 800 }}>{message}</p>
        ) : (
          <form onSubmit={submit}>
            <div
              style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                style={{
                  flex: "1 1 220px",
                  maxWidth: 320,
                  padding: "12px 16px",
                  borderRadius: 999,
                  border: "1px solid #6b6b6b",
                  background: "#fff",
                  color: "#0b0b0b",
                }}
              />
              <button
                type="submit"
                className="btn btn--solid-paper"
                disabled={state === "busy"}
                style={{ cursor: state === "busy" ? "wait" : "pointer" }}
              >
                {state === "busy" ? "Saving..." : "Count me in"}
              </button>
            </div>
            <label
              style={{
                display: "flex",
                gap: "0.6rem",
                alignItems: "flex-start",
                justifyContent: "center",
                margin: "1rem auto 0",
                maxWidth: 420,
                fontSize: "0.85rem",
                opacity: 0.85,
                textAlign: "left",
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{CONSENT_TEXT[props.source]}</span>
            </label>
            {state === "error" && (
              <p role="alert" style={{ marginTop: "0.8rem", fontWeight: 700 }}>
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
