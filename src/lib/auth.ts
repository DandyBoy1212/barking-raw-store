import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { FieldValue } from "firebase-admin/firestore";
import { getAuthAdmin, getDb, COLLECTIONS } from "@/lib/firebase-admin";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  decodedToSessionUser,
  buildCustomerDoc,
  type SessionUser,
} from "@/lib/auth-helpers";

const RECENT_AUTH_WINDOW_SECONDS = 300; // 5 minutes.

export type CreateSessionResult = "ok" | "invalid" | "unavailable";

/**
 * Mint a Firebase session cookie from a freshly minted ID token.
 *
 * Requires the token's auth_time to be recent (within the last 5 minutes) so
 * a stale or replayed ID token cannot be used to mint a long-lived session
 * cookie well after the user actually authenticated.
 */
export async function createSession(idToken: string): Promise<CreateSessionResult> {
  const auth = getAuthAdmin();
  if (!auth) return "unavailable";
  let value: string;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (Date.now() / 1000 - decoded.auth_time >= RECENT_AUTH_WINDOW_SECONDS) {
      return "invalid";
    }
    value = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  } catch {
    return "invalid";
  }
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
  return "ok";
}

/** Sign out locally and, best-effort, revoke the user's refresh tokens server-side. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;
  const auth = getAuthAdmin();
  if (auth && cookie) {
    try {
      const decoded = await auth.verifySessionCookie(cookie);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Sign-out must always succeed locally even if revocation fails.
    }
  }
  store.delete(SESSION_COOKIE_NAME);
}

/** Verified current user, memoised per render pass. Null when signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const auth = getAuthAdmin();
  if (!auth) return null;
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const decoded = await auth.verifySessionCookie(cookie, true);
    return decodedToSessionUser(decoded);
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !user.staff) redirect("/login");
  return user;
}

/**
 * Create or match a Firebase user + store_customers doc for a buyer.
 *
 * Called from the Stripe webhook on a paid order, which is one of the two things that
 * confer membership (the other is the stall signup, spec section 10.1). It therefore
 * writes `member: true` explicitly. Membership is no longer implied by the document
 * existing, because the account routes create that document too.
 */
export async function ensureCustomer(input: {
  email: string;
  name?: string;
  postcode?: string;
  /** Set by webhook fulfilment when Stripe told us its customer id; the billing portal needs it. */
  stripeCustomerId?: string;
}): Promise<string | null> {
  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db || !input.email) return null;
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(input.email)).uid;
  } catch {
    uid = (await auth.createUser({ email: input.email, displayName: input.name || undefined })).uid;
  }
  await db
    .collection(COLLECTIONS.customers)
    .doc(uid)
    .set(
      {
        ...buildCustomerDoc(input),
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        member: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  // The webhook needs this to credit loyalty points to the right customer doc.
  return uid;
}
