"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_SENSITIVITIES, SENSITIVITY_LABEL, type Sensitivity } from "@/data/customers";

/**
 * Add a dog. Deliberately plain: the real collection surface is the stall iPad form
 * in step D.1, and this exists so the model is exercised rather than assumed.
 */
export default function DogForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [bornAt, setBornAt] = useState("");
  const [sensitivities, setSensitivities] = useState<Sensitivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(s: Sensitivity) {
    setSensitivities((current) =>
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, breed, bornAt, sensitivities }),
      });
      const data = await res.json();
      // Surface the failure. The product form shipped without this and a failed save
      // looked identical to a successful one.
      if (!res.ok || !data.ok) {
        setError((data.errors ?? ["Save failed."]).join(" "));
        return;
      }
      setName("");
      setBreed("");
      setBornAt("");
      setSensitivities([]);
      router.refresh();
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: "1.5rem", display: "grid", gap: ".75rem" }}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Breed
        <input value={breed} onChange={(e) => setBreed(e.target.value)} />
      </label>
      <label>
        Roughly when was he or she born?
        <input type="date" value={bornAt} onChange={(e) => setBornAt(e.target.value)} />
      </label>
      <fieldset>
        <legend>Anything he or she struggles with?</legend>
        {ALL_SENSITIVITIES.map((s) => (
          <label key={s} style={{ display: "block" }}>
            <input type="checkbox" checked={sensitivities.includes(s)} onChange={() => toggle(s)} />
            {SENSITIVITY_LABEL[s]}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" style={{ color: "#b00" }}>
          {error}
        </p>
      )}
      <button className="btn btn--solid-ink" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Add this dog"}
      </button>
    </form>
  );
}
