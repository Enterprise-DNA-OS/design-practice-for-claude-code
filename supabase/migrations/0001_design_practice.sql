-- Design Practice for Claude Code: the schema.
-- Plain Postgres. Runs on any Postgres 13+ and on embedded PGlite. No extensions.
-- Money is numeric(12,2) excluding tax. Time is stored in minutes. Dates are the practice's calendar.

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- One row: the practice, its rates of tax, payment terms and the rules it works under.
create table practice_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  singleton boolean not null default true unique check (singleton),
  jurisdiction text not null default 'NZ' check (jurisdiction in ('NZ', 'AU')),
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Pacific/Auckland',
  tax_rate numeric(5,2) not null default 15 check (tax_rate >= 0),
  payment_terms_days integer not null default 20 check (payment_terms_days >= 0),
  claim_response_days integer not null default 20 check (claim_response_days > 0),
  registered_architects boolean not null default true,
  utilisation_target integer not null default 75 check (utilisation_target between 1 and 100),
  burn_tolerance integer not null default 10 check (burn_tolerance >= 0),
  pi_insurer text,
  pi_expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger practice_profile_updated before update on practice_profile for each row execute function touch_updated_at();

create function practice_today() returns date language sql stable as $$
  select (now() at time zone coalesce((select timezone from practice_profile limit 1), 'UTC'))::date
$$;

-- Monday to Friday between two dates, after a and up to b. Public holidays are not counted out.
create function working_days(a date, b date) returns integer language sql immutable as $$
  select count(*)::int from generate_series(a + 1, b, interval '1 day') d where extract(isodow from d) < 6
$$;

create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text,
  role text,
  discipline text,
  charge_rate numeric(10,2) not null default 0 check (charge_rate >= 0),
  cost_rate numeric(10,2) not null default 0 check (cost_rate >= 0),
  weekly_hours numeric(5,2) not null default 40 check (weekly_hours >= 0),
  registration text,
  registration_expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_updated before update on staff for each row execute function touch_updated_at();

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  email text,
  phone text,
  address text,
  residential boolean not null default false,
  last_contact_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated before update on clients for each row execute function touch_updated_at();

create table projects (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text not null,
  client_id uuid references clients,
  manager_id uuid references staff,
  status text not null default 'active' check (status in ('proposal', 'active', 'on_hold', 'completed', 'lost')),
  contract_value numeric(14,2) check (contract_value >= 0),
  terms_sent_on date,
  terms_signed_on date,
  instructed_on date,
  source_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated before update on projects for each row execute function touch_updated_at();

-- Fee stages: the unit a practice quotes, tracks and invoices by.
create table stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects,
  name text not null,
  phase text,
  sort integer not null default 0,
  fee_type text not null default 'fixed' check (fee_type in ('fixed', 'hourly', 'capped', 'percent', 'none')),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  contract_pct numeric(5,2) check (contract_pct between 0 and 100),
  budget numeric(12,2) check (budget >= 0),
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  status text not null default 'active' check (status in ('proposal', 'active', 'on_hold', 'complete')),
  manager_id uuid references staff,
  start_on date,
  due_on date,
  source_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);
create trigger stages_updated before update on stages for each row execute function touch_updated_at();

create table variations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  project_id uuid not null references projects,
  stage_id uuid not null references stages,
  description text not null,
  fee numeric(12,2) not null check (fee >= 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'declined')),
  submitted_on date,
  decided_on date,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger variations_updated before update on variations for each row execute function touch_updated_at();

create table invoices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  project_id uuid not null references projects,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issued_on date,
  due_on date,
  tax_rate numeric(5,2) not null default 15,
  payment_claim boolean not null default false,
  form1_attached boolean not null default false,
  schedule_on date,
  scheduled_amount numeric(12,2),
  opening_balance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or issued_on is not null)
);
create trigger invoices_updated before update on invoices for each row execute function touch_updated_at();

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invoice_id uuid not null references invoices on delete cascade,
  stage_id uuid references stages,
  kind text not null check (kind in ('fee', 'time', 'expense')),
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger invoice_lines_updated before update on invoice_lines for each row execute function touch_updated_at();

