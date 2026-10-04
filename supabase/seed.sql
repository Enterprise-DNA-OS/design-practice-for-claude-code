-- Fictional demo practice. Every date is relative to today, so the attention commands always have
-- something to say: a stage burning its fee faster than it is progressing, a capped stage over its
-- cap, a variation waiting weeks for approval, a payment claim with no payment schedule, unbilled
-- work, a missing timesheet, an overbooked graduate, a lapsed registration and work started on a
-- proposal with no signed terms. Idempotent: fixed ids and on conflict do nothing.

insert into practice_profile (id, name, jurisdiction, currency, tax_rate, payment_terms_days, claim_response_days, pi_insurer, pi_expires_on)
values ('00000000-0000-4000-8000-000000000001', 'Kowhai Studio Architects', 'NZ', 'NZD', 15, 20, 20, 'Example Mutual', current_date + 21)
on conflict do nothing;

insert into staff (id, name, email, role, discipline, charge_rate, cost_rate, weekly_hours, registration, registration_expires_on) values
('10000000-0000-4000-8000-000000000001', 'Mere Tawhiri', 'mere@example.org', 'Director', 'architecture', 260, 120, 40, 'Registered architect 3112', practice_today() + 200),
('10000000-0000-4000-8000-000000000002', 'Tom Hughes', 'tom@example.org', 'Senior architect', 'architecture', 210, 85, 40, 'Registered architect 4021', practice_today() - 10),
('10000000-0000-4000-8000-000000000003', 'Priya Nair', 'priya@example.org', 'Architectural graduate', 'architecture', 140, 50, 40, null, null),
('10000000-0000-4000-8000-000000000004', 'Sam Okafor', 'sam@example.org', 'Structural engineer', 'structural', 230, 95, 32, 'Chartered engineer 1045', practice_today() + 300),
('10000000-0000-4000-8000-000000000005', 'Lucy Chen', 'lucy@example.org', 'Technician', 'architecture', 130, 45, 40, null, null),
('10000000-0000-4000-8000-000000000006', 'Rangi Moana', 'rangi@example.org', 'Practice manager', 'admin', 0, 60, 24, null, null)
on conflict do nothing;

insert into clients (id, name, contact, email, phone, address, residential, last_contact_on) values
('20000000-0000-4000-8000-000000000001', 'Jo and Mark Ellis', 'Jo Ellis', 'jo.ellis@example.org', '021 555 0201', '14 Ridge Road, Karori, Wellington', true, practice_today() - 12),
('20000000-0000-4000-8000-000000000002', 'Harbour St Holdings', 'Ana Silva', 'ana@example.org', '04 555 0202', 'Level 3, 20 Harbour Street, Wellington', false, practice_today() - 6),
('20000000-0000-4000-8000-000000000003', 'Kapiti Schools Trust', 'David Rowe', 'david@example.org', '04 555 0203', '5 Rimu Road, Paraparaumu', false, practice_today() - 20),
('20000000-0000-4000-8000-000000000004', 'Miramar Property Group', 'Hana Wright', 'hana@example.org', '04 555 0204', '88 Park Road, Miramar', false, practice_today() - 40),
('20000000-0000-4000-8000-000000000005', 'Petone Logistics', 'Craig Bell', 'craig@example.org', '04 555 0205', '2 Hutt Road, Petone', false, practice_today() - 9),
('20000000-0000-4000-8000-000000000006', 'Kowhai Studio (internal)', null, null, null, null, false, null)
on conflict do nothing;

insert into projects (id, number, name, client_id, manager_id, status, contract_value, terms_sent_on, terms_signed_on, instructed_on) values
('30000000-0000-4000-8000-000000000001', '2401', 'Ridge Road House', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'active', null, practice_today() - 160, practice_today() - 150, practice_today() - 148),
('30000000-0000-4000-8000-000000000002', '2402', 'Harbour St Fitout', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'active', null, practice_today() - 70, practice_today() - 66, practice_today() - 65),
('30000000-0000-4000-8000-000000000003', '2403', 'Kapiti School Block', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'active', 2400000, practice_today() - 130, practice_today() - 120, practice_today() - 118),
('30000000-0000-4000-8000-000000000004', '2404', 'Miramar Townhouses', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'proposal', null, practice_today() - 25, null, null),
('30000000-0000-4000-8000-000000000005', '2405', 'Petone Warehouse Seismic', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'active', null, practice_today() - 60, practice_today() - 55, practice_today() - 55),
('30000000-0000-4000-8000-000000000006', '0000', 'Practice overhead', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'active', null, null, null, null)
on conflict do nothing;

