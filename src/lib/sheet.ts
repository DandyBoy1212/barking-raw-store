import { google } from "googleapis";

const HEADERS = [
  "Order #",
  "Date",
  "Customer",
  "Address",
  "Postcode",
  "Items",
  "Qty",
  "Subtotal",
  "Postage",
  "Total",
  "Local?",
  "Packed",
  "Posted",
  "Returns / Notes",
];

// Append-only write to Michaela's fulfilment sheet. Writes to the FIRST tab
// (no naming needed) and auto-creates the header row on first use. We ONLY ever
// add a new row to the bottom, so her Packed / Posted / Returns columns stay safe.
// Returns false (never throws) if not configured.
export async function appendOrderRow(values: (string | number)[]): Promise<boolean> {
  const spreadsheetId = process.env.FULFILMENT_SHEET_ID;
  const saJson =
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!spreadsheetId || !saJson) {
    console.warn("[sheet] FULFILMENT_SHEET_ID or service account not set, skipping");
    return false;
  }
  try {
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure a header row exists (first use only).
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range: "A1:A1" });
    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [HEADERS] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    return true;
  } catch (err) {
    console.error("[sheet] append failed:", err);
    return false;
  }
}
