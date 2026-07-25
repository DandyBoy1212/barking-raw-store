// One-off backfill: give every customer already in store_customers the fields added by
// docs/plans/2026-07-25-stage-8-customer-dog-model.md. Idempotent, and it never
// overwrites a value that is already set.
//
// docToStoredCustomer already defaults all of these on read, so nothing is broken
// without this. The reason to run it is that a doc with a real dogs array and address
// can be queried, and one without them cannot, which matters the first time Michaela
// wants a count.
//
// Dry run:  node scripts/backfill-customer-fields.mjs
// Apply:    node scripts/backfill-customer-fields.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const COLLECTION = "store_customers";

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

  if (typeof data.phone !== "string") patch.phone = "";
  if (!Array.isArray(data.dogs)) patch.dogs = [];
  if (!data.address || typeof data.address !== "object") {
    // lastPostcode is the only address information these docs ever held, so it
    // seeds the postcode rather than being thrown away.
    patch.address = {
      line1: "",
      line2: "",
      city: "",
      postcode: String(data.lastPostcode ?? "").trim().toUpperCase(),
    };
  }

  if (Object.keys(patch).length === 0) continue;
  touched += 1;
  console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, Object.keys(patch).join(", "));
  if (APPLY) await doc.ref.set(patch, { merge: true });
}

console.log(
  `${snap.size} customers, ${touched} ${APPLY ? "patched" : "would be patched"}.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
