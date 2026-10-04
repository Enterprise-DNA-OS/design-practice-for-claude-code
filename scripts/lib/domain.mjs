// Every command the CLI and the slash commands run. Reads are plain SQL; writes run in a
// transaction, enforce the practice's fee rules and leave an audit row.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { REPO_ROOT } from './db.mjs';
import { importProjects, importTimesheets } from './import.mjs';

// Fields `add` and `set` may write, per record type.
export const fields = {
  staff: ['name', 'email', 'role', 'discipline', 'charge_rate', 'cost_rate', 'weekly_hours', 'registration', 'registration_expires_on', 'active'],
  clients: ['name', 'contact', 'email', 'phone', 'address', 'residential', 'last_contact_on'],
  projects: ['number', 'name', 'client_id', 'manager_id', 'status', 'contract_value', 'terms_sent_on'],
  stages: ['project_id', 'name', 'phase', 'sort', 'fee_type', 'fee', 'contract_pct', 'budget', 'status', 'manager_id', 'start_on', 'due_on'],
  leave: ['name', 'staff_id', 'starts_on', 'ends_on'],
  practice_profile: ['name', 'jurisdiction', 'currency', 'timezone', 'tax_rate', 'payment_terms_days', 'claim_response_days', 'registered_architects', 'utilisation_target', 'burn_tolerance', 'pi_insurer', 'pi_expires_on'],
};
const LOOKUP = { client_id: 'clients', manager_id: 'staff', staff_id: 'staff', project_id: 'projects' };
const RESOLVABLE = [...Object.keys(fields), 'variations', 'invoices'];

const FIXED_FEE = "('fixed', 'percent', 'capped')";

