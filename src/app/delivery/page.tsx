import type { Metadata } from "next";
import Link from "next/link";
import { FLAT_RATE, FREE_OVER } from "@/lib/shipping";
import { PendingDetails } from "@/components/legal/PendingDetails";

export const metadata: Metadata = {
  title: "Delivery | Barking Raw",
  description:
    "How and when Barking Raw posts your order. Free local delivery to DD1 to DD6, free over £35, and what happens when an item posts direct from our supplier.",
};

export default function DeliveryPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Information</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          Delivery
        </h1>

        <PendingDetails />

        <h2 style={{ marginTop: "2rem" }}>What postage costs</h2>
        <ul style={{ margin: "1rem 0 0 1.2rem" }}>
          <li>
            <b>Free</b> to local postcodes DD1 to DD6, whatever you spend.
          </li>
          <li>
            <b>Free</b> on orders over £{FREE_OVER} anywhere else in mainland UK.
          </li>
          <li>
            <b>£{FLAT_RATE.toFixed(2)}</b> otherwise.
          </li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          The basket works the postage out before you pay, so there is never a figure at the
          checkout you have not already seen.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Orders that arrive in more than one parcel</h2>
        <p>
          Most of what we sell is on our own shelves and goes out as one parcel. A few items post
          direct from the supplier who stocks them. When your order mixes the two, it arrives as
          more than one parcel, on more than one day.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Each of those items carries its own postage and its own arrival window, both shown on the
          product and itemised in your basket before you pay. The free postage threshold of £
          {FREE_OVER} applies to the part of your order we post ourselves.
        </p>

        <h2 style={{ marginTop: "2rem" }}>When it arrives</h2>
        <p>
          Orders placed before we pack for the day usually go out the same or the next working day.
          Anything with a longer lead time says so on the product page, and anything posted by a
          supplier shows its own arrival range, typically two to five working days.
        </p>
        <p style={{ marginTop: "1rem" }}>
          We post within mainland UK. If you are outside that and want an order, get in touch before
          you buy and we will tell you honestly whether we can do it.
        </p>

        <h2 style={{ marginTop: "2rem" }}>If it does not turn up</h2>
        <p>
          Tell us. Goods are our responsibility until they reach you, so a parcel that goes missing
          in the post is our problem to sort out, not yours to chase the courier about.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/returns">Returns and cancellations</Link> ·{" "}
          <Link href="/contact">Contact us</Link>
        </p>
      </div>
    </main>
  );
}
