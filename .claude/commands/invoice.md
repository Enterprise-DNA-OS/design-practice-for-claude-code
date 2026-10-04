---
description: Raise a draft invoice for a project: every stage's work not yet invoiced plus rechargeable disbursements. Never invoices the same work twice.
---

# /invoice

Run:

```bash
node scripts/practice.mjs invoice <project>
```

Show the draft lines and total. Issuing is a separate step.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
