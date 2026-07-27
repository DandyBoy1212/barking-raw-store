import Link from "next/link";
import { listDogFeatures } from "@/lib/dogs-of-the-day-store";

/**
 * The members-area strip for Dogs of the Day (spec 10.2: photos out, discussion
 * in). A self-contained async server component: it fetches its own data, so
 * mounting is one line with no wiring.
 *
 * NOT mounted anywhere by this track. The members page belongs to another
 * track and carries a placeholder paragraph; the coordinator swaps that for
 * <DogsOfTheDayStrip /> at merge time.
 */
export default async function DogsOfTheDayStrip() {
  const features = await listDogFeatures(6);

  return (
    <div>
      <h2 style={{ fontSize: "1.1rem", textTransform: "uppercase" }}>Dogs of the day</h2>
      {features.length === 0 ? (
        <p style={{ opacity: 0.7 }}>
          The dogs we meet at the stall land here first. Nobody featured just yet.
        </p>
      ) : (
        <div style={{ display: "flex", gap: "0.8rem", overflowX: "auto", padding: "0.4rem 0" }}>
          {features.map((dog) => (
            <figure key={dog.id} style={{ margin: 0, flex: "0 0 auto", width: 120 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dog.photo}
                alt={dog.dogName}
                loading="lazy"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "2px solid #0b0b0b",
                }}
              />
              <figcaption style={{ marginTop: "0.3rem", fontWeight: 700, fontSize: "0.9rem" }}>
                {dog.dogName}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p style={{ marginTop: "0.4rem" }}>
        <Link href="/dogs-of-the-day">See them all</Link>
      </p>
    </div>
  );
}
