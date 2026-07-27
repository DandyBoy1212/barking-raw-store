import type { Metadata } from "next";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { getViewerDogs } from "@/lib/viewer-dogs";
import { ProductCard } from "@/components/ProductCard";
import { EmailCapture } from "@/components/EmailCapture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop | Barking Raw",
  description:
    "Everything we sell, in one place: honest single-ingredient natural dog treats, named in full and posted to your door. Free local delivery, free over £35.",
};

/**
 * The flat shop: everything, a plain grid, for people who arrived ready to buy
 * (spec section 3). The teaching lives on the pillar pages; none of it is
 * repeated here on purpose.
 */
export default async function ShopPage() {
  const [products, dogs] = await Promise.all([
    getPublicProducts().then((list) => list.map(toCatalogue)),
    getViewerDogs(),
  ]);
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shop</p>
              <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
                Everything, in one place.
              </h1>
            </div>
          </div>
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} dogs={dogs} />
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
