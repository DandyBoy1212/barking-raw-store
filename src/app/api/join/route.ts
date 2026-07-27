import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import { recordAttempt } from "@/lib/stall-session";
import { validateStallRecord } from "@/lib/stall-record";
import { applyStallRecord, sendStallWelcomeEmail } from "@/lib/stall-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance, the /api/subscribe caveat: a platform
// level rate limit should back this up. Ten submits in fifteen minutes is
// plenty for a family at the stall and useless for a scraper.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_ATTEMPTS = 10;
const attemptsByCaller = new Map<string, number[]>();

function callerId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const MAX_DOGS = 10;

/**
 * The QR self-serve fallback, spec 10.1: the poster route for the customer's
 * own phone. Not PIN gated (it is their device), so it carries the public
 * route protections instead, but it validates with the same validator, applies
 * through the same applyStallRecord (same membership flag, same idempotency
 * marker, same subscriber seam) and sends the same welcome email as the iPad's
 * sync route. Both routes write the same record, by construction.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  }

  // Not /api/subscribe's silent ok: a dropped submit here would lose a signup
  // the phone believes synced. An honest 429 keeps the record on the phone,
  // and the stable clientId makes the retry idempotent.
  const caller = callerId(req);
  const attempt = recordAttempt(
    attemptsByCaller.get(caller) ?? [],
    Date.now(),
    THROTTLE_WINDOW_MS,
    THROTTLE_MAX_ATTEMPTS,
  );
  attemptsByCaller.set(caller, attempt.kept);
  if (!attempt.allowed) {
    console.error("[join] throttled:", caller);
    return NextResponse.json(
      { ok: false, error: "Give it a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Bad record."] }, { status: 400 });
  }

  const parsed = validateStallRecord(body, new Date().toISOString());
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  // Public-route hardening: the join page never offers photos, and this route
  // enforces it. Accepting inline photoData here would let anyone store an
  // arbitrary image in our bucket, where it would then pass the own-host guard
  // and be featurable on a public page. The dog cap matches the page's.
  const record = {
    ...parsed.record,
    dogs: parsed.record.dogs.slice(0, MAX_DOGS).map(({ value }) => ({ value })),
  };

  const result = await applyStallRecord(record);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Could not save just now." }, { status: 503 });
  }

  // Same rule as the iPad's sync: only a freshly created signup is welcomed,
  // so a retried submit cannot email twice.
  if (result.created) await sendStallWelcomeEmail(record, siteUrl);

  return NextResponse.json({ ok: true });
}
