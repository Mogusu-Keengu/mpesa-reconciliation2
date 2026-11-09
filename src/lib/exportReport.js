import * as XLSX from 'xlsx';

const toSheetRow = (r) => ({
  'Bank ID': r.bankId || '',
  'System ID': r.sysId || '',
  Match: r.status === 'matched' ? '✔' : '✘',
  'Bank amount': r.bankAmount ?? '',
  'System amount': r.sysAmount ?? '',
  Date: r.date || '',
  'Property code': r.code || '',
  'House (from bank)': r.house || '',
  'Property sheet': r.sheet || '',
  Tenant: r.tenant || '',
  Unit: r.unit || '',
  Note: r.note || '',
});

export function exportReport(rows, props) {
  const wb = XLSX.utils.book_new();
  const add = (name, data) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
  add('Reconciliation', rows.map(toSheetRow));
  add('Matched', rows.filter((r) => r.status === 'matched').map(toSheetRow));
  add('In bank only', rows.filter((r) => r.status === 'bank_only' || r.status === 'no_id').map(toSheetRow));
  add('In system only', rows.filter((r) => r.status === 'system_only').map(toSheetRow));
  add(
    'By property',
    props.map((p) => ({
      'Property code': p.code,
      'Bank payments': p.bank,
      Matched: p.matched,
      Unmatched: p.unmatched,
      'System sheet': p.sheet,
    }))
  );
  XLSX.writeFile(wb, 'reconciliation-report.xlsx');
}
