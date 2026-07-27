import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { currentUserIsMember } from "@/lib/membership";
import { listPublishedPosts } from "@/lib/posts-store";
import { getStoredProducts, splitByMembersOnly, toCatalogue } from "@/lib/products-store";
import { postFreshMs, postParagraphs, type Post } from "@/lib/posts";
import { ProductCard } from "@/components/ProductCard";
import { PawTrail } from "@/components/PawTrail";
import { DogsOfTheDayStrip } from "@/components/DogsOfTheDayStrip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members | Barking Raw",
  description: "Early access drops and Michaela's weekly posts, for Barking Raw members.",
};

function postDate(p: Post): string {
  const ms = postFreshMs(p);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The locked view for somebody signed in who is not yet a member. Honest about
 * how membership is earned (spec 10.1: an order, or the stall), and never a
 * client-side hide: a non-member gets this page and no member content at all.
 */
function LockedPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">Members</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)" }}>
            Nearly in.
          </h1>
          <p style={{ opacity: 0.85, marginTop: "0.9rem", maxWidth: "46ch" }}>
            The members area comes with your first order, or with signing up at the stall.
            Members see new stock first and can buy it before anyone else, so it would be
            unfair to hand that out at the door.
          </p>
          <p style={{ marginTop: "1.6rem" }}>
            <Link className="btn btn--solid-paper" href="/">
              Browse the shop
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const member = await currentUserIsMember();
  if (!member) return <LockedPage />;

  const [posts, stored] = await Promise.all([listPublishedPosts(), getStoredProducts()]);
  const drops = splitByMembersOnly(stored, new Date()).membersOnly.map(toCatalogue);

  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">Members</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)" }}>
            You see it first.
          </h1>
          <p style={{ opacity: 0.75, marginTop: "0.9rem" }}>Signed in as {user.email}</p>
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Early access</p>
            <h2 className="display">Buy it before anyone else.</h2>
          </div>
          {drops.length > 0 ? (
            <div className="grid">
              {drops.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          ) : (
            <p className="notice">
              Nothing is inside its early access window right now. New stock lands here
              first, before it reaches the shop, so keep an eye on the weekly email.
            </p>
          )}
        </div>
      </section>

      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <p className="eyebrow">From Michaela</p>
            <h2 className="display">This week&apos;s posts.</h2>
          </div>
          {posts.length > 0 ? (
            posts.map((p) => (
              <article key={p.id} className="panel" style={{ marginBottom: "1.4rem" }}>
                <p className="panel__title">{p.title}</p>
                {postDate(p) && (
                  <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "0.8rem" }}>
                    {postDate(p)}
                  </p>
                )}
                {postParagraphs(p.body).map((para, i) => (
                  <p key={i} style={{ marginBottom: "0.8rem", lineHeight: 1.6 }}>
                    {para}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <p className="notice">Michaela&apos;s first post is on its way. It lands here.</p>
          )}

          <p className="notice" style={{ marginTop: "1.6rem" }}>
            Your points balance will show here, in points and in pounds, once points switch
            on.
          </p>

          <DogsOfTheDayStrip />
        </div>
      </section>
    </main>
  );
}
