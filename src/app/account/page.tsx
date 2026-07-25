import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";
import { deriveLifeStage, dogOwnerLabel } from "@/lib/customer-fields";
import { SENSITIVITY_LABEL } from "@/data/customers";
import { Paw } from "@/components/Paw";
import { PawTrail } from "@/components/PawTrail";
import DogForm from "@/components/account/DogForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const customer = await getCustomer(user.uid);
  const dogs = customer?.dogs ?? [];
  const label = dogOwnerLabel(dogs);
  const now = new Date();

  return (
    <main>
      {/* The owner label is the whole personality of this page. Somebody who has told
          us about their dog gets greeted as that dog's owner, not as an email address. */}
      <section className="band band--ink">
        <div className="wrap wrap--tight" style={{ maxWidth: 720 }}>
          <p className="eyebrow">Your account</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 7vw, 4rem)" }}>
            {label || "Your account"}
          </h1>
          <p style={{ opacity: 0.75, marginTop: "0.9rem" }}>Signed in as {user.email}</p>
          {user.staff && (
            <p style={{ marginTop: "1.6rem" }}>
              <Link className="btn btn--solid-paper" href="/admin">
                Go to the staff area
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="band band--paper">
        <PawTrail />
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="panel">
            <p className="panel__title">Your dogs</p>

            {dogs.length === 0 ? (
              <p className="account-empty">
                No dogs yet. Tell us about yours and we will point you at what actually suits them.
              </p>
            ) : (
              dogs.map((dog) => {
                const stage = deriveLifeStage(dog.bornAt, now);
                return (
                  <article className="dog" key={dog.id}>
                    {dog.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dog__photo" src={dog.photo} alt={dog.name} />
                    ) : (
                      <Paw size={44} className="dog__paw" />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <h2 className="dog__name">{dog.name}</h2>
                      {dog.breed && <p className="dog__meta">{dog.breed}</p>}
                      <div className="dog__tags">
                        {stage !== "unknown" && <span className="badge">{stage}</span>}
                        {dog.size && <span className="badge">{dog.size}</span>}
                        {dog.activity && <span className="badge">{dog.activity} energy</span>}
                        {dog.sensitivities?.map((s) => (
                          <span className="badge" key={s}>
                            {SENSITIVITY_LABEL[s]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <DogForm />

          <p className="notice" style={{ marginTop: "1.6rem" }}>
            Points and order history arrive in a later stage.
          </p>
        </div>
      </section>
    </main>
  );
}
