import type { Metadata } from "next";
import { listDogFeatures } from "@/lib/dogs-of-the-day-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dogs of the Day",
  description:
    "The dogs we met at the Barking Raw stall, with their owners' blessing. Photos out, always.",
};

/**
 * The public Dogs of the Day page, spec 10.2: photos out, discussion in. Every
 * photo here has already survived the own-storage host guard twice (at write
 * and again at read), and a feature carries nothing about the owner, so the
 * dog's name is the only word that could ever render.
 */
export default async function DogsOfTheDayPage() {
  const features = await listDogFeatures(30);

  return (
    <main>
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 900 }}>
          <p className="eyebrow">The stall</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>
            Dogs of the Day
          </h1>
          <p>The dogs we met at the stall, shared with their owners&apos; blessing.</p>
        </div>
      </section>
      <section className="band band--paper">
        <div className="wrap" style={{ maxWidth: 900 }}>
          {features.length === 0 ? (
            <p>The first stall dogs land here soon. Come and say hello on a Sunday.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "1.2rem",
              }}
            >
              {features.map((dog) => (
                <figure key={dog.id} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dog.photo}
                    alt={dog.dogName}
                    loading="lazy"
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: 12,
                      border: "2px solid #0b0b0b",
                    }}
                  />
                  <figcaption style={{ marginTop: "0.5rem", fontWeight: 800 }}>
                    {dog.dogName}
                    {dog.date && (
                      <span style={{ opacity: 0.6, fontWeight: 400 }}> · {dog.date}</span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
