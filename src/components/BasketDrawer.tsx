"use client";

import { useState } from "react";
import { gbp } from "@/lib/format";
import { bundleLabel, priceBundle, summariseBundleContents } from "@/lib/pick-and-mix";
import {
  SUBSCRIBE_FREQUENCIES,
  SUBSCRIBE_PERCENT,
  discounted,
  type FrequencyWeeks,
} from "@/lib/subscriptions";
import { useCart } from "./CartProvider";

export function BasketDrawer() {
  const { lines, open, setOpen, subtotal, setQty, remove, count, catalogue, delivery } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [frequencyWeeks, setFrequencyWeeks] = useState<FrequencyWeeks | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliveryPlan = delivery(postcode);
  const validEmail = /.+@.+\..+/.test(email);

  // A line whose product has vanished from the catalogue (archived, or now inside a
  // members only window) is skipped rather than crashing the drawer.
  const detail = (slug: string) => catalogue.find((p) => p.slug === slug);
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]));
  const hasBundle = lines.some((l) => Boolean(l.bundle));

  // Subscribe and save is offered only when every line is own stock (spec 4.4):
  // supplier-posted items post on the supplier's terms and cannot repeat. Rather
  // than resetting state in an effect, a basket that cannot repeat simply deactivates
  // the chosen frequency, so adding a supplier item can never smuggle one into
  // the request and the plain one-off flow is untouched.
  const basketItems = lines
    .map((l) => ({ product: detail(l.slug), qty: l.qty }))
    .filter((i): i is { product: NonNullable<ReturnType<typeof detail>>; qty: number } =>
      Boolean(i.product),
    );
  // A bundle is a one-off order, so its presence deactivates subscribe.
  // basketItems already excludes bundle lines (detail() cannot resolve their
  // minted slug); hasBundle makes the intent explicit rather than relying on
  // that accident.
  const canSubscribe = basketItems.length > 0 && !hasBundle;
  const activeFrequency = canSubscribe ? frequencyWeeks : null;

  const goodsShown = activeFrequency ? discounted(subtotal) : subtotal;
  const total = goodsShown + deliveryPlan.cost;

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
        body: JSON.stringify({
          lines,
          name,
          email,
          postcode,
          discountCode,
          ...(activeFrequency ? { frequencyWeeks: activeFrequency } : {}),
        }),
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
                if (l.bundle) {
                  const priced = priceBundle(l.bundle.items, bySlug);
                  return (
                    <div className="line-item" key={l.slug}>
                      <div style={{ flex: 1 }}>
                        <div className="line-item__name">{bundleLabel(l.bundle.size)}</div>
                        <div className="line-item__meta">
                          {priced ? gbp(priced.price) : ""}
                          {priced && priced.saving > 0 && ` (saves ${gbp(priced.saving)})`}
                          <button
                            onClick={() => remove(l.slug)}
                            style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginLeft: 8 }}
                          >
                            remove
                          </button>
                        </div>
                        <div className="line-item__meta" style={{ fontStyle: "italic" }}>
                          {summariseBundleContents(l.bundle.items, bySlug)}
                        </div>
                      </div>
                    </div>
                  );
                }
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

              {canSubscribe ? (
                <fieldset className="field" style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "0.9rem" }}>
                  <legend style={{ fontWeight: 600, padding: "0 0.4rem" }}>
                    Repeat this order, save {SUBSCRIBE_PERCENT}%
                  </legend>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      type="radio"
                      name="repeat"
                      checked={activeFrequency === null}
                      onChange={() => setFrequencyWeeks(null)}
                    />
                    <span>One-off order</span>
                  </label>
                  {SUBSCRIBE_FREQUENCIES.map((f) => (
                    <label
                      key={f.weeks}
                      style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}
                    >
                      <input
                        type="radio"
                        name="repeat"
                        checked={activeFrequency === f.weeks}
                        onChange={() => setFrequencyWeeks(f.weeks)}
                      />
                      <span>
                        {f.label}, {gbp(discounted(subtotal))} a delivery
                      </span>
                    </label>
                  ))}
                  <p className="notice" style={{ marginTop: 4 }}>
                    Change or cancel any time from your account.
                  </p>
                </fieldset>
              ) : hasBundle ? (
                <p className="notice">
                  A Pick &amp; Mix bundle is a one-off order, so repeat orders and discount codes
                  do not apply while one is in the basket. The saving is already in its price.
                </p>
              ) : null}
            </div>

            <div className="drawer__foot">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{gbp(subtotal)}</span>
              </div>
              {activeFrequency !== null && (
                <div className="summary-row">
                  <span>Subscribe and save {SUBSCRIBE_PERCENT}%</span>
                  <span>-{gbp(subtotal - goodsShown)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Delivery</span>
                <span>{deliveryPlan.cost === 0 ? "Free" : gbp(deliveryPlan.cost)}</span>
              </div>
              <div className="summary-row summary-row--total">
                <span>{activeFrequency ? "Total each delivery" : "Total"}</span>
                <span>{gbp(total)}</span>
              </div>
              {error && <p className="notice" style={{ color: "#b00" }}>{error}</p>}
              <button className="btn btn--solid-ink btn--block" style={{ marginTop: "0.9rem" }} onClick={checkout} disabled={busy}>
                {busy ? "One moment…" : activeFrequency ? "Subscribe securely" : "Checkout securely"}
              </button>
              <p className="notice">Card payment is handled by Stripe. We never see your card details.</p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
