import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { normaliseSubscriberEmail } from "@/lib/subscribers";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#fff;color:#0b0b0b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:520px;padding:2rem;text-align:center">
<h1 style="font-weight:900;text-transform:uppercase">${title}</h1>
<p>${body}</p>
<p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * The unsubscribe link from every marketing email (spec 12.2). A GET because
 * it is opened straight from an email client; the signed token is what makes
 * that safe, since only our own emails can carry a valid one. Idempotent, so
 * clicking twice is fine. No same-origin guard on purpose: the link arrives
 * cross-origin by nature, and the HMAC is the guard.
 */
export async function GET(req: NextRequest) {
  const email = normaliseSubscriberEmail(req.nextUrl.searchParams.get("e"));
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  if (!email || !verifyUnsubscribeToken(email, token, secret)) {
    return page(
      "That link did not work.",
      "It may have been cut short by your email app. Reply to any of our emails and a human will take you off the list.",
      400,
    );
  }
  const db = getDb();
  if (!db) {
    return page("Not quite.", "We could not reach the list just now. Try the link again in a minute.", 503);
  }
  try {
    await db.collection(COLLECTIONS.subscribers).doc(email).set(
      {
        consent: false,
        unsubscribedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.error("[unsubscribe] write failed:", err);
    return page("Not quite.", "We could not reach the list just now. Try the link again in a minute.", 503);
  }
  return page(
    "You are unsubscribed.",
    "No more marketing email from us. Order and delivery emails still arrive when you buy something.",
  );
}
