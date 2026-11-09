// Compares bank credits with system receipts by transaction ID.
export function reconcile(bank, sys) {
  const sysMap = new Map();
  for (const rec of sys) {
    for (const id of rec.ids) sysMap.set(id, { ...rec, single: rec.ids.length === 1 });
  }
  const bankIds = new Set(bank.map((b) => b.id).filter(Boolean));
  const rows = [];

  for (const b of bank) {
    const base = {
      date: b.date,
      bankId: b.id || '',
      bankAmount: b.credit,
      code: b.code,
      house: b.house,
      noHouse: !b.house,
    };
    if (!b.id) {
      rows.push({ ...base, status: 'no_id', note: 'No transaction ID found. Check manually.' });
      continue;
    }
    const s = sysMap.get(b.id);
    if (s) {
      const amountOk = s.single && s.amount != null ? Math.abs(s.amount - b.credit) < 0.5 : null;
      rows.push({
        ...base,
        status: 'matched',
        sysId: b.id,
        sysAmount: s.single ? s.amount : null,
        amountOk,
        sheet: s.sheet,
        tenant: s.tenant,
        unit: s.unit,
        note: amountOk === false ? 'Amounts differ' : s.single ? '' : 'Split payment (several IDs in one cell)',
      });
    } else {
      rows.push({
        ...base,
        status: 'bank_only',
        note: b.house ? 'In bank, not recorded in system' : 'In bank, no house number assigned',
      });
    }
  }

  for (const [id, s] of sysMap) {
    if (bankIds.has(id)) continue;
    rows.push({
      status: 'system_only',
      sysId: id,
      sysAmount: s.single ? s.amount : null,
      sheet: s.sheet,
      tenant: s.tenant,
      unit: s.unit,
      noHouse: false,
      note: 'In system, not in bank statement (other month, typo or unpaid?)',
    });
  }

  // Per-property summary, keyed by the paybill code in the bank narration
  const props = new Map();
  for (const r of rows) {
    if (!r.code) continue;
    const p = props.get(r.code) || { code: r.code, bank: 0, matched: 0, sheets: {} };
    p.bank++;
    if (r.status === 'matched') {
      p.matched++;
      p.sheets[r.sheet] = (p.sheets[r.sheet] || 0) + 1;
    }
    props.set(r.code, p);
  }
  const propList = [...props.values()]
    .map((p) => ({
      ...p,
      unmatched: p.bank - p.matched,
      sheet: Object.entries(p.sheets).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    }))
    .sort((a, b) => b.bank - a.bank);

  const scopeCodes = new Set(propList.filter((p) => p.matched > 0).map((p) => p.code));
  return { rows, props: propList, scopeCodes };
}
