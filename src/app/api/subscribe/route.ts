import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { isBrowserSameOrigin } from "@/lib/auth-helpers";
import {
  CAPTURE_SOURCES,
  type CaptureSource,
  applySubscription,
  docToSubscriber,
  normaliseSubscriberEmail,
} from "@/lib/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per serverless instance only, same shape and reasoning as
// /api/auth/link: each cold start gets a fresh Map, so a platform-level rate
// limit should back this up.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_MAX_REQUESTS = 5;
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

/**
 * One list, deduplicated on the lower-cased email, which is the doc id.
 * Signing up here does NOT grant membership (spec 10.1). A repeat submit is
 * idempotent: applySubscription never touches the sequence position or an
 * issued code, and an unticked box never revokes earlier consent. The write
 * runs in a transaction because two tabs submitting at once would otherwise
 * race the read-modify-write.
 */
export async function POST(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  if (!isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { email?: unknown; source?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = normaliseSubscriberEmail(body.email);
  if (!email) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }
  if (!CAPTURE_SOURCES.includes(body.source as CaptureSource)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const source = body.source as CaptureSource;
  const consent = body.consent === true;

  if (isThrottled(email)) {
    // Uniform response, same as /api/auth/link: no signal that the throttle tripped.
    console.error("[subscribe] throttled:", email);
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Sign-up is not switched on yet." }, { status: 503 });
  }

  const ref = db.collection(COLLECTIONS.subscribers).doc(email);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists
        ? docToSubscriber(email, (snap.data() ?? {}) as Record<string, unknown>)
        : null;
      const change = applySubscription(existing, { source, consent });
      const fields: Record<string, unknown> = {
        ...change.fields,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (change.create) {
        fields.email = email;
        fields.sequencePosition = 0;
        fields.createdAt = FieldValue.serverTimestamp();
      }
      if (change.consentTurnedOn) {
        fields.consentAt = FieldValue.serverTimestamp();
        // Re-consent after an unsubscribe starts a clean slate.
        fields.unsubscribedAt = null;
      }
      tx.set(ref, fields, { merge: true });
    });
  } catch (err) {
    console.error("[subscribe] write failed:", err);
    return NextResponse.json({ error: "Something went wrong saving that." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
