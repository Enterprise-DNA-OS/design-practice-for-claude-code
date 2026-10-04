#!/usr/bin/env node
// npm test: a throwaway database, the schema, the demo practice, every command, then the real
// executables. Embedded PGlite by default; TEST_DATABASE_URL runs the same test on Postgres.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, commands, reads } from './lib/domain.mjs';

const tmp = mkdtempSync(path.join(tmpdir(), 'design-practice-test-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = tmp;

let db, assertions = 0;
const exercised = new Set();
const call = (c, a = [], o = {}) => { exercised.add(c); return run(db, c, a, o); };
const ok = (x, msg) => { assert.ok(x, msg); assertions++; };
const fails = async (c, a, pattern, o = {}) => { await assert.rejects(() => call(c, a, o), pattern); assertions++; };
const one = async (sql) => (await db.query(sql))[0];
const names = (rows, key = 'stage') => rows.map((r) => r[key]).join();

try {
  db = await getDb();
  if (process.env.TEST_DATABASE_URL) await db.exec('drop schema public cascade; create schema public;');
  ok((await migrate(db)).ran.length === 1, 'schema applies');
  await seed(db);
  await seed(db);
  ok((await migrate(db)).ran.length === 0, 'migrate is idempotent');
  ok((await call('projects')).length === 6, 'seed is idempotent');
  const entries = (await one('select count(*)::int as n from time_entries')).n;
  await seed(db);
  ok((await one('select count(*)::int as n from time_entries')).n === entries, 'generated time is not duplicated');

  // Every read runs, and the demo has something to say.
  for (const c of Object.keys(reads)) ok(Array.isArray(await call(c)), c);
  const today = (await one('select practice_today()::text as d')).d;
  ok(names(await call('fee-tracking')) === 'Feasibility,Developed design,Seismic assessment', 'fee burning ahead of progress');
  ok(names(await call('over-fee')) === 'Seismic assessment', 'capped stage over its cap');
  const wip = await call('wip');
  ok(wip[0].stage === 'Detailed design' && Number(wip[0].wip) === 19680, 'percent-of-contract WIP includes the approved variation');
  ok(Number(wip.find((r) => r.stage === 'Design and documentation').wip) === 13350, 'hourly WIP is unbilled time');
  ok(Number(wip.find((r) => r.stage === 'Seismic assessment').earned) === 12000, 'capped stage earns no more than its cap');
  const claims = await call('claims');
  ok(claims.find((r) => r.invoice === 'INV-1002').position.startsWith('no schedule'), 'payment claim past the response time');
  ok(claims.find((r) => r.invoice === 'INV-1005').position === 'schedule received');
  ok(names(await call('debtors'), 'invoice') === 'INV-1005,INV-1002', 'debtors oldest first');
  ok(names(await call('missing-timesheets'), 'name') === 'Lucy Chen', 'one missing timesheet');
  ok(names(await call('overbooked'), 'name') === 'Priya Nair,Sam Okafor', 'overbooked this week, and on leave next week');
  ok((await call('variations-waiting')).length === 2, 'one unapproved, one unsent variation');
  ok((await call('utilisation')).find((r) => r.name === 'Priya Nair').utilisation_pct > 80);
  ok((await call('unbilled-expenses')).length === 2, 'two rechargeable disbursements');
  ok((await call('attention')).length >= 15, 'attention list');
  const rules = (await call('compliance')).map((r) => r.rule);
  for (const r of ['TERMS-OF-APPOINTMENT', 'CLAIM-NO-SCHEDULE', 'CLAIM-FORM-1', 'REGISTRATION-CURRENT', 'PI-INSURANCE']) ok(rules.includes(r), r);
  const review = await call('weekly-review');
  ok(review['fee tracking'].length === 3 && review.debtors.length === 2, 'weekly review');

  // Lookups: number, partial, case-insensitive, ambiguous.
  ok((await call('project', ['road house'])).project.number === '2401', 'partial name');
  await fails('project', ['Nowhere'], /No projects/);
  ok((await call('project', ['2401'])).stages.length === 3);
  ok((await call('project', ['ridge'])).project.number === '2401');
  await fails('project', ['2'], /Ambiguous projects/);
  ok((await call('client', ['ellis'])).owing.length === 1);
  ok((await call('person', ['priya']))['next four weeks'].length === 4);
  await fails('person', ['Ghost'], /No staff/);

  // Time rules.
  await fails('log-time', ['Priya', '2401', 'Concept', today, '2'], /complete: new work there needs a variation/);
  const [over] = await call('log-time', ['Priya', '2401', 'Concept', today, '2'], { override: 'client asked for a revision' });
  ok(over.overridden.includes('variation'), 'override records the broken rule');
  await fails('log-time', ['Priya', '2401', 'Developed', '2099-01-01', '2'], /future/);
  await fails('log-time', ['Priya', '2401', 'Developed', today, '2.1'], /quarter hours/);
  await fails('log-time', ['Priya', '2401', 'Nonsense', today, '2'], /No stage/);
  await fails('log-time', ['Priya', '2401', 'design', today, '2'], /Ambiguous stage/);
  const [t] = await call('log-time', ['Sam', '2405', 'Seismic', today, '1.5', 'Mezzanine check']);
  ok(t.minutes === 90 && t.note.includes('fee'), 'time logged and the fee warning raised');
  ok((await call('time')).some((r) => r.note === 'Mezzanine check'));

  // Progress, variations.
  await fails('progress', ['2401', 'Developed', '20'], /already invoiced/);
  await fails('progress', ['2401', 'Developed', '120'], /0 to 100/);
  const [prog] = await call('progress', ['2401', 'Developed', '80']);
  ok(prog.percent_complete === 80);
  ok(!(await call('fee-tracking')).some((r) => r.stage === 'Developed design'), 'progress catches up with the fee');
  await fails('approve-variation', ['V-2405-01', today, 'Craig'], /Submit it/);
  await call('submit-variation', ['V-2405-01']);
  await fails('submit-variation', ['V-2405-01'], /not draft/);
  await fails('approve-variation', ['V-2405-01', today], /who approved/);
  await call('approve-variation', ['V-2405-01', today, 'Craig Bell']);
  ok(Number((await one("select total_fee from stage_position where stage = 'Seismic assessment'")).total_fee) === 14500, 'approved variation adds to the stage fee');
  const [v] = await call('variation', ['2401', 'Developed', '1800', 'Redesign the deck stairs']);
  ok(v.name === 'V-2401-02' && v.status === 'draft');
  await call('submit-variation', ['V-2401-02', today]);
  await call('decline-variation', ['V-2401-02', today]);
  await fails('variation', ['2401', 'Developed', '-5', 'Bad'], /positive fee/);
  ok(readFileSync((await call('draft-variation', ['V-2401-01']))[0].file, 'utf8').includes('$4,500.00'));

  // Invoicing: raise, issue, payment claims, schedules, payments.
  await fails('expense', ['2401', 'Developed', today, '40'], /what it was/);
  await call('expense', ['2401', 'Developed', today, '40', 'Courier', 'to', 'council']);
  await call('expense', ['2401', 'Developed', today, '25', 'Coffee'], { notRechargeable: true });
  const [inv] = await call('invoice', ['2401']);
  ok(inv.name === 'INV-1007' && Number(inv.net) === 13525 && inv.status === 'draft', 'invoice raised from progress plus disbursements');
  ok((await call('wip')).every((r) => r.number !== '2401'), 'nothing left to invoice on 2401');
  ok((await call('invoice', ['2401']))[0].raised === 0, 'never invoiced twice');
  await fails('issue', ['INV-1007'], /residential occupier/, { claim: true });
  const [iss] = await call('issue', ['INV-1007'], { claim: true, form1: true });
  ok(iss.payment_claim === true);
  await fails('issue', ['INV-1007'], /not draft/);
  await fails('payment', ['INV-1002', '7000', 'BANK-1'], /exceeds/);
  await fails('payment', ['INV-1002', '0', 'BANK-1'], /positive/);
  await call('payment', ['INV-1002', '6900', 'ELLIS-1002']);
  await fails('payment', ['INV-1003', '1', 'ELLIS-1002'], /exceeds|unique|duplicate/);
  ok(!(await call('compliance')).some((r) => r.rule === 'CLAIM-NO-SCHEDULE'), 'paid claim clears');
  await fails('schedule', ['INV-1006', today, '100'], /not issued as a payment claim/);
  const [sch] = await call('schedule', ['INV-1007', today, '10000']);
  ok(sch.note.includes('less than claimed'));
  ok(readFileSync((await call('draft-reminder', ['INV-1005']))[0].file, 'utf8').includes('$13,000.00'));
  await fails('draft-reminder', ['INV-1001'], /nothing owing/);

  // Resourcing, terms, client notes, records.
  const monday = (await one("select (date_trunc('week', practice_today()) + interval '14 days')::date::text as d")).d;
  await fails('allocate', ['Tom', '2402', 'Design', '2026-10-06', '8'], /Monday/);
  const [al] = await call('allocate', ['Tom', '2402', 'Design', monday, '45']);
  ok(al.note.includes('planned 45'), 'over-allocation flagged');
  await call('allocate', ['Tom', '2402', 'Design', monday, '30']);
  ok(Number((await one(`select hours from allocations a join staff s on s.id = a.staff_id where s.name = 'Tom Hughes' and week_of = '${monday}'`)).hours) === 30, 'allocation replaced, not doubled');
  ok(readFileSync((await call('draft-terms', ['2404']))[0].file, 'utf8').includes('Instruction to proceed'));
  await call('sign-terms', ['2404', today]);
  ok(!(await call('compliance')).some((r) => r.rule === 'TERMS-OF-APPOINTMENT'), 'signed terms clear the rule');
  ok((await call('project', ['2404'])).project.status === 'active');
  await call('log', ['Miramar', 'Terms signed. Survey booked for next week.']);
  ok((await call('activity'))[0].note.includes('Survey booked'));
  await fails('log', ['Miramar'], /note/);
  await call('add', ['staff', '{"name":"Ari Ngata","role":"Graduate","charge_rate":130,"cost_rate":48}']);
  await call('set', ['staff', 'Tom', `{"registration_expires_on":"${(await one("select (practice_today() + 365)::text as d")).d}"}`]);
  ok(!(await call('compliance')).some((r) => r.rule === 'REGISTRATION-CURRENT'), 'renewed registration clears');
  await call('add', ['leave', `{"name":"Ari leave","staff_id":"Ari","starts_on":"${monday}","ends_on":"${monday}"}`]);
  await fails('add', ['staff', '{"name":"X","salary":1}'], /not writable/);
  await fails('add', ['stages', '{"project_id":"2402","name":"Bad","fee_type":"barter"}'], /check/);
  await fails('set', ['stages', 'Preliminary design', '{"fee":1000}'], /already invoiced/);
  await fails('add', ['invoices', '{}'], /Writable types/);
  await call('set', ['practice_profile', 'Kowhai', '{"jurisdiction":"AU","claim_response_days":10}']);
  ok(!(await call('compliance')).some((r) => r.rule === 'TERMS-OF-APPOINTMENT' || r.rule === 'CLAIM-FORM-1'), 'NZ rules off for an Australian practice');
  await call('set', ['practice_profile', 'Kowhai', '{"jurisdiction":"NZ","claim_response_days":20}']);

  // Synergy imports.
  const breakdown = path.join(REPO_ROOT, 'fixtures', 'synergy-project-breakdown.csv');
  const sheets = path.join(REPO_ROOT, 'fixtures', 'synergy-timesheets.csv');
  await fails('import', ['synergy', breakdown], /date-order/);
  await call('import', ['synergy', breakdown], { dryRun: true, dateOrder: 'DMY' });
  ok((await call('projects')).length === 6, 'dry run writes nothing');
  const [first] = await call('import', ['synergy', breakdown], { dateOrder: 'DMY' });
  ok(first.projects_new === 3 && first.inserted === 4 && first.updated === 1 && first.opening_invoiced === 3, 'breakdown imported, existing stage matched');
  ok(first.managers_not_found === 'Pat Unknown');
  const [again] = await call('import', ['synergy', breakdown], { dateOrder: 'DMY' });
  ok(again.inserted === 0 && again.updated === 5 && again.opening_invoiced === 0, 'import is repeatable');
  const tawa = await one("select fee, fee_type from stages where name = 'Preliminary design' and project_id = (select id from projects where number = '2503')");
  ok(Number(tawa.fee) === 54000 && tawa.fee_type === 'percent', 'percent stage fee from contract value');
  const dd = await one("select earned, invoiced, wip from stage_position where number = '2501' and stage = 'Developed design'");
  ok(Number(dd.earned) === 5600 && Number(dd.invoiced) === 3500 && Number(dd.wip) === 2100, 'opening invoiced value sets WIP');
  const [ts] = await call('import', ['synergy', sheets], { timesheets: true, dateOrder: 'DMY' });
  ok(ts.inserted === 5 && ts.staff_added === 'Jordan Reid', 'timesheets imported, duplicate rows both kept');
  const [ts2] = await call('import', ['synergy', sheets], { timesheets: true, dateOrder: 'DMY' });
  ok(ts2.inserted === 0 && ts2.already_there === 5, 'timesheet import is repeatable');
  const bad = path.join(tmp, 'bad.csv');
  writeFileSync(bad, 'Project Number,Stage Name,Fee Type\n2601,Concept,Barter\n');
  await fails('import', ['synergy', bad], /fee type/);
  writeFileSync(bad, 'Project Number,Project Name,Stage Name,Fee Type,Stage Fee,Invoiced Value\n2602,New,Concept,Fixed Fee,1000,500\n2602,New,Concept,Fixed Fee,1000,500\n');
  await fails('import', ['synergy', bad], /duplicate stage/);
  writeFileSync(bad, 'Project Number,Project Name,Stage Name,Fee Type,Stage Fee,Invoiced Value\n2603,New,Concept,Fixed Fee,1000,1500\n');
  await fails('import', ['synergy', bad], /more than the stage fee/);
  writeFileSync(bad, 'Staff,Project,Stage,Date,Hours\nMere Tawhiri,2401,Concept design,2025-09-01,2\nMere Tawhiri,9999,Concept,2025-09-01,2\n');
  await fails('import', ['synergy', bad], /Row 3: project "9999"/, { timesheets: true });
  ok((await one("select count(*)::int as n from time_entries where worked_on = '2025-09-01'")).n === 0, 'bad timesheet file rolled back');
  await fails('import', ['monograph', bad], /import synergy/);

  const backup = path.join(tmp, 'backup.json');
  await call('export', [backup]);
  const saved = JSON.parse(readFileSync(backup, 'utf8'));
  ok(saved.projects.length === 9 && saved.time_entries.length > 300 && saved.audit.length > 10, 'export holds everything');
  ok((await call('help')).length === commands.length);
  await fails('nonsense', [], /Unknown command/);
  ok((await call('audit')).length > 10);
  await db.close();
  db = null;

  // The real executables, after releasing the embedded database.
  const child = (file, args = [], status = 0) => {
    const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', file), ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    assert.equal(p.status, status, p.stderr || p.stdout);
    assertions++;
    return p;
  };
  ok(JSON.parse(child('practice.mjs', ['projects', '--json']).stdout).length === 9);
  ok(child('practice.mjs', ['wip']).stdout.includes('earned'));
  ok(child('practice.mjs', ['project', '2'], 1).stderr.includes('Ambiguous'));
  child('view.mjs');
  child('docs.mjs');
  ok(readFileSync(path.join(tmp, 'views', 'week.html'), 'utf8').includes('Kowhai Studio Architects'), 'view rendered in the practice brand');
  ok(readdirSync(path.join(tmp, 'docs-out', 'fee-report')).length >= 5, 'fee reports rendered');
  ok(readdirSync(path.join(tmp, 'docs-out', 'payment-claim')).length === 7, 'invoices rendered, opening balances left out');
  ok(existsSync(path.join(tmp, 'docs-out', 'variation')), 'variations rendered');

  const missing = commands.filter((c) => !exercised.has(c));
  ok(!missing.length, 'every command exercised: missing ' + missing.join(', '));
  console.log(`PASS: ${commands.length} commands, ${assertions} assertions on ${process.env.TEST_DATABASE_URL ? 'Postgres' : 'embedded PGlite'}. Fee tracking, WIP by fee type, variations, invoicing and payment claims, time rules and overrides, resourcing, compliance, Synergy imports with rollback, drafts, views and documents. Temporary database removed.`);
} finally {
  await db?.close();
  rmSync(tmp, { recursive: true, force: true });
}
