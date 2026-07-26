import { describe, it, expect } from "vitest";
import {
  deriveStallKey,
  mintStallToken,
  pinMatches,
  recordAttempt,
  verifyStallToken,
} from "./stall-session";

const KEY = deriveStallKey("4519", "server-secret");
const NOW = 1_753_500_000_000;

describe("stall tokens", () => {
  it("round-trips a freshly minted token", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW)).toBe(true);
  });

  it("refuses a token after it expires, so a forgotten logout dies on its own", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW + 60_001)).toBe(false);
  });

  it("refuses a token signed with a different key", () => {
    const otherKey = deriveStallKey("9999", "server-secret");
    const token = mintStallToken(otherKey, NOW, 60_000);
    expect(verifyStallToken(KEY, token, NOW)).toBe(false);
  });

  it("refuses a token whose expiry was tampered with", () => {
    const token = mintStallToken(KEY, NOW, 60_000);
    const [, signature] = token.split(".");
    expect(verifyStallToken(KEY, `${NOW + 999_999_999}.${signature}`, NOW)).toBe(false);
  });

  it("refuses garbage rather than throwing", () => {
    expect(verifyStallToken(KEY, "", NOW)).toBe(false);
    expect(verifyStallToken(KEY, "no-dot-here", NOW)).toBe(false);
    expect(verifyStallToken(KEY, ".signature-only", NOW)).toBe(false);
  });

  it("derives a different key from a different server secret, so a leaked cookie cannot be brute-forced to the PIN alone", () => {
    expect(deriveStallKey("4519", "a").equals(deriveStallKey("4519", "b"))).toBe(false);
  });
});

describe("pinMatches", () => {
  it("accepts the right PIN and refuses a wrong one", () => {
    expect(pinMatches("4519", "4519")).toBe(true);
    expect(pinMatches("4518", "4519")).toBe(false);
  });

  it("refuses everything when no PIN is configured, rather than matching empty on empty", () => {
    expect(pinMatches("", "")).toBe(false);
  });
});

describe("recordAttempt", () => {
  it("allows attempts inside the budget and refuses the one over it", () => {
    let timestamps: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = recordAttempt(timestamps, NOW + i, 60_000, 5);
      expect(result.allowed).toBe(true);
      timestamps = result.kept;
    }
    expect(recordAttempt(timestamps, NOW + 5, 60_000, 5).allowed).toBe(false);
  });

  it("forgets attempts outside the window, so the budget refills", () => {
    const old = [NOW - 61_000, NOW - 62_000, NOW - 63_000, NOW - 64_000, NOW - 65_000];
    const result = recordAttempt(old, NOW, 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.kept).toEqual([NOW]);
  });
});
