// One-off backfill for B.5: fold each product's single `image` string into the
// `images` list (ordered, one primary) and realign the derived `image` field.
// Idempotent: a doc already in shape plans no write. Mirrors backfill-product-fields.mjs.
//
// Dry run:  node scripts/backfill-product-images.mjs
// Apply:    node scripts/backfill-product-images.mjs --apply

import { pathToFileURL } from "node:url";

const COLLECTION = "store_products";

/**
 * Decide what, if anything, this doc needs written. Returns { images, image }
 * or null when the doc is already in shape (or has no image data to fold).
 * Kept pure and exported so scripts/backfill-product-images.test.mjs can test it
 * without Firestore. Mirrors normaliseImages in src/lib/product-images.ts, which
 * node cannot import from an .mjs script because it is TypeScript.
 */
export function planImagePatch(data) {
  const cleaned = [];
  if (Array.isArray(data.images)) {
    for (const entry of data.images) {
      const url =
        typeof entry === "string"
          ? entry.trim()
          : entry && typeof entry.url === "string"
            ? entry.url.trim()
            : "";
      if (!url) continue;
      cleaned.push({ url, primary: entry?.primary === true });
    }
  }
  let images = cleaned;
  if (images.length === 0) {
    const legacy = typeof data.image === "string" ? data.image.trim() : "";
    if (!legacy) return null;
    images = [{ url: legacy, primary: true }];
  }
  const first = images.findIndex((i) => i.primary);
  const primaryAt = first === -1 ? 0 : first;
  images = images.map((i, n) => ({ url: i.url, primary: n === primaryAt }));
  const image = images[primaryAt].url;

  const already =
    Array.isArray(data.images) &&
    data.images.length === images.length &&
    data.images.every(
      (e, n) => e && e.url === images[n].url && e.primary === images[n].primary,
    ) &&
    data.image === image;
  return already ? null : { images, image };
}

async function main() {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const APPLY = process.argv.includes("--apply");
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) {
    console.error("Set FIREBASE_SERVICE_ACCOUNT before running this.");
    process.exit(1);
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(json)) });
  const db = getFirestore();

  const snap = await db.collection(COLLECTION).get();
  let touched = 0;

  for (const doc of snap.docs) {
    const patch = planImagePatch(doc.data());
    if (!patch) continue;
    touched += 1;
    console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, JSON.stringify(patch));
    if (APPLY) await doc.ref.set(patch, { merge: true });
  }

  console.log(
    `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}.` +
      (APPLY ? "" : " Re-run with --apply to write."),
  );
  process.exit(0);
}

// Only run against Firestore when invoked directly, never on import (the tests import this).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