export const reads = {
  profile: 'select name, jurisdiction, currency, tax_rate, payment_terms_days, claim_response_days, registered_architects, utilisation_target, burn_tolerance, pi_insurer, pi_expires_on from practice_profile',
  staff: 'select name, role, discipline, charge_rate, cost_rate, weekly_hours, registration, registration_expires_on, active from staff order by active desc, name',
  clients: 'select name, contact, email, phone, residential, last_contact_on from clients order by name',
  projects: 'select number, name, client, manager, status, fee, earned, invoiced, wip, margin_to_date from project_position order by number',
  stages: 'select number, project, stage, fee_type, total_fee, percent_complete as complete, fee_used_pct as fee_used, earned, invoiced, wip, status from stage_position order by number, sort, stage',
  'fee-tracking': `select number, project, stage, fee_type, percent_complete as complete, fee_used_pct as fee_used,
      fee_used_pct - percent_complete as gap, total_fee, time_value, fee_left
    from stage_position sp cross join practice_profile p
    where sp.status = 'active' and sp.fee_type in ${FIXED_FEE} and sp.total_fee > 0
      and sp.fee_used_pct > sp.percent_complete + p.burn_tolerance
    order by gap desc`,
  'over-fee': `select number, project, stage, fee_type, total_fee, time_value, round(time_value - total_fee, 2) as over_by, percent_complete as complete
    from stage_position where fee_type in ${FIXED_FEE} and total_fee > 0 and time_value > total_fee order by over_by desc`,
  wip: "select number, project, stage, fee_type, earned, invoiced, wip, last_time from stage_position where wip > 0 order by wip desc",
  'unbilled-expenses': `select p.number, p.name as project, e.name as expense, e.incurred_on, e.amount
    from expenses e join stages s on s.id = e.stage_id join projects p on p.id = s.project_id
    where e.rechargeable and e.invoice_id is null order by e.incurred_on`,
  debtors: `select name as invoice, number, client, issued_on, due_on, total, balance, practice_today() - due_on as days_overdue,
      case when practice_today() - due_on > 60 then '60+' when practice_today() - due_on > 30 then '31-60' else '1-30' end as aged
    from invoice_balances where status = 'issued' and balance > 0 and due_on < practice_today() order by due_on`,
  claims: `select b.name as invoice, b.client, b.issued_on, b.total, b.balance, working_days(b.issued_on, practice_today()) as working_days,
      p.claim_response_days as response_days, b.schedule_on, b.scheduled_amount,
      case when b.schedule_on is not null then 'schedule received'
           when working_days(b.issued_on, practice_today()) > p.claim_response_days then 'no schedule: full amount payable'
           else 'waiting' end as position
    from invoice_balances b cross join practice_profile p
    where b.payment_claim and b.status = 'issued' and b.balance > 0 order by b.issued_on`,
  variations: `select v.name, p.number, p.name as project, s.name as stage, v.description, v.fee, v.status, v.submitted_on,
      case when v.status = 'submitted' then practice_today() - v.submitted_on end as days_waiting, v.approved_by
    from variations v join projects p on p.id = v.project_id join stages s on s.id = v.stage_id order by p.number, v.name`,
  'variations-waiting': `select v.name, p.number, p.name as project, v.description, v.fee, v.status,
      coalesce(practice_today() - v.submitted_on, practice_today() - v.created_at::date) as days
    from variations v join projects p on p.id = v.project_id
    where (v.status = 'submitted' and v.submitted_on < practice_today() - 14) or v.status = 'draft' order by days desc`,
  timesheets: `with w as (select (date_trunc('week', practice_today()) - interval '7 days')::date as a)
    select s.name, round(s.weekly_hours - leave_hours(s.id, w.a, w.a + 4), 1) as expected,
      round(coalesce(sum(t.minutes), 0) / 60.0, 1) as logged
    from staff s cross join w
    left join time_entries t on t.staff_id = s.id and t.worked_on between w.a and w.a + 6
    where s.active group by s.id, s.name, s.weekly_hours, w.a order by s.name`,
  'missing-timesheets': `with w as (select (date_trunc('week', practice_today()) - interval '7 days')::date as a),
    x as (select s.name, round(s.weekly_hours - leave_hours(s.id, w.a, w.a + 4), 1) as expected,
      round(coalesce(sum(t.minutes), 0) / 60.0, 1) as logged, w.a as week_of
    from staff s cross join w
    left join time_entries t on t.staff_id = s.id and t.worked_on between w.a and w.a + 6
    where s.active group by s.id, s.name, s.weekly_hours, w.a)
    select name, week_of, expected, logged, round(expected - logged, 1) as short_by from x where logged < expected * 0.9 order by short_by desc`,
  utilisation: 'select u.name, u.role, u.billable_hours, u.other_hours, u.available_hours, u.utilisation_pct, p.utilisation_target as target from staff_utilisation u cross join practice_profile p order by u.utilisation_pct desc nulls last',
  capacity: 'select name, week_of, available, planned, over_by from capacity order by week_of, name',
  overbooked: 'select name, week_of, available, planned, over_by from capacity where over_by > 0 order by week_of, over_by desc',
  invoices: 'select name, number, client, status, issued_on, due_on, net, total, paid, balance, payment_claim from invoice_balances order by name',
  payments: 'select pm.name, i.name as invoice, pm.amount, pm.paid_on, pm.reference from payments pm join invoices i on i.id = pm.invoice_id order by pm.paid_on',
  time: `select t.worked_on, s.name as person, p.number, st.name as stage, round(t.minutes / 60.0, 2) as hours, t.note
    from time_entries t join staff s on s.id = t.staff_id join stages st on st.id = t.stage_id join projects p on p.id = st.project_id
    where t.worked_on >= practice_today() - 7 order by t.worked_on desc, s.name`,
  expenses: `select e.name, p.number, s.name as stage, e.incurred_on, e.amount, e.rechargeable, i.name as invoice
    from expenses e join stages s on s.id = e.stage_id join projects p on p.id = s.project_id left join invoices i on i.id = e.invoice_id order by e.incurred_on`,
  registrations: "select name, role, registration, registration_expires_on, registration_expires_on - practice_today() as days_left from staff where active and registration is not null order by registration_expires_on nulls first",
  proposals: `select p.number, p.name, c.name as client, p.terms_sent_on, practice_today() - p.terms_sent_on as days_since_sent, pp.fee, pp.time_value as time_spent
    from projects p left join clients c on c.id = p.client_id join project_position pp on pp.id = p.id where p.status = 'proposal' order by p.terms_sent_on nulls first`,
  activity: 'select c.name as client, a.happened_on, a.note from activity a join clients c on c.id = a.client_id order by a.happened_on desc, a.created_at desc',
  audit: 'select name, record_id, detail, created_at from audit order by created_at desc',
};

const ACTIONS = ['project', 'client', 'person', 'attention', 'compliance', 'weekly-review', 'log-time', 'expense', 'progress', 'variation', 'submit-variation', 'approve-variation', 'decline-variation', 'invoice', 'issue', 'schedule', 'payment', 'allocate', 'sign-terms', 'log', 'add', 'set', 'draft-reminder', 'draft-variation', 'draft-terms', 'import', 'export', 'help'];
export const commands = [...Object.keys(reads), ...ACTIONS];

// ------------------------------------------------------------------ helpers

