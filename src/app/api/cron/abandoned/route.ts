import { NextResponse, type NextRequest } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const REMINDER_1_AFTER = 3 * HOUR; // a few hours later
const REMINDER_2_AFTER = 24 * HOUR; // next day

function makeCode(percent: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BR${percent}${rand}`;
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret set = allow (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ skipped: "no db" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const now = Date.now();
  let sent1 = 0;
  let sent2 = 0;

  const snap = await db
    .collection(COLLECTIONS.carts)
    .where("status", "==", "open")
    .limit(200)
    .get();

  for (const doc of snap.docs) {
    const c = doc.data();
    if (!c.email) continue;
    const updated: Timestamp | undefined = c.updatedAt;
    const age = updated ? now - updated.toMillis() : 0;

    // Second reminder: bigger, expiring discount.
    if (c.reminder1SentAt && !c.reminder2SentAt && age > REMINDER_2_AFTER) {
      const percent = 15;
      const code = makeCode(percent);
      const expiresAt = Timestamp.fromMillis(now + 24 * HOUR);
      await db.collection(COLLECTIONS.discountCodes).doc(code).set({
        percent,
        cartId: doc.id,
        used: false,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
      });
      await sendEmail(
        c.email,
        "Last chance: 15% off your dog's treats (expires today)",
        recoveryHtml(c.name, percent, code, siteUrl, true),
      );
      await doc.ref.set({ reminder2SentAt: FieldValue.serverTimestamp() }, { merge: true });
      sent2++;
      continue;
    }

    // First reminder: gentle nudge with a 10% code.
    if (!c.reminder1SentAt && age > REMINDER_1_AFTER) {
      const percent = 10;
      const code = makeCode(percent);
      await db.collection(COLLECTIONS.discountCodes).doc(code).set({
        percent,
        cartId: doc.id,
        used: false,
        expiresAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      await sendEmail(
        c.email,
        "You left some treats behind (here's 10% off)",
        recoveryHtml(c.name, percent, code, siteUrl, false),
      );
      await doc.ref.set({ reminder1SentAt: FieldValue.serverTimestamp() }, { merge: true });
      sent1++;
    }
  }

  return NextResponse.json({ scanned: snap.size, reminder1: sent1, reminder2: sent2 });
}

function recoveryHtml(
  name: string,
  percent: number,
  code: string,
  siteUrl: string,
  urgent: boolean,
): string {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Your dog's still waiting.</h1>
    <p>${hi}</p>
    <p>You left some honest, single-ingredient treats in your basket at Barking Raw.
    ${urgent ? "This is the last nudge, and it's the best one." : "Here's a little something to bring you back."}</p>
    <p style="font-size:22px;font-weight:900">${percent}% off with code <span style="background:#0b0b0b;color:#fff;padding:4px 10px;border-radius:6px">${code}</span></p>
    ${urgent ? "<p><b>This code expires in 24 hours.</b></p>" : ""}
    <p><a href="${siteUrl}/#products" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Finish your order</a></p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
  </div>`;
}
