// Pure, framework-free auth helpers. No next/headers, no firebase imports here,
// so this module is trivially unit-testable (mirrors the pure shipping.ts).

export const SESSION_COOKIE_NAME = "br_session";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // Firebase session-cookie maximum.

export type SessionUser = { uid: string; email: string; staff: boolean };

/** Reduce a verified Firebase token to the minimal session user. */
export function decodedToSessionUser(decoded: {
  uid: string;
  email?: string;
  staff?: unknown;
}): SessionUser {
  return {
    uid: decoded.uid,
    email: decoded.email ?? "",
    staff: decoded.staff === true,
  };
}

/** Where the email link sends the user to complete sign-in. */
export function buildActionCodeSettings(siteUrl: string): { url: string; handleCodeInApp: true } {
  return { url: `${siteUrl.replace(/\/$/, "")}/login/complete`, handleCodeInApp: true };
}

/** Branded sign-in email body (British spelling, no em dashes). */
export function signInEmailHtml(link: string, name?: string): string {
  const hi = name ? `Hi ${name},` : "Hi,";
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Sign in to Barking Raw</h1>
    <p>${hi}</p>
    <p>Tap the button below to sign in. The link works once and expires shortly.</p>
    <p><a href="${link}" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Sign in</a></p>
    <p style="color:#6b6b6b;font-size:13px">If you did not ask to sign in, you can ignore this email.</p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
  </div>`;
}

/** Plain, serialisable customer fields (caller adds server timestamps). */
export function buildCustomerDoc(input: { email: string; name?: string; postcode?: string }): {
  email: string;
  name: string;
  lastPostcode: string;
} {
  return {
    email: input.email,
    name: input.name ?? "",
    lastPostcode: input.postcode ?? "",
  };
}
