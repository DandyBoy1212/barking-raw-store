/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["cosy-sleep"].title,
  description: PILLAR_META["cosy-sleep"].description,
};

// The research dossier has no sourced sleep claims, so this page stays
// observational: no hour counts, no science claims, and no efficacy claims
// for calming products.
export default function CosySleepPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar four</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Cosy Sleep</h1>
          <p className="hero__sub">{PILLAR_LINES["cosy-sleep"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Rest is the pillar nobody brags about.</h2>
            <p>
              Dogs sleep far more of the day than we do, and they need to. Ask anyone who has
              raised a puppy: an overtired pup does not wind down, it winds up. The zoomies at ten
              at night, the nipping, the sudden deafness to a name it knew this morning. Plenty of
              "naughty" evenings are just a dog that missed its nap.
            </p>
            <p>
              What a dog needs from you is a spot that is genuinely its own. A proper bed, away
              from the busiest walkway, where a snoozing dog is left alone, by visitors and by
              children especially. If the dog takes itself to bed, that is the pillar working. It
              is not sulking, it is clocking off.
            </p>
            <p>
              A dog that has rested properly has something to give the other three pillars: an
              appetite for its food, legs for the walk, and a head for the game. Get the sleep
              right and the rest of the week gets easier. That is the whole argument.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The bedroom.</h2>
            </div>
          </div>
          <PillarProducts pillar="cosy-sleep" />
        </div>
      </section>
    </main>
  );
}
