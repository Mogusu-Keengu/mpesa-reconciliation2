import { useMemo, useState } from 'react';
import { parseBank } from './lib/parseBank.js';
import { parseSystem } from './lib/parseSystem.js';
import { reconcile } from './lib/reconcile.js';
import { exportReport } from './lib/exportReport.js';

const TABS = [
  ['all', 'All'],
  ['matched', 'Matched'],
  ['bank_only', 'In bank only'],
  ['system_only', 'In system only'],
  ['amount', 'Amount differs'],
  ['nohouse', 'No house number'],
];
const LIMIT = 1000;
const money = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 }));

function Drop({ label, hint, accept, file, count, onFile }) {
  return (
    <label className={'drop' + (file ? ' done' : '')}>
      <input type="file" accept={accept} onChange={(e) => onFile(e.target.files[0])} />
      <strong>{label}</strong>
      <span>{file ? `${file} (${count} rows read)` : hint}</span>
    </label>
  );
}

export default function App() {
  const [bank, setBank] = useState(null);
  const [sys, setSys] = useState(null);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(true);

  async function load(kind, file) {
    if (!file) return;
    setError('');
    setBusy(`Reading ${file.name}…`);
    try {
      if (kind === 'bank') setBank(await parseBank(file));
      else setSys(await parseSystem(file));
      setNames((n) => ({ ...n, [kind]: file.name }));
    } catch (e) {
      console.error(e);
      setError(`Could not read ${file.name}. ${e.message}`);
    }
    setBusy('');
  }

  const result = useMemo(() => (bank && sys ? reconcile(bank, sys) : null), [bank, sys]);

  const scoped = useMemo(() => {
    if (!result) return [];
    return result.rows.filter((r) => !(scope && r.status === 'bank_only' && r.code && !result.scopeCodes.has(r.code)));
  }, [result, scope]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((r) => {
      if (tab === 'matched' && r.status !== 'matched') return false;
      if (tab === 'bank_only' && r.status !== 'bank_only' && r.status !== 'no_id') return false;
      if (tab === 'system_only' && r.status !== 'system_only') return false;
      if (tab === 'amount' && r.amountOk !== false) return false;
      if (tab === 'nohouse' && !(r.noHouse && r.status !== 'system_only')) return false;
      if (!q) return true;
      return [r.bankId, r.sysId, r.code, r.house, r.sheet, r.tenant, r.unit].join(' ').toLowerCase().includes(q);
    });
  }, [scoped, tab, query]);

  const count = (fn) => scoped.filter(fn).length;
  const hidden = result ? result.rows.length - scoped.length : 0;

  return (
    <main>
      <header>
        <h1>Bank statement reconciler</h1>
        <p>Upload the bank statement and the system report. Everything is read in your browser; no file leaves this computer.</p>
      </header>

      <section className="drops">
        <Drop label="1. Bank statement (PDF)" hint="Choose the Co-op statement" accept=".pdf" file={names.bank} count={bank?.length} onFile={(f) => load('bank', f)} />
        <Drop label="2. System report (Excel)" hint="Choose the property report" accept=".xlsx,.xls" file={names.sys} count={sys?.length} onFile={(f) => load('sys', f)} />
      </section>

      {busy && <p className="busy">{busy}</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <section className="stats">
            <div className="ok"><b>{count((r) => r.status === 'matched')}</b>Matched</div>
            <div className="bad"><b>{count((r) => r.status === 'bank_only' || r.status === 'no_id')}</b>In bank only</div>
            <div className="bad"><b>{count((r) => r.status === 'system_only')}</b>In system only</div>
            <div className="warn"><b>{count((r) => r.amountOk === false)}</b>Amount differs</div>
            <div className="warn"><b>{count((r) => r.noHouse && r.status !== 'system_only')}</b>No house number</div>
          </section>

          <section className="bar">
            <label className="check">
              <input type="checkbox" checked={scope} onChange={(e) => setScope(e.target.checked)} />
              Only compare properties found in the system report
              {hidden > 0 && scope && <em> ({hidden} bank payments from other properties hidden)</em>}
            </label>
            <button onClick={() => exportReport(scoped, result.props)}>Download Excel report</button>
          </section>

          <details>
            <summary>Results by property ({result.props.length} paybill codes in the bank statement)</summary>
            <div className="scroll">
              <table>
                <thead><tr><th>Paybill code</th><th>Bank payments</th><th>Matched</th><th>Unmatched</th><th>System sheet</th></tr></thead>
                <tbody>
                  {result.props.map((p) => (
                    <tr key={p.code} className={p.matched ? '' : 'dim'}>
                      <td>{p.code}</td><td>{p.bank}</td><td>{p.matched}</td><td>{p.unmatched}</td>
                      <td>{p.sheet || 'not in system report'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <nav className="tabs">
            {TABS.map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
            <input placeholder="Search ID, house, tenant…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </nav>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Bank ID</th><th>System ID</th><th></th><th>Bank amount</th><th>System amount</th>
                  <th>Paybill</th><th>House (bank)</th><th>System sheet</th><th>Tenant / unit</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, LIMIT).map((r, i) => (
                  <tr key={i} className={r.status}>
                    <td>{r.bankId}</td>
                    <td>{r.sysId}</td>
                    <td className="tick">{r.status === 'matched' ? (r.amountOk === false ? '⚠' : '✔') : '✘'}</td>
                    <td className="n">{money(r.bankAmount)}</td>
                    <td className="n">{money(r.sysAmount)}</td>
                    <td>{r.code}</td>
                    <td>{r.house || (r.status !== 'system_only' ? '—' : '')}</td>
                    <td>{r.sheet}</td>
                    <td>{[r.tenant, r.unit].filter(Boolean).join(' · ')}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > LIMIT && <p className="busy">Showing the first {LIMIT} of {shown.length} rows. The Excel download has all of them.</p>}
          {!shown.length && <p className="busy">No rows match this filter.</p>}
        </>
      )}
    </main>
  );
}
