import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { docToSubscriber, nextWelcomeAction } from "@/lib/subscribers";
import { codeWaitingEmail, storyEmail, STORY_TARGETS } from "@/lib/welcome-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCode(percent: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BR${percent}${rand}`;
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret set = allow (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The welcome sequence, same pattern as the abandoned-cart cron: find who is
 * due, send the next email, record it, so a re-run is harmless. One email per
 * contact per run. Unlike the abandoned cron, the position only advances when
 * the send succeeded, so a Resend failure retries tomorrow rather than
 * silently skipping an email; a welcome sequence with a hole in it is worse
 * than one running a day late.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ skipped: "no db" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  const now = Date.now();
  let codes = 0;
  let stories = 0;
  let failures = 0;

  const snap = await db
    .collection(COLLECTIONS.subscribers)
    .where("consent", "==", true)
    .limit(500)
    .get();

  for (const doc of snap.docs) {
    const s = docToSubscriber(doc.id, doc.data() as Record<string, unknown>);
    const action = nextWelcomeAction(s, now);
    if (!action) continue;
    const emailArgs = { siteUrl, email: s.email, secret };

    if (action.type === "code") {
      let code = s.discountCode;
      if (!code) {
        code = makeCode(10);
        // Same collection and shape the checkout validates: exists, not used,
        // not expired. Recorded on the subscriber before the send, so a failed
        // send reuses this code tomorrow instead of minting a second one.
        await db.collection(COLLECTIONS.discountCodes).doc(code).set({
          percent: 10,
          subscriberEmail: s.email,
          used: false,
          expiresAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        await doc.ref.set(
          { discountCode: code, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
      const { subject, html } = codeWaitingEmail({ code, ...emailArgs });
      if (await sendEmail(s.email, subject, html)) {
        await doc.ref.set(
          { codeEmailSentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        codes++;
      } else {
        console.error("[cron/welcome] code email failed:", s.email);
        failures++;
      }
      continue;
    }

    const { subject, html } = storyEmail(action.index, emailArgs);
    if (await sendEmail(s.email, subject, html)) {
      await doc.ref.set(
        {
          sequencePosition: action.index + 1,
          lastSequenceSentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      stories++;
    } else {
      console.error("[cron/welcome] story email failed:", s.email, STORY_TARGETS[action.index].name);
      failures++;
    }
  }

  return NextResponse.json({ scanned: snap.size, codes, stories, failures });
}
