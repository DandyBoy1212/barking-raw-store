/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["comfy-walks"].title,
  description: PILLAR_META["comfy-walks"].description,
};

// The research dossier has no sourced walking claims, so this page stays
// practical and observational: fit guidance and kit, no injury statistics,
// no medical claims.
export default function ComfyWalksPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar two</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Comfy Walks</h1>
          <p className="hero__sub">{PILLAR_LINES["comfy-walks"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">The walk is for the dog. Kit it out that way.</h2>
            <p>
              Watch a dog straining at a collar: front feet skittering, breath rasping, eyes fixed
              anywhere but on you. That is not a dog enjoying a walk, it is a dog being dragged
              somewhere slowly. A well fitted harness moves the pressure off the throat and spreads
              it across the chest, and the change in the dog is usually visible on the first walk.
            </p>
            <p>
              Fit is the whole job. You should get two flat fingers under every strap, nothing
              should rub behind the elbows, and the harness should not shift sideways when the lead
              goes tight. Ten minutes with a tape measure before you buy beats a month of a dog
              flinching from the thing that means walkies.
            </p>
            <p>
              And when you can, let the walk belong to the nose. A long line in a safe field gives
              a dog room to range, sniff and choose a direction, which is the dog's version of
              reading the news. The boring kit matters too: poo bags you will not run out of, and
              water on any warm day. None of this is complicated. It is just usually skipped.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The walking kit.</h2>
            </div>
          </div>
          <PillarProducts pillar="comfy-walks" />
        </div>
      </section>
    </main>
  );
}
