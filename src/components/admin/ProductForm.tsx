"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_BADGES } from "@/lib/product-admin";
import type { Badge, Product } from "@/data/products";

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

export function ProductForm({ mode, initial }: { mode: Mode; initial?: Product }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [safetyNote, setSafetyNote] = useState(initial?.safetyNote ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [badges, setBadges] = useState<Badge[]>(initial?.badges ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleBadge(b: Badge) {
    setBadges((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }

  async function uploadImage(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/image", { method: "POST", body: fd });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (data.ok) setImage(data.url);
      else setErrors([data.error || "Image upload failed."]);
    } catch {
      setErrors(["Image upload failed. You may need to sign in again."]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const payload = { name, price: Number(price), hook, description, safetyNote, image, badges };
    const url = mode.kind === "create" ? "/api/admin/products" : `/api/admin/products/${mode.slug}`;
    const method = mode.kind === "create" ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
        throw new Error("Non-JSON response (likely redirected to login).");
      }
      const data = await res.json();
      if (data.ok) router.push("/admin/products");
      else setErrors(data.errors || ["Save failed."]);
    } catch {
      setErrors(["Save failed. You may need to sign in again."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "1rem", maxWidth: 640 }}>
      {errors.length > 0 && (
        <ul style={{ color: "#a00" }}>
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      )}
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Price (GBP)
        <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Hook
        <input value={hook} onChange={(e) => setHook(e.target.value)} required style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} style={{ display: "block", width: "100%" }} />
      </label>
      <label>
        Safety note (optional)
        <input value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <fieldset>
        <legend>Badges</legend>
        {ALL_BADGES.map((b) => (
          <label key={b} style={{ display: "inline-flex", gap: "0.3rem", marginRight: "1rem" }}>
            <input type="checkbox" checked={badges.includes(b)} onChange={() => toggleBadge(b)} />
            {b}
          </label>
        ))}
      </fieldset>
      <label>
        Image
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files && uploadImage(e.target.files[0])} style={{ display: "block" }} />
      </label>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Product preview" style={{ maxWidth: 200 }} />
      )}
      <button className="btn btn--solid-ink" disabled={busy || !image} type="submit">
        {busy ? "Saving..." : mode.kind === "create" ? "Create product" : "Save changes"}
      </button>
    </form>
  );
}
