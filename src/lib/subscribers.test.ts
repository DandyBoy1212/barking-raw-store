import { describe, it, expect } from "vitest";
import {
  normaliseSubscriberEmail,
  docToSubscriber,
  applySubscription,
  SUBSCRIBER_SOURCES,
  CAPTURE_SOURCES,
  CONSENT_TEXT,
} from "./subscribers";

const existing = (over: Record<string, unknown> = {}) =>
  docToSubscriber("sam@example.com", { email: "sam@example.com", ...over });

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

describe("applySubscription", () => {
  it("creates a new contact carrying source and consent wording", () => {
    const r = applySubscription(null, { source: "shop", consent: true });
    expect(r.create).toBe(true);
    expect(r.consentTurnedOn).toBe(true);
    expect(r.fields).toEqual({ source: "shop", consent: true, consentText: CONSENT_TEXT.shop });
  });
  it("creates without consent when the box was left unticked", () => {
    const r = applySubscription(null, { source: "home", consent: false });
    expect(r.consentTurnedOn).toBe(false);
    expect(r.fields).toEqual({ source: "home", consent: false, consentText: "" });
  });
  it("keeps the first-touch source on a repeat submit", () => {
    const r = applySubscription(
      existing({ source: "home", consent: true, consentAt: { toMillis: () => 1 } }),
      { source: "shop", consent: true },
    );
    expect(r.create).toBe(false);
    expect(r.fields.source).toBeUndefined();
  });
  it("turns consent on later, with the wording of the form that won it", () => {
    const r = applySubscription(existing({ source: "home", consent: false }), {
      source: "shop",
      consent: true,
    });
    expect(r.consentTurnedOn).toBe(true);
    expect(r.fields.consent).toBe(true);
    expect(r.fields.consentText).toBe(CONSENT_TEXT.shop);
  });
  it("never revokes consent from an unticked repeat", () => {
    const r = applySubscription(
      existing({ source: "home", consent: true, consentText: "kept", consentAt: { toMillis: () => 1 } }),
      { source: "home", consent: false },
    );
    expect(r.consentTurnedOn).toBe(false);
    expect(r.fields.consent).toBeUndefined();
    expect(r.fields.consentText).toBeUndefined();
  });
  it("lets an unsubscribed contact re-consent by ticking the box again", () => {
    const r = applySubscription(
      existing({ consent: false, unsubscribedAt: { toMillis: () => 5 } }),
      { source: "home", consent: true },
    );
    expect(r.consentTurnedOn).toBe(true);
  });
  it("never touches the sequence position or the code", () => {
    // Re-ticking an already consented box is also a no-op, keeping the
    // recorded consent moment the original one.
    const r = applySubscription(
      existing({
        source: "shop",
        consent: true,
        consentAt: { toMillis: () => 1 },
        sequencePosition: 3,
        discountCode: "BR10AAAAA",
      }),
      { source: "shop", consent: true },
    );
    expect(Object.keys(r.fields)).toEqual([]);
  });
});
