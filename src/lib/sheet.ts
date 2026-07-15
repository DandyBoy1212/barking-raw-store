import { google } from "googleapis";

// Append-only write to Michaela's fulfilment sheet. We ONLY ever add a new row
// to the bottom; we never edit existing rows, so her Packed / Posted / Returns
// columns are always safe. Returns false (never throws) if not configured.
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
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Orders!A1",
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
