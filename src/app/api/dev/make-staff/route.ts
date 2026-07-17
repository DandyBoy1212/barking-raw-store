import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuthAdmin, getDb, COLLECTIONS } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same bearer pattern as the cron routes: no secret set means allow (dev only).
// In production, an unset secret fails closed rather than opening the route to everyone.
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.SEED_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "no email" }, { status: 400 });
  }
  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  try {
    let uid: string;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      uid = (await auth.createUser({ email })).uid;
    }
    await auth.setCustomUserClaims(uid, { staff: true });
    await db.collection(COLLECTIONS.staff).doc(uid).set(
      { email, invitedBy: "bootstrap", createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    console.error("[make-staff] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
