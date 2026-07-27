import Link from "next/link";
import { ALL_PILLARS, PILLAR_LABELS, PILLAR_LINES } from "@/data/products";
import { RING_PHOTOS } from "@/lib/pillars";

/**
 * The ring: the home page's primary navigation (spec section 3.2). Desktop is one
 * circle in four photo wedges around a logo hub; mobile is a two by two grid of
 * circular tiles. Both are this one markup, switched in CSS, so they cannot drift.
 * The tiles stay plain and unprovocative: the ad challenges, the page teaches.
 */
export function RingHero() {
  return (
    <section className="band ring-hero" style={{ background: "#000", color: "#fff" }}>
      <div className="wrap">
        <div className="ring-hero__copy">
          <h1 className="display">Get these four right and your dog will lap up training.</h1>
          <p className="hero__sub">
            Most people start with training. That&apos;s the last bit, not the first.
          </p>
        </div>
        <div className="ring">
          {ALL_PILLARS.map((pillar) => (
            <Link key={pillar} href={`/${pillar}`} className={`ring__wedge ring__wedge--${pillar}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={RING_PHOTOS[pillar]} alt="" />
              <span className="ring__label">{PILLAR_LABELS[pillar]}</span>
            </Link>
          ))}
          <span className="ring__hub" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.jpeg" alt="" />
          </span>
        </div>
        <div className="pillar-lines">
          {ALL_PILLARS.map((pillar) => (
            <div className="pillar-lines__item" key={pillar}>
              <b>{PILLAR_LABELS[pillar]}</b>
              <p>{PILLAR_LINES[pillar]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
