import Link from "next/link";

/**
 * The site footer, and the only route to the legal pages.
 *
 * It lives in the root layout rather than on the home page, because Stripe expects a
 * refund policy and a business contact to be reachable from anywhere on the site, and
 * because a policy page nobody can navigate to does not count as published.
 */
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <span className="logo">
          <b style={{ fontWeight: 900, letterSpacing: "0.02em" }}>BARKING RAW</b>
        </span>
        <nav
          aria-label="Legal and information"
          style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.85rem" }}
        >
          <Link href="/about">About us</Link>
          <Link href="/delivery">Delivery</Link>
          <Link href="/returns">Returns &amp; cancellations</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <small>© {new Date().getFullYear()} Barking Raw · Natural Dog Food · barkingraw.dog</small>
      </div>
    </footer>
  );
}
