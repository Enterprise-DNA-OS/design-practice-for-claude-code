# Moving off Synergy

Synergy keeps a practice's projects, stages, fees, time and invoices. Getting them out is two reports saved as CSV, and getting them in is two commands. Do it on a Friday afternoon, run both systems for the next week, and stop entering time in Synergy once the numbers agree.

## 1. Export from Synergy

Synergy exports any report to PDF or Excel from the grid icon at the top right once the report has run ([How to Export a Report](https://help.totalsynergy.com/en/articles/7193061-how-to-export-a-report)). Open the Excel file and save it as CSV.

- **Project breakdown.** One row per stage. The importer reads the field names Synergy's own Project Breakdown import template uses ([Importing Project Financials](https://help.totalsynergy.com/en/articles/6211213-how-to-import-project-financials)): Project Number, Project Name, Client, Phase Name, Stage Name, Fee Type, Stage Status, Stage Fee, Contract Value, Contract %, Budget, Invoiced Value, Stage Complete %, Stage Manager, Stage Start Date and Stage End Date. Build a custom report with those columns, or export the Project Breakdown list and rename the headers to match. Only Project Number and Stage Name are required. A first column marked `Skip` leaves that row out, as in Synergy's template.
- **Timesheets.** Run the Timesheet report for the period you want (it totals hours by staff, project, stage and day) and save it as CSV with columns Staff, Project, Stage, Date, Hours and, if you have it, Description. Project can be the number or the name.

Synergy prints amounts excluding tax, which is what this system stores.

## 2. Import

Add your people first, with their charge and cost rates, so time comes across at the right rates: `/add` with `staff`.

```bash
node scripts/practice.mjs import synergy breakdown.csv --dry-run --date-order=DMY
node scripts/practice.mjs import synergy breakdown.csv --date-order=DMY
node scripts/practice.mjs import synergy timesheets.csv --timesheets --dry-run --date-order=DMY
node scripts/practice.mjs import synergy timesheets.csv --timesheets --date-order=DMY
```

`--dry-run` runs the whole file and writes nothing, so you see the counts first. `--date-order=DMY` reads 03/02/2026 as 3 February; ISO dates need no flag. Each file is one transaction: one bad row and nothing from that file is written, and the error names the row. Both imports can be run again: projects match on number, stages on project and name, and timesheet rows on their content, so nothing doubles.

## What maps

| Synergy | Here |
|---|---|
| Project Number, Project Name | `projects.number`, `projects.name` |
| Client | `clients.name` (created if new) |
| Phase Name, Stage Name | `stages.phase`, `stages.name` |
| Fee Type: Fixed Fee, Hourly Rates, Capped Rates, Percent of Project, No Billing | `stages.fee_type`: fixed, hourly, capped, percent, none |
| Stage Status: Proposal, In Progress, Complete, On Hold | `stages.status`: proposal, active, complete, on_hold |
| Stage Fee, or Contract Value times Contract % | `stages.fee` |
| Contract Value, Contract %, Budget | `projects.contract_value`, `stages.contract_pct`, `stages.budget` |
| Stage Complete % | `stages.percent_complete` |
| Invoiced Value | a paid opening-balance invoice on the stage, so work in progress starts from the right figure |
| Stage Manager | `stages.manager_id`, when the name matches a person already added |
| Timesheet Staff, Project, Stage, Date, Hours, Description | `time_entries`, at the person's current charge and cost rates unless the file has a Charge Rate column |

## What does not carry over

- **Invoice history line by line.** Only the invoiced total per stage comes across. Keep Synergy's invoice PDFs, or export the invoice list and ask Claude Code to load it.
- **Uninvoiced expenses (disbursements).** Synergy imports these on a separate WIP sheet. Add them with `/expense`.
- **Rate groups, cost centres, disciplines and tax codes.** One charge rate and one cost rate per person here. Add rate groups with `/customise` if you bill different rates per client.
- **Resourcing plans, leave, CRM leads, HR records and documents (PIM, transmittals).** Re-enter the next four weeks of plans with `/allocate`; the rest stays in Synergy or wherever you keep it.
- **Staff names that do not match.** A timesheet name with no matching person is added with zero rates, and the import says who. Set their rates with `/set`.

A different export, or columns named differently? Ask Claude Code to map it: "here is our Synergy export, map these columns to the import". Mapping a practice's real data across is also part of what Enterprise DNA does when it sets this up for you.
