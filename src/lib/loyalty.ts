// Pure loyalty maths for the points owed report (spec section 9). Points are
// money off, they never expire, and every point issued is money owed at some
// future date, so Michaela needs to see the liability. No earn or redeem
// machinery exists yet (stage 5 was planned, not built); this module is the
// code's single definition of the redemption rate, so when that machinery
// lands it must import the rate from here rather than restating it.

/** Spec section 9: redemption is a flat 100 points to GBP 1. */
export const REDEEM_POINTS_PER_POUND = 100;

/** What a points balance is worth in pounds at the redemption rate. */
export function pointsToPounds(points: number): number {
  return Math.max(0, points) / REDEEM_POINTS_PER_POUND;
}

/**
 * A customer doc's points balance, read tolerantly: absent, non-numeric,
 * negative or infinite all count zero, and a fraction floors because a part
 * point cannot be spent. Every doc the account page creates has no balance at
 * all, so nothing a visitor can do to their own record inflates the liability.
 */
export function customerPoints(data: Record<string, unknown>): number {
  const n = Number(data.pointsBalance);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export type PointsRow = {
  uid: string;
  name: string;
  email: string;
  points: number;
  pounds: number;
};

export type PointsReport = {
  totalPoints: number;
  totalPounds: number;
  rows: PointsRow[];
};

/**
 * The outstanding points report: total liability, and who is owed what,
 * biggest balance first (email breaks a tie so the order is stable). Zero
 * balances stay out of the table because they are noise, not liability; the
 * totals count every point either way.
 */
export function buildPointsReport(
  docs: Array<{ uid: string; data: Record<string, unknown> }>,
): PointsReport {
  const rows = docs
    .map((d) => {
      const points = customerPoints(d.data);
      return {
        uid: d.uid,
        name: String(d.data.name ?? ""),
        email: String(d.data.email ?? ""),
        points,
        pounds: pointsToPounds(points),
      };
    })
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.email.localeCompare(b.email));

  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  return { totalPoints, totalPounds: pointsToPounds(totalPoints), rows };
}
