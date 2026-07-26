import { describe, it, expect } from "vitest";
import {
  REDEEM_POINTS_PER_POUND,
  pointsToPounds,
  customerPoints,
  buildPointsReport,
} from "./loyalty";

describe("the redemption rate", () => {
  it("is the spec's flat hundred points to the pound", () => {
    expect(REDEEM_POINTS_PER_POUND).toBe(100);
    expect(pointsToPounds(250)).toBe(2.5);
    expect(pointsToPounds(0)).toBe(0);
  });
});

describe("customerPoints", () => {
  it("reads a balance", () => {
    expect(customerPoints({ pointsBalance: 340 })).toBe(340);
  });

  it("counts nothing for a doc without one, which is every doc the account page creates", () => {
    expect(customerPoints({ email: "a@b.com", name: "Sam", dogs: [] })).toBe(0);
  });

  it("refuses to count rubbish: strings, negatives, infinities", () => {
    expect(customerPoints({ pointsBalance: "lots" })).toBe(0);
    expect(customerPoints({ pointsBalance: -50 })).toBe(0);
    expect(customerPoints({ pointsBalance: Infinity })).toBe(0);
  });

  it("floors a fraction, since a part point cannot be spent", () => {
    expect(customerPoints({ pointsBalance: 99.9 })).toBe(99);
  });
});

describe("buildPointsReport", () => {
  it("is all zeros with no rows on an empty dataset, which is the live project today", () => {
    expect(buildPointsReport([])).toEqual({ totalPoints: 0, totalPounds: 0, rows: [] });
  });

  it("keeps zero balances out of the table but counts every point in the totals", () => {
    const report = buildPointsReport([
      { uid: "a", data: { name: "Ann", email: "ann@example.com", pointsBalance: 150 } },
      { uid: "b", data: { name: "Bob", email: "bob@example.com" } },
      { uid: "c", data: { name: "Cat", email: "cat@example.com", pointsBalance: 700 } },
    ]);
    expect(report.totalPoints).toBe(850);
    expect(report.totalPounds).toBe(8.5);
    expect(report.rows.map((r) => r.uid)).toEqual(["c", "a"]);
    expect(report.rows[0]).toEqual({
      uid: "c",
      name: "Cat",
      email: "cat@example.com",
      points: 700,
      pounds: 7,
    });
  });

  it("breaks a points tie by email so the order is stable run to run", () => {
    const report = buildPointsReport([
      { uid: "z", data: { email: "zoe@example.com", pointsBalance: 100 } },
      { uid: "a", data: { email: "amy@example.com", pointsBalance: 100 } },
    ]);
    expect(report.rows.map((r) => r.email)).toEqual(["amy@example.com", "zoe@example.com"]);
  });

  it("survives docs with no name or email rather than dropping the money they are owed", () => {
    const report = buildPointsReport([{ uid: "x", data: { pointsBalance: 50 } }]);
    expect(report.rows).toEqual([{ uid: "x", name: "", email: "", points: 50, pounds: 0.5 }]);
    expect(report.totalPoints).toBe(50);
  });
});