export async function resolve(db, type, q) {
  if (!q) throw Error(`Supply a ${type} name or ID`);
  if (!RESOLVABLE.includes(type)) throw Error(`Unknown record type ${type}`);
  const byNumber = type === 'projects' ? ' or number ilike $1' : '';
  const params = [q + '%', '%' + q + '%'];
  const rows = await db.query(`select * from ${type} where id::text ilike $1 or name ilike $2${byNumber} order by name`, params);
  const exact = rows.filter((r) => r.name.toLowerCase() === q.toLowerCase() || r.id === q || (type === 'projects' && r.number === q));
  if (exact.length === 1) return exact[0];
  if (rows.length !== 1) throw Error(rows.length ? `Ambiguous ${type}, pick one:\n${rows.map((r) => r.id + '  ' + (r.number ? r.number + ' ' : '') + r.name).join('\n')}` : `No ${type} matched "${q}"`);
  return rows[0];
}
async function resolveStage(db, project, q) {
  if (!q) throw Error(`Supply a stage of ${project.number} ${project.name}`);
  const rows = await db.query('select * from stages where project_id = $1 and (id::text ilike $2 or name ilike $3) order by sort, name', [project.id, q + '%', '%' + q + '%']);
  const exact = rows.filter((r) => r.name.toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length !== 1) throw Error(rows.length ? `Ambiguous stage, pick one:\n${rows.map((r) => r.id + '  ' + r.name).join('\n')}` : `No stage of ${project.number} matched "${q}"`);
  return rows[0];
}
export async function transaction(db, fn) {
  await db.exec('BEGIN');
  try { const out = await fn(); await db.exec('COMMIT'); return out; } catch (e) { await db.exec('ROLLBACK'); throw e; }
}
async function audit(db, name, recordId, detail) {
  await db.query('insert into audit (name, record_id, detail) values ($1, $2, $3)', [name, recordId, JSON.stringify(detail)]);
}
function date(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '') || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error(`Use a valid YYYY-MM-DD date, not "${s}"`);
  return s;
}
function amount(s, what = 'amount') {
  if (!/^\d+(\.\d{1,2})?$/.test(String(s)) || Number(s) <= 0) throw Error(`Use a positive ${what} with at most two decimals`);
  return String(s);
}
async function profile(db) {
  const [p] = await db.query('select * from practice_profile');
  if (!p) throw Error('No practice profile. Add one: add practice_profile {"name":"Your Practice"}');
  return p;
}
async function today(db) { return (await db.query('select practice_today()::text as d'))[0].d; }
function draftFile(kind, id, body) {
  const dir = path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}-${String(id).slice(0, 8)}-${randomUUID().slice(0, 8)}.md`);
  writeFileSync(file, body + '\n');
  return [{ file }];
}
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
const dollars = (v) => '$' + Number(v || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FEE_WORDS = { fixed: 'fixed fee', hourly: 'hourly rates', capped: 'hourly rates up to a cap', percent: 'percentage of the contract value', none: 'not billed' };

// ------------------------------------------------------------------ run

export async function run(db, cmd, args = [], opts = {}) {
  if (cmd === 'help') return commands.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'project') {
    const p = await resolve(db, 'projects', args[0]);
    return {
      project: (await db.query('select number, name, client, manager, status, fee, earned, invoiced, wip, time_cost, margin_to_date from project_position where id = $1', [p.id]))[0],
      stages: await db.query('select stage, fee_type, total_fee, percent_complete as complete, fee_used_pct as fee_used, earned, invoiced, wip, status, due_on from stage_position where project_id = $1 order by sort, stage', [p.id]),
      variations: await db.query('select name, description, fee, status, submitted_on from variations where project_id = $1 order by name', [p.id]),
      invoices: await db.query('select name, status, issued_on, due_on, total, balance from invoice_balances where project_id = $1 order by name', [p.id]),
    };
  }
  if (cmd === 'client') {
    const c = await resolve(db, 'clients', args[0]);
    return {
      client: c,
      projects: await db.query('select number, name, status, fee, invoiced, wip from project_position where client = $1 order by number', [c.name]),
      owing: await db.query("select name, due_on, balance from invoice_balances where client = $1 and status = 'issued' and balance > 0 order by due_on", [c.name]),
      activity: await db.query('select happened_on, note from activity where client_id = $1 order by happened_on desc', [c.id]),
    };
  }
  if (cmd === 'person') {
    const s = await resolve(db, 'staff', args[0]);
    return {
      person: (await db.query('select name, role, charge_rate, weekly_hours, registration, registration_expires_on from staff where id = $1', [s.id]))[0],
      utilisation: await db.query('select billable_hours, other_hours, available_hours, utilisation_pct from staff_utilisation where id = $1', [s.id]),
      'next four weeks': await db.query('select week_of, available, planned, over_by from capacity where staff_id = $1 order by week_of', [s.id]),
      'last 14 days': await db.query('select t.worked_on, p.number, st.name as stage, round(t.minutes / 60.0, 2) as hours from time_entries t join stages st on st.id = t.stage_id join projects p on p.id = st.project_id where t.staff_id = $1 and t.worked_on >= practice_today() - 14 order by t.worked_on desc', [s.id]),
    };
  }
  if (cmd === 'attention') return attention(db);
  if (cmd === 'compliance') return compliance(db);
  if (cmd === 'weekly-review') {
    return {
      'fee tracking': await run(db, 'fee-tracking'),
      'work to invoice': await run(db, 'wip'),
      debtors: await run(db, 'debtors'),
      'missing timesheets': await run(db, 'missing-timesheets'),
      overbooked: await run(db, 'overbooked'),
    };
  }
  if (cmd === 'import') {
    const [kind, file] = args;
    if (kind !== 'synergy' || !file) throw Error('import synergy <file.csv> [--timesheets] [--dry-run] [--date-order=DMY|MDY]');
    return opts.timesheets ? importTimesheets(db, file, opts) : importProjects(db, file, opts);
  }
  if (cmd === 'export') {
    if (!args[0]) throw Error('export <file.json>');
    const out = { format: 'design-practice-v1', exported_at: new Date().toISOString() };
    await transaction(db, async () => {
      for (const t of ['practice_profile', 'staff', 'clients', 'projects', 'stages', 'variations', 'invoices', 'invoice_lines', 'payments', 'time_entries', 'expenses', 'allocations', 'leave', 'activity', 'audit']) {
        out[t] = await db.query(`select * from ${t} order by created_at, id`);
      }
    });
    writeFileSync(args[0], JSON.stringify(out, null, 2));
    return [{ file: path.resolve(args[0]), records: Object.values(out).filter(Array.isArray).reduce((n, a) => n + a.length, 0) }];
  }
  if (cmd === 'draft-reminder') return draftReminder(db, args);
  if (cmd === 'draft-variation') return draftVariation(db, args);
  if (cmd === 'draft-terms') return draftTerms(db, args);

  return transaction(db, async () => {
    let rows;
    if (cmd === 'log-time') rows = await logTime(db, args, opts);
    else if (cmd === 'expense') {
      const p = await resolve(db, 'projects', args[0]);
      const s = await resolveStage(db, p, args[1]);
      date(args[2]); amount(args[3]);
      const what = args.slice(4).join(' ').trim();
      if (!what) throw Error('expense <project> <stage> <YYYY-MM-DD> <amount> <what it was> [--not-rechargeable]');
      rows = await db.query('insert into expenses (name, stage_id, incurred_on, amount, rechargeable) values ($1, $2, $3, $4, $5) returning id, name, amount, rechargeable', [what, s.id, args[2], args[3], !opts.notRechargeable]);
    } else if (cmd === 'progress') {
      const p = await resolve(db, 'projects', args[0]);
      const s = await resolveStage(db, p, args[1]);
      const pct = Number(args[2]);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw Error('progress <project> <stage> <percent 0 to 100>');
      const [sp] = await db.query('select * from stage_position where id = $1', [s.id]);
      if (['fixed', 'percent'].includes(s.fee_type) && Number(sp.total_fee) > 0) {
        const billed = Math.ceil((Number(sp.invoiced) * 100) / Number(sp.total_fee));
        if (pct < billed) throw Error(`${billed}% of ${s.name} is already invoiced. Progress cannot go below that without a credit note.`);
      }
      rows = await db.query("update stages set percent_complete = $1, status = case when $1 = 100 then 'complete' when status = 'proposal' then 'active' else status end where id = $2 returning id, name, percent_complete, status", [pct, s.id]);
      if (sp.fee_used_pct !== null && Number(sp.fee_used_pct) > pct + 10) rows[0].note = `${sp.fee_used_pct}% of the fee is used at ${pct}% complete`;
    } else if (cmd === 'variation') {
      const p = await resolve(db, 'projects', args[0]);
      const s = await resolveStage(db, p, args[1]);
      amount(args[2], 'fee');
      const description = args.slice(3).join(' ').trim();
      if (!description) throw Error('variation <project> <stage> <fee> <description>');
      const [{ n }] = await db.query('select count(*)::int + 1 as n from variations where project_id = $1', [p.id]);
      rows = await db.query("insert into variations (name, project_id, stage_id, description, fee) values ($1, $2, $3, $4, $5) returning id, name, fee, status", [`V-${p.number}-${String(n).padStart(2, '0')}`, p.id, s.id, description, args[2]]);
    } else if (cmd === 'submit-variation') {
      const v = await resolve(db, 'variations', args[0]);
      if (v.status !== 'draft') throw Error(`${v.name} is ${v.status}, not draft`);
      const on = args[1] ? date(args[1]) : await today(db);
      rows = await db.query("update variations set status = 'submitted', submitted_on = $1 where id = $2 returning id, name, status, submitted_on", [on, v.id]);
    } else if (cmd === 'approve-variation' || cmd === 'decline-variation') {
      const v = await resolve(db, 'variations', args[0]);
      if (v.status !== 'submitted') throw Error(`${v.name} is ${v.status}. Submit it to the client first.`);
      date(args[1]);
      const by = args.slice(2).join(' ').trim();
      if (cmd === 'approve-variation' && !by) throw Error('approve-variation <variation> <YYYY-MM-DD> <who approved it>');
      rows = await db.query('update variations set status = $1, decided_on = $2, approved_by = $3 where id = $4 returning id, name, status, fee', [cmd === 'approve-variation' ? 'approved' : 'declined', args[1], by || null, v.id]);
    } else if (cmd === 'invoice') rows = await raiseInvoice(db, args);
    else if (cmd === 'issue') {
      const inv = await resolve(db, 'invoices', args[0]);
      if (inv.status !== 'draft') throw Error(`${inv.name} is ${inv.status}, not draft`);
      const [b] = await db.query('select * from invoice_balances where id = $1', [inv.id]);
      if (Number(b.net) <= 0) throw Error(`${inv.name} has nothing on it`);
      const p = await profile(db);
      if (opts.claim && b.residential && !opts.form1 && p.jurisdiction === 'NZ') throw Error(`${b.client} is a residential occupier. Attach the prescribed Form 1 to the payment claim, then issue with --claim --form1.`);
      rows = await db.query("update invoices set status = 'issued', issued_on = practice_today(), due_on = practice_today() + $1::int, payment_claim = $2, form1_attached = $3 where id = $4 returning id, name, issued_on, due_on, payment_claim", [p.payment_terms_days, !!opts.claim, !!opts.form1, inv.id]);
    } else if (cmd === 'schedule') {
      const inv = await resolve(db, 'invoices', args[0]);
      if (!inv.payment_claim) throw Error(`${inv.name} was not issued as a payment claim`);
      date(args[1]);
      if (!/^\d+(\.\d{1,2})?$/.test(String(args[2] ?? ''))) throw Error('schedule <invoice> <YYYY-MM-DD received> <scheduled amount incl. tax>');
      rows = await db.query('update invoices set schedule_on = $1, scheduled_amount = $2 where id = $3 returning id, name, schedule_on, scheduled_amount', [args[1], args[2], inv.id]);
      const [b] = await db.query('select total from invoice_balances where id = $1', [inv.id]);
      if (Number(args[2]) < Number(b.total)) rows[0].note = `Scheduled ${dollars(Number(b.total) - Number(args[2]))} less than claimed. The schedule must say how it was calculated and why.`;
    } else if (cmd === 'payment') {
      const inv = await resolve(db, 'invoices', args[0]);
      amount(args[1]);
      if (!args[2]?.trim()) throw Error('payment <invoice> <amount> <bank reference>');
      const [b] = await db.query('select * from invoice_balances where id = $1', [inv.id]);
      if (b.status !== 'issued') throw Error(`${inv.name} is ${b.status}, not issued`);
      if (Number(args[1]) > Number(b.balance)) throw Error(`Payment exceeds the ${dollars(b.balance)} left on ${inv.name}`);
      rows = await db.query('insert into payments (name, invoice_id, amount, reference) values ($1, $2, $3, $4) returning id, name, amount, paid_on', ['Receipt ' + args[2], inv.id, args[1], args[2]]);
    } else if (cmd === 'allocate') {
      const s = await resolve(db, 'staff', args[0]);
      const p = await resolve(db, 'projects', args[1]);
      const st = await resolveStage(db, p, args[2]);
      date(args[3]);
      const [mon] = await db.query('select extract(isodow from $1::date) = 1 as ok', [args[3]]);
      if (!mon.ok) throw Error('Plan by week: use the Monday date');
      const hours = Number(args[4]);
      if (!(hours > 0 && hours <= 80)) throw Error('allocate <person> <project> <stage> <Monday YYYY-MM-DD> <hours>');
      rows = await db.query('insert into allocations (name, staff_id, stage_id, week_of, hours) values ($1, $2, $3, $4, $5) on conflict (staff_id, stage_id, week_of) do update set hours = excluded.hours returning id, name, week_of, hours', [`${s.name} on ${p.number} ${st.name}`, s.id, st.id, args[3], hours]);
      const [c] = await db.query('select available, planned, over_by from capacity where staff_id = $1 and week_of = $2', [s.id, args[3]]);
      if (c && Number(c.over_by) > 0) rows[0].note = `${s.name} is now planned ${c.planned}h against ${c.available}h available`;
    } else if (cmd === 'sign-terms') {
      const p = await resolve(db, 'projects', args[0]);
      date(args[1]);
      const instructed = args[2] ? date(args[2]) : args[1];
      rows = await db.query("update projects set terms_signed_on = $1, instructed_on = $2, status = case when status = 'proposal' then 'active' else status end where id = $3 returning id, number, name, status, terms_signed_on, instructed_on", [args[1], instructed, p.id]);
    } else if (cmd === 'log') {
      const c = await resolve(db, 'clients', args[0]);
      const note = args.slice(1).join(' ').trim();
      if (!note) throw Error('log <client> <note>');
      rows = await db.query('insert into activity (name, client_id, note) values ($1, $2, $3) returning *', ['Contact with ' + c.name, c.id, note]);
      await db.query('update clients set last_contact_on = practice_today() where id = $1', [c.id]);
    } else if (cmd === 'add' || cmd === 'set') {
      rows = await write(db, cmd, args);
    } else throw Error(`Unknown command "${cmd}". Run help.`);
    await audit(db, cmd, rows[0]?.id || null, { arguments: args, override: opts.override || undefined });
    return rows;
  });
}

// ------------------------------------------------------------------ time

async function logTime(db, args, opts) {
  const [who, proj, stageQ, on, hoursArg, ...noteParts] = args;
  if (!who || !proj || !stageQ || !on || !hoursArg) throw Error('log-time <person> <project> <stage> <YYYY-MM-DD> <hours> [note] [--override="reason"]');
  const s = await resolve(db, 'staff', who);
  const p = await resolve(db, 'projects', proj);
  const st = await resolveStage(db, p, stageQ);
  date(on);
  const hours = Number(hoursArg);
  if (!(hours > 0 && hours <= 24) || Math.round(hours * 4) !== hours * 4) throw Error('Hours must be between 0.25 and 24, in quarter hours');
  const broken = [];
  if (!s.active) broken.push(`${s.name} is not active`);
  if (on > (await today(db))) broken.push('the date is in the future');
  if (['completed', 'lost'].includes(p.status)) broken.push(`${p.number} is ${p.status}`);
  if (st.status === 'complete') broken.push(`${st.name} is complete: new work there needs a variation`);
  if (st.status === 'on_hold') broken.push(`${st.name} is on hold`);
  if (broken.length && !opts.override) throw Error(`Time refused: ${broken.join('; ')}. A director can pass --override="reason".`);
  const rows = await db.query('insert into time_entries (name, staff_id, stage_id, worked_on, minutes, charge_rate, cost_rate, note) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, name, worked_on, minutes',
    [`${s.name}, ${st.name}`, s.id, st.id, on, Math.round(hours * 60), s.charge_rate, s.cost_rate, noteParts.join(' ').trim() || null]);
  if (broken.length) rows[0].overridden = broken.join('; ');
  const [sp] = await db.query('select fee_used_pct, percent_complete, fee_type from stage_position where id = $1', [st.id]);
  if (sp.fee_used_pct !== null && ['fixed', 'percent', 'capped'].includes(sp.fee_type) && Number(sp.fee_used_pct) >= 100) rows[0].note = `${st.name} has now used ${sp.fee_used_pct}% of its fee`;
  return rows;
}

// ------------------------------------------------------------------ invoicing

async function raiseInvoice(db, args) {
  const p = await resolve(db, 'projects', args[0]);
  const pr = await profile(db);
  const stages = await db.query("select * from stage_position where project_id = $1 and wip > 0 order by sort, stage", [p.id]);
  const expenses = await db.query('select e.* from expenses e join stages s on s.id = e.stage_id where s.project_id = $1 and e.rechargeable and e.invoice_id is null order by e.incurred_on', [p.id]);
  if (!stages.length && !expenses.length) return [{ raised: 0, note: `Nothing to invoice on ${p.number}` }];
  const [{ n }] = await db.query("select coalesce(max(substring(name from '^INV-(\\d+)$')::int), 1000) + 1 as n from invoices");
  const [inv] = await db.query("insert into invoices (name, project_id, tax_rate) values ($1, $2, $3) returning id, name", [`INV-${n}`, p.id, pr.tax_rate]);
  for (const s of stages) {
    const fee = ['fixed', 'percent'].includes(s.fee_type);
    const label = fee ? `${s.stage}: ${s.percent_complete}% complete` : `${s.stage}: time to ${day(s.last_time)}`;
    await db.query('insert into invoice_lines (name, invoice_id, stage_id, kind, amount) values ($1, $2, $3, $4, $5)', [label, inv.id, s.id, fee ? 'fee' : 'time', s.wip]);
  }
  for (const e of expenses) {
    await db.query("insert into invoice_lines (name, invoice_id, stage_id, kind, amount) values ($1, $2, $3, 'expense', $4)", [`Disbursement: ${e.name}`, inv.id, e.stage_id, e.amount]);
    await db.query('update expenses set invoice_id = $1 where id = $2', [inv.id, e.id]);
  }
  return db.query("select id, name, status, net, total from invoice_balances where id = $1", [inv.id]);
}

// ------------------------------------------------------------------ add / set

async function write(db, cmd, args) {
  const [type, ...rest] = args;
  if (!fields[type]) throw Error('Writable types: ' + Object.keys(fields).join(', '));
  const record = cmd === 'set' ? await resolve(db, type, rest.shift()) : null;
  let value;
  try { value = JSON.parse(rest.join(' ')); } catch { throw Error('Supply one JSON object of field values'); }
  if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length) throw Error('Supply a non-empty JSON object');
  for (const k of Object.keys(value)) {
    if (!fields[type].includes(k)) throw Error(`Field ${k} is not writable on ${type}. Writable: ${fields[type].join(', ')}`);
    if (LOOKUP[k] && value[k]) value[k] = (await resolve(db, LOOKUP[k], value[k])).id;
    if (k.endsWith('_on') && value[k] !== null) date(value[k]);
  }
  if (type === 'stages' && record && ('fee' in value || 'fee_type' in value)) {
    const [sp] = await db.query('select invoiced from stage_position where id = $1', [record.id]);
    if (Number(sp.invoiced) > 0 && 'fee_type' in value) throw Error('This stage has invoices against it. Its fee type cannot change.');
    if ('fee' in value && Number(value.fee) < Number(sp.invoiced)) throw Error(`The fee cannot drop below the ${dollars(sp.invoiced)} already invoiced`);
  }
  const keys = Object.keys(value), vals = Object.values(value);
  if (record) return db.query(`update ${type} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${vals.length + 1} returning *`, [...vals, record.id]);
  return db.query(`insert into ${type} (${keys.join(', ')}) values (${vals.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, vals);
}

