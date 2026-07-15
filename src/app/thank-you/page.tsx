"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export default function ThankYou() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="band band--paper" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <div className="wrap" style={{ textAlign: "center", maxWidth: 640 }}>
        <p className="eyebrow">Order confirmed</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)", marginBottom: "1rem" }}>
          Good human.
        </h1>
        <p style={{ opacity: 0.8, marginBottom: "2rem" }}>
          Thank you, your order is in and a confirmation is on its way to your inbox. We'll get it
          sealed and posted to your door. Your dog thanks you too.
        </p>
        <a className="btn btn--solid-ink" href="/#products">
          Back to the treats
        </a>
      </div>
    </main>
  );
}
