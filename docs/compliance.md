# Compliance checks

`/compliance` (or `node scripts/practice.mjs compliance`) checks the records against the rules below. Checked 4 October 2026. The New Zealand rules apply when the practice profile's `jurisdiction` is `NZ`; the Australian one when it is `AU`. They show gaps in the records against the cited rule. They are not legal advice and a clean result is not a certificate.

| Rule | What it flags | Source |
|---|---|---|
| TERMS-OF-APPOINTMENT | A proposal or active project with billable time logged and no signed terms, or no instruction to proceed. Applies when `registered_architects` is on. | [Registered Architects Rules 2006](https://www.legislation.govt.nz/regulation/public/2006/0161/latest/whole.html) r58A (in force from 1 January 2018): a registered architect provides professional services only once written terms of appointment have been provided and the client, having agreed them, has instructed the architect to proceed. Record both with `/sign-terms`. `/draft-terms` drafts the letter. |
| CLAIM-NO-SCHEDULE (NZ) | An invoice served as a payment claim, still owing, with no payment schedule recorded and more working days gone than `claim_response_days` (20 by default). | [Construction Contracts Act 2002](https://www.legislation.govt.nz/act/public/2002/0046/latest/whole.html) s22: if the payer does not give a payment schedule within the time in the contract, or 20 working days after the claim is served, the payer becomes liable to pay the claimed amount. Design, engineering and quantity surveying work has been covered since 1 September 2016 (Construction Contracts Amendment Act 2015), for contracts entered into or renewed after that date. Working days here count Monday to Friday and do not take out public holidays or the Christmas break: check the date before relying on it. |
| CLAIM-NO-SCHEDULE (AU) | The same check, with `claim_response_days` set to 10. | [Building and Construction Industry Security of Payment Act 1999 (NSW)](https://legislation.nsw.gov.au/view/html/inforce/current/act-1999-046) s14(4): a respondent who gives no payment schedule within the contract time or 10 business days becomes liable to pay the claimed amount. Other states have their own Act and periods: set the days to match and cite yours here. |
| CLAIM-FORM-1 (NZ) | A payment claim to a client marked `residential` without Form 1 recorded. `/issue --claim` refuses one without `--form1`. | Construction Contracts Act 2002 s20: a payment claim served on a residential occupier is accompanied by the prescribed outline of the process for responding (Form 1 in the Construction Contracts Regulations 2003). |
| REGISTRATION-CURRENT | A person with a registration recorded (registered architect, chartered engineer) whose expiry has passed or is missing. | The practice's own rule: only people with current registration sign drawings, design features reports or producer statements. Check each person on the public register: [NZ Registered Architects Board](https://www.nzrab.nz) and [Engineering New Zealand](https://www.engineeringnz.org). |
| PI-INSURANCE | Professional indemnity cover with no expiry recorded, or expiring within 30 days. | The practice's own rule. Terms of appointment usually state the cover held, and many client contracts require it. |

## The practice's own fee rules

These are not law. They are the rules the practice sets, and the CLI applies them every time:

- Time is refused on a completed stage (new work needs a variation), on a stage on hold, in the future, or on a completed or lost project. A director can override with `--override="reason"`, and the reason is kept in the audit log.
- Progress cannot drop below the share of the fee already invoiced.
- An invoice raises each stage's work not yet invoiced: earned at the recorded progress for fixed and percentage fees, time at charge rates for hourly, time up to the cap for capped. The same work is never invoiced twice.
- A stage's fee type cannot change once it has been invoiced, and its fee cannot drop below what is invoiced.
- `burn_tolerance` (10 points by default) sets how far the fee used can run ahead of progress before `/fee-tracking` flags it.

Add a rule with `/customise`, one row per rule in this table with its source.
