// Pure subscriber logic: no Firestore, no next/server, no node built-ins, so it
// is trivially unit-testable (mirrors auth-helpers.ts) and safe to import from
// a client component. The doc id in store_subscribers is the lower-cased email,
// which is what makes deduplication automatic: both forms write one doc.

export type SubscriberSource = "home" | "shop" | "stall";

/** Every source the record vocabulary knows. The stall flow is not built yet. */
export const SUBSCRIBER_SOURCES: readonly SubscriberSource[] = ["home", "shop", "stall"];

/** The sources the public /api/subscribe route accepts today. */
export const CAPTURE_SOURCES = ["home", "shop"] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

/**
 * The exact sentence shown beside the unticked checkbox, stored on the record
 * so we always know what was consented to. Defined server-side so a tampered
 * client cannot rewrite what somebody agreed to.
 */
export const CONSENT_TEXT: Record<CaptureSource, string> = {
  home: "Email me free hints and tips from each pillar. Unsubscribe any time.",
  shop: "Email me my 10% first order code and hints and tips from each pillar. Unsubscribe any time.",
};

/** Trimmed and lower-cased, or null unless it looks like an email address. */
export function normaliseSubscriberEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export const WELCOME_SEQUENCE_LENGTH = 4;

export type Subscriber = {
  email: string;
  source: SubscriberSource;
  consent: boolean;
  consentText: string;
  consentAtMs: number | null;
  discountCode: string | null;
  codeEmailSentAtMs: number | null;
  sequencePosition: number;
  unsubscribed: boolean;
};

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Map a Firestore doc to a subscriber, tolerating every shape ever written. */
export function docToSubscriber(id: string, data: Record<string, unknown>): Subscriber {
  const source = SUBSCRIBER_SOURCES.includes(data.source as SubscriberSource)
    ? (data.source as SubscriberSource)
    : "home";
  const rawPosition = Number(data.sequencePosition ?? 0);
  const sequencePosition = Number.isFinite(rawPosition)
    ? Math.min(Math.max(Math.trunc(rawPosition), 0), WELCOME_SEQUENCE_LENGTH)
    : 0;
  return {
    email: String(data.email ?? id),
    source,
    consent: data.consent === true,
    consentText: String(data.consentText ?? ""),
    consentAtMs: toMillis(data.consentAt),
    discountCode:
      typeof data.discountCode === "string" && data.discountCode ? data.discountCode : null,
    codeEmailSentAtMs: toMillis(data.codeEmailSentAt),
    sequencePosition,
    unsubscribed: toMillis(data.unsubscribedAt) !== null,
  };
}
