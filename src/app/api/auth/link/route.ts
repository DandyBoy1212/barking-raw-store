import { NextResponse, type NextRequest } from "next/server";
import { getAuthAdmin } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { buildActionCodeSettings, signInEmailHtml, isAllowedOrigin } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance only: each cold start gets a fresh Map,
// and instances are not shared, so this does not enforce a global limit. A
// platform-level rate limit (e.g. Vercel/WAF) should back this up.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_REQUESTS = 3;
const recentRequestsByEmail = new Map<string, number[]>();

function isThrottled(email: string): boolean {
  const now = Date.now();
  const cutoff = now - THROTTLE_WINDOW_MS;
  for (const [key, timestamps] of recentRequestsByEmail) {
    const kept = timestamps.filter((t) => t > cutoff);
    if (kept.length === 0) recentRequestsByEmail.delete(key);
    else recentRequestsByEmail.set(key, kept);
  }
  const timestamps = recentRequestsByEmail.get(email) ?? [];
  if (timestamps.length >= THROTTLE_MAX_REQUESTS) return true;
  timestamps.push(now);
  recentRequestsByEmail.set(email, timestamps);
  return false;
}

export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isAllowedOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
  if (isThrottled(email)) {
    console.error("[auth/link] throttled:", email);
    // Uniform response: no signal to the caller that the throttle tripped.
    return NextResponse.json({ ok: true });
  }
  const auth = getAuthAdmin();
  if (!auth) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });

  try {
    const link = await auth.generateSignInWithEmailLink(email, buildActionCodeSettings(siteUrl));
    await sendEmail(email, "Your Barking Raw sign-in link", signInEmailHtml(link));
  } catch (err) {
    // Link generation does not depend on whether the address is registered, so
    // failures here are configuration or transient errors (not a signal to leak).
    // Log server-side but still return the uniform response below.
    console.error("[auth/link] failed:", err);
  }
  // Always report success so we never reveal whether an email is registered.
  return NextResponse.json({ ok: true });
}
