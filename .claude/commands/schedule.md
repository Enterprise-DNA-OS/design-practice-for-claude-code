---
description: Record a payment schedule received against a payment claim, with the scheduled amount.
---

# /schedule

Run:

```bash
node scripts/practice.mjs schedule <invoice> <YYYY-MM-DD> <amount incl. tax>
```

If it schedules less than claimed, say by how much.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
