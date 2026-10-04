# Fixtures

Small, fictional Synergy exports used by `npm test` and handy for a first test run of `/import`.

- `synergy-project-breakdown.csv`: one row per stage, with the field names Synergy's Project Breakdown import template uses (Project Number, Phase Name, Stage Name, Fee Type, Stage Status, Stage Fee, Contract Value, Contract %, Budget, Invoiced Value, Stage Complete %, Stage Manager, Stage Start and End Dates). Dates are day first.
- `synergy-timesheets.csv`: the default Timesheet report saved as CSV: staff, project, stage, date, hours and description. Two identical rows on purpose: both are kept, and a second import adds neither again.

No real practice, person or project is in either file.
