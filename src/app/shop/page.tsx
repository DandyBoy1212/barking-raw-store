import type { Metadata } from "next";
import Link from "next/link";
import { ALL_SHOP_CATEGORIES, CATEGORY_LABELS } from "@/data/products";
import { CATEGORY_IMAGES } from "@/lib/categories";
import { EmailCapture } from "@/components/EmailCapture";

export const metadata: Metadata = {
  title: "Shop | Barking Raw",
  description:
    "Natural dog treats, hand packed boxes, pick and mix, and toys. Named in full and posted to your door. Free local delivery, free over GBP 35.",
};

/**
 * The shop landing page: four circles, one per category. Replaces the flat
 * everything-grid, because a flat grid and four categories are two answers to
 * the same question and the categories are the one the customer asked for.
 */
export default function ShopPage() {
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <p className="eyebrow">The shop</p>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              What are you after?
            </h1>
          </div>
          <div className="ring">
            {ALL_SHOP_CATEGORIES.map((category) => (
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
          </div>
        </div>
      </section>
      <EmailCapture
        source="shop"
        heading="10% off your first order"
        sub="Pop your email in, tick the box, and the code lands in your inbox."
      />
    </main>
  );
}
