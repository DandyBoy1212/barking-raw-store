import { requireStaff } from "@/lib/auth";
import { getAllStoredProducts } from "@/lib/products-store";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireStaff();
  const products = await getAllStoredProducts();
  return (
    <main className="band band--paper">
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="display">Products</h1>
          <a className="btn btn--solid-ink" href="/admin/products/new">New product</a>
        </div>
        <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.slug} style={{ borderTop: "1px solid #ddd" }}>
                <td>{p.name}</td>
                <td>{gbp(p.price)}</td>
                <td>{p.archived ? "Archived" : p.active ? "Live" : "Hidden"}</td>
                <td><a href={`/admin/products/${p.slug}`}>Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
