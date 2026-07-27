import { requireStaff } from "@/lib/auth";
import { getAllBadges } from "@/lib/badges-store";
import BadgeManager from "@/components/admin/BadgeManager";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  await requireStaff();
  const badges = await getAllBadges();

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Staff</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
          Badges
        </h1>
        <p style={{ marginTop: "1rem", maxWidth: "60ch" }}>
          These are the labels you can put on a product. Add your own whenever you like. Retiring
          one takes it off the list for new products without removing it from products that already
          carry it.
        </p>
        <BadgeManager initial={badges} />
      </div>
    </main>
  );
}
