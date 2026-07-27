import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getPointsReport } from "@/lib/loyalty-store";
import { REDEEM_POINTS_PER_POUND } from "@/lib/loyalty";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The points owed report (spec section 9): points never expire, so every point
 * issued is money off owed at some future date. This page is the "report the
 * outstanding balance somewhere Michaela can see it" the spec asks for.
 */
export default async function AdminPointsPage() {
  await requireStaff();
  const report = await getPointsReport();
  const cell = { padding: "0.5rem 0.6rem", verticalAlign: "top" as const };

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href="/admin">&larr; Admin</Link>
        </p>
        <h1 className="display">Points owed</h1>
        <p style={{ maxWidth: "56ch" }}>
          Points are money off and they never expire, so this is money the shop owes at
          some future date. {REDEEM_POINTS_PER_POUND} points make {gbp(1)} off an order.
        </p>

        <div className="panel" style={{ marginTop: "1.5rem" }}>
          <p className="panel__title">Outstanding right now</p>
          <p style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>
            {report.totalPoints.toLocaleString("en-GB")} points = {gbp(report.totalPounds)}
          </p>
        </div>

        {report.rows.length === 0 ? (
          <p className="notice" style={{ marginTop: "1.5rem" }}>
            Nobody is owed anything yet. Balances appear here with the first paid orders
            once points switch on.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", marginTop: "1.5rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={cell}>Customer</th>
                  <th style={cell}>Email</th>
                  <th style={cell}>Balance</th>
                  <th style={cell}>Worth</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.uid} style={{ borderTop: "1px solid #ddd" }}>
                    <td style={cell}>{r.name || <span style={{ opacity: 0.5 }}>No name yet</span>}</td>
                    <td style={cell}>{r.email || <span style={{ opacity: 0.5 }}>No email</span>}</td>
                    <td style={cell}>{r.points.toLocaleString("en-GB")}</td>
                    <td style={cell}>{gbp(r.pounds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
