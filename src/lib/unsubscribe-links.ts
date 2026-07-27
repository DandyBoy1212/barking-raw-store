// Signed unsubscribe links (spec 12.2: a working unsubscribe in every
// marketing send). The token is an HMAC of the lower-cased email, so the link
// proves it came from us without a database round trip, and one contact's
// link cannot unsubscribe anybody else.
//
// This lives apart from subscribers.ts on purpose: that module is imported by
// the client-side capture form for CONSENT_TEXT, and node:crypto cannot go
// into a client bundle. Everything here is server-only.

import { createHmac, timingSafeEqual } from "node:crypto";

export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email, secret), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  // Buffer.from("zz not hex", "hex") does not throw, it truncates, so the
  // length guard is what rejects it. The try/catch is belt and braces.
  if (given.length !== expected.length || expected.length === 0) return false;
  return timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, email: string, secret: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const e = email.trim().toLowerCase();
  return `${base}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e, secret)}`;
}
