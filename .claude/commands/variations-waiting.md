---
description: Variations not yet sent, or sent more than 14 days ago with no answer.
---

# /variations-waiting

Run:

```bash
node scripts/practice.mjs variations-waiting
```

Offer to draft a follow-up for each submitted one.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
