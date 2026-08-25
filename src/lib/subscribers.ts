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
 * client cannot rewrite what somebody agreed to. The stall wording is the
 * consent screen's chip, verbatim; it reaches this module only through the
 * server-side stall sync, never through the public capture route.
 */
export const CONSENT_TEXT: Record<SubscriberSource, string> = {
  home: "Email me free hints and tips. Unsubscribe any time.",
  shop: "Email me my 10% first order code and hints and tips. Unsubscribe any time.",
  stall: "Email me the new stuff and the member offers. Unsubscribe any time.",
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

/**
 * What one form submit changes on the record. Pure: the route adds timestamps.
 *
 * The rules a repeat submit must obey (spec section 5, and C.1):
 * - first-touch source wins, so the follow up matches the offer they saw first;
 * - a later ticked box turns consent on, recording the wording that won it;
 * - an unticked repeat is the absence of consent, not a revocation, so it
 *   changes nothing (revocation is the unsubscribe link);
 * - sequence position and any issued code are never reset, so a repeat submit
 *   cannot restart the emails or claim the 10% twice.
 */
export function applySubscription(
  existing: Subscriber | null,
  input: { source: SubscriberSource; consent: boolean },
): {
  create: boolean;
  consentTurnedOn: boolean;
  fields: { source?: SubscriberSource; consent?: boolean; consentText?: string };
} {
  if (!existing) {
    return {
      create: true,
      consentTurnedOn: input.consent,
      fields: {
        source: input.source,
        consent: input.consent,
        consentText: input.consent ? CONSENT_TEXT[input.source] : "",
      },
    };
  }
  if (input.consent && !existing.consent) {
    return {
      create: false,
      consentTurnedOn: true,
      fields: { consent: true, consentText: CONSENT_TEXT[input.source] },
    };
  }
  return { create: false, consentTurnedOn: false, fields: {} };
}

/** Day offsets from consent for the four story emails: the first fortnight. */
export const WELCOME_OFFSETS_DAYS = [0, 4, 9, 14] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type WelcomeAction = { type: "code" } | { type: "story"; index: 0 | 1 | 2 | 3 } | null;

/**
 * The one email this contact is due right now, or null.
 *
 * No consent, no marketing sequence, and the code email counts as marketing
 * (the shop form says the ticked box is how the code arrives). Shop contacts
 * get "your code is waiting" before story one, and so do stall contacts,
 * because the table offer is 10% now and 10% off the first online order. The
 * cron sends at most one email per contact per run, so the code email lands a
 * run ahead of story one rather than in the same inbox minute.
 */
export function nextWelcomeAction(s: Subscriber, nowMs: number): WelcomeAction {
  if (!s.consent || s.unsubscribed || s.consentAtMs === null) return null;
  if ((s.source === "shop" || s.source === "stall") && s.codeEmailSentAtMs === null) {
    return { type: "code" };
  }
  const index = s.sequencePosition;
  if (index >= WELCOME_SEQUENCE_LENGTH) return null;
  if (nowMs >= s.consentAtMs + WELCOME_OFFSETS_DAYS[index] * DAY_MS) {
    return { type: "story", index: index as 0 | 1 | 2 | 3 };
  }
  return null;
}

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
