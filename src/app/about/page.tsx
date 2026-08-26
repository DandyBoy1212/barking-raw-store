import type { Metadata } from "next";
import Link from "next/link";
import { PendingFounderDetails } from "@/components/about/PendingFounderDetails";
import { founderDetail } from "@/data/founder";

export const metadata: Metadata = {
  title: "About Us | Barking Raw",
  description:
    "We read the back of the packet, and we could not unread it. What the law lets a dog treat label hide, what your dog is actually built to eat, and why one person in Dundee started a shop about it.",
};

/**
 * About is the argument, not a company biography.
 *
 * It takes the reader on the journey the home page used to carry: what is going
 * on in dog food, the case built in ascending order, the moment it stops being a
 * list and becomes a realisation, and only then why this shop exists. The shop is
 * mentioned once, at the end, because a page that sells at step two has not
 * earned step five.
 *
 * No other company is named anywhere on this page, by instruction. Every fact
 * below is true of the category and is attributed to the category. A fact that
 * could not survive losing its brand name was cut rather than reworded into a
 * recognisable hint.
 */
export default function AboutPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Who we are</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          We read the back of the packet.
        </h1>

        <p style={{ fontSize: "1.15rem", marginTop: "1.2rem" }}>
          And we could not unread it. This is what we found, in the order we found it.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>It starts with a word that means nothing</h2>
        <p>
          Go and get a packet of dog treats out of your cupboard. Not the front of the bag, the
          front is marketing. Turn it over and read the ingredients.
        </p>
        <p style={{ marginTop: "1rem" }}>
          You will probably find the words &quot;meat and animal derivatives&quot;. That is not a
          description. It is a legal category, and it is allowed to stand in for almost anything an
          animal is made of, from almost any animal, in almost any proportion. Next to it you will
          likely find &quot;cereals&quot;, which does not have to say which cereal. And
          &quot;various sugars&quot;, which does not have to say which sugars, or how much.
        </p>
        <p style={{ marginTop: "1rem" }}>
          None of that is a loophole somebody sneaked through. UK and EU labelling law permits those
          group terms outright. A brand can name every ingredient in full if it wants to. The ones
          using group terms are choosing not to.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>Then you start doing the arithmetic</h2>
        <p>
          Once you know to look, the percentages are the part that gets you, because the popular
          brands print them on the pack themselves. They are not hiding the numbers. They are
          relying on nobody adding them up.
        </p>
        <p style={{ marginTop: "1rem" }}>
          A treat sold on a picture of beef can be around two per cent beef. Not two per cent of the
          meat, two per cent of the treat. A biscuit named for beef and vegetables can be nearly
          sixty per cent cereal, four per cent beef, and a third of one per cent of the vegetable on
          the front of the box. Guess which of those three the packaging is about.
        </p>
        <p style={{ marginTop: "1rem" }}>
          And sugar. Not a trace, not an accident: sugar declared third in the list, above the meat,
          in a product for an animal that has no dietary need for it at all.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>Then you get to the dental sticks</h2>
        <p>This is where it stopped being funny for us.</p>
        <p style={{ marginTop: "1rem" }}>
          The chew shaped like a bone, sold on the promise of cleaning your dog&apos;s teeth, sold
          on a picture of meat. Read its ingredients and the first word is cereals. The meaty part,
          the part the whole product is named and sold on, can be present in milligrams per
          kilogram. Milligrams. Of flavouring.
        </p>
        <p style={{ marginTop: "1rem" }}>
          It is a cereal stick, dyed and shaped to look like something else, and it is being bought
          by people who think they are doing their dog a kindness.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>And then there is what gets added on purpose</h2>
        <p>
          Propylene glycol is a humectant, there to keep a soft treat soft. It is a close chemical
          relative of the glycol used in antifreeze. Regulators permit it in dog food. They banned
          it from cat food in 1996, because of what it did to cats.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Ethoxyquin is a synthetic preservative that EU regulators withdrew from animal feed
          because its safety could not be confirmed. It was originally developed as a rubber
          stabiliser.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Neither of those is a scandal. Both are legal, or were. That is rather the point.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>Here is the bit that actually floored us</h2>
        <p>None of the above is the worst part. The worst part is what it is being fed to.</p>
        <p style={{ marginTop: "1rem" }}>
          Dogs have lived alongside us for thousands of years and can handle some starch, so this is
          not about banning every carbohydrate. But look at what a dog is actually built from.
          Shearing teeth made to tear meat, not molars made to grind grain. A short, simple gut,
          suited to meat rather than the long fermentation of plants. A stomach sitting around pH 1
          to 2, acidic enough to handle raw and dried meat without blinking. And no salivary amylase
          at all, which means the digestion of starch does not even begin in your dog&apos;s mouth.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Read that list again and then picture the cereal biscuit, dyed brown, shaped like a bone,
          with the sugar above the meat.
        </p>
        <p style={{ marginTop: "1rem", fontSize: "1.15rem", fontWeight: 600 }}>
          That was the moment for us. If you have got this far, it is probably the moment for you
          too.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Because you cannot unknow it. You go back to the cupboard, and the bag you have been
          buying for years is suddenly a different object. That feeling, the slightly sick one, the
          one where you are annoyed at yourself even though none of it was your fault, is the
          feeling this whole shop came out of.
        </p>

        <h2 style={{ marginTop: "2.4rem" }}>So we did something about it</h2>
        <p>
          We did not set out to start a business. We set out to find treats we could feed our own
          dogs without having to look anything up. It turned out that if you insist on naming every
          single ingredient in full, most of the shelf disappears, and what is left is really quite
          simple. Meat. Fish. Air-dried or gently cooked. One thing, called by its name.
        </p>
        <p style={{ marginTop: "1rem" }}>
          That is the entire rule Barking Raw is built on, and it is the only rule we have: if we
          cannot name everything in it in full, we do not sell it. No group terms. Nothing on our
          shelf needs a word like &quot;derivatives&quot; to get past you.
        </p>
        <p style={{ marginTop: "1rem" }}>
          We are not here to frighten you about what is in your cupboard, and we are careful about
          what we claim. The deception is provable, so we say it plainly. Anything beyond that, we
          leave to your vet.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link className="btn btn--solid-ink" href="/shop">
            See what that leaves
          </Link>
        </p>

        <hr
          style={{
            margin: "3rem 0 2.4rem",
            border: 0,
            borderTop: "1px solid rgba(0,0,0,0.12)",
          }}
        />

        <p className="eyebrow">And who is &quot;we&quot;</p>
        <h2 style={{ marginTop: "0.4rem" }}>Michaela</h2>

        <PendingFounderDetails />

        <p>
          Barking Raw is a small Dundee business run by Michaela. We sell natural dog food and
          treats online and from the market stall. Michaela has had dogs her whole life, and has
          always believed in looking after them properly. That part never changed, through
          everything else that did.
        </p>
        <p style={{ marginTop: "1rem" }}>
          A few years ago life went hard. There was a stretch when leaving the house felt impossible
          and her mental health took the hit. What she built on the way back is what you are looking
          at: the stall, the shop, and the training she is doing to be better at the work she always
          wanted.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Recently she said goodbye to two older dogs. There was a time when a loss like that would
          have stopped her for a long while. This time there are two new pups in the house and she
          has kept moving. That, more than anything on this page, is who is running this shop.
        </p>

        <h2 style={{ marginTop: "2rem" }}>What she is learning</h2>
        <p>
          Michaela is currently working through two courses: one in canine nutrition (
          {founderDetail("nutritionCourse")}), and one in Tellington TTouch (
          {founderDetail("ttouchCourse")}), a gentle, hands-on method of touch and handling that
          helps dogs relax, settle and trust.
        </p>
        <p style={{ marginTop: "1rem" }}>
          You will notice we say training, not qualified. Both courses are underway, not finished,
          and we would rather tell you exactly where she is than round it up. When they are done,
          this page will name them properly. If we would not let a treat label be vague, we do not
          get to be vague about ourselves.
        </p>

        <h2 style={{ marginTop: "2rem" }}>The bigger plan</h2>
        <p>
          Barking Raw is the first business, not the last. The long-term dream is kennels and doggy
          day care, run on everything Michaela is learning about nutrition, handling and care. This
          shop is what gets it started and what funds the way there.
        </p>
        <p style={{ marginTop: "1rem" }}>
          So when you buy from us, you are not feeding a faceless brand. You are backing one person,
          in Dundee, building the thing she always wanted to build. We think that is a better place
          for your money than a supermarket shelf.
        </p>
        <p style={{ marginTop: "1rem" }}>
          And because honesty cuts both ways: we are not vets, and nothing here is veterinary
          advice. We say what is in our products and what they are good for, and we tell you to
          supervise chews and check with your vet when it matters.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/shop">Shop</Link> · <Link href="/delivery">Delivery</Link> ·{" "}
          <Link href="/contact">Contact us</Link> · <Link href="/terms">Terms</Link> ·{" "}
          <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
