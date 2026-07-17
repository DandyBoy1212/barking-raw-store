"use client";

import { useCart } from "./CartProvider";

export function Header() {
  const { count, setOpen } = useCart();
  return (
    <header className="header">
      <div className="header__inner">
        <a className="logo" href="#top" aria-label="Barking Raw home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo__img" src="/brand/logo.jpeg" alt="Barking Raw, Natural Dog Food" />
          <span className="logo__word">
            <b>BARKING RAW</b>
            <span>Natural Dog Food</span>
          </span>
        </a>
        <a className="header__account" href="/account" style={{ marginLeft: "auto", marginRight: "1rem" }}>
          Account
        </a>
        <button className="basket-btn" onClick={() => setOpen(true)} aria-label="Open basket">
          Basket
          <span className="basket-btn__count">{count}</span>
        </button>
      </div>
    </header>
  );
}
