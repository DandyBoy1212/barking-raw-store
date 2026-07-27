import type { Metadata } from "next";
import JoinForm from "@/components/join/JoinForm";

export const metadata: Metadata = {
  title: "Join Barking Raw",
  description:
    "Sign up at the stall from your own phone. Membership starts here or with your first order.",
};

/**
 * The QR self-serve fallback, spec 10.1: the short path on the stall banner
 * for anyone who does not want to stop and chat. Public on purpose, it is the
 * customer's own phone; the route behind it carries the public protections.
 */
export default function JoinPage() {
  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">The stall</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
            Join Barking Raw
          </h1>
          <p>
            Signing up here is what makes you a member: first look at the new stuff, and
            the stall offers in your inbox if you want them.
          </p>
        </div>
      </section>
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <JoinForm />
        </div>
      </section>
    </main>
  );
}
