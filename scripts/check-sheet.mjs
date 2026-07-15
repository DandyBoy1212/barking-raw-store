// End-to-end fulfilment-sheet check for the barking-raw service account.
// Reads the sheet, writes a test row, then deletes it (leaves the sheet clean).
// Proves: Sheets API enabled + sheet shared with the SA as Editor.
// Usage: node scripts/check-sheet.mjs <SHEET_ID> <path-to-service-account.json>
import { google } from "googleapis";
import fs from "node:fs";

const SHEET_ID = process.argv[2];
const saPath = process.argv[3];
const credentials = JSON.parse(fs.readFileSync(saPath, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

try {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "properties.title,sheets.properties.title,sheets.properties.sheetId",
  });
  const firstSheetId = meta.data.sheets[0].properties.sheetId;

  const appended = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "A1",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [["__barking_raw_connection_test__ (safe to ignore)"]] },
  });

  const m = appended.data.updates.updatedRange.match(/!\D+(\d+):/);
  const rowNum = m ? parseInt(m[1], 10) : null;
  let cleaned = false;
  if (rowNum) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: firstSheetId,
                dimension: "ROWS",
                startIndex: rowNum - 1,
                endIndex: rowNum,
              },
            },
          },
        ],
      },
    });
    cleaned = true;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        title: meta.data.properties?.title,
        tabs: meta.data.sheets?.map((s) => s.properties?.title),
        canWrite: true,
        testRowRemoved: cleaned,
        serviceAccount: credentials.client_email,
      },
      null,
      2
    )
  );
} catch (e) {
  console.log(
    JSON.stringify(
      { ok: false, code: e.code, message: String(e.errors?.[0]?.message || e.message) },
      null,
      2
    )
  );
}
