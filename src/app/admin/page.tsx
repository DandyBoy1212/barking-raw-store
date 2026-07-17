import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <h1 className="display">Admin</h1>
        <p>Signed in as {user.email} (staff).</p>
        <p style={{ opacity: 0.7 }}>Product management arrives in Stage 3.</p>
      </div>
    </main>
  );
}
