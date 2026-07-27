"use client";

import { useState } from "react";
import { gbp } from "@/lib/format";
import {
  BUNDLE_SIZES,
  bundleLabel,
  bundlePool,
  drawBundle,
  priceBundle,
  summariseBundleContents,
  type BundleSize,
} from "@/lib/pick-and-mix";
import { useCart } from "./CartProvider";

/**
 * The Pick & Mix builder (spec step E.2). The randomisation is the product:
 * pick a size, we draw the assortment, you see exactly what was drawn and
 * what it costs before it goes anywhere near the basket. The catalogue comes
 * from the cart context, so members see their early-access items in the pool
 * and nobody else ever receives them.
 */
export function PickAndMixBuilder() {
  const { catalogue, addBundle, setOpen } = useCart();
  const [size, setSize] = useState<BundleSize>(10);
  const [items, setItems] = useState<string[] | null>(null);
  const [added, setAdded] = useState(false);

  const pool = bundlePool(catalogue);
  if (pool.length === 0) return null;

  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const priced = items ? priceBundle(items, bySlug) : null;

  const draw = (s: BundleSize) => {
    setSize(s);
    setItems(drawBundle(pool.map((p) => p.slug), s));
    setAdded(false);
  };

  const add = () => {
    if (!items) return;
    addBundle(size, items);
    setItems(null);
    setAdded(true);
    setOpen(true);
  };

  return (
    <div className="pickmix">
      <div className="pickmix__sizes" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {BUNDLE_SIZES.map((s) => (
          <button
            key={s}
            className={`btn ${items && size === s ? "btn--solid-ink" : ""}`}
            onClick={() => draw(s)}
          >
            {s} items
          </button>
        ))}
      </div>

      {items && priced && (
        <div className="pickmix__result" style={{ marginTop: "1rem" }}>
          <p style={{ fontWeight: 600 }}>
            {bundleLabel(size)}: {gbp(priced.price)}
            <span style={{ fontWeight: 400 }}>
              {" "}
              (worth {gbp(priced.list)} bought singly, saves {gbp(priced.saving)})
            </span>
          </p>
          <p>{summariseBundleContents(items, bySlug)}</p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn--solid-ink" onClick={add}>
              Add this surprise to the basket
            </button>
            <button className="btn" onClick={() => draw(size)}>
              Draw again
            </button>
          </div>
          <p className="notice" style={{ marginTop: "0.5rem" }}>
            One parcel from us, packed by hand. Repeat orders and discount codes
            do not apply to a bundle; the saving is already in the price.
          </p>
        </div>
      )}

      {!items && added && (
        <p className="notice" style={{ marginTop: "1rem" }}>
          In the basket. Fancy another? Every draw is different.
        </p>
      )}
    </div>
  );
}
