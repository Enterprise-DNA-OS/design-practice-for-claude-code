// Synergy imports: the project breakdown (projects, phases, stages, fee types, fees, percent
// complete and invoiced to date) and the timesheet report. Synergy exports reports to Excel; save
// the sheet as CSV. Headers vary with the columns a practice shows, so every field accepts the
// usual names. One transaction per file: a bad row rolls the whole file back.
import { readFileSync } from 'node:fs';
import { parseCsv, pick } from './csv.mjs';

const FEE_TYPES = { 'fixed fee': 'fixed', fixed: 'fixed', 'lump sum': 'fixed', 'hourly rates': 'hourly', hourly: 'hourly', 'time and materials': 'hourly', 'capped rates': 'capped', capped: 'capped', 'percent of project': 'percent', 'percent of contract': 'percent', percentage: 'percent', 'no billing': 'none', 'non billable': 'none' };
const STAGE_STATUS = { proposal: 'proposal', 'in progress': 'active', active: 'active', open: 'active', current: 'active', complete: 'complete', completed: 'complete', closed: 'complete', 'on hold': 'on_hold', hold: 'on_hold' };

function isoDate(s, order, where) {
  if (!s) return null;
  const v = s.trim().split(/[ T]/)[0];
  let iso = v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m || !['DMY', 'MDY'].includes(order)) throw Error(`${where}: date "${s}" needs --date-order=DMY or MDY (or ISO dates)`);
    const [d, mo] = order === 'DMY' ? [m[1], m[2]] : [m[2], m[1]];
    iso = `${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) throw Error(`${where}: invalid date "${s}"`);
  return iso;
}
function num(s, where, what, { max } = {}) {
  const v = String(s || '').replace(/[$,%\s]/g, '');
  if (!v) return null;
  if (!/^\d+(\.\d+)?$/.test(v) || (max !== undefined && Number(v) > max)) throw Error(`${where}: ${what} "${s}" is not a valid number`);
  return Number(v);
}
function rows(file) {
  const raw = parseCsv(readFileSync(file, 'utf8'));
  if (!raw.length) throw Error('No rows found in ' + file);
  return raw;
}

export async function importProjects(db, file, opts = {}) {
  const seen = new Set();
  const parsed = rows(file).map((r, i) => {
    const where = `Row ${i + 2}`;
    const get = (...k) => pick(r, ...k).trim();
    if (get('Skip', 'Import').toLowerCase() === 'skip') return null;
    const number = get('Project Number', 'Project No', 'Job Number', 'Project Code');
    const projectName = get('Project Name', 'Project');
    const stage = get('Stage Name', 'Stage');
    if (!number || !stage) throw Error(`${where}: Project Number and Stage Name are required. See docs/replace-synergy.md`);
    const key = `${number}|${stage.toLowerCase()}`;
    if (seen.has(key)) throw Error(`${where}: duplicate stage ${stage} on ${number}`);
    seen.add(key);
    const typeRaw = get('Fee Type', 'Billing Type').toLowerCase();
    const feeType = typeRaw ? FEE_TYPES[typeRaw] : 'fixed';
    if (!feeType) throw Error(`${where}: fee type "${typeRaw}" is not one of ${Object.keys(FEE_TYPES).join(', ')}`);
    const statusRaw = get('Stage Status', 'Status').toLowerCase();
    const status = statusRaw ? STAGE_STATUS[statusRaw] : 'active';
    if (!status) throw Error(`${where}: stage status "${statusRaw}" is not recognised`);
    const contractValue = num(get('Contract Value'), where, 'contract value');
    const contractPct = num(get('Contract %', 'Contract Percent'), where, 'contract %', { max: 100 });
    let fee = num(get('Stage Fee', 'Fee', 'Fee Value'), where, 'stage fee');
    if (feeType === 'percent' && fee === null && contractValue !== null && contractPct !== null) fee = Math.round(contractValue * contractPct) / 100;
    return {
      number, projectName: projectName || number, stage, feeType, status, contractValue, contractPct,
      fee: fee ?? 0,
      budget: num(get('Budget'), where, 'budget'),
      invoiced: num(get('Invoiced Value', 'Invoiced', 'Invoiced to Date'), where, 'invoiced value'),
      complete: Math.round(num(get('Stage Complete %', 'Percent Complete', '% Complete', 'Complete %'), where, 'stage complete %', { max: 100 }) ?? (status === 'complete' ? 100 : 0)),
      phase: get('Phase Name', 'Phase') || null,
      client: get('Client', 'Client Name', 'Invoice Contact') || null,
      manager: get('Stage Manager', 'Project Manager', 'Manager') || null,
      start: isoDate(get('Stage Start Date', 'Start Date'), opts.dateOrder, where),
      due: isoDate(get('Stage End Date', 'End Date', 'Due Date'), opts.dateOrder, where),
      raw: r,
    };
  }).filter(Boolean);
  for (const r of parsed) {
    if (r.invoiced !== null && r.fee > 0 && ['fixed', 'percent', 'capped'].includes(r.feeType) && r.invoiced > r.fee) throw Error(`${r.number} ${r.stage}: invoiced value ${r.invoiced} is more than the stage fee ${r.fee}`);
  }

  await db.exec('BEGIN');
  let projects = 0, inserted = 0, updated = 0, opening = 0;
  const managersNotFound = new Set();
  try {
    const [{ tax }] = await db.query('select coalesce((select tax_rate from practice_profile limit 1), 15) as tax');
    const sort = {};
    for (const r of parsed) {
      let clientId = null;
      if (r.client) [{ id: clientId }] = await db.query('insert into clients (name) values ($1) on conflict (name) do update set name = excluded.name returning id', [r.client]);
      let managerId = null;
      if (r.manager) {
        const m = await db.query('select id from staff where lower(name) = lower($1)', [r.manager]);
        if (m.length) managerId = m[0].id; else managersNotFound.add(r.manager);
      }
      const [before] = await db.query('select id from projects where number = $1', [r.number]);
      const [p] = await db.query(`insert into projects (number, name, client_id, contract_value, status, source_data) values ($1, $2, $3, $4, 'active', '{"source":"synergy"}')
        on conflict (number) do update set name = excluded.name, client_id = coalesce(excluded.client_id, projects.client_id), contract_value = coalesce(excluded.contract_value, projects.contract_value) returning id`, [r.number, r.projectName, clientId, r.contractValue]);
      if (!before && !sort[r.number]) projects++;
      sort[r.number] = (sort[r.number] || 0) + 1;
      const [had] = await db.query('select id from stages where project_id = $1 and lower(name) = lower($2)', [p.id, r.stage]);
      had ? updated++ : inserted++;
      const [s] = await db.query(`insert into stages (project_id, name, phase, sort, fee_type, fee, contract_pct, budget, percent_complete, status, manager_id, start_on, due_on, source_data)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (project_id, name) do update set phase = excluded.phase, fee_type = excluded.fee_type, fee = excluded.fee, contract_pct = excluded.contract_pct, budget = excluded.budget,
          percent_complete = excluded.percent_complete, status = excluded.status, manager_id = coalesce(excluded.manager_id, stages.manager_id), start_on = excluded.start_on, due_on = excluded.due_on, source_data = excluded.source_data
        returning id`,
      [p.id, had ? (await db.query('select name from stages where id = $1', [had.id]))[0].name : r.stage, r.phase, sort[r.number], r.feeType, r.fee, r.contractPct, r.budget, r.complete, r.status, managerId, r.start, r.due, JSON.stringify(r.raw)]);
      // What Synergy already invoiced comes across once, as a paid opening-balance invoice, so the
      // stage's work in progress starts from the right place.
      if (r.invoiced) {
        const name = `OB-${r.number}-${s.id.slice(0, 8).toUpperCase()}`;
        const [exists] = await db.query('select id from invoices where name = $1', [name]);
        if (!exists) {
          const [inv] = await db.query("insert into invoices (name, project_id, status, issued_on, due_on, tax_rate, opening_balance) values ($1, $2, 'issued', practice_today(), practice_today(), 0, true) returning id", [name, p.id]);
          await db.query("insert into invoice_lines (name, invoice_id, stage_id, kind, amount) values ($1, $2, $3, $4, $5)", [`${r.stage}: invoiced in Synergy`, inv.id, s.id, r.feeType === 'hourly' || r.feeType === 'capped' ? 'time' : 'fee', r.invoiced]);
          await db.query("insert into payments (name, invoice_id, amount, paid_on, reference) values ($1, $2, $3, practice_today(), $4)", ['Opening balance ' + name, inv.id, r.invoiced, 'OPENING-' + name]);
          opening++;
        }
      }
    }
    if (opts.dryRun) await db.exec('ROLLBACK'); else await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return [{ file, dry_run: !!opts.dryRun, projects_new: projects, inserted, updated, opening_invoiced: opening, managers_not_found: [...managersNotFound].join(', ') || null }];
}

export async function importTimesheets(db, file, opts = {}) {
  const count = {};
  const parsed = rows(file).map((r, i) => {
    const where = `Row ${i + 2}`;
    const get = (...k) => pick(r, ...k).trim();
    const staff = get('Staff', 'Staff Name', 'Employee', 'Staff Member');
    const project = get('Project Number', 'Project No', 'Project');
    const stage = get('Stage', 'Stage Name');
    const on = isoDate(get('Date', 'Transaction Date', 'Work Date'), opts.dateOrder, where);
    const hours = num(get('Hours', 'Quantity', 'Time'), where, 'hours', { max: 24 });
    if (!staff || !project || !stage || !on || !hours) throw Error(`${where}: Staff, Project, Stage, Date and Hours are required. See docs/replace-synergy.md`);
    const note = get('Description', 'Notes', 'Task', 'Comment') || null;
    const base = `synergy:${staff.toLowerCase()}|${project.toLowerCase()}|${stage.toLowerCase()}|${on}|${hours}|${note || ''}`;
    count[base] = (count[base] || 0) + 1;
    return { where, staff, project, stage, on, hours, note, external: `${base}|${count[base]}`, rate: num(get('Charge Rate', 'Rate'), where, 'charge rate') };
  });

  await db.exec('BEGIN');
  let inserted = 0, skipped = 0;
  const staffAdded = new Set();
  try {
    for (const r of parsed) {
      let [s] = await db.query('select * from staff where lower(name) = lower($1)', [r.staff]);
      if (!s) { [s] = await db.query('insert into staff (name, charge_rate) values ($1, $2) returning *', [r.staff, r.rate || 0]); staffAdded.add(r.staff); }
      const proj = await db.query('select id from projects where number = $1 or lower(name) = lower($1)', [r.project]);
      if (proj.length !== 1) throw Error(`${r.where}: project "${r.project}" ${proj.length ? 'is ambiguous' : 'is not here yet. Import the project breakdown first'}`);
      const [st] = await db.query('select id from stages where project_id = $1 and lower(name) = lower($2)', [proj[0].id, r.stage]);
      if (!st) throw Error(`${r.where}: stage "${r.stage}" is not on project ${r.project}`);
      const res = await db.query(`insert into time_entries (name, staff_id, stage_id, worked_on, minutes, charge_rate, cost_rate, note, external_id)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (external_id) do nothing returning id`,
      [`${s.name}, ${r.stage}`, s.id, st.id, r.on, Math.round(r.hours * 60), r.rate ?? s.charge_rate, s.cost_rate, r.note, r.external]);
      res.length ? inserted++ : skipped++;
    }
    if (opts.dryRun) await db.exec('ROLLBACK'); else await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return [{ file, dry_run: !!opts.dryRun, inserted, already_there: skipped, staff_added: [...staffAdded].join(', ') || null }];
}
