import type { Metadata } from "next";
import Link from "next/link";
import { PendingDetails } from "@/components/legal/PendingDetails";
import { BUSINESS, detail, provided } from "@/data/business";

export const metadata: Metadata = {
  title: "Terms & Conditions | Barking Raw",
  description:
    "The terms you buy under at Barking Raw: who we are, how an order is made, prices and payment, delivery, your right to cancel, and the limits of what we promise.",
};

export default function TermsPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          Terms and conditions
        </h1>

        <PendingDetails />

        <h2 style={{ marginTop: "2rem" }}>1. Who you are buying from</h2>
        <p>
          This shop is run by {detail("legalName")}, trading as Barking Raw, of {detail("address")}.
          You can reach us at {detail("contactEmail")}
          {provided("contactPhone") ? ` or on ${detail("contactPhone")}` : ""}.
          {provided("companyNumber") ? ` Company number ${detail("companyNumber")}.` : ""}
          {provided("vatNumber") ? ` VAT number ${detail("vatNumber")}.` : ""}
        </p>

        <h2 style={{ marginTop: "2rem" }}>2. How an order is made</h2>
        <p>
          Adding something to your basket is not an order. Your order is made when you pay, and our
          confirmation email is an acknowledgement: the contract is accepted when we dispatch your
          goods. If we cannot fulfil an order, because something has sold out or a price was listed
          wrongly, we will tell you and refund you in full. We do not send a substitute without
          asking you first.
        </p>

        <h2 style={{ marginTop: "2rem" }}>3. Prices and payment</h2>
        <p>
          Prices are in pounds sterling and include VAT where it applies. Postage is shown in your
          basket before you pay, and the total you see at the checkout is the total you are charged.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Payment is taken by Stripe. Your card details go to Stripe and not to us. If a price is
          obviously wrong, and by obviously we mean wrong enough that you would have noticed too, we
          are not obliged to honour it.
        </p>

        <h2 style={{ marginTop: "2rem" }}>4. Delivery</h2>
        <p>
          Set out on our <Link href="/delivery">delivery page</Link>, which forms part of these terms.
          Some orders arrive in more than one parcel, because a few items post direct from the
          supplier who stocks them. Goods are our responsibility until they are delivered to the
          address you gave, and from that point the risk in them passes to you.
        </p>
        <p style={{ marginTop: "1rem" }}>
          If a parcel arrives visibly damaged or unsealed, please tell us within 48 hours with a
          photo where you can. That is a request that helps us claim against the courier, not a
          limit on your rights: your statutory remedies for faulty goods are unaffected and are set
          out on the returns page.
        </p>

        <h2 style={{ marginTop: "2rem" }}>5. Cancelling and returning</h2>
        <p>
          Set out on our <Link href="/returns">returns and cancellations page</Link>, which also
          forms part of these terms. In short: 14 days to change your mind on most things, food and
          hygiene-sealed items excepted once opened, and none of that limits your rights when
          something is faulty.
        </p>

        <h2 style={{ marginTop: "2rem" }}>6. Feeding your dog is your decision</h2>
        <p>
          Our treats are sold as complementary pet food: they sit alongside your dog&apos;s main
          diet rather than replacing it. They are natural dehydrated products, weighed and
          repackaged by us under the hygiene rules that govern animal by-products, and because they
          are natural, individual pieces vary a little in size, colour and texture. Stated weights
          are minimums.
        </p>
        <p style={{ marginTop: "1rem" }}>
          We describe what is in our products honestly and we say what they are good for. We are not
          your vet, and nothing on this site is veterinary advice. If your dog is unwell, on a
          prescription diet, pregnant, very young or very old, ask your vet before you change what
          they eat.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Chews and treats should be given with somebody in the room. Choose a size that suits your
          dog, take it away when it gets small enough to swallow whole, and give fresh water with
          anything dried. Raw and dried animal products should be handled and stored like any other
          raw meat, and hands washed after.
        </p>

        <h2 style={{ marginTop: "2rem" }}>7. Your account</h2>
        <p>
          Keep your sign-in link to yourself. Tell us if you think somebody else has used your
          account. We may close an account that is being used fraudulently or to abuse our staff, and
          we will refund anything already paid for and not yet sent.
        </p>

        <h2 style={{ marginTop: "2rem" }}>8. Points and discounts</h2>
        <p>
          Loyalty points have no cash value, cannot be exchanged for money and cannot be transferred
          between accounts. They do not expire. We may change how points are earned in future, and if
          we do it will not affect points you have already collected. Discount codes are single use
          per customer unless we say otherwise, and cannot be combined.
        </p>

        <h2 style={{ marginTop: "2rem" }}>9. What we are responsible for</h2>
        <p>
          If we fail to meet these terms, we are responsible for loss you suffer that is a
          foreseeable result of it. We are not responsible for loss that was not foreseeable, or for
          business losses, since we supply to households rather than to businesses.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Nothing in these terms limits our liability for death or personal injury caused by our
          negligence, for fraud, or for anything else the law does not allow us to limit. Your
          statutory rights are unaffected by anything written here.
        </p>

        <h2 style={{ marginTop: "2rem" }}>10. Changes</h2>
        <p>
          We may change these terms. The version that applies to your order is the one on the site
          when you placed it.
        </p>

        <h2 style={{ marginTop: "2rem" }}>11. Which law applies</h2>
        <p>
          These terms are governed by the law of {BUSINESS.jurisdiction}, and disputes can be brought
          in the Scottish courts. If you live elsewhere in the UK you keep the protection of your own
          local consumer law and can bring a claim in your own courts.
        </p>

        <p style={{ marginTop: "2rem", opacity: 0.6, fontSize: ".85rem" }}>
          Document reference RA-TCS-01, effective July 2026, reviewed annually.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/privacy">Privacy notice</Link> · <Link href="/contact">Contact us</Link>
        </p>
      </div>
    </main>
  );
}
