"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_PILLARS } from "@/lib/product-admin";
import { PILLAR_LABELS, ALL_FULFILMENT_PATHS } from "@/data/products";
import type { Badge, Product, Pillar, FulfilmentPath } from "@/data/products";
import {
  normaliseImages,
  setPrimary,
  moveImage,
  removeImage,
  type ProductImage,
} from "@/lib/product-images";
import { Paw } from "@/components/Paw";

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

/**
 * Michaela's product form.
 *
 * Same design vocabulary as the customer facing dog form: panels per decision,
 * chips for anything multiple choice, and the shared .field treatment. She is the
 * person who uses this most, and it was the plainest screen on the site.
 */
export function ProductForm({
  mode,
  initial,
  availableBadges,
}: {
  mode: Mode;
  initial?: Product;
  /** The badge labels currently in the collection, fetched by the page. */
  availableBadges: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [safetyNote, setSafetyNote] = useState(initial?.safetyNote ?? "");
  const [images, setImages] = useState<ProductImage[]>(
    normaliseImages(initial?.images, initial?.image),
  );
  const [uploading, setUploading] = useState(false);
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
  const [packWeightGrams, setPackWeightGrams] = useState(
    initial?.packWeightGrams === undefined ? "" : String(initial.packWeightGrams),
  );
  const [packPieceCount, setPackPieceCount] = useState(
    initial?.packPieceCount === undefined ? "" : String(initial.packPieceCount),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleBadge(b: Badge) {
    setBadges((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }

  // Each file goes through the same single-file endpoint in turn; the first
  // photo a product ever gets becomes its primary via normalisation.
  async function uploadImages(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/products/image", { method: "POST", body: fd });
        if (res.redirected || !res.headers.get("content-type")?.includes("json")) {
          throw new Error("Non-JSON response (likely redirected to login).");
        }
        const data = await res.json();
        if (!data.ok) {
          setErrors([data.error || "Photo upload failed."]);
          return;
        }
        setImages((cur) => normaliseImages([...cur, { url: data.url as string }]));
      }
    } catch {
      setErrors(["Photo upload failed. You may need to sign in again."]);
    } finally {
      setUploading(false);
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
      images,
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
      packWeightGrams: packWeightGrams === "" ? undefined : Number(packWeightGrams),
      packPieceCount: packPieceCount === "" ? undefined : Number(packPieceCount),
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
    <form onSubmit={submit} style={{ maxWidth: 720 }}>
      {errors.length > 0 && (
        <div className="form-error" role="alert" style={{ marginBottom: "1.3rem" }}>
          {errors.map((er) => (
            <p key={er}>{er}</p>
          ))}
        </div>
      )}

      <div className="panel">
        <p className="panel__title">The product</p>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Price in pounds</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Hook</span>
          <input value={hook} onChange={(e) => setHook(e.target.value)} required />
          <span className="field__hint">The one line under the name on the card.</span>
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
          />
        </label>
        <label className="field">
          <span>Safety note</span>
          <input value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} />
          <span className="field__hint">Optional. Shown quietly at the foot of the card.</span>
        </label>
      </div>

      <div className="panel">
        <p className="panel__title">Where it appears</p>
        <label className="field">
          <span>Pillar</span>
          <select value={pillar} onChange={(e) => setPillar(e.target.value as Pillar)} required>
            <option value="">Choose a pillar...</option>
            {ALL_PILLARS.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
          <span className="field__hint">
            Which of the four pages this shows on. A product without one appears on none of them.
          </span>
        </label>

        <fieldset className="fieldset">
          <legend>Badges</legend>
          <div className="chips">
            {availableBadges.map((b) => (
              <button
                key={b}
                type="button"
                className="chip"
                aria-pressed={badges.includes(b)}
                onClick={() => toggleBadge(b)}
              >
                {b}
              </button>
            ))}
            {/* A badge this product carries that has since been retired. It stays on
                the product, because retiring is not meant to edit products behind her
                back, but it is not offered to anything else. */}
            {badges
              .filter((b) => !availableBadges.includes(b))
              .map((b) => (
                <span
                  key={b}
                  className="badge"
                  style={{ opacity: 0.5 }}
                  title="Retired badge, still on this product"
                >
                  {b}
                </span>
              ))}
          </div>
        </fieldset>
      </div>

      <div className="panel">
        <p className="panel__title">Pack size</p>
        <p className="field__hint" style={{ marginBottom: "0.8rem" }}>
          Fill in whichever fits. Without this a customer cannot compare the price against anyone
          else&apos;s, and neither can we. Leave blank if you genuinely do not know.
        </p>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Weight in grams</span>
            <input
              type="number"
              step="1"
              min="1"
              value={packWeightGrams}
              onChange={(e) => setPackWeightGrams(e.target.value)}
              placeholder="100"
            />
          </label>
          <label className="field">
            <span>Number of pieces</span>
            <input
              type="number"
              step="1"
              min="1"
              value={packPieceCount}
              onChange={(e) => setPackPieceCount(e.target.value)}
              placeholder="3"
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <p className="panel__title">Stock and timing</p>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span>Lead time in days</span>
            <input
              type="number"
              step="1"
              min="0"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
            <span className="field__hint">0 if it is on the shelf and posts straight away.</span>
          </label>
          <label className="field">
            <span>Members only until</span>
            <input
              type="date"
              value={membersOnlyUntil}
              onChange={(e) => setMembersOnlyUntil(e.target.value)}
            />
            <span className="field__hint">
              Optional. Before this date only members can see it or buy it.
            </span>
          </label>
        </div>
      </div>

      <div className="panel">
        <p className="panel__title">Who posts it</p>
        <div className="chips">
          {ALL_FULFILMENT_PATHS.map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={fulfilment === f}
              onClick={() => setFulfilment(f)}
            >
              {f === "own-stock" ? "From my own stock" : "Posted by the supplier"}
            </button>
          ))}
        </div>

        {fulfilment === "supplier-posted" && (
          <>
            <p className="field__hint" style={{ margin: "1.1rem 0 0.6rem" }}>
              The customer sees this as a separate delivery line, for example &quot;Posts
              separately, arrives in 3 to 5 days&quot;.
            </p>
            <label className="field">
              <span>Postage charged for this item</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={supplierPostage}
                onChange={(e) => setSupplierPostage(e.target.value)}
              />
            </label>
            <div className="form-grid form-grid--2">
              <label className="field">
                <span>Arrives in, from (days)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={supplierArrivalMinDays}
                  onChange={(e) => setSupplierArrivalMinDays(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Arrives in, to (days)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={supplierArrivalMaxDays}
                  onChange={(e) => setSupplierArrivalMaxDays(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <p className="panel__title">Photos</p>
        {images.length === 0 ? (
          <div className="photo-pick">
            <span className="photo-pick__empty" aria-hidden="true">
              <Paw size={34} />
            </span>
          </div>
        ) : (
          <ul className="photo-list">
            {images.map((img, n) => (
              <li key={img.url} className="photo-list__row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="photo-pick__preview" src={img.url} alt={`Photo ${n + 1}`} />
                <div className="photo-list__ctl">
                  {img.primary ? (
                    <span className="badge badge--star">Primary</span>
                  ) : (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setImages(setPrimary(images, n))}
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    className="chip"
                    aria-label={`Move photo ${n + 1} earlier`}
                    disabled={n === 0}
                    onClick={() => setImages(moveImage(images, n, n - 1))}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-label={`Move photo ${n + 1} later`}
                    disabled={n === images.length - 1}
                    onClick={() => setImages(moveImage(images, n, n + 1))}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setImages(removeImage(images, n))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: "0.9rem" }}>
          <label className="btn btn--solid-ink" style={{ cursor: "pointer" }}>
            {uploading ? "Uploading..." : images.length ? "Add more photos" : "Choose photos"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => e.target.files && uploadImages(e.target.files)}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          <span className="field__hint">
            At least one is required. The primary photo is the one Stripe and the basket show.
          </span>
        </div>
      </div>

      <p style={{ marginTop: "1.4rem" }}>
        <button
          className="btn btn--solid-ink btn--block"
          disabled={busy || images.length === 0}
          type="submit"
        >
          {busy ? "Saving..." : mode.kind === "create" ? "Create product" : "Save changes"}
        </button>
      </p>
    </form>
  );
}
