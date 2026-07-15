// One-off: clear all values from the first tab (removes the connection-test row).
// Usage: node scripts/clear-sheet.mjs <SHEET_ID> <path-to-service-account.json>
import { google } from "googleapis";
import fs from "node:fs";

const SHEET_ID = process.argv[2];
const credentials = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const meta = await sheets.spreadsheets.get({
  spreadsheetId: SHEET_ID,
  fields: "sheets.properties.title",
});
const firstTab = meta.data.sheets[0].properties.title;
await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: firstTab });
console.log(JSON.stringify({ cleared: firstTab }, null, 2));
