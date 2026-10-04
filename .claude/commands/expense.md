---
description: Record a disbursement on a stage. Rechargeable unless --not-rechargeable.
---

# /expense

Run:

```bash
node scripts/practice.mjs expense <project> <stage> <YYYY-MM-DD> <amount> <what it was> [--not-rechargeable]
```

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
