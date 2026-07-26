/* eslint-disable react/no-unescaped-entities */
import { getPublicProducts, toCatalogue } from "@/lib/products-store";
import { ProductCard } from "@/components/ProductCard";
import { PawTrail } from "@/components/PawTrail";
import { EmailCapture } from "@/components/EmailCapture";
import { RingHero } from "@/components/Ring";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = (await getPublicProducts()).map(toCatalogue);
  return (
    <main>
      {/* THE RING: positioning first, navigation second (spec section 3.2). */}
      <RingHero />

      {/* HERO */}
      <section className="band hero" style={{ background: "#000", color: "#fff" }}>
        <div
          className="wrap"
          style={{ display: "flex", gap: "2.5rem", alignItems: "center", flexWrap: "wrap" }}
        >
          <div style={{ flex: "1 1 340px" }}>
            {/* An h2 since the ring hero above carries the page's single h1. */}
            <h2 className="display">You've been lied to.</h2>
            <p className="hero__sub">
              The "beef" treat in your cupboard is roughly 2% beef. The "dental stick" is basically a
              cereal biscuit with a few milligrams of flavouring. You didn't know, because the label
              was written so you wouldn't.
            </p>
            <p className="hero__intro">
              Barking Raw is natural dog food and treats with nothing to hide: one honest
              ingredient, named in full, posted to your door.
            </p>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
              <a className="btn btn--solid-paper" href="#truth">
                Show me what's really in them
              </a>
              <a className="btn" href="#products" style={{ color: "#fff" }}>
                Shop the treats
              </a>
            </div>
          </div>
          <div style={{ flex: "0 1 300px", display: "flex", justifyContent: "center", width: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.jpeg"
              alt="Barking Raw, Natural Dog Food"
              style={{ maxHeight: 400, width: "auto", maxWidth: "100%" }}
            />
          </div>
        </div>
      </section>

      <EmailCapture source="home" heading="Free hints and tips, one pillar at a time" sub="Four short emails over a fortnight: good food, comfy walks, fun and games, cosy sleep. No spam, no selling your address." />

      {/* WHAT'S REALLY IN THEM */}
      <section className="band band--paper" id="truth">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">What's really in them</p>
            <h2 className="display">Their words. Not ours.</h2>
            <p>Every one of these is lifted straight off a real UK label.</p>
          </div>
          <div className="callouts">
            <div className="callout">
              <b>"Beef &amp; Poultry" that's 2% beef and 2% poultry.</b>
              <p>
                Pedigree Jumbone spells it out itself: "equivalent to Beef 2% and Poultry 2%," with
                "Various Sugars" sitting above the meat as the third ingredient.
              </p>
            </div>
            <div className="callout">
              <b>Sugar as the third ingredient.</b>
              <p>
                Pedigree Markies list "various sugars" third on the pack, a group term that lets a
                brand add sugar without ever naming what it is or how much went in.
              </p>
            </div>
            <div className="callout">
              <b>The "dental stick" that's a cereal stick.</b>
              <p>
                Pedigree Dentastix begin with "Cereals." The beefy, chicken-y bit? Beef flavour at
                5.8 mg per kg and chicken flavour at 9.7 mg per kg. Milligrams. Of flavouring.
              </p>
            </div>
            <div className="callout">
              <b>59% cereals, 4% beef, 0.3% carrot.</b>
              <p>
                Bakers Beef with Vegetables, by their own declaration: wholegrain cereals 59%, of
                which 4% beef, plus 0.3% dried pea and 0.3% dried carrot. Guess which one is on the
                front of the box.
              </p>
            </div>
            <div className="callout callout--full">
              <b>Vague by design, and it's legal.</b>
              <p>
                UK and EU law lets brands write "meat and animal derivatives" and "cereals" instead
                of naming a single thing. That is a choice. We choose the opposite: open
                declaration, every ingredient named.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BIOLOGY */}
      <section className="band band--ink">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow" style={{ color: "#fff" }}>
              Your dog wasn't built for it
            </p>
            <h2 className="display">A gut made for meat, not cereal.</h2>
            <p>
              Here is the part the label never mentions. Your dog isn't a wolf, and isn't a bin.
              Dogs evolved alongside us for thousands of years and can digest some starch, more than
              wolves can. So this isn't about banning every carbohydrate.
            </p>
            <p>
              It's about what a dog is built for. Shearing teeth made to tear meat, not grind grain.
              A short, simple gut suited to meat rather than long plant fermentation. A stomach
              sitting around pH 1 to 2, acidic enough to handle raw and dried meat with ease. And no
              salivary amylase, so digestion of starch doesn't even begin in the mouth.
            </p>
            <p>
              None of that says "feed me a cereal biscuit dyed to look like a bone." Dogs are
              adaptable, meat-first animals, and studies suggest they do well on meat-rich, minimally
              processed food, with firmer stools a fairly consistent finding. Built to tear and
              digest meat. So we gave them meat.
            </p>
          </div>
        </div>
      </section>

      {/* SO WE DID THE DIGGING + TRUST */}
      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">So we did the digging</p>
            <h2 className="display">Real food, honestly labelled.</h2>
            <p>
              Once you've read a few real labels, you can't unread them. So we went looking for the
              opposite of all that: treats a dog would actually recognise as food.
            </p>
            <p>
              No cereal fillers. No "various sugars." No propylene glycol, a close chemical relative
              of the glycol used in antifreeze, which regulators allow in dog food but banned from
              cat food back in 1996. No ethoxyquin, the synthetic preservative EU regulators
              withdrew from animal feed because its safety couldn't be confirmed. Just single
              ingredients, air-dried or gently cooked, named in full on the pack.
            </p>
          </div>
          <div className="trust" style={{ marginTop: "2.6rem" }}>
            <div className="trust__item">
              <b>One honest ingredient</b>
              <p>If it's beef trachea, it's beef trachea. That's the list.</p>
            </div>
            <div className="trust__item">
              <b>Nothing hidden</b>
              <p>Open declaration, every ingredient named. No group terms.</p>
            </div>
            <div className="trust__item">
              <b>Posted to your door</b>
              <p>Sealed, dried, and dropped straight through the letterbox.</p>
            </div>
            <div className="trust__item">
              <b>Free local, free over £35</b>
              <p>Free to DD1 to DD6. £3.95 elsewhere, free over £35.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="band band--paper" id="products">
        <div className="wrap wrap--tight">
          <div className="products__head">
            <div className="section-head">
              <p className="eyebrow">The treats</p>
              <h2 className="display">Nine ways to feed them the truth.</h2>
            </div>
          </div>
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="band band--ink">
        <div className="wrap">
          <div className="section-head" style={{ margin: "0 auto 2.4rem", textAlign: "center" }}>
            <h2 className="display">Good questions, honest answers.</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Are these safe? Do I need to supervise?</summary>
              <p>
                Yes, always supervise your dog with any chew or treat, especially the first time and
                with anything containing bone. Every dog eats differently. Pick a size and texture
                that suits your chewer, and keep fresh water down.
              </p>
            </details>
            <details>
              <summary>How do I store them?</summary>
              <p>
                These are natural, air-dried treats, so keep them somewhere cool and dry in a sealed
                bag or tub. No fridge needed for the dried ranges. They keep well, but they're real
                food, so use common sense on smell and texture.
              </p>
            </details>
            <details>
              <summary>What about delivery and postage?</summary>
              <p>
                Free delivery across DD1 to DD6. Everywhere else in the UK is a flat £3.95, and
                delivery is free on any order over £35. Everything posts sealed, straight to your
                door.
              </p>
            </details>
            <details>
              <summary>Are they suitable for puppies and seniors?</summary>
              <p>
                Many are, but it depends on the dog and the chew. Softer options suit gentler
                mouths, while harder chews suit confident adult chewers. If your dog is very young,
                very old, or has dental issues, choose a softer treat, supervise closely, and check
                with your vet if you're unsure.
              </p>
            </details>
            <details>
              <summary>Raw versus cooked, which is safe here?</summary>
              <p>
                Our fish and salmon treats are cooked or dried, never raw, because raw salmon can
                carry a fluke-borne illness that's serious in dogs. Our raw meaty bones like duck
                wings are air-dried and must never be cooked, since cooking makes bones brittle and
                prone to splintering. We're specific on every product for a reason.
              </p>
            </details>
            <details>
              <summary>What makes these different from supermarket treats?</summary>
              <p>
                Supermarket treats often lead with cereals, added sugars, humectants and vague
                "derivatives," all legal, all forgettable to your dog. Ours are single, named
                ingredients with nothing hidden. It's the difference between a flavoured cereal
                biscuit and an actual piece of meat or fish.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="band band--paper">
        <PawTrail />
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2rem, 1.4rem + 3vw, 3.6rem)" }}>
            Read one honest label. You'll never go back.
          </h2>
          <p style={{ maxWidth: "54ch", margin: "1.2rem auto 2rem", opacity: 0.8 }}>
            Real meat and fish, air-dried and named in full, posted to your door. Free over £35, free
            across DD1 to DD6.
          </p>
          <a className="btn btn--solid-ink" href="#products">
            Feed them the truth
          </a>
        </div>
      </section>

      {/* The footer now lives in the root layout, so it carries the legal links on
          every page rather than only on this one. */}
    </main>
  );
}
