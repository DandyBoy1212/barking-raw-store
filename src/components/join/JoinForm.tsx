"use client";

import { useCallback, useEffect, useState } from "react";
import type { StallRecord } from "@/lib/stall-record";

type DraftDog = { name: string; breed: string };

type Draft = {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  dogs: DraftDog[];
  marketing: boolean;
  photoConsent: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  postcode: "",
  dogs: [{ name: "", breed: "" }],
  marketing: false,
  photoConsent: false,
};

const MAX_DOGS = 10;
const PENDING_KEY = "br-join-pending";

type Status = "editing" | "sending" | "waiting" | "done";

/**
 * The record a refresh mid-outage picks straight back up. Read in the state
 * initialisers (not an effect, the CartProvider lint lesson): during server
 * rendering there is no window, so the server always renders the blank form.
 */
function readPending(): StallRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as StallRecord;
    return record && typeof record === "object" && record.clientId ? record : null;
  } catch {
    return null;
  }
}

/**
 * The QR self-serve signup, spec 10.1: one page for the customer's own phone,
 * typed from the poster. Same record vocabulary as the stall form, no photos
 * (those are the iPad's flow). The record persists in localStorage from the
 * first submit with a clientId that never changes, so a refresh loses nothing
 * and every retry is idempotent against the server's marker.
 */
export default function JoinForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, setPending] = useState<StallRecord | null>(() => readPending());
  const [status, setStatus] = useState<Status>(() => (readPending() ? "waiting" : "editing"));
  const [errors, setErrors] = useState<string[]>([]);

  const send = useCallback(async (record: StallRecord) => {
    setStatus("sending");
    setErrors([]);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        setPending(null);
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // Nothing personal survives a success only if this works; best effort.
        }
        setStatus("done");
        return;
      }
      if (res.status === 400) {
        const data = (await res.json().catch(() => null)) as { errors?: string[] } | null;
        setErrors(data?.errors ?? ["That did not save. Check it over and try again."]);
        setPending(null);
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // Ignore: an editing state replaces the pending record anyway.
        }
        setStatus("editing");
        return;
      }
      // 429, 503 and friends: keep the record and wait.
      setStatus("waiting");
    } catch {
      setStatus("waiting");
    }
  }, []);

  // When signal returns, the pending record goes by itself.
  useEffect(() => {
    const onOnline = () => {
      if (pending && status === "waiting") void send(pending);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [pending, status, send]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Keep the clientId across retries: it is the idempotency key.
    const record: StallRecord = {
      clientId: pending?.clientId ?? crypto.randomUUID(),
      capturedAt: pending?.capturedAt ?? new Date().toISOString(),
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      address: {
        line1: draft.line1.trim(),
        line2: draft.line2.trim(),
        city: draft.city.trim(),
        postcode: draft.postcode.trim().toUpperCase(),
      },
      dogs: draft.dogs
        .filter((d) => d.name.trim())
        .slice(0, MAX_DOGS)
        .map((d) => ({
          value: {
            name: d.name.trim(),
            ...(d.breed.trim() ? { breed: d.breed.trim() } : {}),
          },
        })),
      consent: { marketing: draft.marketing, photo: draft.photoConsent },
    };
    setPending(record);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(record));
    } catch {
      // No storage is no reason not to try the network.
    }
    void send(record);
  }

  const input = { fontSize: "1.1rem", padding: "0.75rem" } as const;

  if (status === "done") {
    return (
      <div className="panel">
        <p className="panel__title">You are in</p>
        <p>
          Lovely to meet you at the stall. If you gave an email, your sign-in link is on
          its way; it lands you on your account with your dog already there.
        </p>
      </div>
    );
  }

  if (status === "waiting" || status === "sending") {
    return (
      <div className="panel">
        <p className="panel__title">
          {status === "sending" ? "Sending..." : "No signal just now"}
        </p>
        {status === "waiting" && (
          <>
            <p style={{ marginBottom: "1.2rem" }}>
              Your signup is saved on this phone. It will go by itself the moment you are
              back online, or tap retry whenever you like. Closing this page before then
              loses it.
            </p>
            <button
              className="btn btn--solid-ink btn--block"
              type="button"
              style={{ fontSize: "1.1rem", padding: "1rem" }}
              onClick={() => pending && void send(pending)}
            >
              Retry now
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <p className="panel__title">Join at the stall</p>
      {errors.length > 0 && (
        <p className="form-error" role="alert">
          {errors.join(" ")}
        </p>
      )}
      <label className="field">
        <span>Your name</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={input}
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          inputMode="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          style={input}
        />
        <span className="field__hint">
          How your account reaches you. Without it there is no sign-in and no welcome
          email, but you can still join.
        </span>
      </label>
      <label className="field">
        <span>Phone (optional)</span>
        <input
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          style={input}
        />
      </label>
      <label className="field">
        <span>First line of your address (optional)</span>
        <input
          value={draft.line1}
          onChange={(e) => setDraft({ ...draft, line1: e.target.value })}
          style={input}
        />
      </label>
      <label className="field">
        <span>Second line (optional)</span>
        <input
          value={draft.line2}
          onChange={(e) => setDraft({ ...draft, line2: e.target.value })}
          style={input}
        />
      </label>
      <div className="form-grid form-grid--2">
        <label className="field">
          <span>Town or city (optional)</span>
          <input
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            style={input}
          />
        </label>
        <label className="field">
          <span>Postcode (optional)</span>
          <input
            autoCapitalize="characters"
            value={draft.postcode}
            onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
            style={input}
          />
        </label>
      </div>

      {draft.dogs.map((dog, i) => (
        <div className="form-grid form-grid--2" key={i}>
          <label className="field">
            <span>{i === 0 ? "Your dog's name" : "Another dog's name"}</span>
            <input
              value={dog.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  dogs: draft.dogs.map((d, at) => (at === i ? { ...d, name: e.target.value } : d)),
                })
              }
              style={input}
            />
          </label>
          <label className="field">
            <span>Breed (optional)</span>
            <input
              value={dog.breed}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  dogs: draft.dogs.map((d, at) => (at === i ? { ...d, breed: e.target.value } : d)),
                })
              }
              style={input}
            />
          </label>
        </div>
      ))}
      {draft.dogs.length < MAX_DOGS && (
        <p>
          <button
            className="btn"
            type="button"
            onClick={() => setDraft({ ...draft, dogs: [...draft.dogs, { name: "", breed: "" }] })}
          >
            Add another dog
          </button>
        </p>
      )}

      <p style={{ margin: "1.2rem 0 0.6rem" }}>
        Both of these are yours to tick, or not. Nothing is ticked unless you tick it.
      </p>
      <div className="chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button
          type="button"
          className="chip"
          style={{ fontSize: "1rem", padding: "1rem", textAlign: "left" }}
          aria-pressed={draft.marketing}
          onClick={() => setDraft((d) => ({ ...d, marketing: !d.marketing }))}
        >
          Email me the new stuff and the member offers. Unsubscribe any time.
        </button>
        <button
          type="button"
          className="chip"
          style={{ fontSize: "1rem", padding: "1rem", textAlign: "left" }}
          aria-pressed={draft.photoConsent}
          onClick={() => setDraft((d) => ({ ...d, photoConsent: !d.photoConsent }))}
        >
          You can share my dog&apos;s photo on Dogs of the Day.
        </button>
      </div>

      <p style={{ marginTop: "1.4rem" }}>
        <button
          className="btn btn--solid-ink btn--block"
          type="submit"
          style={{ fontSize: "1.15rem", padding: "1rem" }}
        >
          Join
        </button>
      </p>
    </form>
  );
}
