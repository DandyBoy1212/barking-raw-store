import { NextResponse, type NextRequest } from "next/server";
import { getAuthAdmin } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { buildActionCodeSettings, signInEmailHtml } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const auth = getAuthAdmin();
  if (!auth) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const link = await auth.generateSignInWithEmailLink(email, buildActionCodeSettings(siteUrl));
  await sendEmail(email, "Your Barking Raw sign-in link", signInEmailHtml(link));
  // Always report success so we never reveal whether an email is registered.
  return NextResponse.json({ ok: true });
}
