import type { Metadata } from "next";
import Link from "next/link";
import { PendingDetails } from "@/components/legal/PendingDetails";
import { detail } from "@/data/business";

export const metadata: Metadata = {
  title: "Returns & Cancellations | Barking Raw",
  description:
    "Your right to cancel a Barking Raw order, how to return something, when we refund, and the few things we cannot take back once opened.",
};

export default function ReturnsPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Your rights</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          Returns and cancellations
        </h1>

        <PendingDetails />

        <p>
          You buy from Barking Raw, so if something is wrong it is ours to put right. Your rights
          are against us, and we will not send you off to deal with somebody else.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Changing your mind</h2>
        <p>
          Under the Consumer Contracts Regulations 2013 you have <b>14 days from the day your order
          arrives</b> to tell us you want to cancel, and you do not have to give a reason. You then
          have a further <b>14 days</b> to send the goods back.
        </p>
        <p style={{ marginTop: "1rem" }}>
          We refund within <b>14 days</b> of the goods coming back to us, or of you showing us proof
          you have posted them, whichever is sooner. The refund includes the basic postage you paid
          on the way out. If you chose a faster delivery than our standard one, we refund the
          standard cost rather than the upgrade.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Return postage for a change of mind is yours to pay. Please use a tracked service and keep
          the receipt, because until it reaches us we have no way to prove it is on its way.
        </p>

        <h2 style={{ marginTop: "2rem" }}>What we cannot take back once it is opened</h2>
        <p>
          The same regulations make an exception for food and for anything sealed for hygiene
          reasons, and almost everything we sell is one or the other. So:
        </p>
        <ul style={{ margin: "1rem 0 0 1.2rem" }}>
          <li>
            Treats and food <b>still sealed</b> can go back within the window above.
          </li>
          <li>
            Treats and food that have been <b>opened</b>{" "}
            cannot, because we cannot resell food that has been out of its packaging in somebody
            else&apos;s house.
          </li>
          <li>
            Toys, beds, leads and the like can go back opened or unopened, as long as they are in a
            condition we could sell on.
          </li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          None of this applies when something is faulty. See below.
        </p>

        <h2 style={{ marginTop: "2rem" }}>If it is faulty, wrong, or not as described</h2>
        <p>
          Then it is a different matter entirely and the exceptions above do not apply. Under the
          Consumer Rights Act 2015 goods must be of satisfactory quality, fit for purpose and as
          described. If they are not, you have <b>30 days</b> to reject them for a full refund, and
          we pay the return postage.
        </p>
        <p style={{ marginTop: "1rem" }}>
          After 30 days we will repair or replace first, and refund if that does not sort it. If
          something arrives damaged or off, a photo saves us both a lot of time, and telling us
          within 48 hours helps us claim against the courier. Neither shortens your rights: they
          run from the day the goods arrive, whatever day you get round to telling us.
        </p>

        <h2 style={{ marginTop: "2rem" }}>How to start a return</h2>
        <p>
          <b>Contact us first and we will send you the return address.</b> Please do not post
          anything back before you have it. Sending one to the wrong place delays your refund and
          sometimes loses the parcel.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Email {detail("contactEmail")} with your order number and what you would like to do, and
          we will come back to you with the address and anything else you need.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Cancelling before it is posted</h2>
        <p>
          If your order has not gone out yet, tell us and we will cancel it and refund you in full,
          postage included. That is much easier for everyone than sending it back.
        </p>

        <p style={{ marginTop: "2rem", opacity: 0.75, fontSize: ".95rem" }}>
          Nothing here affects your statutory rights.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/delivery">Delivery</Link> · <Link href="/terms">Terms</Link> ·{" "}
          <Link href="/contact">Contact us</Link>
        </p>
      </div>
    </main>
  );
}
