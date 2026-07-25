/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PILLAR_META } from "@/lib/pillars";
import { PILLAR_LINES } from "@/data/products";
import { PillarProducts } from "@/components/PillarProducts";
import { PawTrail } from "@/components/PawTrail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PILLAR_META["fun-and-games"].title,
  description: PILLAR_META["fun-and-games"].description,
};

// The research dossier has no sourced enrichment claims, so this page stays
// observational: breed history, mechanical facts (a puzzle feeder slows eating),
// and no "sniffing equals exercise" multipliers or equivalence claims.
export default function FunAndGamesPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight">
          <p className="eyebrow" style={{ color: "#fff" }}>Pillar three</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)" }}>Fun & Games</h1>
          <p className="hero__sub">{PILLAR_LINES["fun-and-games"]}.</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <h2 className="display">Every dog was bred for a job. Give yours one.</h2>
            <p>
              Collies were bred to herd, spaniels to flush, terriers to dig things out of holes.
              Most dogs now get a job description of "lie there until further notice", and a dog
              with nothing to do writes its own to-do list: the skirting board, the post, the bin.
              The fix is not a telling off. It is a better job.
            </p>
            <p>
              The easiest jobs use the nose, a dog's strongest sense. A snuffle mat turns a bowl of
              food into a search. A scatter feed in the garden does the same for free. Puzzle
              feeders make the dog work out how the food comes out, and as a bonus they slow down a
              dog that inhales dinner. Scentwork, even the kitchen table version where you hide a
              treat under one of three cups, gives a dog the rarest thing in its week: a problem.
            </p>
            <p>
              Licking and chewing are jobs too. Load a lickimat and watch a busy dog become an
              absorbed one; the frantic edge tends to go. Ten minutes of work like this will not
              replace the walk, and nobody honest will tell you it does, but it fills the hours
              around the walk with something better than boredom.
            </p>
          </div>
        </div>
      </section>

      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The shelf</p>
              <h2 className="display">The toy box.</h2>
            </div>
          </div>
          <PillarProducts pillar="fun-and-games" />
        </div>
      </section>
    </main>
  );
}
