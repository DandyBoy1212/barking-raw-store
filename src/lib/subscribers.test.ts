import { describe, it, expect } from "vitest";
import {
  normaliseSubscriberEmail,
  docToSubscriber,
  SUBSCRIBER_SOURCES,
  CAPTURE_SOURCES,
  CONSENT_TEXT,
} from "./subscribers";

describe("normaliseSubscriberEmail", () => {
  it("trims and lower-cases, so both forms land on one doc", () => {
    expect(normaliseSubscriberEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });
  it("rejects things that are not an email", () => {
    expect(normaliseSubscriberEmail("")).toBeNull();
    expect(normaliseSubscriberEmail("not-an-email")).toBeNull();
    expect(normaliseSubscriberEmail("a@b")).toBeNull();
    expect(normaliseSubscriberEmail(42)).toBeNull();
    expect(normaliseSubscriberEmail("a b@c.com")).toBeNull();
  });
});

describe("the source vocabulary", () => {
  it("reserves stall without capturing it", () => {
    expect(SUBSCRIBER_SOURCES).toContain("stall");
    expect(CAPTURE_SOURCES).not.toContain("stall");
  });
  it("has consent wording for every capture source", () => {
    for (const s of CAPTURE_SOURCES) expect(CONSENT_TEXT[s].length).toBeGreaterThan(10);
  });
});

describe("docToSubscriber", () => {
  it("reads a full record", () => {
    const at = { toMillis: () => 1000 };
    expect(
      docToSubscriber("sam@example.com", {
        email: "sam@example.com",
        source: "shop",
        consent: true,
        consentText: "tick",
        consentAt: at,
        discountCode: "BR10ABCDE",
        codeEmailSentAt: at,
        sequencePosition: 2,
        unsubscribedAt: null,
      }),
    ).toEqual({
      email: "sam@example.com",
      source: "shop",
      consent: true,
      consentText: "tick",
      consentAtMs: 1000,
      discountCode: "BR10ABCDE",
      codeEmailSentAtMs: 1000,
      sequencePosition: 2,
      unsubscribed: false,
    });
  });
  it("survives an empty doc rather than throwing", () => {
    expect(docToSubscriber("x@y.co", {})).toEqual({
      email: "x@y.co",
      source: "home",
      consent: false,
      consentText: "",
      consentAtMs: null,
      discountCode: null,
      codeEmailSentAtMs: null,
      sequencePosition: 0,
      unsubscribed: false,
    });
  });
  it("reads unsubscribedAt as the unsubscribed flag", () => {
    const s = docToSubscriber("x@y.co", { unsubscribedAt: { toMillis: () => 5 } });
    expect(s.unsubscribed).toBe(true);
  });
  it("clamps a nonsense sequence position", () => {
    expect(docToSubscriber("x@y.co", { sequencePosition: "9" }).sequencePosition).toBe(4);
    expect(docToSubscriber("x@y.co", { sequencePosition: -3 }).sequencePosition).toBe(0);
  });
});
