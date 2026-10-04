# Design Practice for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Practice:** [YOUR PRACTICE] (the demo is Kowhai Studio Architects)
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| stages burning their fee faster than they are progressing: share of the fee used in time against the percent complete, worst gap first | `/fee-tracking` |
| stages where the time spent is worth more than the fee (fixed, percent and capped), and by how much | `/over-fee` |
| record a stage's percent complete. Refuses to drop below what is already invoiced, and warns when the fee is used faster than the work | `/progress` |
| log hours for a person on a project stage. Refuses future dates, completed stages (that needs a variation) and stages on hold unless a director overrides | `/log-time` |
| last week's hours per person against their expected hours, net of leave | `/timesheets` |
| people who logged less than 90% of their expected hours last week | `/missing-timesheets` |
| every time entry in the last seven days | `/time` |
| every stage: fee type, fee, percent complete, fee used, earned, invoiced, still to invoice | `/stages` |
| every project with its fee, earned value, invoiced, work still to invoice and margin to date | `/projects` |
| one project: its position, every stage, variations and invoices | `/project` |
| raise a variation on a stage: extra work, the fee for it and what it is. Starts as a draft | `/variation` |
| mark a variation as sent to the client | `/submit-variation` |
| record the client's approval: the date and who approved it. The fee adds to the stage | `/approve-variation` |
| record that the client declined a variation | `/decline-variation` |
| every variation with its status and how long it has waited | `/variations` |
| variations not yet sent, or sent more than 14 days ago with no answer | `/variations-waiting` |
| draft the variation letter for the client to approve | `/draft-variation` |
| work done and not yet invoiced, by stage: earned at the recorded progress (fixed and percent), time at charge rates (hourly) or up to the cap (capped) | `/wip` |
| rechargeable disbursements not yet on an invoice | `/unbilled-expenses` |
| raise a draft invoice for a project: every stage's work not yet invoiced plus rechargeable disbursements. Never invoices the same work twice | `/invoice` |
| issue a draft invoice: sets the issue and due dates. --claim serves it as a payment claim; a residential occupier needs --form1 once Form 1 is attached | `/issue` |
| payment claims still owing: working days since served, the response time, whether a payment schedule came back | `/claims` |
| record a payment schedule received against a payment claim, with the scheduled amount | `/schedule` |
| overdue invoices, oldest first, aged 1-30, 31-60 and 60+ days | `/debtors` |
| record money received against an invoice. Refuses more than the balance | `/payment` |
| every invoice with total, paid and balance | `/invoices` |
| every payment recorded | `/payments` |
| record a disbursement on a stage. Rechargeable unless --not-rechargeable | `/expense` |
| every disbursement and the invoice it went on | `/expenses` |
| draft a payment reminder for an invoice. Where a payment claim got no schedule in time, it says the amount is payable in full | `/draft-reminder` |
| billable hours as a share of available hours per person over the last four weeks, against the practice target | `/utilisation` |
| planned hours against available hours (net of leave) per person for this week and the next three | `/capacity` |
| people planned for more hours than they have in a week | `/overbooked` |
| plan hours for a person on a stage for a week (the Monday). Replaces the earlier plan for that week | `/allocate` |
| one person: rates, registration, utilisation, the next four weeks and the last 14 days of time | `/person` |
| the team with roles, rates, weekly hours and registration | `/staff` |
| registered architects and chartered engineers, with expiry and days left | `/registrations` |
| proposals waiting on signed terms, how long since they were sent and any time already spent | `/proposals` |
| draft terms of appointment for a project: stages, fee basis, fees, rates, invoicing, variations, insurance and the instruction to proceed | `/draft-terms` |
| record signed terms and the instruction to proceed. A proposal becomes active | `/sign-terms` |
| the client list | `/clients` |
| one client: projects, what they owe and contact notes | `/client` |
| log a conversation with a client | `/log` |
| client contact notes, newest first | `/activity` |
| one list of everything that needs a director: fees burning ahead of progress, stages over fee, payment claims with no schedule, overdue invoices, work not invoiced, disbursements not recharged, variations waiting, short timesheets, overbooked people, unsigned terms | `/attention` |
| the Monday review for the directors: fee tracking, work to invoice, debtors, missing timesheets and who is overbooked | `/weekly-review` |
| the practice profile: jurisdiction, tax, payment terms, claim response days, utilisation target, burn tolerance and insurance | `/profile` |
| every change made through the CLI, newest first | `/audit` |
| check the records against the rules a design practice works under (terms of appointment, payment claims and schedules, Form 1, registration, insurance), each with its source | `/compliance` |
| add a record: a person, client, project, stage, leave or the practice profile | `/add` |
| change fields on one record | `/set` |
| bring projects, stages and timesheets across from Synergy's exports (saved as CSV). Test run first | `/import` |
| write every record to one JSON file, as a backup or to move elsewhere | `/export` |
| make it the practice's own: add a field, a fee type, a stage template or a rule, in plain language. The migration is written, applied and tested | `/customise` |
| add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the practice's brand by `npm run view` | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run practice -- help`) and then propose a new command for it.

## Hard rules

- Time the rules refuse (a completed stage, a future date, a stage on hold) stays refused unless the operator says a director approved it. Then pass `--override="reason"` with that reason.
- Never mark an invoice as a payment claim to a residential occupier with `--form1` unless the operator confirms Form 1 is attached.
- Money is recorded, never taken. Nothing here charges a card or talks to the accounting system.
- Amounts are excluding GST unless a column says `total`.

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Synergy (`docs/replace-synergy.md`), and the rules `/compliance` checks (`docs/compliance.md`).

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/synergy
