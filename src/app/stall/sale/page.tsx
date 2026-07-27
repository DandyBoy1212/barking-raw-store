import { hasStallAccess } from "@/lib/stall-auth";
import { getStoredProducts } from "@/lib/products-store";
import { listStallMembers } from "@/lib/stall-sale-store";
import PinLogin from "@/components/stall/PinLogin";
import SaleRecorder from "@/components/stall/SaleRecorder";

export const dynamic = "force-dynamic";

/**
 * The stall sale recorder, spec 10.1.2. It lives under /stall rather than
 * /admin deliberately: at the table Michaela holds only the stall PIN session,
 * which cannot reach /admin, and a recorder she cannot open while taking the
 * money would fail at its one job. hasStallAccess also admits a real staff
 * session, so it works from her own phone signed in normally. Reached by URL
 * or the link on the signup form; no public nav anywhere.
 */
export default async function StallSalePage() {
  const allowed = await hasStallAccess();
  const [products, members] = allowed
    ? await Promise.all([getStoredProducts(), listStallMembers()])
    : [[], []];

  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">The stall</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
            {allowed ? "Record a sale" : "Stall day"}
          </h1>
        </div>
      </section>
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 720 }}>
          {allowed ? (
            <SaleRecorder
              products={products.map((p) => ({ slug: p.slug, name: p.name, price: p.price }))}
              members={members}
            />
          ) : (
            <PinLogin />
          )}
        </div>
      </section>
    </main>
  );
}
