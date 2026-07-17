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

/** Escape the characters that matter for safe HTML text interpolation. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Branded sign-in email body (British spelling, no em dashes). */
export function signInEmailHtml(link: string, name?: string): string {
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi,";
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

const LOCALHOST_DEV_ORIGIN = "http://localhost:3000";

/**
 * Same-origin check for CSRF protection on state-changing routes.
 *
 * Browsers always send an Origin header on cross-site POSTs, which is the
 * attack this guards against, so a missing Origin (and missing Referer)
 * means a non-browser client such as curl or a server-to-server call, which
 * this helper allows through.
 */
export function isAllowedOrigin(
  origin: string | null,
  referer: string | null,
  siteUrl: string,
): boolean {
  const allowedOrigin = new URL(siteUrl).origin;
  if (origin) {
    return origin === allowedOrigin || origin === LOCALHOST_DEV_ORIGIN;
  }
  if (referer) {
    return referer.startsWith(allowedOrigin) || referer.startsWith(LOCALHOST_DEV_ORIGIN);
  }
  return true;
}
