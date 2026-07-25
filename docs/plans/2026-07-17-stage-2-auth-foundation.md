# Stage 2: Auth Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passwordless email-link login for customers and staff, an httpOnly session cookie, server-side role guards, protected `/account` and `/admin` shells, and invisible customer-account creation at checkout.

**Architecture:** Firebase Auth provides identity. The client Firebase SDK completes the email-link sign-in and hands its ID token to a Route Handler, which mints a Firebase **session cookie** via the Admin SDK. A server-side data-access layer (`src/lib/auth.ts`) reads and verifies that cookie and exposes `getSessionUser`, `requireUser`, `requireStaff`. Pure, framework-free helpers live in `src/lib/auth-helpers.ts` so they are unit-testable. Staff are ordinary Firebase users carrying a `staff: true` custom claim. The Stripe webhook creates or matches a Firebase user and a `store_customers` doc after each paid order.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, `firebase-admin` (Auth + Firestore), `firebase` (client SDK, new dependency), Resend email (existing `sendEmail`), Vitest.

## Global Constraints

- British spelling. No em dashes anywhere in code, comments, or copy.
- **This Next.js build differs from older versions. `cookies()` from `next/headers` is async: always `const store = await cookies()`.** `redirect()` is imported from `next/navigation`. Before writing route/cookie code, skim `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
- Auth checks must sit in the page/route handler close to the data, not only in a layout (layouts do not re-run on client navigation). Every mutating Route Handler re-checks the session itself.
- Firestore collections stay namespaced under `store_*`. Server-only modules never get imported by `"use client"` components.
- Modules that need Firebase degrade gracefully (return null) rather than throwing, matching `getDb()`.
- Session cookie: name `br_session`, `httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`, max age 14 days (Firebase session-cookie maximum).
- Run tests with `npx vitest run <path>`.

## Prerequisites (manual, one-time, outside code)

- In the Firebase console for the existing project: enable **Email link (passwordless sign-in)** under Authentication > Sign-in method, and add the site domains (localhost and barkingraw.dog) to Authentication > Settings > Authorized domains.
- Add client env vars to `.env.local` and Vercel: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. These are public by design (client SDK config).

---

## File Structure

- **Create** `src/lib/auth-helpers.ts` — pure helpers (claims mapping, action-code settings, email HTML, customer doc, cookie constants). Unit-tested.
- **Create** `src/lib/auth-helpers.test.ts` — tests for the above.
- **Create** `src/lib/firebase-client.ts` — client Firebase app + auth singletons.
- **Create** `src/lib/auth.ts` — server DAL: session cookie create/clear, `getSessionUser`, `requireUser`, `requireStaff`, `ensureCustomer`.
- **Create** `src/app/api/auth/session/route.ts` — POST sets the session cookie, DELETE clears it.
- **Create** `src/app/api/auth/link/route.ts` — POST emails a sign-in link.
- **Create** `src/app/api/dev/make-staff/route.ts` — guarded bootstrap that grants the staff claim.
- **Create** `src/app/login/page.tsx` — email entry (client).
- **Create** `src/app/login/complete/page.tsx` — completes the email-link sign-in (client).
- **Create** `src/app/account/page.tsx` — protected customer shell (server).
- **Create** `src/app/admin/page.tsx` — protected staff shell (server).
- **Modify** `src/lib/firebase-admin.ts` — add `getAuthAdmin()` and the `customers`/`staff` collections.
- **Modify** `src/components/Header.tsx` — add an Account link.
- **Modify** `src/app/api/webhooks/stripe/route.ts` — call `ensureCustomer` after fulfilment.

---

### Task 1: Pure auth helpers

**Files:**
- Create: `src/lib/auth-helpers.ts`
- Test: `src/lib/auth-helpers.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE_NAME = "br_session"`, `SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000`
  - `type SessionUser = { uid: string; email: string; staff: boolean }`
  - `decodedToSessionUser(decoded: { uid: string; email?: string; staff?: unknown }): SessionUser`
  - `buildActionCodeSettings(siteUrl: string): { url: string; handleCodeInApp: true }`
  - `signInEmailHtml(link: string, name?: string): string`
  - `buildCustomerDoc(input: { email: string; name?: string; postcode?: string }): { email: string; name: string; lastPostcode: string }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  decodedToSessionUser,
  buildActionCodeSettings,
  signInEmailHtml,
  buildCustomerDoc,
  SESSION_MAX_AGE_MS,
} from "./auth-helpers";

