---
description: Payment claims still owing: working days since served, the response time, whether a payment schedule came back.
---

# /claims

Run:

```bash
node scripts/practice.mjs claims
```

Flag any where no schedule came back in time: the claimed amount is payable in full.

Use `--json` when combining results. On an ambiguous name, list the candidates and ask; never pick the first. Nothing here sends a message or takes a payment.
