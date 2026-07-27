"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SENSITIVITY_LABEL, type Dog } from "@/data/customers";
import { deriveLifeStage } from "@/lib/customer-fields";
import { Paw } from "@/components/Paw";
import DogForm from "@/components/account/DogForm";

/**
 * The dogs on the account, with edit and remove.
 *
 * A client component because editing one has to swap a row for a form in place.
 * The life stage is still derived rather than stored, and deriveLifeStage is pure,
 * so it runs happily on either side.
 */
export default function DogList({ dogs }: { dogs: Dog[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const now = new Date();

  async function remove(dog: Dog) {
    setRemovingId(dog.id);
    setError("");
    try {
      const res = await fetch("/api/account/dogs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dog.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(`${dog.name} could not be removed.`);
        return;
      }
      setConfirmingId(null);
      router.refresh();
    } catch {
      setError(`${dog.name} could not be removed.`);
    } finally {
      setRemovingId(null);
    }
  }

  if (!dogs.length) {
    return (
      <p className="account-empty">
        No dogs yet. Tell us about yours and we will point you at what actually suits them.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="form-error" role="alert" style={{ marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {dogs.map((dog) => {
        if (editingId === dog.id) {
          return (
            <div key={dog.id} style={{ padding: "0.5rem 0 1.2rem" }}>
              <DogForm
                initial={dog}
                onDone={() => {
                  setEditingId(null);
                  router.refresh();
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          );
        }

        const stage = deriveLifeStage(dog.bornAt, now);
        return (
          <article className="dog" key={dog.id}>
            {dog.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dog__photo" src={dog.photo} alt={dog.name} />
            ) : (
              <Paw size={44} className="dog__paw" />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 className="dog__name">{dog.name}</h2>
              {dog.breed && <p className="dog__meta">{dog.breed}</p>}
              <div className="dog__tags">
                {stage !== "unknown" && <span className="badge">{stage}</span>}
                {dog.size && <span className="badge">{dog.size}</span>}
                {dog.activity && <span className="badge">{dog.activity} energy</span>}
                {dog.sensitivities?.map((s) => (
                  <span className="badge" key={s}>
                    {SENSITIVITY_LABEL[s]}
                  </span>
                ))}
              </div>

              {confirmingId === dog.id ? (
                // Two steps, because removing a dog cannot be undone and the record
                // may have been filled in by conversation at a stall months ago.
                <p className="dog__actions">
                  <span style={{ marginRight: "0.6rem" }}>Remove {dog.name}?</span>
                  <button
                    type="button"
                    className="linkbtn linkbtn--warn"
                    onClick={() => remove(dog)}
                    disabled={removingId === dog.id}
                  >
                    {removingId === dog.id ? "Removing..." : "Yes, remove"}
                  </button>
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => setConfirmingId(null)}
                    disabled={removingId === dog.id}
                  >
                    Keep
                  </button>
                </p>
              ) : (
                <p className="dog__actions">
                  <button type="button" className="linkbtn" onClick={() => setEditingId(dog.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => {
                      setConfirmingId(dog.id);
                      setError("");
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
