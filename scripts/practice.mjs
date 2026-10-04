#!/usr/bin/env node
// The one CLI. Human tables by default, --json for machines.
//   node scripts/practice.mjs help
//   node scripts/practice.mjs fee-tracking
//   node scripts/practice.mjs log-time "Priya" 2401 "Developed design" 2026-10-05 6.5 "Window details"
import { getDb } from './lib/db.mjs';
import { run } from './lib/domain.mjs';
import { table } from './lib/format.mjs';

const opts = {}, args = [];
for (const a of process.argv.slice(2)) {
  if (a === '--json') opts.json = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--timesheets') opts.timesheets = true;
  else if (a === '--claim') opts.claim = true;
  else if (a === '--form1') opts.form1 = true;
  else if (a === '--not-rechargeable') opts.notRechargeable = true;
  else if (a.startsWith('--date-order=')) opts.dateOrder = a.slice(13).toUpperCase();
  else if (a.startsWith('--override=')) opts.override = a.slice(11).replace(/^"(.*)"$/, '$1');
  else if (a.startsWith('--')) { console.error('Unknown option ' + a); process.exit(1); }
  else args.push(a);
}

const cell = (v) => (v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
function show(value) {
  if (Array.isArray(value)) {
    if (!value.length) return console.log('  (nothing)');
    const rows = value.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])));
    console.log(table(rows, Object.keys(rows[0]).map((key) => ({ key, label: key, width: 50 }))));
  } else for (const [k, v] of Object.entries(value)) { console.log('\n' + k); show(Array.isArray(v) ? v : v ? [v] : []); }
}

let db;
try {
  db = await getDb();
  const result = await run(db, args.shift() || 'help', args, opts);
  opts.json ? console.log(JSON.stringify(result, null, 2)) : show(result);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
