# MandateIQ

An ML-driven, policy-bounded agent that decides *when* to retry a failed UPI
Autopay/e-mandate debit, instead of using a fixed retry schedule — benchmarked
against a documented smart-rule baseline on a synthetic batch, with hard
safety caps and a full audit trail.

**Built for Razorpay AI Buildathon 2026 — AI Revenue Recovery track.**

> Note: this README is a working placeholder. Full writeup (methodology,
> results, how to run, limitations) lands here on Day 13.

## Status
- [x] Day 1-2: Synthetic mandate-failure data generation, documented methodology
- [x] Day 4: Retry-success probability model, trained + validated (AUC 0.736 on held-out test set)
- [x] Day 5: Smart-rule baseline + policy engine (hard-bounded)
- [ ] Day 6: Batch runner + outcome simulation (agent vs. baseline)
- [ ] Day 7-8: Fallback recovery agent (Gemini + Razorpay test-mode Payment Links)
- [ ] Day 9: Audit trail
- [ ] Day 10-11: Dashboard
- [ ] Day 12: Full validation run
- [ ] Day 13: Full README + architecture diagram
- [ ] Day 14-15: Pitch video + submission

## Quick start
```bash
pip install -r requirements.txt
cd src
python data_gen.py      # generates data/ CSVs
python model.py          # trains and validates the model
python baseline.py       # smoke-test the baseline
python policy.py         # smoke-test the agent's policy engine
```

## Why this matters (short version)
UPI Autopay/e-mandate debits fail on a fixed retry schedule today, wasting
NPCI-capped retry attempts on low-probability timing. MandateIQ predicts
*when* a retry is most likely to succeed, enforces hard safety caps in code
(not prompts), and falls back to a real Razorpay test-mode payment link when
retries are exhausted — with every decision logged and explainable.

See `docs/day2_schema.md` for the full synthetic-data methodology.
