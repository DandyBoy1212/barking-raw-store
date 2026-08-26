// Throwaway diagnostic: who currently holds staff access?
// Lists store_staff docs alongside the real Firebase custom claim, because the
// claim is what requireStaff() actually checks; the doc is only a record.
import fs from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

initializeApp({ credential: cert(JSON.parse(get("FIREBASE_SERVICE_ACCOUNT"))) });
const db = getFirestore();
const auth = getAuth();

const snap = await db.collection("store_staff").get();
console.log(`store_staff docs: ${snap.size}`);
for (const d of snap.docs) {
  const email = d.data().email || "(no email field)";
  let claims = {};
  try {
    claims = (await auth.getUser(d.id)).customClaims || {};
  } catch {
    claims = { error: "no auth user" };
  }
  console.log(
    `  ${email.padEnd(42)} staff-claim=${claims.staff === true}  invitedBy=${d.data().invitedBy || "-"}`,
  );
}
process.exit(0);
