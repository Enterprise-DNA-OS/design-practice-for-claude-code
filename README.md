<h1 align="center">Design Practice for Claude Code</h1>

<p align="center">
  <strong>The open-source architecture and engineering practice management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Synergy data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=synergy">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/synergy?utm_source=github&utm_medium=readme&utm_campaign=synergy">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-synergy">Instead of Synergy</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Design Practice for Claude Code does the job you pay Synergy (Total Synergy) for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Synergy dashboard cannot.

Synergy's own plans page lists Business and Enterprise plans with no public prices, and five add-ons (Analytics Plus, Premium API, PIM, HR and CRM) priced on request ([totalsynergy.com/plans](https://totalsynergy.com/plans/), read 4 October 2026). Software directories have reported per-user monthly figures over the years, but they disagree and none come from Synergy, so none are quoted here. What a practice pays is in its own invoice: per user, per month, plus add-ons.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=synergy).

It covers the weekly jobs of a 5 to 50 person architecture, engineering or design practice in New Zealand or Australia: fee stages (fixed, hourly, capped and percentage of contract), progress and fee burn, variations, timesheets, work in progress, invoicing by stage, payment claims and schedules, debtors, resourcing and utilisation. It is built for a director, studio manager or practice manager who would rather ask than click through a project breakdown.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/design-practice-for-claude-code.git
cd design-practice-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`, or ask "which stages are burning their fee faster than they are progressing?". The demo is a fictional Wellington practice, Kowhai Studio Architects, with six people, five client projects and six weeks of timesheets, all dated from today.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

Every recurring job is a slash command in `.claude/commands/`. The same jobs run from the terminal: `npm run practice -- <command>`, `--json` for machines, project numbers or partial names, and an ambiguous name lists the candidates and stops.

### The fee week

| Command | What it does |
|---|---|
| `/fee-tracking` | Stages burning their fee faster than they are progressing: share of the fee used in time against the percent complete, worst gap first. |
| `/over-fee` | Stages where the time spent is worth more than the fee (fixed, percent and capped), and by how much. |
| `/progress` | Record a stage's percent complete. Refuses to drop below what is already invoiced, and warns when the fee is used faster than the work. |
| `/log-time` | Log hours for a person on a project stage. Refuses future dates, completed stages (that needs a variation) and stages on hold unless a director overrides. |
| `/timesheets` | Last week's hours per person against their expected hours, net of leave. |
| `/missing-timesheets` | People who logged less than 90% of their expected hours last week. |
| `/time` | Every time entry in the last seven days. |
| `/stages` | Every stage: fee type, fee, percent complete, fee used, earned, invoiced, still to invoice. |
| `/projects` | Every project with its fee, earned value, invoiced, work still to invoice and margin to date. |
| `/project` | One project: its position, every stage, variations and invoices. |

### Variations

| Command | What it does |
|---|---|
| `/variation` | Raise a variation on a stage: extra work, the fee for it and what it is. Starts as a draft. |
| `/submit-variation` | Mark a variation as sent to the client. |
| `/approve-variation` | Record the client's approval: the date and who approved it. The fee adds to the stage. |
| `/decline-variation` | Record that the client declined a variation. |
| `/variations` | Every variation with its status and how long it has waited. |
| `/variations-waiting` | Variations not yet sent, or sent more than 14 days ago with no answer. |
| `/draft-variation` | Draft the variation letter for the client to approve. |

### Invoicing and money

| Command | What it does |
|---|---|
| `/wip` | Work done and not yet invoiced, by stage: earned at the recorded progress (fixed and percent), time at charge rates (hourly) or up to the cap (capped). |
| `/unbilled-expenses` | Rechargeable disbursements not yet on an invoice. |
| `/invoice` | Raise a draft invoice for a project: every stage's work not yet invoiced plus rechargeable disbursements. Never invoices the same work twice. |
| `/issue` | Issue a draft invoice: sets the issue and due dates. --claim serves it as a payment claim; a residential occupier needs --form1 once Form 1 is attached. |
| `/claims` | Payment claims still owing: working days since served, the response time, whether a payment schedule came back. |
| `/schedule` | Record a payment schedule received against a payment claim, with the scheduled amount. |
| `/debtors` | Overdue invoices, oldest first, aged 1-30, 31-60 and 60+ days. |
| `/payment` | Record money received against an invoice. Refuses more than the balance. |
| `/invoices` | Every invoice with total, paid and balance. |
| `/payments` | Every payment recorded. |
| `/expense` | Record a disbursement on a stage. Rechargeable unless --not-rechargeable. |
| `/expenses` | Every disbursement and the invoice it went on. |
| `/draft-reminder` | Draft a payment reminder for an invoice. Where a payment claim got no schedule in time, it says the amount is payable in full. |

### People and resourcing

| Command | What it does |
|---|---|
| `/utilisation` | Billable hours as a share of available hours per person over the last four weeks, against the practice target. |
| `/capacity` | Planned hours against available hours (net of leave) per person for this week and the next three. |
| `/overbooked` | People planned for more hours than they have in a week. |
| `/allocate` | Plan hours for a person on a stage for a week (the Monday). Replaces the earlier plan for that week. |
| `/person` | One person: rates, registration, utilisation, the next four weeks and the last 14 days of time. |
| `/staff` | The team with roles, rates, weekly hours and registration. |
| `/registrations` | Registered architects and chartered engineers, with expiry and days left. |

### Clients and new work

| Command | What it does |
|---|---|
| `/proposals` | Proposals waiting on signed terms, how long since they were sent and any time already spent. |
| `/draft-terms` | Draft terms of appointment for a project: stages, fee basis, fees, rates, invoicing, variations, insurance and the instruction to proceed. |
| `/sign-terms` | Record signed terms and the instruction to proceed. A proposal becomes active. |
| `/clients` | The client list. |
| `/client` | One client: projects, what they owe and contact notes. |
| `/log` | Log a conversation with a client. |
| `/activity` | Client contact notes, newest first. |

### Reviews and checks

| Command | What it does |
|---|---|
| `/attention` | One list of everything that needs a director: fees burning ahead of progress, stages over fee, payment claims with no schedule, overdue invoices, work not invoiced, disbursements not recharged, variations waiting, short timesheets, overbooked people, unsigned terms. |
| `/weekly-review` | The Monday review for the directors: fee tracking, work to invoice, debtors, missing timesheets and who is overbooked. |
| `/profile` | The practice profile: jurisdiction, tax, payment terms, claim response days, utilisation target, burn tolerance and insurance. |
| `/audit` | Every change made through the CLI, newest first. |
| `/compliance` | Check the records against the rules a design practice works under (terms of appointment, payment claims and schedules, Form 1, registration, insurance), each with its source. |

### Records and setup

| Command | What it does |
|---|---|
| `/add` | Add a record: a person, client, project, stage, leave or the practice profile. |
| `/set` | Change fields on one record. |
| `/import` | Bring projects, stages and timesheets across from Synergy's exports (saved as CSV). Test run first. |
| `/export` | Write every record to one JSON file, as a backup or to move elsewhere. |
| `/customise` | Make it the practice's own: add a field, a fee type, a stage template or a rule, in plain language. The migration is written, applied and tested. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the practice's brand by `npm run view`. |


## Ten questions Synergy's screens do not answer

Each one is a command that works on the demo today.

1. Which stages have used more of their fee than they have progressed, and by how much? `/fee-tracking`
2. Which capped stages have run past the cap, so the extra time is written off? `/over-fee`
3. Which payment claims got no payment schedule in time, so the full amount is now payable? `/claims`
4. Which variations have waited more than two weeks for the client's yes, and what are they worth? `/variations-waiting`
5. What work is done and not invoiced, by stage, whatever the fee type? `/wip`
6. Which disbursements were never recharged? `/unbilled-expenses`
7. Who is booked for more hours than they have next week, once leave is counted? `/overbooked`
8. Who logged less than 90% of their hours last week? `/missing-timesheets`
9. Which projects have time on them but no signed terms of appointment? `/compliance`
10. Whose registration or the practice's insurance lapses this month? `/compliance`

## Your first hour: ten things to ask for

1. "Put our practice name and colours on the paperwork" (edits `brand.json`).
2. "Import our Synergy project breakdown and do a test run first."
3. "Now import last month's timesheets."
4. "Which stages are burning their fee faster than they are progressing?"
5. "Raise invoices for everything finished this month and show me the drafts."
6. "Draft a variation letter for the extra garage studio on 2401."
7. "Who is overbooked next week?"
8. "Draft terms of appointment for the Miramar townhouses."
9. "Add a stage template for our standard residential job." (`/customise`)
10. "Make me a Monday page for the directors." (`/new-view`)

## Paperwork and views

`npm run docs` renders a fee report per project, each invoice as a payment claim showing how it was calculated, and each open variation as an approval form, in the practice's brand from `brand.json`, into `docs-out/`. `npm run view` renders the practice week and the project fees page into `views/`. Both are local HTML files: print them or save as PDF.

## Instead of Synergy

Synergy exports reports to Excel. Save the project breakdown and the timesheet report as CSV and run `/import`: projects, phases, stages, fee types, fees, percent complete and what was already invoiced come across in one command, then the timesheets. A test run (`--dry-run`) shows the counts first and writes nothing. What maps and what does not: [docs/replace-synergy.md](docs/replace-synergy.md).

## Architecture

```
design-practice-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  scripts/practice.mjs      the one CLI; scripts/lib/domain.mjs holds the fee and claim rules
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Design Practice for Claude Code for your business, migrates your Synergy data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=synergy)
- Read more: [enterprisedna.co/omni/instead-of/synergy](https://enterprisedna.co/omni/instead-of/synergy?utm_source=github&utm_medium=readme&utm_campaign=synergy)

## Verification

`npm test` builds a throwaway database, loads the demo twice, and runs every command: earned value and work in progress for each fee type, progress refusing to drop below what is invoiced, the time rules refusing and the override recording why, variations through draft, submitted, approved and declined, invoices never raising the same work twice, a residential payment claim refused without Form 1, payments refusing overpayment, both Synergy imports with a dry run, a repeat run and a rollback on a bad row, the drafts, the views and the documents. CI runs it on Linux, Windows and a real Postgres.

## License

MIT. Copyright (c) 2026 Enterprise DNA. Not affiliated with Total Synergy or Anthropic.
