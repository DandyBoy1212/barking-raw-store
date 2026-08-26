import Link from "next/link";
import { RingHero } from "@/components/Ring";
import { visibleShopCategories } from "@/lib/categories";
import { getPublicProducts } from "@/lib/products-store";
import { EmailCapture } from "@/components/EmailCapture";
import DogsOfTheDayStrip from "@/components/DogsOfTheDayStrip";

export const dynamic = "force-dynamic";

/**
 * The home page: the logo, a short explainer, the four shop categories, and the
 * dogs.
 *
 * Deliberately short. The long form argument that used to live here is the whole
 * of /about now, because a landing page that opens with a thousand words of
 * exposé asks for more than a visitor has agreed to give. Home says what this is
 * and where the shelves are; About earns the belief.
 */
export default async function Home() {
  const categories = visibleShopCategories(await getPublicProducts());
  return (
    <main>
      {/* Logo, one line, and the four circles. */}
      <RingHero categories={categories} />

      {/* The explainer: small on purpose. Three sentences and a way in. */}
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 680, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
            One ingredient. Named in full.
          </h2>
          <p style={{ marginTop: "1rem", fontSize: "1.05rem" }}>
            Most dog treats are written so you will not look twice: group terms, cereal fillers and
            sugar above the meat, all of it perfectly legal. We only sell things we can name
            completely. If it is beef trachea, the ingredients list says beef trachea. That is the
            whole list.
          </p>
          <p style={{ marginTop: "1.4rem" }}>
            <Link className="btn btn--solid-ink" href="/shop">
              Have a look round the shop
            </Link>
            <Link className="btn" href="/about" style={{ marginLeft: "0.7rem" }}>
              Why we started this
            </Link>
          </p>
        </div>
      </section>

      {/* The dogs. Michaela's customers, and the warmest thing on the site. */}
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <DogsOfTheDayStrip />
        </div>
      </section>

      <EmailCapture
        source="home"
        heading="10% off your first order"
        sub="Pop your email in, tick the box, and the code lands in your inbox. No spam, and we never sell your address."
      />
    </main>
  );
}
