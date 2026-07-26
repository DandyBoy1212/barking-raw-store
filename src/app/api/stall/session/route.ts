import { NextResponse, type NextRequest } from "next/server";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import {
  STALL_COOKIE_NAME,
  STALL_SESSION_MAX_AGE_MS,
  mintStallToken,
  pinMatches,
  recordAttempt,
} from "@/lib/stall-session";
import { stallKey } from "@/lib/stall-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance, same caveat as the /api/auth/link throttle:
// a platform-level rate limit should back this up. Five tries in fifteen minutes is
// plenty for one mistyped PIN and useless for guessing one.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_ATTEMPTS = 5;
const attemptsByCaller = new Map<string, number[]>();

function callerId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function originOk(req: NextRequest): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  return isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl);
}

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });

  const pin = process.env.STALL_PIN;
  if (!pin) {
    return NextResponse.json(
      { ok: false, error: "The stall PIN is not set up yet." },
      { status: 503 },
    );
  }

  const caller = callerId(req);
  const attempt = recordAttempt(
    attemptsByCaller.get(caller) ?? [],
    Date.now(),
    THROTTLE_WINDOW_MS,
    THROTTLE_MAX_ATTEMPTS,
  );
  attemptsByCaller.set(caller, attempt.kept);
  if (!attempt.allowed) {
    console.error("[stall/session] throttled:", caller);
    // Uniform with a wrong PIN, so the throttle gives nothing away.
    return NextResponse.json({ ok: false, error: "That PIN is not right." }, { status: 403 });
  }

  let body: { pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  if (!pinMatches(String(body.pin ?? ""), pin)) {
    return NextResponse.json({ ok: false, error: "That PIN is not right." }, { status: 403 });
  }

  const key = stallKey();
  if (!key) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 503 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STALL_COOKIE_NAME, mintStallToken(key, Date.now(), STALL_SESSION_MAX_AGE_MS), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(STALL_SESSION_MAX_AGE_MS / 1000),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 403 });
  // The client wipes its local queue before calling this: the wipe must not depend
  // on the network, and the logout must not depend on the wipe having synced.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(STALL_COOKIE_NAME);
  return res;
}
