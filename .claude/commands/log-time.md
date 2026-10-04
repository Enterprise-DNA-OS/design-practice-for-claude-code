---
description: Log hours for a person on a project stage. Refuses future dates, completed stages (that needs a variation) and stages on hold unless a director overrides.
---

# /log-time

Run:

```bash
node scripts/practice.mjs log-time <person> <project> <stage> <YYYY-MM-DD> <hours> [note]
```

Hours are in quarter hours. If the stage is complete, ask whether a variation should be raised before using --override="reason".

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
