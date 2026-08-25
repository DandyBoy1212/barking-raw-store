"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function Header() {
  const { count, setOpen } = useCart();
  return (
    <header className="header">
      <div className="header__inner">
        {/* Was href="#top", which on any page other than the home page scrolled to the
            top of that page instead of going home, leaving the site with no way back. */}
        <Link className="logo" href="/" aria-label="Barking Raw home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo__img" src="/brand/logo.jpeg" alt="Barking Raw, Natural Dog Food" />
          <span className="logo__word">
            <b>BARKING RAW</b>
            <span>Natural Dog Food</span>
          </span>
        </Link>
        <Link
          className="header__account"
          href="/account"
          style={{ marginLeft: "auto", marginRight: "1rem" }}
        >
          Account
        </Link>
        <button className="basket-btn" onClick={() => setOpen(true)} aria-label="Open basket">
          Basket
          <span className="basket-btn__count">{count}</span>
        </button>
      </div>
      {/* The five pages plus Members, reachable from every page. Scrolls sideways
          on phones rather than wrapping. */}
      <nav className="header__nav" aria-label="Main">
        <Link href="/">Home</Link>
        <Link href="/about">About us</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/delivery">Delivery</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/members">Members</Link>
      </nav>
    </header>
  );
}