// ------------------------------------------------------------------ drafts

async function draftReminder(db, args) {
  const inv = await resolve(db, 'invoices', args[0]);
  const [b] = await db.query('select * from invoice_balances where id = $1', [inv.id]);
  if (b.status !== 'issued' || Number(b.balance) <= 0) throw Error(`${inv.name} has nothing owing`);
  const p = await profile(db);
  const [c] = await db.query('select contact, name from clients where name = $1', [b.client]);
  const [wd] = await db.query('select working_days($1::date, practice_today()) as n', [b.issued_on]);
  const lapsed = b.payment_claim && !b.schedule_on && wd.n > p.claim_response_days;
  const law = p.jurisdiction === 'NZ'
    ? `This invoice was served as a payment claim under the Construction Contracts Act 2002. No payment schedule was provided within ${p.claim_response_days} working days, so the claimed amount is now payable in full.`
    : `This invoice was served as a payment claim under the security of payment legislation that applies to the project. No payment schedule was provided within ${p.claim_response_days} business days, so the claimed amount is now payable in full.`;
  return draftFile('reminder', inv.id, `Subject: ${b.name}, ${b.number} ${b.project}\n\nHi ${(c?.contact || c?.name || b.client).split(' ')[0]},\n\nA note that ${b.name} for ${b.project}, issued ${day(b.issued_on)} and due ${day(b.due_on)}, still shows ${dollars(b.balance)} owing (including GST).${lapsed ? `\n\n${law}` : ''}\n\nIf it is already paid, reply with the date and reference and we will match it up.\n\nThanks,\n${p.name}\n\nDraft. A person reviews and sends it.`);
}

