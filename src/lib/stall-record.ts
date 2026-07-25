// Pure logic for the stall signup record: validation, the Firestore patch, and the
// welcome email body. No Firestore, no next/headers, no React, so this module is
// trivially unit-testable (mirrors customer-fields.ts).

import { normaliseAddress, validateDogInput } from "@/lib/customer-fields";
import type { CustomerAddress, Dog } from "@/data/customers";

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
