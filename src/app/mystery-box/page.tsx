import type { Metadata } from "next";
import { getStoredProductBySlug, toCatalogue } from "@/lib/products-store";
import { getViewerDogs } from "@/lib/viewer-dogs";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mystery Box | Barking Raw",
  description:
    "A £15 hand-packed mystery box of natural, single-ingredient dog treats — chosen for your dog. Launched for International Dog Day with Scoop Patrol.",
};

/**
 * The mystery box's own landing page. Two audiences arrive here: Scoop Patrol's
 * Dog Day funnel sends its "I just want a box" clicks and out-of-area signups,
 * and the box also stands on its own for anyone Michaela points at it. One
 * product, one page, one job — the wider treats-only strip-back of the site is
 * a separate project and does not gate this page.
 */
export default async function MysteryBoxPage() {
  const [stored, dogs] = await Promise.all([
    getStoredProductBySlug("mystery-box"),
    getViewerDogs(),
  ]);
  const product = stored ? toCatalogue(stored) : null;

  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head" style={{ textAlign: "center" }}>
            <p className="eyebrow">🐾 International Dog Day</p>
            <h1 className="display" style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}>
              Nobody knows what&apos;s in the box.
            </h1>
            <p style={{ maxWidth: "38rem", margin: "1rem auto 0" }}>
              Except us — because we pack every one for the dog it&apos;s going to. £15 of our
              natural, single-ingredient treats, chosen around your dog&apos;s allergies and what
              they actually love. Tell us at checkout; we do the rest.
            </p>
          </div>
          <div className="grid" style={{ maxWidth: "24rem", margin: "2rem auto 0" }}>
            {product ? (
              <ProductCard product={product} dogs={dogs} />
            ) : (
              <p style={{ textAlign: "center" }}>
                The mystery box is being restocked — check back shortly.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
