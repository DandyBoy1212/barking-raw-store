import "server-only";
import type { Dog } from "@/data/customers";
import { getSessionUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers-store";

/**
 * The signed-in viewer's dogs, for the B.3 ribbons, or [] when signed out,
 * unconfigured or dog-less, so every public page renders identically for a
 * visitor with no profile. Glue only: the session read is memoised in auth.ts
 * and the ribbon logic is tested in dog-merchandising.ts, so there is nothing
 * here to unit test.
 */
export async function getViewerDogs(): Promise<Dog[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const customer = await getCustomer(user.uid);
  return customer?.dogs ?? [];
}
