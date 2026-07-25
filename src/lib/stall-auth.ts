import "server-only";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { STALL_COOKIE_NAME, deriveStallKey, verifyStallToken } from "@/lib/stall-session";

/**
 * The stall token signing key, or null when no PIN is configured (feature off).
 *
 * The key mixes the PIN with FIREBASE_SERVICE_ACCOUNT so a captured cookie cannot
 * be brute-forced offline back to a short PIN without also holding the server
 * credential. In production the service account is always set; locally without it
 * the tokens are only as strong as the PIN, which for a dev machine is fine.
 */
export function stallKey(): Buffer | null {
  const pin = process.env.STALL_PIN;
  if (!pin) return null;
  return deriveStallKey(pin, process.env.FIREBASE_SERVICE_ACCOUNT ?? "");
}

/**
 * Whether this request may use the stall form and its sync routes.
 *
 * A valid stall cookie (minted by the PIN route) or a signed-in staff member both
 * pass. The stall cookie deliberately is not a Firebase session: it carries no uid
 * and no staff claim, so it opens /stall and /api/stall/* and nothing else. /admin
 * stays behind requireStaff and is unreachable from the borrowed iPad.
 */
export async function hasStallAccess(): Promise<boolean> {
  const key = stallKey();
  if (key) {
    const store = await cookies();
    const token = store.get(STALL_COOKIE_NAME)?.value;
    if (token && verifyStallToken(key, token, Date.now())) return true;
  }
  const user = await getSessionUser();
  return Boolean(user?.staff);
}
