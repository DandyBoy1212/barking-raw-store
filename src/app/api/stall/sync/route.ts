import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { validateStallRecord } from "@/lib/stall-record";
import { applyStallRecord, sendStallWelcomeEmail } from "@/lib/stall-store";
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

  // Only a freshly created signup gets the magic-link welcome, so a retried
  // record cannot email twice. Best effort, inside the shared helper, which
  // /api/join uses too (both routes write the same record).
  if (result.created) await sendStallWelcomeEmail(parsed.record, siteUrl);

  return NextResponse.json({ ok: true });
}
