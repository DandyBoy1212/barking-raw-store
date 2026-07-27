"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

export default function CompleteSignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      // Lazy: initialising here, in the browser, is what lets a build without the
      // NEXT_PUBLIC_FIREBASE_* variables prerender this page instead of dying.
      let clientAuth;
      try {
        clientAuth = getClientAuth();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in is not configured.");
        return;
      }
      if (!isSignInWithEmailLink(clientAuth, window.location.href)) {
        setError("This sign-in link is invalid or has expired.");
        return;
      }
      let email = window.localStorage.getItem("br_signin_email");
      if (!email) email = window.prompt("Please confirm your email to finish signing in") || "";
      if (!email) {
        setError("We need your email to finish signing in.");
        return;
      }
      try {
        const cred = await signInWithEmailLink(clientAuth, email, window.location.href);
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error("session");
        window.localStorage.removeItem("br_signin_email");
        router.replace("/account");
      } catch {
        setError("We could not complete sign-in. Please request a fresh link.");
      }
    }
    run();
  }, [router]);

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 460 }}>
        <h1 className="display">Signing you in...</h1>
        {error && <p>{error}</p>}
      </div>
    </main>
  );
}
