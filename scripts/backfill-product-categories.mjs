// One-off migration for docs/specs/2026-08-25-shop-taxonomy-foundations-design.md
// section 8: put every product on a shelf, archive anything the supplier used to
// post, and delete the retired pillar and dropshipping fields.
//
// Idempotent, and it makes no Stripe calls, because none of these fields reach Stripe.
//
// Dry run:  node scripts/backfill-product-categories.mjs
// Apply:    node scripts/backfill-product-categories.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const COLLECTION = "store_products";

/**
 * The sentinel meaning "remove this field". Injected rather than imported into the
 * planner so the planner stays a pure function the tests can assert against.
 */
export const DELETE = "__delete__";

/** The retired fields, deleted from every doc the migration touches. */
const RETIRED = [
  "pillar",
  "fulfilment",
  "leadTimeDays",
  "supplierPostage",
  "supplierArrivalMinDays",
  "supplierArrivalMaxDays",
];

/**
 * The shelf a slug lands on. Everything on the shelf today is a treat except the
 * Dog Day mystery box, which is a box. Anything unrecognised is a treat, matching
 * the same default in docToStoredProduct, so a product added between writing this
 * and running it is never left invisible.
 */
function shelfFor(slug) {
  return slug === "mystery-box" ? "boxes" : "treats";
}

/**
 * What to write for one product doc, or null if it is already migrated.
 *
 * A supplier posted product is archived rather than converted, because converting
 * it would put a product Michaela cannot post from her own shelf onto a shelf that
 * promises she can.
 */
export function planCategoryPatch(slug, data) {
  const alreadyDone =
    typeof data.category === "string" && RETIRED.every((f) => data[f] === undefined);
  if (alreadyDone) return null;

  const archive = data.fulfilment === "supplier-posted";
  const patch = { category: data.category ?? shelfFor(slug) };
  if (archive) patch.archived = true;
  for (const field of RETIRED) {
    if (data[field] !== undefined) patch[field] = DELETE;
  }
  return { patch, archive };
}

/** Swap the sentinels for the real Firestore delete, just before writing. */
function toFirestorePatch(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[k] = v === DELETE ? FieldValue.delete() : v;
  return out;
}

async function main() {
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
  let archived = 0;

  for (const doc of snap.docs) {
    const plan = planCategoryPatch(doc.id, doc.data());
    if (!plan) continue;
    touched += 1;
    if (plan.archive) {
      archived += 1;
      console.log(`${APPLY ? "archiving" : "would archive"} ${doc.id} (was supplier posted)`);
    }
    console.log(`${APPLY ? "patching" : "would patch"} ${doc.id}:`, plan.patch);
    if (APPLY) await doc.ref.set(toFirestorePatch(plan.patch), { merge: true });
  }

  console.log(
    `${snap.size} products, ${touched} ${APPLY ? "patched" : "would be patched"}, ` +
      `${archived} ${APPLY ? "archived" : "would be archived"}.` +
      (APPLY ? "" : " Re-run with --apply to write."),
  );
  process.exit(0);
}

// Only connect to Firestore when run as a script, so importing it in a test does not.
if (process.argv[1] && process.argv[1].endsWith("backfill-product-categories.mjs")) {
  await main();
}