async function draftVariation(db, args) {
  const v = await resolve(db, 'variations', args[0]);
  const [d] = await db.query('select p.number, p.name as project, s.name as stage, s.fee_type, c.contact, c.name as client from variations v join projects p on p.id = v.project_id join stages s on s.id = v.stage_id left join clients c on c.id = p.client_id where v.id = $1', [v.id]);
  const p = await profile(db);
  return draftFile('variation', v.id, `Subject: Variation ${v.name}, ${d.number} ${d.project}\n\nHi ${(d.contact || d.client || '').split(' ')[0]},\n\nYou asked us to ${v.description.charAt(0).toLowerCase() + v.description.slice(1)}. That sits outside the scope agreed for ${d.stage}, so we have priced it as a variation:\n\n- Variation: ${v.name}\n- Work: ${v.description}\n- Fee: ${dollars(v.fee)} excluding GST, added to ${d.stage}\n\nWe will start this work once you confirm by reply that you approve it. Nothing else in our terms changes.\n\nThanks,\n${p.name}\n\nDraft. A person reviews and sends it.`);
}

async function draftTerms(db, args) {
  const pj = await resolve(db, 'projects', args[0]);
  const p = await profile(db);
  const [c] = await db.query('select * from clients where id = $1', [pj.client_id]);
  const stages = await db.query('select name, fee_type, fee, contract_pct, due_on from stages where project_id = $1 order by sort, name', [pj.id]);
  const lines = stages.map((s) => `| ${s.name} | ${FEE_WORDS[s.fee_type]} | ${s.fee_type === 'hourly' ? `estimate ${dollars(s.fee)}` : s.fee_type === 'percent' ? `${s.contract_pct}% of the contract value (${dollars(s.fee)})` : s.fee_type === 'none' ? '' : dollars(s.fee)} | ${s.due_on ? day(s.due_on) : ''} |`);
  const rates = await db.query("select role, charge_rate from staff where active and charge_rate > 0 group by role, charge_rate order by charge_rate desc");
  return draftFile('terms', pj.id, `# Terms of appointment: ${pj.number} ${pj.name}\n\nClient: ${c?.name || ''}${c?.address ? `, ${c.address}` : ''}\nConsultant: ${p.name}\n\n## Scope of services\n\n[Describe the services for each stage below. Say what is included and what is not.]\n\n## Stages and fees\n\n| Stage | Fee basis | Fee (excl. GST) | Target date |\n|---|---|---|---|\n${lines.join('\n')}\n\n## Hourly rates\n\n${rates.map((r) => `- ${r.role}: ${dollars(r.charge_rate)} an hour`).join('\n')}\n\n## Invoicing and payment\n\nWe invoice monthly by stage progress, plus disbursements at cost. Invoices are due ${p.payment_terms_days} days after issue.${p.jurisdiction === 'NZ' ? ' Invoices may be served as payment claims under the Construction Contracts Act 2002.' : ''}\n\n## Variations\n\nWork outside the scope above is priced as a variation and starts once you approve it in writing.\n\n## Professional indemnity insurance\n\n${p.pi_insurer ? `Held with ${p.pi_insurer}.` : '[Insurer and cover.]'}\n\n## Termination, responsibilities and limits\n\n[Your standard clauses, or the conditions of engagement you use.]\n\n## Instruction to proceed\n\nSign and return to confirm you accept these terms and instruct us to proceed.\n\nDraft. A person reviews and sends it.`);
}

