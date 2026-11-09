# Bank statement reconciler

Compares a Co-op bank statement (PDF) with a property system report (Excel) by M-Pesa transaction ID.
Runs entirely in the browser. No backend, no uploads.

## Run it
```
npm install
npm run dev
```
Open the address shown in the terminal (usually http://localhost:5173).

## How matching works
- **Bank PDF:** the first word of each credit narration (before the first `~`) is the transaction ID.
  The `1000462#366` part gives the property paybill code and the house number.
- **System Excel:** every sheet is scanned for transaction IDs in the RECEIPT column. Cells with several IDs
  (comma or `/` separated), lowercase IDs and stray punctuation are cleaned up.
- Each bank credit is marked matched, in bank only, or no ID found. IDs only in the system are marked in system only.
- Amounts are compared for single-ID receipts.

## Files
- `src/lib/parseBank.js` reads the PDF with pdf.js
- `src/lib/parseSystem.js` reads the Excel with SheetJS
- `src/lib/reconcile.js` matching logic
- `src/lib/exportReport.js` Excel download
- `src/App.jsx` interface