-- Rates are copied onto each entry when it is logged, so a rate rise never rewrites history.
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_id uuid not null references staff,
  stage_id uuid not null references stages,
  worked_on date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  charge_rate numeric(10,2) not null default 0,
  cost_rate numeric(10,2) not null default 0,
  note text,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger time_entries_updated before update on time_entries for each row execute function touch_updated_at();

create table expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage_id uuid not null references stages,
  incurred_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  rechargeable boolean not null default true,
  invoice_id uuid references invoices,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger expenses_updated before update on expenses for each row execute function touch_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invoice_id uuid not null references invoices,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  reference text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_updated before update on payments for each row execute function touch_updated_at();

-- Resourcing: planned hours per person per stage per week (week_of is a Monday).
create table allocations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_id uuid not null references staff,
  stage_id uuid not null references stages,
  week_of date not null check (extract(isodow from week_of) = 1),
  hours numeric(5,2) not null check (hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, stage_id, week_of)
);
create trigger allocations_updated before update on allocations for each row execute function touch_updated_at();

create table leave (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  staff_id uuid not null references staff,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create trigger leave_updated before update on leave for each row execute function touch_updated_at();

create table activity (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid not null references clients,
  happened_on date not null default current_date,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger activity_updated before update on activity for each row execute function touch_updated_at();

create table audit (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  record_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_stage on time_entries (stage_id, worked_on);
create index time_entries_staff on time_entries (staff_id, worked_on);
create index invoice_lines_stage on invoice_lines (stage_id);

-- Weekday hours a person is on leave in a date range.
create function leave_hours(p_staff uuid, a date, b date) returns numeric language sql stable as $$
  select coalesce(count(*) * (select weekly_hours / 5 from staff where id = p_staff), 0)
  from generate_series(a, b, interval '1 day') d
  where extract(isodow from d) < 6
    and exists (select 1 from leave l where l.staff_id = p_staff and d::date between l.starts_on and l.ends_on)
$$;

-- Each stage's fee position: agreed fee plus approved variations, what has been earned at the
-- recorded percent complete, what the time has cost, what is invoiced, and the work not yet billed.
create view stage_position as
with t as (
  select stage_id, sum(minutes) as minutes,
    round(sum(minutes * charge_rate / 60.0), 2) as time_value,
    round(sum(minutes * cost_rate / 60.0), 2) as time_cost,
    max(worked_on) as last_time
  from time_entries group by stage_id
), v as (
  select stage_id, sum(fee) as approved from variations where status = 'approved' group by stage_id
), i as (
  select l.stage_id, sum(l.amount) as invoiced
  from invoice_lines l join invoices inv on inv.id = l.invoice_id
  where inv.status <> 'void' and l.kind in ('fee', 'time') group by l.stage_id
), base as (
  select s.id, s.project_id, p.number, p.name as project, s.name as stage, s.phase, s.sort, s.fee_type, s.status,
    s.percent_complete, s.due_on, s.fee, coalesce(v.approved, 0) as variations,
    s.fee + coalesce(v.approved, 0) as total_fee,
    coalesce(t.minutes, 0) as minutes, coalesce(t.time_value, 0) as time_value,
    coalesce(t.time_cost, 0) as time_cost, t.last_time,
    coalesce(i.invoiced, 0) as invoiced
  from stages s join projects p on p.id = s.project_id
  left join t on t.stage_id = s.id left join v on v.stage_id = s.id left join i on i.stage_id = s.id
)
select b.*,
  case b.fee_type
    when 'hourly' then b.time_value
    when 'capped' then least(b.time_value, b.total_fee)
    when 'none' then 0
    else round(b.total_fee * b.percent_complete / 100.0, 2)
  end as earned,
  greatest(case b.fee_type
    when 'hourly' then b.time_value
    when 'capped' then least(b.time_value, b.total_fee)
    when 'none' then 0
    else round(b.total_fee * b.percent_complete / 100.0, 2)
  end - b.invoiced, 0) as wip,
  case when b.total_fee > 0 then round(b.time_value * 100.0 / b.total_fee, 0) end as fee_used_pct,
  round(b.total_fee - b.time_value, 2) as fee_left
from base b;

create view project_position as
select p.id, p.number, p.name, c.name as client, m.name as manager, p.status,
  coalesce(sum(sp.total_fee), 0) as fee,
  coalesce(sum(sp.earned), 0) as earned,
  coalesce(sum(sp.invoiced), 0) as invoiced,
  coalesce(sum(sp.wip), 0) as wip,
  coalesce(sum(sp.time_value), 0) as time_value,
  coalesce(sum(sp.time_cost), 0) as time_cost,
  coalesce(sum(sp.invoiced), 0) - coalesce(sum(sp.time_cost), 0) as margin_to_date,
  max(sp.last_time) as last_time
from projects p
left join clients c on c.id = p.client_id
left join staff m on m.id = p.manager_id
left join stage_position sp on sp.project_id = p.id
group by p.id, p.number, p.name, c.name, m.name, p.status;

create view invoice_balances as
with l as (select invoice_id, sum(amount) as net from invoice_lines group by invoice_id),
pay as (select invoice_id, sum(amount) as paid from payments group by invoice_id)
select inv.id, inv.name, inv.project_id, p.number, p.name as project, c.name as client, c.residential,
  inv.status, inv.issued_on, inv.due_on, inv.payment_claim, inv.form1_attached, inv.schedule_on, inv.scheduled_amount,
  inv.opening_balance,
  coalesce(l.net, 0) as net,
  round(coalesce(l.net, 0) * (1 + inv.tax_rate / 100.0), 2) as total,
  coalesce(pay.paid, 0) as paid,
  round(coalesce(l.net, 0) * (1 + inv.tax_rate / 100.0), 2) - coalesce(pay.paid, 0) as balance
from invoices inv
join projects p on p.id = inv.project_id
left join clients c on c.id = p.client_id
left join l on l.invoice_id = inv.id
left join pay on pay.invoice_id = inv.id;

-- Billable share of available hours over the last four full weeks.
create view staff_utilisation as
with w as (select (date_trunc('week', practice_today()) - interval '28 days')::date as a,
                  (date_trunc('week', practice_today()) - interval '1 day')::date as b)
select s.id, s.name, s.role, s.weekly_hours,
  round(coalesce(sum(te.minutes) filter (where st.fee_type <> 'none'), 0) / 60.0, 1) as billable_hours,
  round(coalesce(sum(te.minutes) filter (where st.fee_type = 'none'), 0) / 60.0, 1) as other_hours,
  round(s.weekly_hours * 4 - leave_hours(s.id, w.a, w.b), 1) as available_hours,
  round(coalesce(sum(te.minutes) filter (where st.fee_type <> 'none'), 0) / 60.0 * 100
    / nullif(s.weekly_hours * 4 - leave_hours(s.id, w.a, w.b), 0), 0) as utilisation_pct
from staff s cross join w
left join time_entries te on te.staff_id = s.id and te.worked_on between w.a and w.b
left join stages st on st.id = te.stage_id
where s.active
group by s.id, s.name, s.role, s.weekly_hours, w.a, w.b;

-- Planned hours against available hours, per person, for this week and the next three.
create view capacity as
with weeks as (
  select (date_trunc('week', practice_today()) + n * interval '7 days')::date as week_of
  from generate_series(0, 3) n
)
select s.id as staff_id, s.name, w.week_of,
  round(s.weekly_hours - leave_hours(s.id, w.week_of, w.week_of + 4), 1) as available,
  coalesce(sum(a.hours), 0) as planned,
  round(coalesce(sum(a.hours), 0) - (s.weekly_hours - leave_hours(s.id, w.week_of, w.week_of + 4)), 1) as over_by
from staff s cross join weeks w
left join allocations a on a.staff_id = s.id and a.week_of = w.week_of
where s.active
group by s.id, s.name, s.weekly_hours, w.week_of;
