import type { Metadata } from "next";
import Link from "next/link";
import { PendingDetails } from "@/components/legal/PendingDetails";
import { detail, provided } from "@/data/business";

export const metadata: Metadata = {
  title: "Contact Us | Barking Raw",
  description:
    "How to reach Barking Raw: email, phone, our business address, and where to find the stall.",
};

export default function ContactPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Say hello</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          Contact us
        </h1>

        <PendingDetails />

        <p>
          A real person reads these, and that person knows dogs. Ask us what suits a fussy eater, a
          dog with a dodgy tummy, or a puppy who destroys everything, and you will get a straight
          answer rather than a product recommendation.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Email</h2>
        <p>{detail("contactEmail")}</p>
        <p style={{ marginTop: ".4rem", opacity: 0.75 }}>
          The quickest route, and the best one for anything about an order. Quote your order number
          and we can look it up straight away.
        </p>

        {provided("contactPhone") && (
          <>
            <h2 style={{ marginTop: "2rem" }}>Phone</h2>
            <p>{detail("contactPhone")}</p>
          </>
        )}

        <h2 style={{ marginTop: "2rem" }}>Post</h2>
        <p style={{ whiteSpace: "pre-line" }}>{detail("address")}</p>
        <p style={{ marginTop: ".4rem", opacity: 0.75 }}>
          Please do not send returns here without asking first. The return address depends on the
          item, so <Link href="/returns">get in touch</Link> and we will tell you where it goes.
        </p>

        <h2 style={{ marginTop: "2rem" }}>At the stall</h2>
        <p>
          The best way to meet us is in person, with your dog. Bring them along, tell us what they
          are like, and we will hand you something that actually suits them.
        </p>

        <h2 style={{ marginTop: "2rem" }}>How quickly we answer</h2>
        <p>
          Usually the same day, and within two working days at the outside. This is a small business,
          not a call centre, so if we are at the stall on a Sunday you might hear from us on the
          Monday.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/delivery">Delivery</Link> ·{" "}
          <Link href="/returns">Returns &amp; cancellations</Link> · <Link href="/terms">Terms</Link>{" "}
          · <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
