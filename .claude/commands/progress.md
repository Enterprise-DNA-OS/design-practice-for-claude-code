---
description: Record a stage's percent complete. Refuses to drop below what is already invoiced, and warns when the fee is used faster than the work.
---

# /progress

Run:

```bash
node scripts/practice.mjs progress <project> <stage> <percent>
```

Ask for the percent if not given. Show the stage before and after.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
