import * as XLSX from 'xlsx';
import { idsFromCell } from './ids.js';

// Reads every sheet (one per property). Headers are shifted in some sheets, so instead of trusting
// header positions we look for transaction IDs by pattern. The PAYMENT amount sits right after RECEIPT.
export async function parseSystem(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const out = [];
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: true });
    for (const r of rows) {
      if (!r || String(r[0]).toLowerCase() === 'totals') continue;
      for (let c = 3; c < r.length; c++) {
        if (typeof r[c] !== 'string') continue;
        const ids = idsFromCell(r[c]);
        if (!ids.length) continue;
        const next = r[c + 1];
        out.push({
          ids,
          sheet,
          tenant: r[1] ?? '',
          unit: r[2] ?? '',
          amount: typeof next === 'number' ? next : null,
        });
        break;
      }
    }
  }
  if (!out.length) throw new Error('No transaction IDs found in the RECEIPT column.');
  return out;
}
