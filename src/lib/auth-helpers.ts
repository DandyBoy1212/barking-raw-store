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

/**
 * Plain, serialisable customer fields (caller adds server timestamps).
 *
 * A blank field is omitted rather than written as "". This doc is merged into
 * store_customers by the Stripe webhook on every order, so writing an empty string
 * would blank a name or postcode the customer had already given on the account page.
 * It deliberately never carries dogs or address: those belong to the customer and to
 * the stall form, and Stripe knows nothing about either.
 */
export function buildCustomerDoc(input: { email: string; name?: string; postcode?: string }): {
  email: string;
  name?: string;
  lastPostcode?: string;
} {
  const name = String(input.name ?? "").trim();
  const postcode = String(input.postcode ?? "").trim();
  return {
    email: input.email,
    ...(name ? { name } : {}),
    ...(postcode ? { lastPostcode: postcode } : {}),
  };
}

/** True for an http URL on localhost or 127.0.0.1, whatever the port. */
function isLocalhostUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/**
 * Same-origin check for CSRF protection on state-changing routes.
 *
 * Browsers always send an Origin header on cross-site POSTs, which is the
 * attack this guards against, so a missing Origin (and missing Referer)
 * means a non-browser client such as curl or a server-to-server call, which
 * this helper allows through.
 *
 * When the configured site is itself localhost (local dev), any localhost
 * port is allowed, because parallel worktree dev servers each pick their own
 * port. When the site is a real domain, no localhost allowance exists at all.
 */
export function isAllowedOrigin(
  origin: string | null,
  referer: string | null,
  siteUrl: string,
): boolean {
  const allowedOrigin = new URL(siteUrl).origin;
  const devSite = isLocalhostUrl(siteUrl);
  if (origin) {
    return origin === allowedOrigin || (devSite && isLocalhostUrl(origin));
  }
  if (referer) {
    // Exact origin or origin followed by "/": a plain prefix match would let
    // https://barkingraw.dog.evil.example slip through. The localhost check
    // parses the URL, so localhost.evil.example does not pass either.
    return (
      referer === allowedOrigin ||
      referer.startsWith(allowedOrigin + "/") ||
      (devSite && isLocalhostUrl(referer))
    );
  }
  return true;
}

/**
 * Stricter same-origin check, for routes with no non-browser caller.
 *
 * isAllowedOrigin above lets a request through when it states neither an Origin nor
 * a Referer, so that curl and server-to-server callers keep working. The account
 * routes have no such caller: they are only ever fetched by our own page script, and
 * a browser always states its origin on a cross-site POST. So a request that will not
 * say where it came from is refused here rather than trusted.
 */
export function isBrowserSameOrigin(
  origin: string | null,
  referer: string | null,
  siteUrl: string,
): boolean {
  if (!origin && !referer) return false;
  return isAllowedOrigin(origin, referer, siteUrl);
}
