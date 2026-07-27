import "server-only";
import { getDb, COLLECTIONS } from "@/lib/firebase-admin";
import { buildPointsReport, type PointsReport } from "@/lib/loyalty";

/**
 * The outstanding points liability across every customer. Server only IO glue,
 * mirroring customers-store: the maths lives in loyalty.ts, and a missing or
 * failing database degrades to the empty report rather than a broken page.
 */
export async function getPointsReport(): Promise<PointsReport> {
  const db = getDb();
  if (!db) return buildPointsReport([]);
  try {
    const snap = await db.collection(COLLECTIONS.customers).get();
    return buildPointsReport(
      snap.docs.map((d) => ({ uid: d.id, data: d.data() as Record<string, unknown> })),
    );
  } catch (err) {
    console.error("[loyalty-store] getPointsReport read failed:", err);
    return buildPointsReport([]);
  }
}
