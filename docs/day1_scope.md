# MandateIQ — Day 1 Scope Lock

## The 3-sentence pitch (memorize this)
UPI Autopay/mandate debits fail on a fixed retry schedule today, wasting scarce NPCI-capped retry attempts on low-probability timing. MandateIQ uses a trained probability model to pick *when* to retry each failed mandate, enforces hard safety caps in code (not prompts), and falls back to a real Razorpay test-mode payment link when retries are exhausted — with every decision logged. It's benchmarked against a documented smart-rule baseline on a 50+ record synthetic batch, so the recovery-rate lift is honest, not cherry-picked.

## What's IN scope (Day 1–15)
- Synthetic mandate-failure dataset generator (documented methodology)
- Retry-success probability model (scikit-learn, trained/validated on held-out split)
- Deterministic policy engine: retry caps, retry windows, stop rules (hard-enforced in code)
- Smart-rule baseline for comparison (NOT a strawman)
- Batch runner + outcome simulator
- Gemini-powered fallback message generator (for exhausted-retry mandates only)
- Razorpay test-mode Payment Links integration (fallback step only)
- Full audit trail (every decision + reasoning, structured JSON)
- Dashboard: recovery-rate lift chart, retries-saved, exception list, per-record drill-down
- One adversarial demo case: a mandate that exhausts retries and falls back gracefully

## What's OUT of scope (do not build, no matter how tempting)
- Any second agent / negotiation protocol / "agentic commerce" scope creep
- Real bank/UPI/NPCI integration of any kind
- Real customer data of any kind — synthetic only, always labeled as such
- A generic chatbot UI as "the product" — the model + policy engine ARE the product
- Multi-loss-type platform (checkout abandonment, receivables, etc.) — one loss type, done well
- Online/adaptive learning — cut from the 15-day plan; static model is enough for a real ML story

## Success metric (the one number the whole pitch hangs on)
**Recovery-rate lift (%) of MandateIQ vs. the smart-rule baseline, on the same held-out 50+ record batch, reproducible across repeated runs.**

Secondary metrics: retries saved (efficiency), zero retry-cap violations (safety), audit-trail completeness (100% of decisions traceable).

## Architecture sketch (text version — turn into a diagram on Day 13)

```
data_gen.py
   |
   v
mandates.csv  (synthetic failed mandates: failure_reason, bank, timestamp,
               payer_history_features, TRUE_success_probability [hidden from model])
   |
   +----------------------+
   |                       |
   v                       v
model.py               baseline.py
(trained probability   (documented smart
 estimator)             rule schedule)
   |                       |
   v                       v
policy.py  <----------------
(deterministic state machine: consumes probability estimate,
 enforces retry cap / window / stop rules, emits next action)
   |
   v
run_batch.py
(executes simulated retries against TRUE probability surface;
 on retry-cap exhaustion -> calls fallback_agent.py)
   |
   +------------------------------+
   |                               |
   v                               v
fallback_agent.py              audit_log.jsonl
(Gemini: generates             (every decision + reasoning,
 payment-link message)          structured, queryable)
   |
   v
Razorpay test-mode
Payment Links API
(real, free, test-mode link)
   |
   v
dashboard (Streamlit / HTML+Chart.js)
- recovery-rate lift chart (agent vs baseline)
- retries-saved counter
- exception list
- per-record drill-down (reads audit_log.jsonl)
```

## Key design decision to defend in Q&A
**The LLM never makes the retry-timing decision.** `model.py` (scikit-learn) + `policy.py` (deterministic rules) make every money-affecting decision. Gemini only (a) explains a decision in plain language and (b) drafts the fallback message copy. This is the answer to "is the AI doing meaningful work / could this be simple rules" — the ML model is genuinely predictive and validated; the LLM is scoped to what LLMs are actually good at.

## Day 1 checklist
- [ ] Razorpay test-mode account created, API keys generated and sanity-checked
- [ ] Gemini API key generated and sanity-checked
- [ ] This scope doc reviewed — nothing in "out of scope" has crept back in
- [ ] Architecture sketch makes sense to you well enough to explain out loud without notes
