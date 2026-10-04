---
description: Check the records against the rules a design practice works under (terms of appointment, payment claims and schedules, Form 1, registration, insurance), each with its source.
---

# /compliance

Run:

```bash
node scripts/practice.mjs compliance
```

1. Group by rule. For each, show the record, the detail and the source from `docs/compliance.md`.
2. For each breach, draft the fix the operator can approve: `/draft-terms` for missing terms, `/draft-reminder` for a claim with no schedule, a note to renew a registration or the insurance. Drafts go to `drafts/`. Never send.
3. If a rule in `docs/compliance.md` looks out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check in `scripts/lib/domain.mjs` together.

Nothing here is legal advice. The doc records the rules the practice has told the system to check, with sources.
