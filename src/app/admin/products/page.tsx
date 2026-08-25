import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getAllStoredProducts } from "@/lib/products-store";
import { gbp } from "@/lib/format";
import { isMembersOnly, leadTimeNote, packSizeLabel } from "@/lib/product-fields";
import { ArchiveToggle } from "@/components/admin/ArchiveToggle";

export const dynamic = "force-dynamic";

/**
 * What a customer would actually find, rather than the raw flags.
 *
 * A product inside its members only window is `active` and not `archived`, so the
 * old three-way Live/Hidden/Archived column showed it as "Live" while it was absent
 * from the shop. That is the failure mode section 4.1 of the v1 launch spec warns
 * about: the admin looking correct while the shop does not match it.
 */
function visibility(p: {
  active: boolean;
  archived: boolean;
  membersOnlyUntil?: string;
}, now: Date): string {
  if (p.archived) return "Archived";
  if (!p.active) return "Hidden";
  if (isMembersOnly(p, now)) return `Members only until ${p.membersOnlyUntil}`;
  return "Live";
}

export default async function AdminProductsPage() {
  await requireStaff();
  const products = await getAllStoredProducts();
  const now = new Date();
  const cell = { padding: "0.5rem 0.6rem", verticalAlign: "top" as const };

  return (
    <main className="band band--paper">
      <div className="wrap">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin">&larr; Admin</Link>
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="display">Products</h1>
          <Link className="btn btn--solid-ink" href="/admin/products/new">
            New product
          </Link>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={cell}>Name</th>
                <th style={cell}>Price</th>
                <th style={cell}>Pack</th>
                <th style={cell}>Posting</th>
                <th style={cell}>Shows as</th>
                <th style={cell}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const pack = packSizeLabel(p);
                const lead = leadTimeNote(p);
                return (
                  <tr key={p.slug} style={{ borderTop: "1px solid #ddd" }}>
                    <td style={cell}>{p.name}</td>
                    <td style={cell}>{gbp(p.price)}</td>
                    <td style={cell}>
                      {pack ?? <span style={{ color: "#a00" }}>Not set</span>}
                    </td>
                    <td style={cell}>
                      {p.fulfilment === "supplier-posted" ? "Supplier posts it" : "From your stock"}
                      {lead && <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>{lead}</div>}
                    </td>
                    <td style={cell}>{visibility(p, now)}</td>
                    <td style={cell}>
                      <Link href={`/admin/products/${p.slug}`}>Edit</Link>
                      <span style={{ margin: "0 0.5rem", opacity: 0.4 }}>|</span>
                      <ArchiveToggle slug={p.slug} archived={p.archived} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
