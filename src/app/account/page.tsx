import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";
import { deriveLifeStage, dogOwnerLabel } from "@/lib/customer-fields";
import { SENSITIVITY_LABEL } from "@/data/customers";
import DogForm from "@/components/account/DogForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const customer = await getCustomer(user.uid);
  const dogs = customer?.dogs ?? [];
  const label = dogOwnerLabel(dogs);
  const now = new Date();

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1 className="display">Your account</h1>
        <p>{label ? `${label}, signed in as ${user.email}.` : `Signed in as ${user.email}.`}</p>

        {/* Staff had no route into the admin from anywhere in the site, so Michaela
            had to know and type the URL. This is the entry point until there is a
            proper staff nav. */}
        {user.staff && (
          <p style={{ marginTop: "1.5rem" }}>
            <Link className="btn btn--solid-ink" href="/admin">
              Go to the staff area
            </Link>
          </p>
        )}

        <h2 style={{ marginTop: "2rem" }}>Your dogs</h2>
        {dogs.length === 0 && <p style={{ opacity: 0.7 }}>No dogs yet. Add one below.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {dogs.map((dog) => {
            const stage = deriveLifeStage(dog.bornAt, now);
            return (
              <li key={dog.id} style={{ borderTop: "1px solid rgba(0,0,0,.1)", padding: "1rem 0" }}>
                <strong>{dog.name}</strong>
                {dog.breed ? `, ${dog.breed}` : ""}
                {stage !== "unknown" ? `, ${stage}` : ""}
                {dog.sensitivities?.length ? (
                  <div style={{ opacity: 0.7, fontSize: ".9rem" }}>
                    {dog.sensitivities.map((s) => SENSITIVITY_LABEL[s]).join(", ")}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <DogForm />

        <p style={{ opacity: 0.7, marginTop: "2rem" }}>
          Points and order history arrive in a later stage.
        </p>
      </div>
    </main>
  );
}
