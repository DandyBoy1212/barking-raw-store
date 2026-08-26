import type { Metadata } from "next";
import { PickAndMixBuilder } from "@/components/PickAndMixBuilder";

export const metadata: Metadata = {
  title: "Pick & Mix | Barking Raw",
  description:
    "Choose 5, 10 or 20 items and we pick the assortment: a randomised spread of natural single ingredient treats, packed by hand and posted to your door.",
};

/**
 * Pick and Mix, which until now was the last section of a pillar page nobody
 * reached the bottom of. The heading lives in the builder rather than here, so
 * an empty pool cannot render a headless section.
 */
export default function PickAndMixPage() {
  return (
    <main>
      <section className="band band--paper">
        <div className="wrap wrap--tight">
          <PickAndMixBuilder />
        </div>
      </section>
    </main>
  );
}
