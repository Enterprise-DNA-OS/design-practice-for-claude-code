---
description: Bring projects, stages and timesheets across from Synergy's exports (saved as CSV). Test run first.
---

# /import

Run:

```bash
node scripts/practice.mjs import synergy <file.csv> [--timesheets] --dry-run --date-order=DMY
```

Always --dry-run first and show the counts. Then run without it. Read docs/replace-synergy.md.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
