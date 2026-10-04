---
description: Make it the practice's own: add a field, a fee type, a stage template or a rule, in plain language. The migration is written, applied and tested.
---

# /customise

The operator describes a change, for example "add a discipline field to stages", "our standard residential job has five stages", "flag a stage when the fee used runs 15 points ahead", "claims get 15 working days in our contracts", "bill different rates for council clients".

1. Read `supabase/migrations/`, `scripts/lib/domain.mjs` and the matching command recipe.
2. If it is a setting (tax rate, payment terms, claim response days, utilisation target, burn tolerance, insurance), change it with `node scripts/practice.mjs set practice_profile ...`. A rate or registration is `set staff ...`. No code.
3. Otherwise write the next numbered migration (`supabase/migrations/0002_<what>.sql`). Never edit an applied migration. Update `fields` in `scripts/lib/domain.mjs` if the field should be writable, the queries, and the recipe in `.claude/commands/`.
4. Back up first: `node scripts/practice.mjs export backup.json`. Apply with `npm run migrate`, then `npm test`. Add a test for the new rule in `scripts/smoke.mjs`.
5. Show before and after on real records.

A client portal, a phone timesheet app, a Gantt planner or a connection to Xero is a separate build, not a customisation here.
