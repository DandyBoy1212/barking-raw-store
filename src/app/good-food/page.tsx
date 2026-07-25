/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["good-food"].title,
  description: PILLAR_META["good-food"].description,
};

// Teaching claims on this page are honesty-checked against docs/research-dossier.md:
// the label-law group terms and percentage rules (FEDIAF), the adaptable meat-first
// biology, treats around a tenth of daily calories, chewing not replacing dental
// care, and omega-3 as the strongest per-product evidence base.
export default function GoodFoodPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar one</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Good Food</h1>
          <p className="hero__sub">{PILLAR_LINES["good-food"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Learn to read the label. It takes two minutes.</h2>
            <p>
              UK and EU law lets a pet food brand declare its ingredients by category. "Meat and
              animal derivatives" can be any fleshy part of any warm blooded land animal, with no
              need to name the species or the cut. "Cereals" can be any grain, in any amount.
              "Various sugars" is added sugar with no obligation to say which, or how much. All of
              it is legal, and none of it tells you what your dog is actually eating.
            </p>
            <p>
              The percentages have rules too, and they are worth knowing by heart. "Beef flavour"
              can mean under 4% beef. "With beef" means at least 4%. "Rich in beef" means at least
              14%. Only "beef dinner" or "beef meal" has to reach 26%. So a bag with a steak on the
              front can be mostly cereal, sweetened, with a beef presence measured in flavouring.
            </p>
            <p>
              The opposite of all that is an open declaration: every ingredient named in full. That
              is what we sell. If it says beef trachea, the list reads "beef trachea", and the list
              ends there.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <div className="section-head">
            <h2 className="display">What a dog is actually built for.</h2>
            <p>
              Your dog is not a wolf. Dogs evolved alongside us and can digest some starch, more
              than wolves can, so this is not about banning every carbohydrate. It is about what
              the animal in front of you is built for: shearing teeth made to tear meat rather than
              grind grain, a short simple gut suited to meat rather than long plant fermentation,
              and a strongly acidic stomach that handles raw and dried meat with ease. Studies
              suggest dogs do well on meat rich, minimally processed food, with firmer stools one
              of the more consistent findings.
            </p>
            <p>
              Two honest rules of thumb from us. Keep treats to roughly a tenth of the day's food,
              because even good treats are extras. And chewing helps keep teeth cleaner, but it is
              not a substitute for brushing or for your vet. Anyone who tells you a chew replaces
              dental care is selling you a chew.
            </p>
            <p>
              Where we can point at real evidence, we do. The omega 3 in whole sprats and salmon,
              EPA and DHA, is backed by genuine veterinary trials for skin, coat and joints, which
              is why the fish treats are the ones we hand to a dog with a dull coat first.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The good food.</h2>
            </div>
          </div>
          <PillarProducts pillar="good-food" />
        </div>
      </section>
    </main>
  );
}
