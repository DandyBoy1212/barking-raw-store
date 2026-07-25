import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin, buildActionCodeSettings } from "@/lib/auth-helpers";
import { getAuthAdmin } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { validateStallRecord, stallWelcomeEmailHtml } from "@/lib/stall-record";
import { applyStallRecord } from "@/lib/stall-store";
import { hasStallAccess } from "@/lib/stall-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Take one queued stall record. The client maps the response onto a queue outcome:
 * 2xx synced, 400 rejected (kept and flagged, never dropped), anything else retry.
 * 401 also tells the iPad its stall session has ended.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  }
  if (!(await hasStallAccess())) {
    return NextResponse.json({ ok: false, error: "The stall session has ended." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad record."] }, { status: 400 });
  }

  const parsed = validateStallRecord(body, new Date().toISOString());
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  const result = await applyStallRecord(parsed.record);
  if (!result.ok) {
    // Retryable: the record stays queued on the iPad and comes back later.
    return NextResponse.json({ ok: false, error: "Could not save just now." }, { status: 503 });
  }

  // The welcome email, spec 10.1.1: the magic link goes out afterwards, so the
  // first sign-in lands on this record. Best effort only, a send failure logs and
  // never blocks the sync, and only a freshly created signup gets one, so a
  // retried record cannot email twice.
  if (result.created && parsed.record.email) {
    const auth = getAuthAdmin();
    if (auth) {
      try {
        const link = await auth.generateSignInWithEmailLink(
          parsed.record.email,
          buildActionCodeSettings(siteUrl),
        );
        const sent = await sendEmail(
          parsed.record.email,
          "Welcome to Barking Raw",
          stallWelcomeEmailHtml(link, parsed.record.name || undefined),
        );
        if (!sent) console.error("[stall/sync] welcome email did not send:", parsed.record.email);
      } catch (err) {
        console.error("[stall/sync] welcome email failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
