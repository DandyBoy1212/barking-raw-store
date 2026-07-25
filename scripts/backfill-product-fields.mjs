// One-off backfill: give every product already in store_products the fields added by
// docs/plans/2026-07-25-stage-7-product-data-pillars.md. Idempotent, and it never
// overwrites a value that is already set.
//
// Dry run:  node scripts/backfill-product-fields.mjs
// Apply:    node scripts/backfill-product-fields.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const COLLECTION = "store_products";

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
  const data = doc.data();
  const patch = {};
  if (data.pillar === undefined) patch.pillar = "good-food";
  if (data.leadTimeDays === undefined) patch.leadTimeDays = 0;
  if (data.fulfilment === undefined) patch.fulfilment = "own-stock";
  if (Object.keys(patch).length === 0) continue;
  touched += 1;
  console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, patch);
  if (APPLY) await doc.ref.set(patch, { merge: true });
}

console.log(
  `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
process.exit(0);