// ------------------------------------------------------------------ attention and compliance

export async function attention(db) {
  const out = [];
  const add = (who, issue, detail) => out.push({ who, issue, detail });
  for (const r of await run(db, 'fee-tracking')) add(`${r.number} ${r.stage}`, 'fee burning ahead of progress', `${r.fee_used}% of fee used at ${r.complete}% complete`);
  for (const r of await run(db, 'over-fee')) add(`${r.number} ${r.stage}`, 'over fee', `time ${dollars(r.time_value)} against a ${dollars(r.total_fee)} fee`);
  for (const r of await run(db, 'claims')) if (r.position.startsWith('no schedule')) add(`${r.invoice} ${r.client}`, 'payment claim, no schedule', `${r.working_days} working days, ${dollars(r.balance)} payable in full`);
  for (const r of await run(db, 'debtors')) add(`${r.invoice} ${r.client}`, 'overdue', `${dollars(r.balance)}, ${r.days_overdue} days`);
  for (const r of await run(db, 'wip')) if (Number(r.wip) >= 1000) add(`${r.number} ${r.stage}`, 'work not invoiced', dollars(r.wip));
  const exp = await run(db, 'unbilled-expenses');
  if (exp.length) add('Accounts', 'disbursements not recharged', `${exp.length}, ${dollars(exp.reduce((n, r) => n + Number(r.amount), 0))}`);
  for (const r of await run(db, 'variations-waiting')) add(`${r.number} ${r.name}`, r.status === 'draft' ? 'variation not sent' : 'variation not approved', `${dollars(r.fee)}, ${r.days} day${r.days === 1 ? '' : 's'}`);
  for (const r of await run(db, 'missing-timesheets')) add(r.name, 'timesheet short', `${r.logged}h of ${r.expected}h last week`);
  for (const r of await run(db, 'overbooked')) add(r.name, 'overbooked', `${r.planned}h planned, ${r.available}h available, week of ${day(r.week_of)}`);
  for (const r of await run(db, 'proposals')) if (r.days_since_sent > 14) add(`${r.number} ${r.name}`, 'terms not signed', `sent ${r.days_since_sent} days ago`);
  return out;
}

