import { NextResponse, type NextRequest } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ skipped: "no db" });

  const to = process.env.OWNER_EMAIL;
  if (!to) return NextResponse.json({ skipped: "no OWNER_EMAIL" });

  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("createdAt", ">=", since)
    .get();

  const count = snap.size;
  const revenue = snap.docs.reduce((sum, d) => sum + (d.data().total || 0), 0);

  await sendEmail(
    to,
    `Barking Raw: ${count} new order${count === 1 ? "" : "s"} yesterday`,
    `<div style="font-family:Arial,sans-serif;color:#0b0b0b">
      <h2>Good morning</h2>
      <p><b>${count}</b> new order${count === 1 ? "" : "s"} in the last 24 hours, worth <b>£${revenue.toFixed(2)}</b>.</p>
      <p>Open the fulfilment sheet to see what needs packing and posting.</p>
    </div>`,
  );

  return NextResponse.json({ count, revenue });
}
