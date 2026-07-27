import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listConsentedDogPhotos, listDogFeatures } from "@/lib/dogs-of-the-day-store";
import FeatureDogButton from "@/components/admin/FeatureDogButton";

export const dynamic = "force-dynamic";

/**
 * The Dogs of the Day picker (spec 10.2). Genuinely in /admin, not /stall: it
 * is not used at the table, so it stays behind the real staff session. Only
 * dogs whose owner ticked the photo box, with a photo on our own storage, are
 * offered, and a feature stores nothing about the owner.
 */
export default async function AdminDogsPage() {
  await requireStaff();
  const [dogs, features] = await Promise.all([listConsentedDogPhotos(), listDogFeatures(10)]);

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <p>
          <Link href="/admin">Back to admin</Link>
        </p>
        <h1 className="display">Dogs of the day</h1>

        <h2 style={{ marginTop: "1.6rem", fontSize: "1rem", textTransform: "uppercase" }}>
          Recently featured
        </h2>
        {features.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nobody featured yet.</p>
        ) : (
          <ul style={{ lineHeight: 1.8 }}>
            {features.map((f) => (
              <li key={f.id}>
                <b>{f.dogName}</b>
                {f.date && <> on {f.date}</>}
              </li>
            ))}
          </ul>
        )}

        <h2 style={{ marginTop: "2rem", fontSize: "1rem", textTransform: "uppercase" }}>
          Dogs you may feature
        </h2>
        {dogs.length === 0 && (
          <p style={{ opacity: 0.7 }}>
            Nobody has ticked the photo box yet. It is on the stall form&apos;s consent
            screen, and the photo comes from the last screen of a signup.
          </p>
        )}
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          {dogs.map((dog) => (
            <div
              key={`${dog.uid}-${dog.dogId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                border: "2px solid #0b0b0b",
                borderRadius: 8,
                padding: "1rem",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dog.photo}
                alt={dog.dogName}
                style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }}
              />
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: "1.1rem" }}>{dog.dogName}</b>
                {dog.ownerName && (
                  <div style={{ opacity: 0.7 }}>{dog.ownerName}&apos;s dog</div>
                )}
              </div>
              <FeatureDogButton dogName={dog.dogName} photo={dog.photo} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
