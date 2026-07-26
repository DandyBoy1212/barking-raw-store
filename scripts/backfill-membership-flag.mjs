// One-off backfill: set the explicit `member` flag on the customers who earned it.
//
// Membership used to be inferred from a store_customers doc existing, which stopped
// being safe once the A.2 account routes started creating that doc when somebody adds
// a dog or saves an address. isMemberUid now reads an explicit `member: true`, so the
// customers who were members under the old rule need the flag written.
//
// Who gets it: a doc created by ensureCustomer on a paid order ALWAYS carries an
// `email` field, and a doc created by the account routes NEVER does, because those
// write only dogs, name, phone and address. So a non-empty email is a reliable marker
// of "this record came from a purchase". Anything else is left alone, deliberately:
// granting membership to a record that never bought anything is the exact bug this
// is here to close.
//
// ORDERING, and it matters. Deploy the membership fix, then run this, and only then
// ship the stall form (D.1). The stall grants membership at the table, so a signup
// created after D.1 ships but before this has run would be written under the old
// assumption and would need patching by hand. Nothing is deployed yet, so the order
// is free today and expensive to get wrong later.
//
// Dry run:  node scripts/backfill-membership-flag.mjs
// Apply:    node scripts/backfill-membership-flag.mjs --apply

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
let granted = 0;
let skipped = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  if (data.member === true) continue;

  const boughtSomething = typeof data.email === "string" && data.email.trim() !== "";
  if (!boughtSomething) {
    skipped += 1;
    console.log(`leaving ${doc.id} a non-member: no email, so this record never came from an order`);
    continue;
  }

  granted += 1;
  console.log(`${APPLY ? "granting" : "would grant"} membership to ${doc.id} (${data.email})`);
  if (APPLY) await doc.ref.set({ member: true }, { merge: true });
}

console.log(
  `${snap.size} customers, ${granted} ${APPLY ? "granted" : "would be granted"}, ${skipped} left as non-members.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
