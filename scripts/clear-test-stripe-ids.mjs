// One-off for the test->live Stripe key cutover (26 Aug 2026, Dog Day).
//
// Every product doc carries stripeProductId / stripePriceId minted under the
// TEST key. buildCheckoutLineItem prefers stripePriceId when present, so under
// the LIVE key every checkout 500s on a price id that does not exist in live
// mode. Clearing the ids makes checkout fall back to inline price_data
// immediately; the next admin sync per product mints proper LIVE ids.
//
// Dry run:  node --env-file=.env.local scripts/clear-test-stripe-ids.mjs
// Apply:    node --env-file=.env.local scripts/clear-test-stripe-ids.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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
  const d = doc.data();
  const has = d.stripeProductId || d.stripePriceId || d.stripeRecurringPriceIds;
  if (!has) continue;
  touched++;
  console.log(
    `${APPLY ? "clearing" : "would clear"} ${doc.id}:`,
    [d.stripeProductId, d.stripePriceId].filter(Boolean).join(", "),
    d.stripeRecurringPriceIds ? `+ recurring ${Object.keys(d.stripeRecurringPriceIds).length}` : "",
  );
  if (APPLY) {
    await doc.ref.update({
      stripeProductId: FieldValue.delete(),
      stripePriceId: FieldValue.delete(),
      stripeRecurringPriceIds: FieldValue.delete(),
    });
  }
}

console.log(`${APPLY ? "cleared" : "would clear"} ${touched} of ${snap.size} products`);
