"use client";

import { useState } from "react";
import { gbp } from "@/lib/format";
import { leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";
import { useCart } from "./CartProvider";

export function BasketDrawer() {
  const { lines, open, setOpen, subtotal, setQty, remove, count, catalogue, delivery } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliveryPlan = delivery(postcode);
  const total = subtotal + deliveryPlan.total;
  const validEmail = /.+@.+\..+/.test(email);

  // A line whose product has vanished from the catalogue (archived, or now inside a
  // members only window) is skipped rather than crashing the drawer.
  const detail = (slug: string) => catalogue.find((p) => p.slug === slug);

  async function checkout() {
    setError(null);
    if (!validEmail) {
      setError("Please add your email so we can confirm your order.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, name, email, postcode, discountCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout is not available yet.");
      if (data.url) window.location.href = data.url;
      else throw new Error("No checkout link returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-overlay${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="drawer__head">
          <b>Your Basket</b>
          <button className="drawer__close" onClick={() => setOpen(false)} aria-label="Close basket">
            ×
          </button>
        </div>

        {count === 0 ? (
          <div className="drawer__body">
            <p className="empty">Your basket is empty. Go feed them the truth.</p>
          </div>
        ) : (
          <>
            <div className="drawer__body">
              {lines.map((l) => {
                const p = detail(l.slug);
                if (!p) return null;
                return (
                  <div className="line-item" key={l.slug}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="line-item__img" src={p.image} alt={p.name} />
                    <div style={{ flex: 1 }}>
                      <div className="line-item__name">{p.name}</div>
                      <div className="line-item__meta">
                        {gbp(p.price)} each
                        <button
                          onClick={() => remove(l.slug)}
                          style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginLeft: 8 }}
                        >
                          remove
                        </button>
                      </div>
                      {(leadTimeNote(p) || supplierArrivalNote(p)) && (
                        <div className="line-item__meta" style={{ fontStyle: "italic" }}>
                          {supplierArrivalNote(p) ?? leadTimeNote(p)}
                        </div>
                      )}
                    </div>
                    <div className="qty">
                      <button onClick={() => setQty(l.slug, l.qty - 1)} aria-label="Decrease">−</button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.slug, l.qty + 1)} aria-label="Increase">+</button>
                    </div>
                  </div>
                );
              })}

              <div className="field">
                <label htmlFor="pc">Delivery postcode</label>
                <input id="pc" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g. DD5 1AB" />
              </div>
              {deliveryPlan.amountToFreePostage > 0 && (
                <div className="nudge">
                  Add {gbp(deliveryPlan.amountToFreePostage)} more for free postage.
                </div>
              )}

              <div className="field">
                <label htmlFor="nm">Name</label>
                <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="field">
                <label htmlFor="em">Email</label>
                <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div className="field">
                <label htmlFor="dc">Discount code (optional)</label>
                <input id="dc" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} placeholder="e.g. BR10ABCDE" />
              </div>
            </div>

            <div className="drawer__foot">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{gbp(subtotal)}</span>
              </div>
              {deliveryPlan.parcels.map((parcel) => (
                <div className="summary-row" key={parcel.key}>
                  <span>
                    Delivery: {parcel.label}
                    {parcel.note && (
                      <em style={{ display: "block", fontSize: "0.8em" }}>{parcel.note}</em>
                    )}
                  </span>
                  <span>{parcel.cost === 0 ? "Free" : gbp(parcel.cost)}</span>
                </div>
              ))}
              {deliveryPlan.parcels.length > 1 && (
                <p className="notice">
                  This order arrives in {deliveryPlan.parcels.length} separate parcels, so they may
                  not turn up on the same day.
                </p>
              )}
              <div className="summary-row summary-row--total">
                <span>Total</span>
                <span>{gbp(total)}</span>
              </div>
              {error && <p className="notice" style={{ color: "#b00" }}>{error}</p>}
              <button className="btn btn--solid-ink btn--block" style={{ marginTop: "0.9rem" }} onClick={checkout} disabled={busy}>
                {busy ? "One moment…" : "Checkout securely"}
              </button>
              <p className="notice">Card payment is handled by Stripe. We never see your card details.</p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
