import { hasStallAccess } from "@/lib/stall-auth";
import PinLogin from "@/components/stall/PinLogin";
import StallForm from "@/components/stall/StallForm";

export const dynamic = "force-dynamic";

/**
 * The stall iPad form, spec 10.1.1. Reached by URL only, no nav link anywhere:
 * this is a tool on Michaela's table, not a page customers browse to.
 */
export default async function StallPage() {
  const allowed = await hasStallAccess();

  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">The stall</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
            {allowed ? "Sign somebody up" : "Stall day"}
          </h1>
        </div>
      </section>
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 720 }}>
          {allowed ? <StallForm /> : <PinLogin />}
        </div>
      </section>
    </main>
  );
}
