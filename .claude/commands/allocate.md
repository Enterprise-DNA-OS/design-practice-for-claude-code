---
description: Plan hours for a person on a stage for a week (the Monday). Replaces the earlier plan for that week.
---

# /allocate

Run:

```bash
node scripts/practice.mjs allocate <person> <project> <stage> <Monday YYYY-MM-DD> <hours>
```

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
