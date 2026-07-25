"use client";

import type { Product } from "@/data/products";
import { gbp } from "@/lib/format";
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";
import { Badge } from "./Badge";
import { useCart } from "./CartProvider";

export function ProductCard({ product }: { product: Product }) {
  const { add, setOpen } = useCart();
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
        <img src={product.image} alt={product.name} loading="lazy" />
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
          <span className="card__price">{gbp(product.price)}</span>
          <button className="btn btn--solid-ink" onClick={onAdd}>
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
