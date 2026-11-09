import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { ID_RE, ID_FIND } from './ids.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const num = (s) => Number(s.replace(/,/g, ''));

// Rebuild text lines from the PDF by grouping text items that share a vertical position.
async function pdfLines(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let s = '';
      let end = null;
      for (const it of row.items) {
        const x = it.transform[4];
        if (end !== null && x - end > 1.5) s += ' ';
        s += it.str;
        end = x + it.width;
      }
      lines.push(s.trim());
    }
  }
  return lines;
}

// Line format: "01-10-2026 <narration> <debit> <credit>"
const LINE = /^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

export async function parseBank(file) {
  const lines = await pdfLines(file);
  const out = [];
  for (const line of lines) {
    const m = line.match(LINE);
    if (!m) continue;
    const [, date, narration, debit, credit] = m;
    if (num(credit) <= 0) continue; // only money received

    // The transaction ID is the first word of the narration (before the first "~")
    const first = narration.split(/[~\s]/)[0].toUpperCase();
    const id = ID_RE.test(first) ? first : (narration.toUpperCase().match(ID_FIND) || [null])[0];

    // "1000462#366" -> property paybill code + house number
    const ref = narration.match(/(\d{6,7})#([^~?*]*)/);
    let code = ref ? ref[1] : null;
    let house = ref ? ref[2].trim() : '';
    if (house.startsWith('254')) house = ''; // phone number typed by mistake

    out.push({ date, narration, credit: num(credit), id, code, house });
  }
  if (!out.length) throw new Error('No credit rows found. Is this the right bank statement?');
  return out;
}
