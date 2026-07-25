import type { Metadata } from "next";
import Link from "next/link";
import { PendingFounderDetails } from "@/components/about/PendingFounderDetails";
import { founderDetail } from "@/data/founder";

export const metadata: Metadata = {
  title: "About Us | Barking Raw",
  description:
    "Who is behind Barking Raw: Michaela, the training she is doing in canine nutrition and Tellington TTouch, and why everything we sell has every ingredient named in full.",
};

export default function AboutPage() {
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Who we are</p>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}>
          About us
        </h1>

        <PendingFounderDetails />

        <p>
          Barking Raw is a small Dundee business run by Michaela. We sell natural dog food and
          treats online and from the market stall, built on one idea: dogs deserve food their
          owners can actually read.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Why Barking Raw exists</h2>
        <p>
          Go and read the label on a supermarket dog treat. Not the front, the back. You will find
          &quot;meat and animal derivatives&quot;, &quot;cereals&quot; and &quot;various
          sugars&quot;: group terms the law allows, each one a way of not telling you what is in
          the bag. A &quot;beef&quot; treat can be 2% beef. A dental stick can be a cereal biscuit
          with milligrams of flavouring. All legal. All written so you would not look twice.
        </p>
        <p style={{ marginTop: "1rem" }}>
          We read those labels and went looking for the opposite: single ingredients, named in
          full, air-dried or gently cooked, with nothing needing a group term to hide behind. That
          is the whole mission. Not scaring anyone about what is in the cupboard, just refusing to
          sell anything we would have to be vague about.
        </p>

        <h2 style={{ marginTop: "2rem" }}>Michaela&apos;s story</h2>
        <p>
          Michaela has had dogs her whole life, and has always believed in looking after them
          properly. That part never changed, through everything else that did.
        </p>
        <p style={{ marginTop: "1rem" }}>
          A few years ago life went hard. There was a stretch when leaving the house felt
          impossible and her mental health took the hit. What she built on the way back is what
          you are looking at: the stall, the shop, and the training she is doing to be better at
          the work she always wanted.
        </p>
        <p style={{ marginTop: "1rem" }}>
          Recently she said goodbye to two older dogs. There was a time when a loss like that
          would have stopped her for a long while. This time there are two new pups in the house
          and she has kept moving. That, more than anything on this page, is who is running this
          shop.
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
          Barking Raw is the first business, not the last. The long-term dream is kennels and
          doggy day care, run on everything Michaela is learning about nutrition, handling and
          care. This shop is what gets it started and what funds the way there.
        </p>
        <p style={{ marginTop: "1rem" }}>
          So when you buy from us, you are not feeding a faceless brand. You are backing one
          person, in Dundee, building the thing she always wanted to build. We think that is a
          better place for your money than a supermarket shelf.
        </p>

        <h2 style={{ marginTop: "2rem" }}>The four things we think matter</h2>
        <p>
          Most people start with training. We think that is the last bit, not the first. Get these
          four right and your dog will lap up training:
        </p>
        <ul style={{ margin: "1rem 0 0 1.1rem" }}>
          <li style={{ marginBottom: ".6rem" }}>
            <b>Good Food.</b> What goes in shows up in everything else.
          </li>
          <li style={{ marginBottom: ".6rem" }}>
            <b>Comfy Walks.</b> A dog that&apos;s choking on a collar isn&apos;t enjoying the
            walk. You&apos;re just dragging it.
          </li>
          <li style={{ marginBottom: ".6rem" }}>
            <b>Fun &amp; Games.</b> A bored dog will find his own fun. You won&apos;t like it.
          </li>
          <li>
            <b>Cosy Sleep.</b> An overtired dog can&apos;t think straight.
          </li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          You might notice touch and handling is not on that list, even though it is the thing
          Michaela is training in. That is deliberate. The four are things you provide for your
          dog, shelves you can shop from. Touch is different: it is something you learn to do, not
          something you buy. So it lives here and in what we teach, rather than pretending to be a
          shelf.
        </p>

        <h2 style={{ marginTop: "2rem" }}>How we choose what we sell</h2>
        <p>
          One rule: if we cannot name every ingredient in full, we do not stock it. No cereal
          fillers, no &quot;various sugars&quot;, no propylene glycol, the humectant regulators
          allow in dog food but banned from cat food back in 1996, and no ethoxyquin, the
          synthetic preservative EU regulators withdrew from animal feed because its safety could
          not be confirmed. We would rather have a shorter shelf than a vaguer label.
        </p>
        <p style={{ marginTop: "1rem" }}>
          And because honesty cuts both ways: we are not vets, and nothing here is veterinary
          advice. We say what is in our products and what they are good for, with sources behind
          the claims, and we tell you to supervise chews and check with your vet when it matters.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/contact">Contact us</Link> · <Link href="/#products">Shop the treats</Link>{" "}
          · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
