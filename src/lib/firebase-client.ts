import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let auth: Auth | null = null;

/**
 * The Firebase client Auth, initialised on first call rather than at module load.
 *
 * Lazy deliberately: this module used to initialise at evaluation time, which meant
 * a build with the NEXT_PUBLIC_FIREBASE_* variables absent died PRERENDERING
 * /login/complete with auth/invalid-api-key, taking the whole deploy down. Only the
 * sign-in flow needs this object, only ever in the browser, so the missing-config
 * case now surfaces there as a readable error instead of killing the build.
 *
 * The variables are still required at BUILD time for login to work, because
 * NEXT_PUBLIC_* values are inlined into the client bundle when the build runs.
 * Setting them in Vercel after a build needs a redeploy to take effect.
 */
export function getClientAuth(): Auth {
  if (!auth) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey || !config.projectId) {
      throw new Error(
        "Sign-in is not configured: the NEXT_PUBLIC_FIREBASE_* variables were absent when this site was built.",
      );
    }
    auth = getAuth(getApps().length ? getApp() : initializeApp(config));
  }
  return auth;
}
