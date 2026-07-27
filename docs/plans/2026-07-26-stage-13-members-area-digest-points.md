# Stage 13: Members Area, Posts Admin, Weekly Digest and Points Owed (C.3, C.4, C.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members get a gated `/members` page carrying Michaela's posts and the early access drops; Michaela gets a posts section in the admin and a points-owed report; members get one weekly digest email, sent by a GitHub Action cron.

**Architecture:** Pure logic in `src/lib` (posts vocabulary, digest selection and email, points report), thin server-only Firestore stores mirroring `customers-store.ts`, server components for pages, and API routes guarded exactly like the account routes (`requireStaff` or `requireUser` plus `isBrowserSameOrigin`). Membership is decided ONLY by the existing helpers in `src/lib/membership.ts` (`isMemberUid` / `currentUserIsMember`), which read the explicit `member: true` flag via the pure `isMemberDoc` predicate (fix bfc1bb5). The digest cron is idempotent per ISO week via a claim document created with `create()`.

**Tech Stack:** Next.js 16 app router (this repo's version; follow existing file patterns), Firestore via firebase-admin, Resend via `sendEmail`, Vitest.

## Global Constraints

- British spelling, NO em dashes anywhere (test suite carries an em dash guard for email copy).
- Do not touch: `vercel.json`, `HANDOVER.md`, `src/components/Header.tsx`, home page, product card, admin product form, stripe-sync, stall files (parallel agents own them).
- Vercel Hobby cron slots are both taken: any schedule rides a GitHub Action pinging a CRON_SECRET-guarded GET route (pattern: `.github/workflows/welcome-sequence.yml`).
- Membership checks go through `currentUserIsMember()` / `isMemberUid()` only. Never infer membership from a customer doc existing; never read or write the `member` field directly outside the existing helpers.
- Gate pages server-side (redirect / alternate render), never hide client-side.
- Baseline: 189 tests passing, `npx tsc --noEmit` clean, lint at exactly 3 pre-existing errors (CartProvider.tsx, thank-you/page.tsx).
- Commit style: `git log --oneline`, body ends `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Decisions taken (recorded up front)

1. **Post model.** `store_posts`, auto-id docs: `{ title, body, published, createdAt, publishedAt, updatedAt }`. No photo field in v1: the products image upload wants Storage plumbing that 7.5's "keep it simple" does not need on day one; body text is the post. Title + body, plain text, paragraphs preserved by splitting on newlines.
2. **A new post is published at creation.** Spec 7.2's flow is "title, body, publish" from a phone; a draft state would be an extra tap she does not want. Unpublish/republish is the toggle (no hard delete).
3. **Digest trigger.** The digest sends only when at least one post is new this week (published within the last 7 days). Early access products currently in their window ride along as a section but do not trigger a send on their own, because `membersOnlyUntil` is an end date with no start marker, so "newly members-only" cannot be told from "still members-only", and a post-free week must not email the list (spec 7.3: the digest IS the week's post).
4. **Digest audience and unsubscribe.** Recipients are `store_customers` docs that are MEMBERS (the `isMemberDoc` predicate, the same one the gate uses) and carry an email. Not every customer doc: since fix bfc1bb5 the account page creates customer docs freely, and adding a dog must not subscribe anybody to members-only mailings. The digest respects the marketing list's opt-out: any recipient whose `store_subscribers` doc (id = lower-cased email) has `unsubscribedAt` set is skipped, and every send carries the signed unsubscribe link, which writes to that same subscriber doc. A member who never joined the marketing list still gets the digest (spec 7.3 makes it a membership email), but one click of unsubscribe stops it for good because the route `set({merge:true})`s the subscriber doc into existence.
5. **Digest idempotency.** One claim doc per ISO week (`store_members_digest/{YYYY-Www}`) created with `create()` BEFORE sending; a rerun the same week hits ALREADY_EXISTS and stops. Trade-off, on purpose: a crash mid-send means the remainder miss a week rather than anyone getting doubles.
6. **Points.** No loyalty machinery exists in `src/` yet (stage 5 was planned, never built). The redemption rate is defined by spec section 9 and the stage 5 plan: flat 100 points to GBP 1. `src/lib/loyalty.ts` defines `REDEEM_POINTS_PER_POUND = 100` as the code's single source. The report reads a customer doc's `pointsBalance` tolerantly (absent, non-numeric or negative counts 0), so account-created docs (which never carry points) cannot inflate the liability, and the page renders sensibly on the live project's empty dataset.
7. **Members page extras.** Spec 7.1 also lists dogs of the day (phase D), courses (as they land) and the points balance (machinery not built). These render as honest placeholders, not fake content.

---

### Task 1: Posts vocabulary (pure) and the two new collections

**Files:**
- Create: `src/lib/posts.ts`
- Create: `src/lib/posts.test.ts`
- Modify: `src/lib/firebase-admin.ts` (COLLECTIONS)

**Interfaces produced:**
- `type Post = { id: string; title: string; body: string; published: boolean; createdAtMs: number | null; publishedAtMs: number | null }`
- `type PostInput = { title: string; body: string }`
- `validatePostInput(input: Record<string, unknown>): { ok: true; value: PostInput } | { ok: false; errors: string[] }`
- `docToPost(id: string, data: Record<string, unknown>): Post`
- `postFreshMs(p: Post): number | null` (publishedAt, else createdAt)
- `sortNewestFirst(posts: Post[]): Post[]`
- `postParagraphs(body: string): string[]`
- `postSnippet(body: string, max?: number): string`
- `COLLECTIONS.posts = "store_posts"`, `COLLECTIONS.membersDigest = "store_members_digest"`

- [ ] **Step 1: Write the failing tests** (`src/lib/posts.test.ts`): validate (title required, body required, trims, caps at 120/20000), docToPost (full doc, empty doc survives, published strict === true, toMillis timestamps), paragraphs (splits on newline runs, drops blanks), snippet (first paragraph, truncated with "..."), sortNewestFirst (publishedAt wins over createdAt, null last, newest first).
- [ ] **Step 2: Run to verify failure** `npm test -- posts` fails: module not found.
- [ ] **Step 3: Implement** `src/lib/posts.ts` (pure, no imports beyond nothing; local `toMillis` mirroring subscribers.ts).
- [ ] **Step 4: Add the two COLLECTIONS keys.**
- [ ] **Step 5: `npm test` green, commit** `feat: the post vocabulary, tolerant reads and paragraphs kept`

### Task 2: Posts store (server-only Firestore access)

**Files:**
- Create: `src/lib/posts-store.ts`

**Interfaces produced (consumed by tasks 3, 4, 6, 8):**
- `listPosts(): Promise<Post[]>` (all, newest first, admin)
- `listPublishedPosts(): Promise<Post[]>` (published, newest first)
- `getPostById(id: string): Promise<Post | null>`
- `createPost(input: PostInput): Promise<string | null>` (returns new id; doc written `published: true` with `publishedAt`)
- `updatePost(id: string, input: PostInput): Promise<boolean>`
- `setPostPublished(id: string, published: boolean): Promise<boolean>` (republish refreshes `publishedAt`)

Pattern: mirrors `customers-store.ts` (server-only, getDb null-safe, try/catch returning empty/false, sort in code rather than by Firestore index). No new unit tests: all logic that can be pure lives in Task 1; these functions are IO glue like the untested IO in customers-store.

- [ ] **Step 1: Implement as above.**
- [ ] **Step 2: `npx tsc --noEmit` clean, `npm test` still green, commit** `feat: posts persist, publish and unpublish, never deleting`

### Task 3: Admin posts API routes

**Files:**
- Create: `src/app/api/admin/posts/route.ts` (POST create)
- Create: `src/app/api/admin/posts/[id]/route.ts` (PUT update title/body)
- Create: `src/app/api/admin/posts/[id]/publish/route.ts` (POST `{ published: boolean }`)

Guards on every handler, in this order: `await requireStaff()` then `isBrowserSameOrigin(req.headers.get("origin"), req.headers.get("referer"), siteUrl)` returning 403 `{ ok: false, errors: ["Bad request."] }` when refused (the account-routes house pattern; these routes are only ever called by our own admin pages). Validation via `validatePostInput`; unknown id 404; db null 503. `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`

- [ ] **Step 1: Implement the three routes.**
- [ ] **Step 2: `npx tsc --noEmit` clean, commit** `feat: the posts routes, staff only and same origin like the rest`

### Task 4: Admin posts UI and the admin nav link

**Files:**
- Create: `src/app/admin/posts/page.tsx` (list: title, date, shows-as, edit link, publish toggle)
- Create: `src/app/admin/posts/new/page.tsx`
- Create: `src/app/admin/posts/[id]/page.tsx`
- Create: `src/components/admin/PostForm.tsx` (client: title input, body textarea, phone-sized, POST or PUT then `router.push("/admin/posts")`)
- Create: `src/components/admin/PublishToggle.tsx` (client, mirrors `ArchiveToggle.tsx` against `/api/admin/posts/${id}/publish`)
- Modify: `src/app/admin/page.tsx` (move Posts from COMING to BUILT with href `/admin/posts`; minimal diff)

All pages `await requireStaff()`, `export const dynamic = "force-dynamic"`, layout vocabulary copied from `admin/products` pages.

- [ ] **Step 1: Implement pages and components.**
- [ ] **Step 2: Gates (tsc, lint still 3), commit** `feat: the posts admin, plain enough to write from a phone`

### Task 5: Membership gate unit tests

**Files:**
- Create: `src/lib/membership.test.ts`

Mocks via `vi.hoisted` + `vi.mock` for `@/lib/auth` (getSessionUser) and `@/lib/firebase-admin` (getDb, COLLECTIONS), a fake db whose `collection().doc().get()` resolves `{ data: () => given }`. Cases (the coordinator's required set):
- `isMemberUid` with doc `{ member: true }` resolves true.
- `isMemberUid` with the exact shape the account routes create (`{ email, name, dogs: [...] }`, no flag) resolves false.
- `isMemberUid` with no doc (`data()` undefined) resolves false; db null resolves false.
- `currentUserIsMember`: signed out false; staff user true even with db null (short-circuit proven); non-staff user with flagless doc false (signed-in non-member refused); non-staff user with `{ member: true }` true.

- [ ] **Step 1: Write tests, watch the interesting ones pass against the real helpers** (these test existing code; the value is regression cover for the gate the members page now leans on).
- [ ] **Step 2: `npm test` green, commit** `test: the members gate admits the flag, staff, and nobody else`

### Task 6: The members page

**Files:**
- Create: `src/app/members/page.tsx`

Server component, `dynamic = "force-dynamic"`. Flow: `getSessionUser()` null redirects to `/login`; `currentUserIsMember()` false renders the friendly locked page ("membership comes with your first order or a stall signup", link to the shop); member renders:
- Hero band (`band band--ink`) "The members area".
- Early access: `splitByMembersOnly(await getStoredProducts(), new Date()).membersOnly.map(toCatalogue)` rendered with `ProductCard` (add-to-basket works: layout already feeds members the full catalogue, checkout already permits members). Empty state copy when no product is in its window.
- Posts: `listPublishedPosts()`, newest first, title + date + `postParagraphs` as `<p>`s. Empty state per 7.4 (launch posts are banked, so honest placeholder copy).
- Placeholders: points balance line ("appears here when points switch on"), dogs of the day ("arrives with the stall build").

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Gates, commit** `feat: the members area, gated on the server, drops first`

### Task 7: Digest pure logic and the email

**Files:**
- Create: `src/lib/members-digest.ts`
- Create: `src/lib/members-digest.test.ts`

**Interfaces produced (consumed by Task 8):**
- `digestWeekKey(now: Date): string` ISO week, e.g. `"2026-W30"` (UTC)
- `type DigestProduct = { name: string; price: number; membersOnlyUntil?: string }`
- `type DigestContent = { posts: Post[]; earlyAccess: DigestProduct[] }`
- `selectDigestContent(posts: Post[], products: DigestProduct[], now: Date): DigestContent | null` (null when no post is fresh within 7 days; fresh = `postFreshMs` within `[now - 7d, now]`; products = currently `isMembersOnly`)
- `digestRecipients(customers: Array<Record<string, unknown>>, optedOut: Set<string>): string[]` (normalised via `normaliseSubscriberEmail`, deduped, opted-out dropped)
- `membersDigestEmail(args: { content: DigestContent; siteUrl: string; email: string; secret: string }): { subject: string; html: string }` house style (Arial 520px, black pill CTA to `/members`, grey footer, signed unsubscribe line), local `escapeHtml` for titles/snippets.

Tests: week key (known dates incl. year boundary: 2026-01-01 is 2026-W01, 2027-01-01 is 2026-W53, 2024-12-30 is 2025-W01), selection (fresh post triggers, stale post does not, unpublished never, products alone do not trigger, in-window product rides along), recipients (dedup, case fold, opt-out skipped, missing email skipped), email (subject, post title present and escaped, unsubscribe link `/api/unsubscribe?e=...&t=`, members link, no em dashes in subject or html).

- [ ] **Step 1: Failing tests.** **Step 2: verify fail.** **Step 3: implement.** **Step 4: green.**
- [ ] **Step 5: Commit** `feat: the digest knows its week, its readers and its news`

### Task 8: Digest cron route and workflow

**Files:**
- Create: `src/app/api/cron/members-digest/route.ts`
- Create: `.github/workflows/members-digest.yml` (cron `45 8 * * 5`, weekly, Friday, after the daily 8:00/8:30 runs; same two secrets; `workflow_dispatch`)

Route (GET, nodejs, force-dynamic): CRON_SECRET bearer guard identical to `cron/welcome`; db null skips; load `listPublishedPosts()` + `getStoredProducts()`; `selectDigestContent` null returns `{ skipped: "nothing new this week" }` WITHOUT claiming the week (a later rerun the same week may still send when a post lands); claim `store_members_digest/{weekKey}` via `create()` (ALREADY_EXISTS returns skipped); recipients from `store_customers` (limit 500) filtered through subscriber docs fetched with `db.getAll` (id = lower-cased email, skip `unsubscribed`); send loop via `sendEmail`; record `{ sentAt, posts, earlyAccess, recipients, sent, failures }` on the claim doc; JSON report.

- [ ] **Step 1: Implement route.** **Step 2: Workflow file.**
- [ ] **Step 3: Gates, commit** `feat: the digest cron sends one week once, riding the Action`

### Task 9: Points report pure logic

**Files:**
- Create: `src/lib/loyalty.ts`
- Create: `src/lib/loyalty.test.ts`

**Interfaces produced (consumed by Task 10):**
- `REDEEM_POINTS_PER_POUND = 100` (spec section 9: flat 100 points to GBP 1)
- `pointsToPounds(points: number): number`
- `customerPoints(data: Record<string, unknown>): number` (tolerant: absent/NaN/negative 0, fractions floored)
- `type PointsRow = { uid: string; name: string; email: string; points: number; pounds: number }`
- `type PointsReport = { totalPoints: number; totalPounds: number; rows: PointsRow[] }`
- `buildPointsReport(docs: Array<{ uid: string; data: Record<string, unknown> }>): PointsReport` (rows only for points > 0, sorted points desc then email asc; totals over all)

Tests: rate is 100 and 250 points is GBP 2.50; tolerant reads; report on empty input is all zeros with no rows; zero-balance and flagless account docs contribute nothing; sort order; totals sum.

- [ ] **Steps: failing tests, verify, implement, green.**
- [ ] **Commit** `feat: points owed, counted at the hundred to the pound`

### Task 10: Points store, admin page, admin nav

**Files:**
- Create: `src/lib/loyalty-store.ts` (`getPointsReport(): Promise<PointsReport>`, reads all customer docs, empty report on db null/error)
- Create: `src/app/admin/points/page.tsx` (requireStaff; total points, total GBP via `gbp`, per-customer table name/email/balance/value desc; empty state for the live zero-member dataset)
- Modify: `src/app/admin/page.tsx` (Points owed from COMING to BUILT, href `/admin/points`)

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Gates, commit** `feat: the points owed page shows Michaela the liability`

### Task 11: Final verification

- [ ] `npm test` all green (189 baseline plus new), `npx tsc --noEmit` clean, `npm run lint` exactly 3 pre-existing errors, `git status` clean, everything committed.
