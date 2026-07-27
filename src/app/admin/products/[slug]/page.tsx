import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getStoredProductBySlug, toCatalogue } from "@/lib/products-store";
import { ProductForm } from "@/components/admin/ProductForm";
import { getActiveBadgeLabels } from "@/lib/badges-store";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await params;
  const product = await getStoredProductBySlug(slug);
  if (!product) notFound();
  const availableBadges = await getActiveBadgeLabels();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <Link href="/admin/products" style={{ textDecoration: "underline" }}>
          &larr; Back to products
        </Link>
        <h1 className="display">Edit: {product.name}</h1>
        <ProductForm
          mode={{ kind: "edit", slug }}
          initial={toCatalogue(product)}
          availableBadges={availableBadges}
        />
      </div>
    </main>
  );
}
