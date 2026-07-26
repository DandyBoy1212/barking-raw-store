// The weekly members digest (spec 7.3): one email a week summarising what is
// new in the members area, batched, never an email per post. Pure logic here;
// the cron route does the Firestore and Resend work. House email style, and a
// signed unsubscribe link in every send because this is marketing adjacent.

import { unsubscribeUrl } from "./unsubscribe-links";
import { normaliseSubscriberEmail } from "./subscribers";
import { isMembersOnly } from "./product-fields";
import { postFreshMs, postSnippet, sortNewestFirst, type Post } from "./posts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back "new this week" reaches. Matches the weekly cron cadence. */
export const DIGEST_WINDOW_DAYS = 7;

/**
 * The ISO week key, for example "2026-W30". One key per calendar week is what
 * makes the cron idempotent: the claim doc's id, whatever day or hour a rerun
 * happens, lands on the same document.
 */
export function digestWeekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Monday 1 .. Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday decides the ISO year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type DigestProduct = { name: string; price: number; membersOnlyUntil?: string };

export type DigestContent = { posts: Post[]; earlyAccess: DigestProduct[] };

/**
 * What this week's digest says, or null when it must not send at all.
 *
 * A send needs at least one post fresh inside the window: the digest IS the
 * week's post (spec 7.3). Products currently in their members only window ride
 * along as a section but never trigger a send on their own, because
 * membersOnlyUntil is an end date with no start marker, so "newly members
 * only" cannot be told apart from "still members only", and a post-free week
 * must not email the whole list about the same drop again.
 */
export function selectDigestContent(
  posts: Post[],
  products: DigestProduct[],
  now: Date,
): DigestContent | null {
  const nowMs = now.getTime();
  const fresh = posts.filter((p) => {
    if (!p.published) return false;
    const ms = postFreshMs(p);
    return ms !== null && ms <= nowMs && nowMs - ms < DIGEST_WINDOW_DAYS * DAY_MS;
  });
  if (fresh.length === 0) return null;
  return {
    posts: sortNewestFirst(fresh),
    earlyAccess: products.filter((p) => isMembersOnly(p, now)),
  };
}

/**
 * Who gets the digest: every customer doc carrying a usable email, once each,
 * minus anyone in the opted-out set (emails whose subscriber record shows an
 * explicit unsubscribe). Membership emails stop the moment somebody clicks
 * unsubscribe, whichever of our emails carried the link.
 */
export function digestRecipients(
  customers: Array<Record<string, unknown>>,
  optedOut: Set<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of customers) {
    const email = normaliseSubscriberEmail(c.email);
    if (!email || seen.has(email) || optedOut.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
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

/** Pounds for the email, plain and unambiguous: "GBP 8.50". */
function pounds(n: number): string {
  return `GBP ${n.toFixed(2)}`;
}

/**
 * The digest itself, in the house style set by signInEmailHtml: Arial, 520px,
 * black on white, bold uppercase heading, pill button, grey small print.
 * British spelling, no em dashes.
 */
export function membersDigestEmail(args: {
  content: DigestContent;
  siteUrl: string;
  email: string;
  secret: string;
}): { subject: string; html: string } {
  const base = args.siteUrl.replace(/\/$/, "");
  const unsub = unsubscribeUrl(args.siteUrl, args.email, args.secret);

  const postBlocks = args.content.posts
    .map(
      (p) => `
    <h2 style="font-weight:800;margin-bottom:4px">${escapeHtml(p.title)}</h2>
    <p style="margin-top:0">${escapeHtml(postSnippet(p.body))}</p>`,
    )
    .join("");

  const early =
    args.content.earlyAccess.length > 0
      ? `
    <p style="font-weight:800;margin-bottom:4px">Early access right now:</p>
    <ul style="margin-top:0">
      ${args.content.earlyAccess
        .map((p) => `<li>${escapeHtml(p.name)}, ${pounds(p.price)}, members only until it opens to everyone</li>`)
        .join("\n      ")}
    </ul>`
      : "";

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">This week in the members area.</h1>
    <p>Hi,</p>
    ${postBlocks}
    ${early}
    <p><a href="${base}/members" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Read it in the members area</a></p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
    <p style="color:#6b6b6b;font-size:13px">Had enough? <a href="${unsub}" style="color:#6b6b6b">Unsubscribe</a> and we will not email you again.</p>
  </div>`;

  return { subject: "This week in the members area", html };
}
