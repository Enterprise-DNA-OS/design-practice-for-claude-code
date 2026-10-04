---
description: Record money received against an invoice. Refuses more than the balance.
---

# /payment

Run:

```bash
node scripts/practice.mjs payment <invoice> <amount> <bank reference>
```

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
