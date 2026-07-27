"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The one button on the picker: feature this dog today. Posts the dog's name
 * and photo only; the route validates the photo host again before anything is
 * stored.
 */
export default function FeatureDogButton({
  dogName,
  photo,
}: {
  dogName: string;
  photo: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function feature() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dogs-of-the-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogName, photo }),
      });
      const data = (await res.json().catch(() => null)) as { errors?: string[] } | null;
      if (!res.ok) {
        setError(data?.errors?.join(" ") ?? "That did not save.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("No connection just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="btn btn--solid-ink"
        type="button"
        disabled={busy || done}
        onClick={() => void feature()}
      >
        {done ? "Featured" : busy ? "Featuring..." : "Feature today"}
      </button>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
