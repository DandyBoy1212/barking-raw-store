// Pure logic for Dogs of the Day (spec 10.2): what may be featured, what a
// stored feature is, and which dogs the picker may offer. No Firestore, no
// next/headers, no React (mirrors customer-fields.ts).
//
// The security rule, once: a dog photo renders publicly ONLY when it passes the
// own-storage host guard pinned in validateDogInput's unit tests. This module
// reuses that guard by round-tripping through validateDogInput rather than
// restating it, and it re-checks at READ time too (docToDogFeature), so even a
// hand-edited Firestore doc cannot put a foreign image on a public page.

import { validateDogInput } from "@/lib/customer-fields";

/** One featured dog: only what renders publicly, and nothing about the owner. */
export type DogFeature = {
  id: string;
  dogName: string;
  photo: string;
  date: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME_LENGTH = 80;

/**
 * The photo, if and only if it survives the pinned own-storage guard. The
 * round trip through validateDogInput keeps that guard the single authority:
 * relaxing it there fails its own tests, and nothing here can relax it.
 */
export function usableDogPhoto(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return "";
  const parsed = validateDogInput({ name: "guard-check", photo: url.trim() });
  return parsed.ok && parsed.value.photo ? parsed.value.photo : "";
}

/**
 * Validate a feature about to be created from the admin picker. The name and a
 * guard-passing photo are required (there is nothing to publish without them);
 * a missing or junk date becomes today, because "feature this dog now" is the
 * button's whole meaning.
 */
export function validateDogFeatureInput(
  input: unknown,
  today: string,
): { ok: true; value: { dogName: string; photo: string; date: string } } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Bad request."] };
  const raw = input as Record<string, unknown>;

  const errors: string[] = [];

  const dogName = String(raw.dogName ?? "").trim().slice(0, MAX_NAME_LENGTH);
  if (!dogName) errors.push("The dog needs its name.");

  const photo = usableDogPhoto(raw.photo);
  if (!photo) errors.push("The photo must live on our own storage.");

  const dateRaw = String(raw.date ?? "").trim();
  const date =
    DATE_PATTERN.test(dateRaw) && Number.isFinite(Date.parse(`${dateRaw}T00:00:00Z`))
      ? dateRaw
      : today;

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { dogName, photo, date } };
}

/**
 * A stored feature, re-guarded at read time. Null rather than a partial: a
 * feature that lost its name or whose photo fails the host guard has nothing
 * safe to render, so it renders nothing.
 */
export function docToDogFeature(id: string, data: Record<string, unknown>): DogFeature | null {
  const dogName = String(data.dogName ?? "").trim();
  const photo = usableDogPhoto(data.photo);
  if (!dogName || !photo) return null;
  const dateRaw = String(data.date ?? "").trim();
  return { id, dogName, photo, date: DATE_PATTERN.test(dateRaw) ? dateRaw : "" };
}

/** Newest first, the public page's order; the id breaks ties so the order is stable. */
export function sortFeaturesNewestFirst(features: DogFeature[]): DogFeature[] {
  return [...features].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
}

/** One pickable dog in the admin screen. ownerName is shown to staff only, never stored on a feature. */
export type ConsentedDogPhoto = {
  uid: string;
  dogId: string;
  dogName: string;
  photo: string;
  ownerName: string;
};

/**
 * The dogs Michaela may feature: owners whose customer doc says photoConsent
 * strictly true (consent is opt in, so anything mangled reads as no), and only
 * their dogs whose stored photo passes the host guard.
 */
export function consentedDogPhotos(
  docs: { uid: string; data: Record<string, unknown> }[],
): ConsentedDogPhoto[] {
  const result: ConsentedDogPhoto[] = [];
  for (const { uid, data } of docs) {
    if (data.photoConsent !== true) continue;
    if (!Array.isArray(data.dogs)) continue;
    const ownerName = String(data.name ?? "").trim();
    for (const entry of data.dogs) {
      if (!entry || typeof entry !== "object") continue;
      const dog = entry as Record<string, unknown>;
      const dogId = String(dog.id ?? "").trim();
      const dogName = String(dog.name ?? "").trim();
      const photo = usableDogPhoto(dog.photo);
      if (!dogId || !dogName || !photo) continue;
      result.push({ uid, dogId, dogName, photo, ownerName });
    }
  }
  return result;
}
