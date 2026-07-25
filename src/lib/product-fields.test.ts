import { describe, it, expect } from "vitest";
import { isMembersOnly, leadTimeNote, supplierArrivalNote } from "@/lib/product-fields";

describe("isMembersOnly", () => {
  it("is false when there is no window", () => {
    expect(isMembersOnly({}, new Date("2026-08-01T12:00:00Z"))).toBe(false);
  });

  it("is true before the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-01T12:00:00Z")),
    ).toBe(true);
  });

  it("is false on the day the window closes", () => {
    expect(
      isMembersOnly({ membersOnlyUntil: "2026-08-10" }, new Date("2026-08-10T00:00:00Z")),
    ).toBe(false);
  });

  it("is false when the date is unparseable, so a typo never hides a product forever", () => {
    expect(isMembersOnly({ membersOnlyUntil: "next tuesday" }, new Date("2026-08-01T12:00:00Z"))).toBe(
      false,
    );
  });
});

describe("leadTimeNote", () => {
  it("is null for stock on the shelf", () => {
    expect(leadTimeNote({ leadTimeDays: 0 })).toBeNull();
  });

  it("names the wait in days", () => {
    expect(leadTimeNote({ leadTimeDays: 14 })).toBe("Ordered in for you, dispatches in 14 days");
  });

  it("uses the singular for one day", () => {
    expect(leadTimeNote({ leadTimeDays: 1 })).toBe("Ordered in for you, dispatches in 1 day");
  });
});

describe("supplierArrivalNote", () => {
  it("is null for her own stock", () => {
    expect(supplierArrivalNote({ fulfilment: "own-stock" })).toBeNull();
  });

  it("gives a range when one is set", () => {
    expect(
      supplierArrivalNote({
        fulfilment: "supplier-posted",
        supplierArrivalMinDays: 3,
        supplierArrivalMaxDays: 5,
      }),
    ).toBe("Posts separately, arrives in 3 to 5 days");
  });

  it("collapses an equal range to a single number", () => {
    expect(
      supplierArrivalNote({
        fulfilment: "supplier-posted",
        supplierArrivalMinDays: 4,
        supplierArrivalMaxDays: 4,
      }),
    ).toBe("Posts separately, arrives in 4 days");
  });

  it("still discloses the separate parcel when no timing is known", () => {
    expect(supplierArrivalNote({ fulfilment: "supplier-posted" })).toBe("Posts separately");
  });

  it("never says dropship", () => {
    const note = supplierArrivalNote({
      fulfilment: "supplier-posted",
      supplierArrivalMinDays: 3,
      supplierArrivalMaxDays: 5,
    });
    expect(note?.toLowerCase()).not.toContain("dropship");
  });
});
