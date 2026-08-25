"use client";

import { useState } from "react";
import type { Dog } from "@/data/customers";
import type { Product } from "@/data/products";
import { productRibbons } from "@/lib/dog-merchandising";
import { gbp } from "@/lib/format";
import { packSizeLabel } from "@/lib/product-fields";
import { cycleIndex } from "@/lib/product-images";
import { Badge } from "./Badge";
import { useCart } from "./CartProvider";

export function ProductCard({ product, dogs = [] }: { product: Product; dogs?: Dog[] }) {
  const { add, setOpen } = useCart();
  // B.3: the viewer's dogs against this product. Signed-out or dog-less viewers
  // pass nothing, ribbons is empty, and the card renders exactly as before.
  const ribbons = productRibbons(dogs, product);
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
        {ribbons.length > 0 && (
          <div className="card__ribbons">
            {ribbons.map((r) => (
              <span
                key={r.key}
                className={r.kind === "caution" ? "ribbon ribbon--caution" : "ribbon"}
              >
                {r.text}
              </span>
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
        <div className="card__foot">
          <span className="card__price">
            {/* A was price only renders when it is genuinely higher, so a bad
                number in the admin cannot draw a line through the same figure. */}
            {product.wasPrice !== undefined && product.wasPrice > product.price && (
              <span className="card__was">
                <s>{gbp(product.wasPrice)}</s>
              </span>
            )}
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
