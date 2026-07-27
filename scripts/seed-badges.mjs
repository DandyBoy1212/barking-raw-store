// Put the eight badges that used to be a compiled union into store_badges, marking
// the five that code depends on by name as system badges.
//
// Idempotent: a badge already present is left exactly as it is, including its
// retired flag, so re-running never un-retires something Michaela retired.
//
// ORDERING: run this before the badge admin is used in anger. Until it runs,
// getAllBadges falls back to the seed list, so nothing looks broken, but a badge
// created before the seed lands would sit alongside eight badges that do not exist
// in the collection yet.
//
// Dry run:  node scripts/seed-badges.mjs
// Apply:    node scripts/seed-badges.mjs --apply

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

const SEED_BADGES = [
  "Most Popular",
  "Best for Big Dogs",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Great for Training",
  "Natural Joint Support",
  "Single Ingredient",
  "Novel Protein",
];

const SYSTEM_BADGES = [
  "Most Popular",
  "Gentle on Dodgy Tummies",
  "Best for Skin & Coat",
  "Natural Joint Support",
  "Novel Protein",
];

const slug = (label) =>
  label.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const json = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!json) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT before running this.");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(json)) });
const db = getFirestore();

let written = 0;
for (const label of SEED_BADGES) {
  const id = slug(label);
  const ref = db.collection("store_badges").doc(id);
  if ((await ref.get()).exists) continue;
  written += 1;
  const system = SYSTEM_BADGES.includes(label);
  console.log(`${APPLY ? "creating" : "would create"} ${id}${system ? " (system)" : ""}`);
  if (APPLY) {
    await ref.set({ label, retired: false, system, createdAt: FieldValue.serverTimestamp() });
  }
}

console.log(
  `${SEED_BADGES.length} seed badges, ${written} ${APPLY ? "created" : "would be created"}.` +
    (APPLY ? "" : " Re-run with --apply to write."),
);
