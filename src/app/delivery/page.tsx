import type { Metadata } from "next";
import Link from "next/link";
import { FLAT_RATE, FREE_OVER } from "@/lib/shipping";
import { PendingDetails } from "@/components/legal/PendingDetails";

export const metadata: Metadata = {
  title: "Delivery | Barking Raw",
  description:
    "How and when Barking Raw posts your order. Free local delivery to DD1 to DD6, free over £35, and a flat £3.95 anywhere else in mainland UK.",
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

        <h2 style={{ marginTop: "2rem" }}>One order, one parcel</h2>
        <p>
          Everything we sell is on our own shelves and packed by hand here, so your order arrives as
          one parcel rather than turning up in pieces over a week. Sealed, dried and dropped
          straight through the letterbox where it fits.
        </p>

        <h2 style={{ marginTop: "2rem" }}>When it arrives</h2>
        <p>
          Orders placed before we pack for the day usually go out the same or the next working day,
          and then it is down to Royal Mail. If something is going to take longer than that, we tell
          you rather than letting you wonder.
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
