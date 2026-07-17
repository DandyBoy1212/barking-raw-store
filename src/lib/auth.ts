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

/** Mint a Firebase session cookie from a freshly minted ID token. */
export async function createSession(idToken: string): Promise<boolean> {
  const auth = getAuthAdmin();
  if (!auth) return false;
  let value: string;
  try {
    value = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  } catch {
    return false;
  }
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
  return true;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
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

/** Create or match a Firebase user + store_customers doc for a buyer. */
export async function ensureCustomer(input: {
  email: string;
  name?: string;
  postcode?: string;
}): Promise<void> {
  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db || !input.email) return;
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
      { ...buildCustomerDoc(input), updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
}
