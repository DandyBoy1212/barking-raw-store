import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap">
        {/* The form is a dead end without this: the header has no admin nav, so the
            only way out was the browser back button. */}
        <Link href="/admin/products" style={{ textDecoration: "underline" }}>
          &larr; Back to products
        </Link>
        <h1 className="display">New product</h1>
        <ProductForm mode={{ kind: "create" }} />
      </div>
    </main>
  );
}