insert into stages (id, project_id, name, phase, sort, fee_type, fee, contract_pct, percent_complete, status, due_on) values
('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Concept design', 'Design', 1, 'fixed', 18000, null, 100, 'complete', practice_today() - 60),
('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Developed design', 'Design', 2, 'fixed', 24000, null, 50, 'active', practice_today() + 21),
('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Consent documentation', 'Documentation', 3, 'fixed', 32000, null, 0, 'proposal', practice_today() + 90),
('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', 'Design and documentation', null, 1, 'hourly', 30000, null, 60, 'active', practice_today() + 30),
('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003', 'Preliminary design', 'Design', 1, 'percent', 48000, 2, 100, 'complete', practice_today() - 80),
('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'Detailed design', 'Design', 2, 'percent', 96000, 4, 40, 'active', practice_today() + 45),
('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000004', 'Feasibility', null, 1, 'fixed', 6000, null, 30, 'active', practice_today() + 14),
('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000005', 'Seismic assessment', 'Assessment', 1, 'capped', 12000, null, 90, 'active', practice_today() + 5),
('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000005', 'Strengthening design', 'Design', 2, 'fixed', 28000, null, 20, 'active', practice_today() + 60),
('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000006', 'Admin and marketing', null, 1, 'none', 0, null, 0, 'active', null)
on conflict do nothing;

insert into variations (id, name, project_id, stage_id, description, fee, status, submitted_on, decided_on, approved_by) values
('50000000-0000-4000-8000-000000000001', 'V-2401-01', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Add a studio above the garage', 4500, 'submitted', practice_today() - 25, null, null),
('50000000-0000-4000-8000-000000000002', 'V-2403-01', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000006', 'Second staffroom option for the board', 3200, 'approved', practice_today() - 50, practice_today() - 44, 'David Rowe'),
('50000000-0000-4000-8000-000000000003', 'V-2405-01', '30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000008', 'Assess the mezzanine as well', 2500, 'draft', null, null, null)
on conflict do nothing;

-- Time: one row per person, stage and weekday over a window of days before today.
-- Lucy Chen has nothing logged for last week, so the timesheet check has someone to chase.
insert into time_entries (name, staff_id, stage_id, worked_on, minutes, charge_rate, cost_rate, note, external_id)
select st.name || ', ' || sg.name, st.id, sg.id, d::date, x.minutes, st.charge_rate, st.cost_rate, x.note,
  'seed:' || right(x.staff, 2) || ':' || right(x.stage, 2) || ':' || d::date
from (values
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', -110, -61, 30, 'Concept options and client meetings', false),
  ('10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', -110, -61, 120, 'Concept modelling', false),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', -35, -1, 60, 'Developed design review', false),
  ('10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', -35, -1, 240, 'Developed design drawings', false),
  ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', -42, -1, 120, 'Fitout design and site visits', false),
  ('10000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000004', -42, -1, 180, 'Fitout documentation', true),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', -30, -1, 120, 'Detailed design coordination', false),
  ('10000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000006', -42, -1, 120, 'Detailed design details', true),
  ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000007', -20, -1, 90, 'Feasibility layouts', false),
  ('10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000008', -42, -1, 120, 'Seismic assessment calculations', false),
  ('10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000009', -14, -1, 60, 'Strengthening concept', false),
  ('10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000006', -30, -1, 180, 'Detailed design drawings', false),
  ('10000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000010', -42, -1, 300, 'Accounts, recruitment and marketing', false),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000010', -42, -1, 300, 'Practice management and new business', false),
  ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000010', -42, -1, 270, 'Proposals, reviews and mentoring', false),
  ('10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000010', -42, -1, 60, 'Studio admin', false),
  ('10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000010', -42, -1, 210, 'Engineering reviews and admin', false),
  ('10000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000010', -42, -1, 180, 'Library and standards', true)
) as x(staff, stage, a, b, minutes, note, skip_last_week)
join staff st on st.id = x.staff::uuid
join stages sg on sg.id = x.stage::uuid
cross join lateral generate_series(practice_today() + x.a, practice_today() + x.b, interval '1 day') d
where extract(isodow from d) < 6
  and not (x.skip_last_week and d >= date_trunc('week', practice_today()) - interval '7 days')
on conflict (external_id) do nothing;

insert into invoices (id, name, project_id, status, issued_on, due_on, tax_rate, payment_claim, form1_attached, schedule_on, scheduled_amount) values
('60000000-0000-4000-8000-000000000001', 'INV-1001', '30000000-0000-4000-8000-000000000001', 'issued', practice_today() - 120, practice_today() - 100, 15, true, true, practice_today() - 110, 20700),
('60000000-0000-4000-8000-000000000002', 'INV-1002', '30000000-0000-4000-8000-000000000001', 'issued', practice_today() - 35, practice_today() - 15, 15, true, false, null, null),
('60000000-0000-4000-8000-000000000003', 'INV-1003', '30000000-0000-4000-8000-000000000002', 'issued', practice_today() - 50, practice_today() - 30, 15, false, false, null, null),
('60000000-0000-4000-8000-000000000004', 'INV-1004', '30000000-0000-4000-8000-000000000003', 'issued', practice_today() - 90, practice_today() - 70, 15, true, false, practice_today() - 80, 55200),
('60000000-0000-4000-8000-000000000005', 'INV-1005', '30000000-0000-4000-8000-000000000003', 'issued', practice_today() - 40, practice_today() - 20, 15, true, false, practice_today() - 30, 23000),
('60000000-0000-4000-8000-000000000006', 'INV-1006', '30000000-0000-4000-8000-000000000005', 'issued', practice_today() - 10, practice_today() + 10, 15, false, false, null, null)
on conflict do nothing;

insert into invoice_lines (id, name, invoice_id, stage_id, kind, amount) values
('61000000-0000-4000-8000-000000000001', 'Concept design: 100% complete', '60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'fee', 18000),
('61000000-0000-4000-8000-000000000002', 'Developed design: 25% complete', '60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'fee', 6000),
('61000000-0000-4000-8000-000000000003', 'Design and documentation: time to date', '60000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', 'time', 9000),
('61000000-0000-4000-8000-000000000004', 'Preliminary design: 100% complete', '60000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005', 'fee', 48000),
('61000000-0000-4000-8000-000000000005', 'Detailed design: 20% complete', '60000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000006', 'fee', 20000),
('61000000-0000-4000-8000-000000000006', 'Seismic assessment: time to date', '60000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000008', 'time', 6000)
on conflict do nothing;

insert into payments (id, name, invoice_id, amount, paid_on, reference) values
('62000000-0000-4000-8000-000000000001', 'Receipt ELLIS-1001', '60000000-0000-4000-8000-000000000001', 20700, practice_today() - 101, 'ELLIS-1001'),
('62000000-0000-4000-8000-000000000002', 'Receipt HSH-1003', '60000000-0000-4000-8000-000000000003', 10350, practice_today() - 31, 'HSH-1003'),
('62000000-0000-4000-8000-000000000003', 'Receipt KST-1004', '60000000-0000-4000-8000-000000000004', 55200, practice_today() - 72, 'KST-1004'),
('62000000-0000-4000-8000-000000000004', 'Receipt KST-1005-PART', '60000000-0000-4000-8000-000000000005', 10000, practice_today() - 18, 'KST-1005-PART')
on conflict do nothing;

insert into expenses (id, name, stage_id, incurred_on, amount, rechargeable) values
('63000000-0000-4000-8000-000000000001', 'Council pre-application meeting', '40000000-0000-4000-8000-000000000002', practice_today() - 18, 285, true),
('63000000-0000-4000-8000-000000000002', 'Site survey prints', '40000000-0000-4000-8000-000000000008', practice_today() - 30, 120, true),
('63000000-0000-4000-8000-000000000003', 'Team lunch', '40000000-0000-4000-8000-000000000010', practice_today() - 8, 160, false)
on conflict do nothing;

-- This week and next. Priya is booked past her hours; Sam is on leave next week with work planned.
insert into allocations (id, name, staff_id, stage_id, week_of, hours) values
('64000000-0000-4000-8000-000000000001', 'Priya on Ridge Road developed design', '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', date_trunc('week', practice_today())::date, 30),
('64000000-0000-4000-8000-000000000002', 'Priya on Kapiti detailed design', '10000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000006', date_trunc('week', practice_today())::date, 16),
('64000000-0000-4000-8000-000000000003', 'Mere on Ridge Road developed design', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', date_trunc('week', practice_today())::date, 10),
('64000000-0000-4000-8000-000000000004', 'Mere on Kapiti detailed design', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', date_trunc('week', practice_today())::date, 12),
('64000000-0000-4000-8000-000000000005', 'Sam on Petone strengthening', '10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000009', (date_trunc('week', practice_today()) + interval '7 days')::date, 20),
('64000000-0000-4000-8000-000000000006', 'Tom on Harbour St', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', date_trunc('week', practice_today())::date, 24),
('64000000-0000-4000-8000-000000000007', 'Lucy on Harbour St', '10000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000004', date_trunc('week', practice_today())::date, 20)
on conflict do nothing;

insert into leave (id, name, staff_id, starts_on, ends_on) values
('65000000-0000-4000-8000-000000000001', 'Sam annual leave', '10000000-0000-4000-8000-000000000004', (date_trunc('week', practice_today()) + interval '7 days')::date, (date_trunc('week', practice_today()) + interval '11 days')::date)
on conflict do nothing;

insert into activity (id, name, client_id, happened_on, note) values
('66000000-0000-4000-8000-000000000001', 'Contact with Jo and Mark Ellis', '20000000-0000-4000-8000-000000000001', practice_today() - 12, 'Walked through developed design. They want the garage studio priced.'),
('66000000-0000-4000-8000-000000000002', 'Contact with Miramar Property Group', '20000000-0000-4000-8000-000000000004', practice_today() - 40, 'Sent terms for the feasibility study. Hana to come back after the board meets.'),
('66000000-0000-4000-8000-000000000003', 'Contact with Kapiti Schools Trust', '20000000-0000-4000-8000-000000000003', practice_today() - 20, 'Board approved the second staffroom option.')
on conflict do nothing;
