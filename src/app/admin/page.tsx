import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** What Michaela can do today, and what is coming, named honestly. */
const BUILT = [
  {
    href: "/admin/products",
    title: "Products",
    blurb: "Add a product, change a price, set which pillar it belongs to, hide or archive it.",
  },
  {
    href: "/admin/badges",
    title: "Badges",
    blurb: "Add your own labels for products, rename them, or retire one you have stopped using.",
  },
  {
    href: "/admin/posts",
    title: "Posts",
    blurb: "Write the weekly pillar post for the members area.",
  },
  {
    href: "/admin/points",
    title: "Points owed",
    blurb: "See the total loyalty points customers have not spent yet.",
  },
];

const COMING = [
  { title: "Stall sales", blurb: "Record a cash or card sale made at the market stall." },
];

export default async function AdminHome() {
  const user = await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <h1 className="display">Admin</h1>
        <p>Signed in as {user.email} (staff).</p>

        <div style={{ display: "grid", gap: "1rem", marginTop: "2rem" }}>
          {BUILT.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "1.2rem",
                border: "2px solid #0b0b0b",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <b style={{ fontSize: "1.15rem" }}>{item.title}</b>
              <div style={{ opacity: 0.75, marginTop: "0.3rem" }}>{item.blurb}</div>
            </Link>
          ))}
        </div>

        <h2 style={{ marginTop: "2.5rem", fontSize: "1rem", textTransform: "uppercase" }}>
          Not built yet
        </h2>
        <ul style={{ opacity: 0.6, lineHeight: 1.8 }}>
          {COMING.map((item) => (
            <li key={item.title}>
              <b>{item.title}.</b> {item.blurb}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
