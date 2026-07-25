import {
  cert,
  applicationDefault,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Lazily initialise Firebase Admin. Returns null (rather than throwing) when no
// credentials are configured, so routes degrade gracefully before handover.
let cached: Firestore | null = null;

export function getDb(): Firestore | null {
  if (cached) return cached;
  try {
    if (!getApps().length) {
      const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (inlineJson) {
        initializeApp({ credential: cert(JSON.parse(inlineJson)) });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp({ credential: applicationDefault() });
      } else {
        return null;
      }
    }
    cached = getFirestore();
    return cached;
  } catch (err) {
    console.error("[firebase-admin] init failed:", err);
    return null;
  }
}

let cachedAuth: Auth | null = null;

/** Firebase Admin Auth, or null when credentials are not configured. */
export function getAuthAdmin(): Auth | null {
  if (!getDb()) return null; // getDb() performs the one-time app initialisation.
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth();
  return cachedAuth;
}

/** The default Storage bucket, or null when Storage is not configured. */
export function getBucket() {
  if (!getDb()) return null;
  const name = process.env.FIREBASE_STORAGE_BUCKET;
  if (!name) return null;
  return getStorage().bucket(name);
}

// Store collections are namespaced so they never tangle with the training app.
export const COLLECTIONS = {
  carts: "store_carts",
  orders: "store_orders",
  discountCodes: "store_discount_codes",
  products: "store_products",
  customers: "store_customers",
  staff: "store_staff",
} as const;
