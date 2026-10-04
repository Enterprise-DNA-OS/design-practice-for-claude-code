---
description: Add a record: a person, client, project, stage, leave or the practice profile.
---

# /add

Run:

```bash
node scripts/practice.mjs add <type> <json>
```

Show the writable fields if unsure: run add with a bad field and read the error.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
