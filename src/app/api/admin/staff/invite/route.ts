import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireStaff } from "@/lib/auth";
import { getAuthAdmin, getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { buildActionCodeSettings, signInEmailHtml } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const inviter = await requireStaff();
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  // Mirrors the make-staff and auth/link routes' email check.
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  try {
    let uid: string;
    let existingClaims: Record<string, unknown> | undefined;
    try {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
      existingClaims = user.customClaims;
    } catch (err) {
      // Only a genuine "no such user" should fall through to createUser.
      // Anything else (network, permission, etc.) is a real failure and must
      // not be masked as "the user does not exist yet".
      if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
      uid = (await auth.createUser({ email })).uid;
    }

    // Grant the staff claim (merged with whatever claims the user already
    // has, never replacing them) and record the invite before sending the
    // email. That ordering means if link generation or sending fails below,
    // the invitee already has staff access but no link in hand: logged
    // separately, naming the email, so an admin knows to re-send it.
    await auth.setCustomUserClaims(uid, { ...(existingClaims || {}), staff: true });
    await db.collection(COLLECTIONS.staff).doc(uid).set(
      { email, invitedBy: inviter.email, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
    try {
      const link = await auth.generateSignInWithEmailLink(email, buildActionCodeSettings(siteUrl));
      await sendEmail(email, "You have been added to Barking Raw admin", signInEmailHtml(link));
    } catch (err) {
      console.error(
        `[staff-invite] granted staff claim to "${email}" but link generation or sending failed, an admin must re-send:`,
        err,
      );
      return NextResponse.json({ ok: false, error: "invite failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    console.error("[staff-invite] failed:", err);
    return NextResponse.json({ ok: false, error: "invite failed" }, { status: 500 });
  }
}
