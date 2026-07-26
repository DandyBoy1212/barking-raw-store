// Pure token and PIN maths for the stall session. No next/headers and no env reads
// here, so every branch is unit-testable with a fixed clock (mirrors auth-helpers.ts).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const STALL_COOKIE_NAME = "br_stall";

// One market day with slack: set up at eight, forgotten until ten at night, and a
// token that outlives the borrowing of the iPad is exactly what must not exist.
export const STALL_SESSION_MAX_AGE_MS = 14 * 60 * 60 * 1000;

/**
 * The HMAC key for stall tokens: the PIN strengthened with a server-held secret.
 *
 * A short PIN alone would let anybody who captured a cookie brute-force the PIN
 * offline in milliseconds. Mixing in FIREBASE_SERVICE_ACCOUNT (the caller passes it)
 * means forging or reversing a token requires the server credential too.
 */
export function deriveStallKey(pin: string, serverSecret: string): Buffer {
  return createHash("sha256").update(`${pin}\n${serverSecret}`).digest();
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** A stall token: the expiry in plain sight, signed so it cannot be moved. */
export function mintStallToken(key: Buffer, now: number, maxAgeMs: number): string {
  const expires = now + maxAgeMs;
  return `${expires}.${sign(key, String(expires))}`;
}

/** True only for an untampered token that has not yet expired. Never throws. */
export function verifyStallToken(key: Buffer, token: string, now: number): boolean {
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiresPart = token.slice(0, dot);
  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires <= now) return false;
  return safeEqual(sign(key, expiresPart), token.slice(dot + 1));
}

/**
 * Server-side PIN comparison. Hashing both sides first equalises length, so the
 * comparison is constant-time and the length of the real PIN leaks nothing. An
 * empty expected PIN matches nothing: unset means the whole feature is off.
 */
export function pinMatches(supplied: string, expected: string): boolean {
  if (!expected) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest().toString("hex");
  return safeEqual(digest(supplied), digest(expected));
}

/**
 * Sliding-window attempt budget, pure so the route owns the Map and the tests own
 * the clock. Same best-effort-per-instance caveat as the /api/auth/link throttle.
 */
export function recordAttempt(
  timestamps: number[],
  now: number,
  windowMs: number,
  max: number,
): { allowed: boolean; kept: number[] } {
  const kept = timestamps.filter((t) => t > now - windowMs);
  if (kept.length >= max) return { allowed: false, kept };
  kept.push(now);
  return { allowed: true, kept };
}
