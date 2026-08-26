import Link from "next/link";
import { CATEGORY_LABELS, type ShopCategory } from "@/data/products";
import { CATEGORY_IMAGES } from "@/lib/categories";

/**
 * The ring: the home page's primary navigation. Desktop is one circle in four
 * photo wedges around a logo hub; mobile is a two by two grid of circular tiles.
 * Both are this one markup, switched in CSS, so they cannot drift.
 *
 * The wedges were the four pillars and are now the shop categories that
 * actually have something on them, handed in by the page.
 */
export function RingHero({ categories }: { categories: ShopCategory[] }) {
  return (
    <section className="band ring-hero" style={{ background: "#000", color: "#fff" }}>
      <div className="wrap">
        <div className="ring-hero__copy">
          <h1 className="display">Real food, honestly labelled.</h1>
          <p className="hero__sub">
            One honest ingredient, named in full, posted to your door.
          </p>
        </div>
        <div className="ring">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/shop/${category}`}
              className={`ring__wedge ring__wedge--${category}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CATEGORY_IMAGES[category]} alt="" />
              <span className="ring__label">{CATEGORY_LABELS[category]}</span>
            </Link>
          ))}
          <span className="ring__hub" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpeg" alt="" />
          </span>
        </div>
      </div>
    </section>
  );
}
