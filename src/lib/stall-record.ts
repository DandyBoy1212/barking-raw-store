// Pure logic for the stall signup record: validation, the Firestore patch, and the
// welcome email body. No Firestore, no next/headers, no React, so this module is
// trivially unit-testable (mirrors customer-fields.ts).

import { normaliseAddress, validateDogInput } from "@/lib/customer-fields";
import type { CustomerAddress, Dog, StoredCustomer } from "@/data/customers";

/** One dog as captured at the stall: the A.2 fields plus an optional inline photo. */
export type StallDog = { value: Omit<Dog, "id">; photoData?: string };

export type StallConsent = { marketing: boolean; photo: boolean };

/**
 * One signup as queued on the iPad and posted to the sync route.
 *
 * clientId is minted by the device when the record is first saved locally, and it is
 * the idempotency key: syncing the same clientId twice applies the record once.
 */
export type StallRecord = {
  clientId: string;
  capturedAt: string;
  name: string;
  email: string;
  phone: string;
  address: CustomerAddress;
  dogs: StallDog[];
  consent: StallConsent;
};

// UUID-shaped, but tolerant of anything url-safe the same length, since the id only
// has to be unique and unguessable enough to key a marker doc.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

// A downscaled 1280px JPEG is a few hundred KB; base64 inflates by a third. This cap
// keeps the whole record safely inside a serverless request body.
const PHOTO_DATA_PATTERN = /^data:image\/(jpeg|png|webp);base64,/;
const MAX_PHOTO_DATA_CHARS = 2_800_000;

/**
 * Validate one stall record from the queue.
 *
 * Lenient the way validateDogInput is lenient, and for the same reason: these records
 * are captured in conversation with every field skippable, so a half-known record is
 * worth far more than a rejected one. Only a missing clientId (sync could not be
 * idempotent) and a record with nothing in it at all are hard errors. Everything else
 * degrades: bad email becomes no email, a nameless dog is dropped, an unusable photo
 * is stripped while the dog is kept.
 */
export function validateStallRecord(
  input: unknown,
  receivedAt: string,
): { ok: true; record: StallRecord } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Bad record."] };
  const raw = input as Record<string, unknown>;

  const clientId = String(raw.clientId ?? "").trim();
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, errors: ["A record needs its client id."] };
  }

  const capturedRaw = String(raw.capturedAt ?? "").trim();
  const capturedAt = Number.isFinite(Date.parse(capturedRaw)) ? capturedRaw : receivedAt;

  const name = String(raw.name ?? "").trim();
  const emailRaw = String(raw.email ?? "").trim().toLowerCase();
  const email = emailRaw.includes("@") ? emailRaw : "";
  const phone = String(raw.phone ?? "").trim();
  const address = normaliseAddress(raw.address as Partial<CustomerAddress> | undefined);

  const dogs: StallDog[] = [];
  if (Array.isArray(raw.dogs)) {
    for (const entry of raw.dogs) {
      if (!entry || typeof entry !== "object") continue;
      const parsed = validateDogInput(entry as Partial<Dog>);
      // A nameless dog is dropped, not fatal: docToStoredCustomer would drop it at
      // read time anyway, so keeping it here would only defer the loss.
      if (!parsed.ok) continue;
      const photoData = String((entry as Record<string, unknown>).photoData ?? "");
      const usablePhoto =
        PHOTO_DATA_PATTERN.test(photoData) && photoData.length <= MAX_PHOTO_DATA_CHARS;
      dogs.push(usablePhoto ? { value: parsed.value, photoData } : { value: parsed.value });
    }
  }

  const consentRaw = (raw.consent ?? {}) as Record<string, unknown>;
  // Strictly === true: consent is opt in, so anything mangled reads as unticked.
  const consent: StallConsent = {
    marketing: consentRaw.marketing === true,
    photo: consentRaw.photo === true,
  };

  const hasAddress = Object.values(address).some(Boolean);
  if (!name && !email && !phone && !hasAddress && dogs.length === 0) {
    return { ok: false, errors: ["Nothing to save."] };
  }

  return { ok: true, record: { clientId, capturedAt, name, email, phone, address, dogs, consent } };
}

/**
 * The dog-{n} id rule, one higher than the highest ever used. This duplicates
 * nextDogId in customers-store.ts deliberately: that module is server-only and this
 * one must stay pure. The unit test pins the behaviour so the copies cannot drift.
 */
function nextStallDogId(existing: { id: string }[]): string {
  const highest = existing.reduce((max, d) => {
    const match = /^dog-(\d+)$/.exec(d.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `dog-${highest + 1}`;
}

/**
 * The Firestore merge patch one stall record becomes.
 *
 * A non-blank record field wins over the existing value, because the stall
 * conversation is the freshest deliberate collection there is. A blank field never
 * blanks anything, mirroring buildCustomerDoc's caution. Email is the exception both
 * ways: it is identity, so it is only written into a doc that has none. Consent is
 * always written, ticked or not, because "no, asked on this date" is a defensible
 * answer and an absent field is not.
 */
export function buildStallCustomerPatch(
  current: StoredCustomer,
  record: StallRecord,
  photoUrls: (string | undefined)[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (record.email && !current.email) patch.email = record.email;
  if (record.name) patch.name = record.name;
  if (record.phone) patch.phone = record.phone;

  const anyAddressField = Object.values(record.address).some(Boolean);
  if (anyAddressField) {
    const merged = {
      line1: record.address.line1 || current.address.line1,
      line2: record.address.line2 || current.address.line2,
      city: record.address.city || current.address.city,
      postcode: record.address.postcode || current.address.postcode,
    };
    patch.address = merged;
    if (merged.postcode) patch.lastPostcode = merged.postcode;
  }

  if (record.dogs.length) {
    const dogs = [...current.dogs];
    record.dogs.forEach((stallDog, i) => {
      const url = photoUrls[i];
      dogs.push({
        id: nextStallDogId(dogs),
        ...stallDog.value,
        ...(url ? { photo: url } : {}),
      });
    });
    patch.dogs = dogs;
  }

  // Spec 10.1: signing up at the stall grants membership. Membership is an
  // explicit flag, not doc existence (existence-as-membership let any signed-in
  // user self-grant by adding a dog), so the stall write says it in so many words.
  patch.member = true;

  patch.marketingConsent = record.consent.marketing;
  patch.photoConsent = record.consent.photo;
  patch.consentAt = record.capturedAt;
  patch.stallSignupAt = record.capturedAt;

  return patch;
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

/**
 * The welcome email sent after a stall signup syncs, carrying the magic link so the
 * person's first sign-in lands on the record Michaela just made for them.
 */
export function stallWelcomeEmailHtml(link: string, name?: string): string {
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0b0b0b">
    <h1 style="font-weight:900;text-transform:uppercase">Welcome to Barking Raw</h1>
    <p>${hi}</p>
    <p>Lovely to meet you at the stall. Your account is ready, with your dog's details already on it.</p>
    <p>Tap the button below to sign in. The link works once and expires shortly, and you can always ask for a fresh one at barkingraw.dog/login.</p>
    <p><a href="${link}" style="display:inline-block;background:#0b0b0b;color:#fff;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Sign in</a></p>
    <p style="color:#6b6b6b;font-size:13px">If this was not you, you can ignore this email.</p>
    <p style="color:#6b6b6b;font-size:13px">Barking Raw · Natural Dog Food · barkingraw.dog</p>
  </div>`;
}