describe("decodedToSessionUser", () => {
  it("maps uid and email and treats staff:true as staff", () => {
    expect(decodedToSessionUser({ uid: "u1", email: "a@b.com", staff: true }))
      .toEqual({ uid: "u1", email: "a@b.com", staff: true });
  });
  it("defaults email to empty and staff to false for anything but true", () => {
    expect(decodedToSessionUser({ uid: "u2" })).toEqual({ uid: "u2", email: "", staff: false });
    expect(decodedToSessionUser({ uid: "u3", staff: "yes" }).staff).toBe(false);
  });
});

describe("buildActionCodeSettings", () => {
  it("points the continue url at /login/complete and trims a trailing slash", () => {
    expect(buildActionCodeSettings("https://barkingraw.dog/")).toEqual({
      url: "https://barkingraw.dog/login/complete",
      handleCodeInApp: true,
    });
  });
});

describe("signInEmailHtml", () => {
  it("includes the link and greets by name when given", () => {
    const html = signInEmailHtml("https://x/y", "Michaela");
    expect(html).toContain("https://x/y");
    expect(html).toContain("Hi Michaela,");
    expect(signInEmailHtml("https://x/y")).toContain("Hi,");
  });
});

describe("buildCustomerDoc", () => {
  it("normalises fields with sensible blanks", () => {
    expect(buildCustomerDoc({ email: "a@b.com", name: "Sam", postcode: "DD1 1AA" }))
      .toEqual({ email: "a@b.com", name: "Sam", lastPostcode: "DD1 1AA" });
    expect(buildCustomerDoc({ email: "a@b.com" }))
      .toEqual({ email: "a@b.com", name: "", lastPostcode: "" });
  });
});

