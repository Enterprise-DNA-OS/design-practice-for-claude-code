---
description: Issue a draft invoice: sets the issue and due dates. --claim serves it as a payment claim; a residential occupier needs --form1 once Form 1 is attached.
---

# /issue

Run:

```bash
node scripts/practice.mjs issue <invoice> [--claim] [--form1]
```

Ask whether it is a payment claim. Never pass --form1 unless the operator confirms Form 1 is attached.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
