import Link from "next/link";
import type { Pillar } from "@/data/products";
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { filterByPillar } from "@/lib/pillars";
import { ProductCard } from "@/components/ProductCard";

/**
 * A pillar page's shelf: the public catalogue filtered to that pillar. Three of
 * the four pillars launch unstocked, so the empty state is honest rather than a
 * bare grid that looks broken.
 */
export async function PillarProducts({ pillar }: { pillar: Pillar }) {
  const products = filterByPillar((await getPublicProducts()).map(toCatalogue), pillar);
  if (products.length === 0) {
    return (
      <div className="shelf-empty">
        <p>
          We are stocking this shelf now. In the meantime, everything we sell today lives in{" "}
          <Link href="/shop">the shop</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className="grid">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  );
}
