// The four pillar pages' shared data: which products belong to a page, which
// photo fills each ring wedge, and each page's search metadata. Pure, so the
// filter and the photo paths are unit-testable (mirrors product-fields.ts).

import type { Pillar } from "@/data/products";

/** The products that belong on a pillar page, in catalogue order. */
export function filterByPillar<T extends { pillar: Pillar }>(items: T[], pillar: Pillar): T[] {
  return items.filter((p) => p.pillar === pillar);
}

/**
 * The photo behind each ring wedge. PLACEHOLDERS: only product shots exist in
 * public/, and there are no walk, play or sleep photographs yet, so the last
 * three are the least-wrong stand-ins. Michaela swaps these here, one line each.
 */
export const RING_PHOTOS: Record<Pillar, string> = {
  "good-food": "/products/whole-sprats.png",
  "comfy-walks": "/products/duck-wings.png",
  "fun-and-games": "/products/chicken-feet.png",
  "cosy-sleep": "/products/rabbit-ears.png",
};

/**
 * Search metadata for the four pillar pages, the only indexable content pages
 * on the site (spec section 3). Written to earn the click, not to challenge:
 * the ad challenges, the tile confirms, the page teaches (section 2.2).
 */
export const PILLAR_META: Record<Pillar, { title: string; description: string }> = {
  "good-food": {
    title: "Good Food for Dogs | Barking Raw",
    description:
      "What goes in shows up in everything else. How to read a UK dog treat label, what the law lets brands hide, and honest single-ingredient treats named in full.",
  },
  "comfy-walks": {
    title: "Comfy Walks | Barking Raw",
    description:
      "A dog that's choking on a collar isn't enjoying the walk. How a well fitted harness changes the walk, what to check before you clip on, and the kit worth carrying.",
  },
  "fun-and-games": {
    title: "Fun & Games for Dogs | Barking Raw",
    description:
      "A bored dog will find his own fun, and you won't like it. Why every dog needs a job, and how snuffle mats, lickimats and scentwork give them one.",
  },
  "cosy-sleep": {
    title: "Cosy Sleep for Dogs | Barking Raw",
    description:
      "An overtired dog can't think straight. Why proper rest sits underneath every other pillar, and how to give your dog a spot that's genuinely theirs.",
  },
};
