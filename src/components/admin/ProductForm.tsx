"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_BADGES, ALL_PILLARS } from "@/lib/product-admin";
import { PILLAR_LABELS, ALL_FULFILMENT_PATHS } from "@/data/products";
import type { Badge, Product, Pillar, FulfilmentPath } from "@/data/products";

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
  const [pillar, setPillar] = useState<Pillar | "">(initial?.pillar ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(String(initial?.leadTimeDays ?? 0));
  const [membersOnlyUntil, setMembersOnlyUntil] = useState(initial?.membersOnlyUntil ?? "");
  const [fulfilment, setFulfilment] = useState<FulfilmentPath>(initial?.fulfilment ?? "own-stock");
  const [supplierPostage, setSupplierPostage] = useState(
    initial?.supplierPostage === undefined ? "" : String(initial.supplierPostage),
  );
  const [supplierArrivalMinDays, setSupplierArrivalMinDays] = useState(
    initial?.supplierArrivalMinDays === undefined ? "" : String(initial.supplierArrivalMinDays),
  );
  const [supplierArrivalMaxDays, setSupplierArrivalMaxDays] = useState(
    initial?.supplierArrivalMaxDays === undefined ? "" : String(initial.supplierArrivalMaxDays),
  );
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
    const payload = {
      name,
      price: Number(price),
      hook,
      description,
      safetyNote,
      image,
      badges,
      pillar,
      leadTimeDays: Number(leadTimeDays || 0),
      membersOnlyUntil,
      fulfilment,
      supplierPostage: supplierPostage === "" ? undefined : Number(supplierPostage),
      supplierArrivalMinDays:
        supplierArrivalMinDays === "" ? undefined : Number(supplierArrivalMinDays),
      supplierArrivalMaxDays:
        supplierArrivalMaxDays === "" ? undefined : Number(supplierArrivalMaxDays),
    };
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
      <label>
        Pillar (which of the four pages this appears on)
        <select
          value={pillar}
          onChange={(e) => setPillar(e.target.value as Pillar)}
          required
          style={{ display: "block", width: "100%" }}
        >
          <option value="">Choose a pillar...</option>
          {ALL_PILLARS.map((p) => (
            <option key={p} value={p}>
              {PILLAR_LABELS[p]}
            </option>
          ))}
        </select>
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
        Lead time in days (0 if it is on the shelf and posts straight away)
        <input
          type="number"
          step="1"
          min="0"
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <label>
        Members only until (optional). Before this date only members can see and buy it
        <input
          type="date"
          value={membersOnlyUntil}
          onChange={(e) => setMembersOnlyUntil(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <fieldset>
        <legend>Who posts it</legend>
        {ALL_FULFILMENT_PATHS.map((f) => (
          <label key={f} style={{ display: "inline-flex", gap: "0.3rem", marginRight: "1rem" }}>
            <input
              type="radio"
              name="fulfilment"
              value={f}
              checked={fulfilment === f}
              onChange={() => setFulfilment(f)}
            />
            {f === "own-stock" ? "From my own stock" : "Posted by the supplier"}
          </label>
        ))}
      </fieldset>
      {fulfilment === "supplier-posted" && (
        <fieldset>
          <legend>Supplier postage and timing</legend>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            The customer is shown this as a separate delivery line, for example &quot;Posts
            separately, arrives in 3 to 5 days&quot;.
          </p>
          <label>
            Postage charged for this item (GBP)
            <input
              type="number"
              step="0.01"
              min="0"
              value={supplierPostage}
              onChange={(e) => setSupplierPostage(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Arrives in, from (days)
            <input
              type="number"
              step="1"
              min="1"
              value={supplierArrivalMinDays}
              onChange={(e) => setSupplierArrivalMinDays(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Arrives in, to (days)
            <input
              type="number"
              step="1"
              min="1"
              value={supplierArrivalMaxDays}
              onChange={(e) => setSupplierArrivalMaxDays(e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </fieldset>
      )}
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
