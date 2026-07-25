import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";
import { dogOwnerLabel } from "@/lib/customer-fields";
import { PawTrail } from "@/components/PawTrail";
import DogForm from "@/components/account/DogForm";
import DogList from "@/components/account/DogList";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const customer = await getCustomer(user.uid);
  const dogs = customer?.dogs ?? [];
  const label = dogOwnerLabel(dogs);

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

            <DogList dogs={dogs} />
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