export async function compliance(db) {
  const p = await profile(db);
  const nz = p.jurisdiction === 'NZ';
  const RAR = 'https://www.legislation.govt.nz/regulation/public/2006/0161/latest/whole.html';
  const CCA = 'https://www.legislation.govt.nz/act/public/2002/0046/latest/whole.html';
  const SOP = 'https://legislation.nsw.gov.au/view/html/inforce/current/act-1999-046';
  const rules = [
    nz && p.registered_architects && ['TERMS-OF-APPOINTMENT', 'Registered Architects Rules 2006 r58A: services only once written terms of appointment are provided and the client has instructed you to proceed', RAR,
      `select p.number || ' ' || p.name as name, concat_ws(', ', case when p.terms_signed_on is null then 'no signed terms' end, case when p.instructed_on is null then 'no instruction to proceed' end) || ', $' || round(pp.time_value) || ' of time logged' as detail
       from projects p join project_position pp on pp.id = p.id
       where p.status in ('proposal', 'active') and (p.terms_signed_on is null or p.instructed_on is null)
         and exists (select 1 from time_entries t join stages s on s.id = t.stage_id where s.project_id = p.id and s.fee_type <> 'none')`],
    ['CLAIM-NO-SCHEDULE', nz ? 'Construction Contracts Act 2002 s22: no payment schedule within the time allowed (20 working days by default) makes the claimed amount payable in full' : 'Building and Construction Industry Security of Payment Act 1999 (NSW) s14(4): no payment schedule within 10 business days makes the claimed amount payable', nz ? CCA : SOP,
      `select b.name || ' ' || b.client as name, working_days(b.issued_on, practice_today()) || ' working days, ' || b.balance || ' owing' as detail
       from invoice_balances b cross join practice_profile pp
       where b.payment_claim and b.status = 'issued' and b.balance > 0 and b.schedule_on is null and working_days(b.issued_on, practice_today()) > pp.claim_response_days`],
    nz && ['CLAIM-FORM-1', 'Construction Contracts Act 2002 s20: a payment claim to a residential occupier carries the prescribed outline of the payment process (Form 1)', CCA,
      "select name || ' ' || client as name, 'payment claim to a residential occupier without Form 1' as detail from invoice_balances where payment_claim and residential and not form1_attached and status = 'issued'"],
    ['REGISTRATION-CURRENT', 'Practice rule: staff who sign drawings or producer statements hold current registration (registered architect or chartered engineer)', 'docs/compliance.md',
      "select name, registration || ', expired ' || registration_expires_on::text as detail from staff where active and registration is not null and (registration_expires_on is null or registration_expires_on < practice_today())"],
    ['PI-INSURANCE', 'Practice rule: professional indemnity cover stays current; renewal is flagged 30 days out', 'docs/compliance.md',
      "select 'Professional indemnity' as name, coalesce('expires ' || pi_expires_on::text, 'no expiry recorded') as detail from practice_profile where pi_expires_on is null or pi_expires_on <= practice_today() + 30"],
  ].filter(Boolean);
  const out = [];
  for (const [rule, requirement, source, sql] of rules) for (const r of await db.query(sql)) out.push({ rule, record: r.name, detail: r.detail, requirement, source });
  return out;
}
