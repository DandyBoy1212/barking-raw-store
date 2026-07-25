import type { Metadata } from "next";
import Link from "next/link";
import { PendingDetails } from "@/components/legal/PendingDetails";
import { detail } from "@/data/business";

export const metadata: Metadata = {
  title: "Privacy Notice | Barking Raw",
  description:
    "What Barking Raw collects about you and your dog, why, who we share it with, how long we keep it, and how to get it back or deleted.",
};

export default function PrivacyPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          Privacy notice
        </h1>

        <PendingDetails />

        <p>
          This explains what we do with your information. It is written to be read rather than to be
          survived, and if anything in it is unclear, ask us and we will explain it.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Who we are</h2>
        <p>
          {detail("legalName")}, trading as Barking Raw, of {detail("address")}. We are the data
          controller for the information described here. Contact us at {detail("contactEmail")}.
        </p>

        <h2 style={{ marginTop: "2rem" }}>What we collect</h2>
        <ul style={{ margin: "1rem 0 0 1.2rem" }}>
          <li>
            <b>Your details.</b> Name, email address, delivery address and phone number.
          </li>
          <li>
            <b>Your order.</b> What you bought, when, and what it cost. We do not see or store your
            card number: payments are handled by Stripe and the card details never reach us.
          </li>
          <li>
            <b>Your dogs.</b> Name, breed, rough age, size, activity level, and any allergies or
            sensitivities you tell us about. You give us this so we can point you at the right food
            and warn you off the wrong food. It is optional, all of it.
          </li>
          <li>
            <b>Photos of your dog</b>, if you give us one at the stall or upload one. We ask
            separately before we use one publicly.
          </li>
          <li>
            <b>Basic technical information</b> needed to keep you signed in and to keep your basket
            between visits.
          </li>
        </ul>

        <h2 style={{ marginTop: "2rem" }}>Why we are allowed to hold it</h2>
        <ul style={{ margin: "1rem 0 0 1.2rem" }}>
          <li>
            <b>To fulfil your order</b>, because we cannot post you anything otherwise. This is
            performance of our contract with you.
          </li>
          <li>
            <b>To keep records we are required to keep</b>, mainly tax and accounting. This is a
            legal obligation.
          </li>
          <li>
            <b>To send you marketing email</b>, only where you have ticked the box asking us to. We
            never pre-tick it, and every email has an unsubscribe link that works immediately.
          </li>
          <li>
            <b>To recommend the right products for your dog</b>, which is our legitimate interest in
            running a useful shop. Tell us to stop and we will.
          </li>
        </ul>

        <h2 style={{ marginTop: "2rem" }}>Who else sees it</h2>
        <p>Only the companies that make the shop work, and only what they need:</p>
        <ul style={{ margin: "1rem 0 0 1.2rem" }}>
          <li>
            <b>Stripe</b>, to take the payment.
          </li>
          <li>
            <b>Google Firebase</b>, which hosts the database your account and order live in.
          </li>
          <li>
            <b>Resend</b>, which sends our email.
          </li>
          <li>
            <b>Our suppliers and couriers</b>, who get the name and address needed to deliver a
            parcel and nothing else. Where an item posts direct from a supplier, that supplier
            receives your delivery address in order to send it.
          </li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          We do not sell your information, and we do not pass it to anyone for their own marketing.
          Some of these companies process data outside the UK, under the safeguards UK data
          protection law requires.
        </p>

        <h2 style={{ marginTop: "2rem" }}>How long we keep it</h2>
        <p>
          Order and payment records for six years after the tax year they fall in, because HMRC
          requires it. Your account, your dog profiles and your marketing preferences for as long as
          you have an account with us. Ask us to close it and we delete everything we are not
          legally required to keep.
        </p>

        <h2 style={{ marginTop: "2rem" }}>What you can ask us to do</h2>
        <p>
          Under UK GDPR you can ask for a copy of what we hold, ask us to correct it, ask us to
          delete it, ask us to stop using it for a particular purpose, and object to marketing at any
          time. Email {detail("contactEmail")} and we will action it within one month, free of
          charge.
        </p>
        <p style={{ marginTop: "1rem" }}>
          If we get it wrong you can complain to the Information Commissioner&apos;s Office at
          ico.org.uk. We would rather you told us first so we can fix it.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Cookies</h2>
        <p>
          We use the minimum. There are cookies that keep you signed in and remember your basket, and
          without them the shop cannot work, so they need no consent. We do not run advertising or
          tracking cookies. If that changes we will ask you first.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/terms">Terms</Link> · <Link href="/contact">Contact us</Link>
        </p>
      </div>
    </main>
  );
}
