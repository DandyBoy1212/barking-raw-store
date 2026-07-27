import { describe, it, expect } from "vitest";
import {
  digestWeekKey,
  selectDigestContent,
  digestRecipients,
  membersDigestEmail,
  type DigestContent,
} from "./members-digest";
import type { Post } from "./posts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-24T09:00:00Z"); // a Friday

function post(overrides: Partial<Post>): Post {
  return {
    id: "p1",
    title: "Good food first",
    body: "One.\n\nTwo.",
    published: true,
    createdAtMs: NOW.getTime() - 2 * DAY,
    publishedAtMs: null,
    ...overrides,
  };
}

describe("digestWeekKey", () => {
  it("is the ISO week, zero padded", () => {
    expect(digestWeekKey(new Date("2026-07-24T09:00:00Z"))).toBe("2026-W30");
    expect(digestWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
  });

  it("handles the year boundaries the ISO calendar is famous for", () => {
    // 1 Jan 2027 is a Friday in the last week of ISO 2026.
    expect(digestWeekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    // 30 Dec 2024 is a Monday in the first week of ISO 2025.
    expect(digestWeekKey(new Date("2024-12-30T12:00:00Z"))).toBe("2025-W01");
  });

  it("gives one key for the whole week, so a rerun lands on the same claim doc", () => {
    expect(digestWeekKey(new Date("2026-07-20T00:00:00Z"))).toBe(
      digestWeekKey(new Date("2026-07-26T23:59:59Z")),
    );
  });
});

describe("selectDigestContent", () => {
  const inWindow = { name: "Venison Sticks", price: 8.5, membersOnlyUntil: "2026-08-01" };
  const outOfWindow = { name: "Old Chews", price: 4, membersOnlyUntil: "2026-07-01" };

  it("sends when a post is fresh this week, carrying the current drops along", () => {
    const content = selectDigestContent([post({})], [inWindow, outOfWindow], NOW);
    expect(content).not.toBeNull();
    expect(content?.posts.map((p) => p.id)).toEqual(["p1"]);
    expect(content?.earlyAccess.map((p) => p.name)).toEqual(["Venison Sticks"]);
  });

  it("does not send when the only post is older than a week", () => {
    expect(selectDigestContent([post({ createdAtMs: NOW.getTime() - 8 * DAY })], [inWindow], NOW)).toBeNull();
  });

  it("does not send for an unpublished or undated post", () => {
    expect(selectDigestContent([post({ published: false })], [], NOW)).toBeNull();
    expect(selectDigestContent([post({ createdAtMs: null })], [], NOW)).toBeNull();
  });

  it("does not send on drops alone: the digest is the week's post", () => {
    expect(selectDigestContent([], [inWindow], NOW)).toBeNull();
  });

  it("counts a republished old post as this week's news", () => {
    const republished = post({
      createdAtMs: NOW.getTime() - 40 * DAY,
      publishedAtMs: NOW.getTime() - 1 * DAY,
    });
    expect(selectDigestContent([republished], [], NOW)?.posts).toHaveLength(1);
  });

  it("newest post first when the week had two", () => {
    const older = post({ id: "older", createdAtMs: NOW.getTime() - 5 * DAY });
    const newer = post({ id: "newer", createdAtMs: NOW.getTime() - 1 * DAY });
    expect(selectDigestContent([older, newer], [], NOW)?.posts.map((p) => p.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("digestRecipients", () => {
  it("normalises, deduplicates and drops the opted out and the email-less", () => {
    const customers = [
      { email: "Sam@Example.com", member: true },
      { email: "sam@example.com ", member: true },
      { email: "gone@example.com", member: true },
      { name: "No email at all", member: true },
      { email: "not-an-email", member: true },
      { email: "kim@example.com", member: true },
    ];
    expect(digestRecipients(customers, new Set(["gone@example.com"]))).toEqual([
      "sam@example.com",
      "kim@example.com",
    ]);
  });

  it("skips the doc the account page creates: a customer record is not a member", () => {
    // Same escalation the membership fix closed, from the email side: adding a
    // dog must not subscribe anybody to members-only mailings.
    const accountCreated = { email: "dog@example.com", name: "Sam", dogs: [{ id: "dog-1", name: "Loki" }] };
    const paidOrder = { email: "member@example.com", member: true };
    expect(digestRecipients([accountCreated, paidOrder], new Set())).toEqual([
      "member@example.com",
    ]);
  });
});

describe("membersDigestEmail", () => {
  const content: DigestContent = {
    posts: [post({ title: "Cosy sleep & the crate <question>", body: "First paragraph.\n\nSecond." })],
    earlyAccess: [{ name: "Venison Sticks", price: 8.5, membersOnlyUntil: "2026-08-01" }],
  };
  const args = { content, siteUrl: "https://barkingraw.dog", email: "sam@example.com", secret: "s" };

  it("carries the post, the drop, and the way in", () => {
    const e = membersDigestEmail(args);
    expect(e.subject).toBe("This week in the members area");
    expect(e.html).toContain("First paragraph.");
    expect(e.html).toContain("Venison Sticks");
    expect(e.html).toContain("https://barkingraw.dog/members");
  });

  it("escapes what Michaela typed rather than trusting it", () => {
    const e = membersDigestEmail(args);
    expect(e.html).not.toContain("<question>");
    expect(e.html).toContain("&lt;question&gt;");
  });

  it("carries a working unsubscribe link, because this is a marketing send", () => {
    expect(membersDigestEmail(args).html).toContain("/api/unsubscribe?e=sam%40example.com&t=");
  });

  it("keeps the house style: no em dashes anywhere", () => {
    const emDash = String.fromCharCode(0x2014);
    const e = membersDigestEmail(args);
    expect(e.subject.includes(emDash)).toBe(false);
    expect(e.html.includes(emDash)).toBe(false);
  });
});
