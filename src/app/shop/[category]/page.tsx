import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_LABELS, type ProductCategory } from "@/data/products";
import { CATEGORY_META, filterByCategory, isProductCategory } from "@/lib/categories";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { getViewerDogs } from "@/lib/viewer-dogs";
import { ProductCard } from "@/components/ProductCard";
import { EmailCapture } from "@/components/EmailCapture";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category } = await params;
  if (!isProductCategory(category)) return {};
  return CATEGORY_META[category];
}

/**
 * One shelf. Pick and Mix never reaches here: it is not a product category, and
 * its own route at /shop/pick-and-mix wins over this dynamic segment.
 */
export default async function CategoryPage({ params }: Params) {
  const { category } = await params;
  if (!isProductCategory(category)) notFound();
  const shelf = category as ProductCategory;

  const [products, dogs] = await Promise.all([
    getPublicProducts().then((list) => list.map(toCatalogue)),
    getViewerDogs(),
  ]);
  const shown = filterByCategory(products, shelf);

  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <p className="eyebrow">The shop</p>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              {CATEGORY_LABELS[shelf]}
            </h1>
          </div>
          {shown.length === 0 ? (
            <p className="notice">Nothing on this shelf just yet. Check back shortly.</p>
          ) : (
            <div className="grid">
              {shown.map((p) => (
                <ProductCard key={p.slug} product={p} dogs={dogs} />
              ))}
            </div>
          )}
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
