import { requireStaff } from "@/lib/auth";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <h1 className="display">New product</h1>
        <ProductForm mode={{ kind: "create" }} />
      </div>
    </main>
  );
}
