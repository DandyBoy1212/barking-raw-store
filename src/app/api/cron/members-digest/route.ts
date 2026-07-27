import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { docToSubscriber } from "@/lib/subscribers";
import { listPublishedPosts } from "@/lib/posts-store";
import { getStoredProducts } from "@/lib/products-store";
import {
  digestWeekKey,
  selectDigestContent,
  digestRecipients,
  membersDigestEmail,
} from "@/lib/members-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret set = allow (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The weekly members digest, rung by .github/workflows/members-digest.yml
 * (both Vercel cron slots are taken, same story as the welcome sequence).
 *
 * Idempotent per ISO week: the run claims store_members_digest/{weekKey} with
 * create() BEFORE sending, so a rerun the same week hits ALREADY_EXISTS and
 * sends nothing. Chosen trade-off, recorded: if a run dies mid-send, the rest
 * of the list misses a week rather than anyone getting the email twice. A week
 * with nothing new claims nothing, so a post published later the same week
 * still goes out on a manual rerun.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ skipped: "no db" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
  const now = new Date();

  const [posts, products] = await Promise.all([listPublishedPosts(), getStoredProducts()]);
  const content = selectDigestContent(posts, products, now);
  if (!content) return NextResponse.json({ skipped: "nothing new this week" });

  const weekKey = digestWeekKey(now);
  const claimRef = db.collection(COLLECTIONS.membersDigest).doc(weekKey);
  try {
    await claimRef.create({ startedAt: FieldValue.serverTimestamp() });
  } catch {
    return NextResponse.json({ skipped: `already sent for ${weekKey}` });
  }

  // Members are store_customers docs carrying an email. The opted-out set is
  // anyone whose subscriber record (doc id = lower-cased email) shows an
  // explicit unsubscribe; one click stops every marketing-adjacent send.
  const custSnap = await db.collection(COLLECTIONS.customers).limit(500).get();
  const customerDocs = custSnap.docs.map((d) => d.data() as Record<string, unknown>);

  const candidates = digestRecipients(customerDocs, new Set());
  const optedOut = new Set<string>();
  if (candidates.length > 0) {
    const refs = candidates.map((e) => db.collection(COLLECTIONS.subscribers).doc(e));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (s.exists && docToSubscriber(s.id, s.data() as Record<string, unknown>).unsubscribed) {
        optedOut.add(s.id);
      }
    }
  }
  const recipients = digestRecipients(customerDocs, optedOut);

  let sent = 0;
  let failures = 0;
  for (const email of recipients) {
    const { subject, html } = membersDigestEmail({ content, siteUrl, email, secret });
    if (await sendEmail(email, subject, html)) sent++;
    else {
      console.error("[cron/members-digest] send failed:", email);
      failures++;
    }
  }

  await claimRef.set(
    {
      sentAt: FieldValue.serverTimestamp(),
      posts: content.posts.length,
      earlyAccess: content.earlyAccess.length,
      recipients: recipients.length,
      sent,
      failures,
    },
    { merge: true },
  );

  return NextResponse.json({ weekKey, recipients: recipients.length, sent, failures });
}
