"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { gbp } from "@/lib/format";
import { leadTimeNote, packSizeLabel, supplierArrivalNote } from "@/lib/product-fields";
import { cycleIndex } from "@/lib/product-images";
import { Badge } from "./Badge";
import { useCart } from "./CartProvider";

export function ProductCard({ product }: { product: Product }) {
  const { add, setOpen } = useCart();
  // The gallery starts on the primary photo; a product that somehow arrives
  // without its list still shows its legacy single image.
  const images = product.images.length
    ? product.images
    : [{ url: product.image, primary: true }];
  const [shown, setShown] = useState(() => Math.max(0, images.findIndex((i) => i.primary)));
  const onAdd = () => {
    add(product.slug);
    setOpen(true);
  };
  return (
    <article className="card">
      <div className="card__media">
        {product.badges.length > 0 && (
          <div className="card__badges">
            {product.badges.map((b) => (
              <Badge key={b} label={b} />
            ))}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[shown]?.url ?? product.image} alt={product.name} loading="lazy" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="card__navbtn card__navbtn--prev"
              aria-label="Previous photo"
              onClick={() => setShown((n) => cycleIndex(n, -1, images.length))}
            >
              &#8249;
            </button>
            <button
              type="button"
              className="card__navbtn card__navbtn--next"
              aria-label="Next photo"
              onClick={() => setShown((n) => cycleIndex(n, 1, images.length))}
            >
              &#8250;
            </button>
            <div className="card__dots" aria-hidden="true">
              {images.map((img, n) => (
                <span
                  key={img.url}
                  className={`card__dot${n === shown ? " card__dot--on" : ""}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="card__body">
        <h3 className="card__name">{product.name}</h3>
        <p className="card__hook">{product.hook}</p>
        <p className="card__desc">{product.description}</p>
        {product.safetyNote && <p className="card__safety">{product.safetyNote}</p>}
        {(supplierArrivalNote(product) ?? leadTimeNote(product)) && (
          <p className="card__lead">{supplierArrivalNote(product) ?? leadTimeNote(product)}</p>
        )}
        <div className="card__foot">
          <span className="card__price">
            {gbp(product.price)}
            {packSizeLabel(product) && (
              <span className="card__pack"> / {packSizeLabel(product)}</span>
            )}
          </span>
          <button className="btn btn--solid-ink" onClick={onAdd}>
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
