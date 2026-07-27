"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_SENSITIVITIES,
  SENSITIVITY_LABEL,
  type ActivityLevel,
  type Dog,
  type DogSize,
  type Sensitivity,
} from "@/data/customers";
import { Paw } from "@/components/Paw";

// Nothing here assumes the dog's sex. "Big lad" was the first draft and only fits
// half of them, and the questions ask about "they" for the same reason.
const SIZES: { value: DogSize; label: string }[] = [
  { value: "small", label: "Wee one" },
  { value: "medium", label: "Middle sized" },
  { value: "large", label: "Big unit" },
];

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "low", label: "Steady" },
  { value: "moderate", label: "Middling" },
  { value: "high", label: "Never stops" },
];

/**
 * Add a dog.
 *
 * The answers are chips rather than checkboxes and dropdowns, for two reasons. They
 * are the same pill shape as the badges on the products these answers will filter,
 * so the connection is visible before it is built. And this form gets rebuilt for the
 * stall iPad in step D.1, where every answer has to be tappable with a dog lead in
 * the other hand.
 */
export default function DogForm({
  initial,
  onDone,
  onCancel,
}: {
  /** Present when editing an existing dog. Absent means adding a new one. */
  initial?: Dog;
  onDone?: () => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [breed, setBreed] = useState(initial?.breed ?? "");
  const [bornAt, setBornAt] = useState(initial?.bornAt ?? "");
  const [size, setSize] = useState<DogSize | "">(initial?.size ?? "");
  const [activity, setActivity] = useState<ActivityLevel | "">(initial?.activity ?? "");
  const [sensitivities, setSensitivities] = useState<Sensitivity[]>(initial?.sensitivities ?? []);
  const [photo, setPhoto] = useState(initial?.photo ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleSensitivity(s: Sensitivity) {
    setSensitivities((current) =>
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
  }

  /**
   * Upload as soon as a photo is chosen, rather than on submit. A phone photo takes
   * a few seconds, and doing it here means the wait happens while they are still
   * filling the rest in, instead of after they press the button.
   */
  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/dogs/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "The photo would not upload.");
        return;
      }
      setPhoto(data.url);
    } catch {
      setError("The photo would not upload.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/dogs", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: initial!.id } : {}),
          name,
          breed,
          bornAt,
          size,
          activity,
          sensitivities,
          photo,
        }),
      });
      const data = await res.json();
      // Surface the failure. The product form shipped without this and a failed save
      // looked identical to a successful one.
      if (!res.ok || !data.ok) {
        setError((data.errors ?? ["Save failed."]).join(" "));
        return;
      }
      if (editing) {
        // The list owns the refresh when editing, because it also has to close the form.
        onDone?.();
        return;
      }
      setName("");
      setBreed("");
      setBornAt("");
      setSize("");
      setActivity("");
      setSensitivities([]);
      setPhoto("");
      router.refresh();
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <p className="panel__title">{editing ? `Editing ${initial!.name}` : "Add a dog"}</p>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Breed</span>
          <input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="Cane Corso, or a good guess"
          />
        </label>
      </div>

      <label className="field">
        <span>Roughly when were they born?</span>
        <input type="date" value={bornAt} onChange={(e) => setBornAt(e.target.value)} />
        <span className="field__hint">
          A rough guess is fine. We only use it to tell puppy from adult from senior.
        </span>
      </label>

      <fieldset className="fieldset">
        <legend>How big are they?</legend>
        <div className="chips">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              className="chip"
              aria-pressed={size === s.value}
              onClick={() => setSize(size === s.value ? "" : s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>How much go have they got?</legend>
        <div className="chips">
          {ACTIVITY.map((a) => (
            <button
              key={a.value}
              type="button"
              className="chip"
              aria-pressed={activity === a.value}
              onClick={() => setActivity(activity === a.value ? "" : a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Anything they struggle with?</legend>
        <div className="chips">
          {ALL_SENSITIVITIES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={sensitivities.includes(s)}
              onClick={() => toggleSensitivity(s)}
            >
              {SENSITIVITY_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>A photo of them</legend>
        <div className="photo-pick">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="photo-pick__preview" src={photo} alt="The dog you are adding" />
          ) : (
            <span className="photo-pick__empty" aria-hidden="true">
              <Paw size={34} />
            </span>
          )}
          <div>
            <label className="btn btn--solid-ink" style={{ cursor: "pointer" }}>
              {uploading ? "Uploading..." : photo ? "Choose a different one" : "Choose a photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={choosePhoto}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
            <span className="field__hint">
              Optional, and up to 5MB. It is yours: we only ever show it publicly if you say so.
            </span>
          </div>
        </div>
      </fieldset>

      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "1.1rem" }}>
          {error}
        </p>
      )}

      <p style={{ marginTop: "1.4rem", display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <button
          className="btn btn--solid-ink"
          type="submit"
          disabled={busy}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {busy ? "Saving..." : editing ? "Save changes" : "Add this dog"}
        </button>
        {editing && (
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </p>
    </form>
  );
}
