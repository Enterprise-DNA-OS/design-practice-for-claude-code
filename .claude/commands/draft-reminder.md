---
description: Draft a payment reminder for an invoice. Where a payment claim got no schedule in time, it says the amount is payable in full.
---

# /draft-reminder

Run:

```bash
node scripts/practice.mjs draft-reminder <invoice>
```

A person sends it.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