describe("constants", () => {
  it("session lasts 14 days", () => {
    expect(SESSION_MAX_AGE_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/auth-helpers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/lib/auth-helpers.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/auth-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-helpers.ts src/lib/auth-helpers.test.ts
git commit -m "feat: pure auth helpers (session user, action-code settings, emails)"
```

---

### Task 2: Admin Auth accessor + new collections

**Files:**
- Modify: `src/lib/firebase-admin.ts`

**Interfaces:**
- Produces: `getAuthAdmin(): Auth | null`; `COLLECTIONS.customers = "store_customers"`, `COLLECTIONS.staff = "store_staff"`.

- [ ] **Step 1: Extend firebase-admin.ts**

In `src/lib/firebase-admin.ts`, add the import and accessor, and extend `COLLECTIONS`:

```ts
import { getAuth, type Auth } from "firebase-admin/auth";

let cachedAuth: Auth | null = null;

/** Firebase Admin Auth, or null when credentials are not configured. */
export function getAuthAdmin(): Auth | null {
  if (!getDb()) return null; // getDb() performs the one-time app initialisation.
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth();
  return cachedAuth;
}
```

And update the collections object:

```ts
export const COLLECTIONS = {
  carts: "store_carts",
  orders: "store_orders",
  discountCodes: "store_discount_codes",
  products: "store_products",
  customers: "store_customers",
  staff: "store_staff",
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase-admin.ts
git commit -m "feat: getAuthAdmin accessor and customer/staff collections"
```

---

### Task 3: Server DAL + session Route Handler

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/session/route.ts`

**Interfaces:**
- Consumes: `getAuthAdmin`, `getDb`, `COLLECTIONS`; helpers from `@/lib/auth-helpers`.
- Produces:
  - `createSession(idToken: string): Promise<boolean>`
  - `clearSession(): Promise<void>`
  - `getSessionUser(): Promise<SessionUser | null>`
  - `requireUser(): Promise<SessionUser>` (redirects to `/login` if absent)
  - `requireStaff(): Promise<SessionUser>` (redirects to `/login` if not staff)
  - `ensureCustomer(input: { email: string; name?: string; postcode?: string }): Promise<void>`
  - Route: `POST /api/auth/session` (body `{ idToken }`), `DELETE /api/auth/session`.

- [ ] **Step 1: Write the DAL**

Create `src/lib/auth.ts`:

```ts
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
  const value = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
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
```

Note: `{ merge: true }` means the `createdAt` above is only meaningful on first write; on later merges it is harmless to re-set but if you prefer strict first-write semantics, read the doc first. For Stage 2 the simple merge is acceptable.

- [ ] **Step 2: Write the session Route Handler**

Create `src/app/api/auth/session/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSession, clearSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.idToken) return NextResponse.json({ error: "no token" }, { status: 400 });
  const ok = await createSession(body.idToken);
  if (!ok) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `server-only` is reported missing, run `npm install server-only`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/session/route.ts
git commit -m "feat: session DAL (create/verify/clear) and session route handler"
```

---

### Task 4: Client Firebase SDK + login flow

**Files:**
- Create: `src/lib/firebase-client.ts`
- Create: `src/app/api/auth/link/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/complete/page.tsx`

**Interfaces:**
- Consumes: `getAuthAdmin`; `buildActionCodeSettings`, `signInEmailHtml` from `@/lib/auth-helpers`; `sendEmail`.
- Produces: `clientAuth` (client SDK Auth); route `POST /api/auth/link` (body `{ email }`); pages `/login` and `/login/complete`.

- [ ] **Step 1: Install the client SDK**

Run: `npm install firebase`
Expected: `firebase` added to `dependencies`.

- [ ] **Step 2: Create the client Firebase singleton**

Create `src/lib/firebase-client.ts`:

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const clientAuth = getAuth(firebaseApp);
```

- [ ] **Step 3: Create the link Route Handler**

Create `src/app/api/auth/link/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getAuthAdmin } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { buildActionCodeSettings, signInEmailHtml } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const auth = getAuthAdmin();
  if (!auth) return NextResponse.json({ error: "auth unavailable" }, { status: 503 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://barkingraw.dog";
  const link = await auth.generateSignInWithEmailLink(email, buildActionCodeSettings(siteUrl));
  await sendEmail(email, "Your Barking Raw sign-in link", signInEmailHtml(link));
  // Always report success so we never reveal whether an email is registered.
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      window.localStorage.setItem("br_signin_email", email.trim().toLowerCase());
      await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 460 }}>
        <h1 className="display">Sign in</h1>
        {sent ? (
          <p>Check your email for a sign-in link. You can close this tab.</p>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ display: "block", width: "100%", padding: "0.7rem", marginTop: "0.3rem" }}
              />
            </label>
            <button className="btn btn--solid-ink" disabled={busy} type="submit">
              {busy ? "Sending..." : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create the completion page**

Create `src/app/login/complete/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export default function CompleteSignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
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
```

- [ ] **Step 6: Typecheck and verify the flow (manual)**

Run: `npx tsc --noEmit` (expected: no errors), then `npm run dev`.
With the Firebase prerequisites and `.env.local` set, visit `/login`, enter your email, and confirm the branded email arrives (needs `RESEND_API_KEY`). Click the link, land on `/login/complete`, and get redirected to `/account`. In the browser dev tools, confirm an httpOnly `br_session` cookie is set.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase-client.ts src/app/api/auth/link/route.ts src/app/login/page.tsx src/app/login/complete/page.tsx package.json package-lock.json
git commit -m "feat: email-link login flow (client SDK, link route, login pages)"
```

---

### Task 5: Protected shells + header link

**Files:**
- Create: `src/app/account/page.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/Header.tsx:17-21`

**Interfaces:**
- Consumes: `requireUser`, `requireStaff`, `clearSession` from `@/lib/auth`.
- Produces: pages `/account` and `/admin`; a logout Route Handler is not needed (DELETE on the session route already exists).

- [ ] **Step 1: Create the account shell**

Create `src/app/account/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <h1 className="display">Your account</h1>
        <p>Signed in as {user.email}.</p>
        <p style={{ opacity: 0.7 }}>Points and order history arrive in a later stage.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the admin shell**

Create `src/app/admin/page.tsx`:

```tsx
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireStaff();
  return (
    <main className="band band--paper">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <h1 className="display">Admin</h1>
        <p>Signed in as {user.email} (staff).</p>
        <p style={{ opacity: 0.7 }}>Product management arrives in Stage 3.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add an Account link to the header**

In `src/components/Header.tsx`, add an Account link just before the basket button (inside `header__inner`, after the closing `</a>` of the logo):

```tsx
        <a className="header__account" href="/account" style={{ marginLeft: "auto", marginRight: "1rem" }}>
          Account
        </a>
        <button className="basket-btn" onClick={() => setOpen(true)} aria-label="Open basket">
          Basket
          <span className="basket-btn__count">{count}</span>
        </button>
```

(The link points at `/account`, which itself redirects signed-out visitors to `/login`, so the header needs no client session state.)

- [ ] **Step 4: Verify the guards (manual)**

Run `npm run dev`. While signed out, visiting `/account` and `/admin` both redirect to `/login`. After signing in as a non-staff user, `/account` renders and `/admin` still redirects to `/login`. (Staff access is verified in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/app/account/page.tsx src/app/admin/page.tsx src/components/Header.tsx
git commit -m "feat: protected account and admin shells + header account link"
```

---

### Task 6: Staff bootstrap route

**Files:**
- Create: `src/app/api/dev/make-staff/route.ts`

**Interfaces:**
- Consumes: `getAuthAdmin`, `getDb`, `COLLECTIONS`.
- Produces: `POST /api/dev/make-staff` (body `{ email }`), guarded by `SEED_SECRET`.

This task is integration wiring, verified by running it rather than by a unit test.

- [ ] **Step 1: Write the route**

Create `src/app/api/dev/make-staff/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuthAdmin, getDb, COLLECTIONS } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.SEED_SECRET;
  if (!secret) return true; // no secret set = allow (dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "no email" }, { status: 400 });
  const auth = getAuthAdmin();
  const db = getDb();
  if (!auth || !db) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email })).uid;
  }
  await auth.setCustomUserClaims(uid, { staff: true });
  await db.collection(COLLECTIONS.staff).doc(uid).set(
    { email, invitedBy: "bootstrap", createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ ok: true, uid });
}
```

- [ ] **Step 2: Grant Michaela staff + verify (manual)**

With `npm run dev` running:

```bash
curl -X POST http://localhost:3000/api/dev/make-staff \
  -H "Content-Type: application/json" \
  -d '{"email":"michaela@barkingraw.dog"}'
```

Expected: `{ "ok": true, "uid": "..." }`. Then sign in as that email (Task 4 flow) and confirm `/admin` now renders (the `staff` claim is in the session cookie). If the user was already signed in before the claim was granted, sign out and back in so the new claim is minted into a fresh session cookie.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dev/make-staff/route.ts
git commit -m "feat: guarded bootstrap route to grant the staff claim"
```

---

### Task 7: Invisible customer provisioning at checkout

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts:80-94`

**Interfaces:**
- Consumes: `ensureCustomer` from `@/lib/auth`.

- [ ] **Step 1: Call ensureCustomer after the order is recorded**

In `src/app/api/webhooks/stripe/route.ts`, add the import at the top:

```ts
import { ensureCustomer } from "@/lib/auth";
```

Then, inside `fulfil`, immediately after the `if (cartId) { ... }` block that marks the cart converted (still within the `if (db)` block), add:

```ts
    // Invisible account: create or match a Firebase user + customer doc for this buyer.
    await ensureCustomer({ email: customerEmail, name: customerName, postcode }).catch((err) => {
      console.error("[webhook] ensureCustomer failed:", err);
    });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify provisioning (manual)**

Complete a test-mode checkout (Stripe test card `4242 4242 4242 4242`). Expected: in the Firebase console, Authentication shows a user for the buyer's email, and `store_customers` has a doc keyed by that uid with `email`, `name`, and `lastPostcode`. Then request a sign-in link for that email and confirm you can reach `/account`.

- [ ] **Step 4: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (shipping, products-store, stripe-sync, auth-helpers).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: provision a customer account on each paid order"
```

---

## Self-Review

**Spec coverage (Stage 2 section of the design spec):**
- Firebase email-link sign-in + session cookie routes + server guards — Tasks 1, 3, 4, 5.
- `staff` custom-claim plumbing and an initial staff account for Michaela — Tasks 2, 6.
- Protected `/account` and `/admin` shells — Task 5.
- Webhook provisioning (create/match Firebase user + `store_customers` from the order email) — Tasks 3 (`ensureCustomer`), 7.
- Done-when criteria (returning customer reaches `/account`; non-staff refused at `/admin`; a purchase creates a customer record) — verified in Tasks 5, 6, 7.

**Placeholder scan:** No TBD/TODO; every code step is complete. Integration tasks (6, 7, and manual steps in 4) use explicit commands with expected output.

**Type consistency:** `SessionUser` defined once in Task 1, consumed unchanged by `auth.ts` (Task 3) and the shells (Task 5). `getSessionUser`/`requireUser`/`requireStaff`/`ensureCustomer`/`createSession`/`clearSession` are named and called identically across tasks. `SESSION_COOKIE_NAME`/`SESSION_MAX_AGE_MS` centralised in the helpers and reused by the DAL. Cookie access uses the async `await cookies()` form throughout, matching this Next build.

**Framework-version notes honoured:** async `cookies()`, `redirect()` from `next/navigation`, per-page guards rather than layout-only, and Route Handlers with named exports and `runtime = "nodejs"` (Admin SDK is Node-only).
