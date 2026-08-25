// Attach the 2026-07-21 retail packshots to their products, doing by script exactly
// what the admin UI does by hand: upload to the Storage bucket under products/<uuid>,
// take a long-lived signed read URL, then prepend it to the product's images list.
//
// The existing photo is kept, demoted to second — nothing is deleted, so this is
// reversible from the admin's own reorder/set-primary controls.
//
// Idempotent: a product whose primary is already a Storage URL is left alone, so a
// second run cannot stack duplicates.
//
// Dry run:  node scripts/upload-packshots.mjs
// Apply:    node scripts/upload-packshots.mjs --apply

import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const COLLECTION = "store_products";
const SRC_DIR = "C:/Users/Liam/Downloads/barking-raw-packshots";

// Product slug -> the staged packshot for it. Rabbit Nibbles is deliberately absent:
// it is a real packaged SKU with no product doc to attach to yet.
const PACKSHOTS = {
  "chicken-feet": "chicken-feet.png",
  "beef-trachea-rings": "beef-trachea-rings.png",
  "rabbit-ears": "rabbit-ears.png",
  "duck-wings": "duck-wings.png",
  "whole-sprats": "whole-sprats.png",
  "salmon-bites": "salmon-bites.png",
};

/** Already-uploaded photos live on the Storage bucket; seed photos are /public paths. */
const isUploaded = (url) => typeof url === "string" && url.includes("storage.googleapis.com");

/**
 * The images list after prepending the packshot as primary, or null when this doc
 * already has an uploaded primary and should be skipped. Pure, so the decision is
 * testable without Firestore.
 */
export function planImages(data, packshotUrl) {
  const existing = (Array.isArray(data.images) ? data.images : [])
    .filter((i) => i && typeof i.url === "string")
    .map((i) => ({ url: i.url, primary: false }));

  if (existing.some((i) => isUploaded(i.url))) return null;

  const images = [{ url: packshotUrl, primary: true }, ...existing];
  return { images, image: packshotUrl };
}

async function main() {
  const APPLY = process.argv.includes("--apply");

  const env = readFileSync("C:/Users/Liam/barking-raw-store/.env.local", "utf8");
  const pick = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1].trim();
  const serviceAccount = pick("FIREBASE_SERVICE_ACCOUNT");
  const bucketName = pick("FIREBASE_STORAGE_BUCKET");
  if (!serviceAccount || !bucketName) {
    console.error("FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET must be set in .env.local");
    process.exit(1);
  }

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");

  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  const db = getFirestore();
  const bucket = getStorage().bucket(bucketName);

  let touched = 0;
  let skipped = 0;

  for (const [slug, filename] of Object.entries(PACKSHOTS)) {
    const local = `${SRC_DIR}/${filename}`;
    if (!existsSync(local)) {
      console.error(`  MISSING  ${slug}: ${local}`);
      process.exitCode = 1;
      continue;
    }

    const ref = db.collection(COLLECTION).doc(slug);
    const doc = await ref.get();
    if (!doc.exists) {
      console.error(`  MISSING  ${slug}: no product doc`);
      process.exitCode = 1;
      continue;
    }

    // Dry run needs a stand-in URL so the plan can be shown without uploading.
    const objectPath = `products/${randomUUID()}.png`;
    let url = `https://storage.googleapis.com/${bucketName}/${objectPath} (not yet uploaded)`;

    if (APPLY) {
      const gcsFile = bucket.file(objectPath);
      await gcsFile.save(readFileSync(local), { contentType: "image/png", resumable: false });
      [url] = await gcsFile.getSignedUrl({ action: "read", expires: "2500-01-01" });
    }

    const patch = planImages(doc.data(), url);
    if (!patch) {
      skipped += 1;
      console.log(`  SKIP     ${slug}: primary is already an uploaded photo`);
      continue;
    }

    touched += 1;
    console.log(
      `  ${APPLY ? "PATCHED " : "would patch"} ${slug}: ${patch.images.length} images, ` +
        `primary -> packshot, was ${doc.data().image}`,
    );
    if (APPLY) await ref.set(patch, { merge: true });
  }

  console.log(
    `\n${touched} ${APPLY ? "updated" : "would be updated"}, ${skipped} skipped.` +
      (APPLY ? "" : " Re-run with --apply to upload and write."),
  );
  process.exit(process.exitCode ?? 0);
}

// Only touch Firestore when invoked directly, never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
