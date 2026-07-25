import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1 className="display">Your account</h1>
        <p>Signed in as {user.email}.</p>
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
        <p style={{ opacity: 0.7 }}>Points and order history arrive in a later stage.</p>
      </div>
    </main>
  );
}
