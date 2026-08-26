# MandateIQ — Day 2: Synthetic Data Schema & Generative Methodology

## Why this doc exists
This is the piece your whole project's credibility rests on. Every number in your
final demo — the recovery-rate lift, the baseline comparison — is only as honest
as this generative process. Document it clearly enough that a skeptical judge
could read this section and verify you didn't rig the data to favor your model.

## Two datasets, two purposes

### 1. `mandate_retry_history.csv` — for TRAINING the model
Historical mandate retry attempts with **known outcomes**. This is what
`model.py` (Day 4) learns from. ~2,000 rows, each row = one retry attempt.

### 2. `active_batch.csv` — for the DEMO / final evaluation
A batch of 50+ **currently-failed** mandates that haven't been retried yet.
This is what your agent and the baseline both compete on in the final demo.
Outcomes for these are held out (generated but not shown to model/policy —
only used afterward to score which decisions were actually correct).

Same schema for both files (below), except `active_batch.csv` doesn't include
`outcome_success` as a visible column during decision-making — it's generated
and stored separately so you can score results after the fact without leaking it.

## Schema (both files)

| Column | Type | Description |
|---|---|---|
| `mandate_id` | string | Unique ID for the subscription/mandate |
| `payer_id` | string | Unique ID for the customer |
| `attempt_number` | int (1-4) | Which retry attempt this is (1 = original debit) |
| `attempt_date` | date | Date of this attempt |
| `day_of_month` | int (1-31) | Derived from attempt_date |
| `day_of_week` | int (0=Mon–6=Sun) | Derived from attempt_date |
| `hour_of_day` | int (0-23) | Hour the debit was attempted |
| `is_salary_window` | bool | True if day_of_month in {1,2,3,28,29,30,31} |
| `bank_name` | categorical | One of 8 synthetic bank archetypes (see below) |
| `payer_archetype` | categorical | `reliable` / `moderate` / `unreliable` (hidden driver, not given to model directly — model only sees derived features below) |
| `payer_historical_success_rate` | float 0-1 | Rolling avg success rate for this payer BEFORE this mandate (engineered feature, not leaking current outcome) |
| `payer_tenure_months` | int | How long this payer has been subscribed |
| `subscription_amount` | float | ₹ amount of the mandate |
| `amount_tier` | categorical | `low` (<₹500) / `medium` (₹500–2000) / `high` (>₹2000) |
| `prior_failure_reason` | categorical | `insufficient_funds` / `bank_server_error` / `account_frozen` / `limit_exceeded` / `technical_decline` |
| `retries_used_so_far` | int | Only relevant for `active_batch.csv` |
| `outcome_success` | bool | Only in `mandate_retry_history.csv`. Held separately for `active_batch.csv`. |

## The generative process (documented, not a black box)

For each attempt, compute a **true success probability** from a transparent
logistic formula, then sample the actual outcome as a coin flip weighted by
that probability. This means: even a "correct" decision won't always succeed
(realistic — probability isn't certainty), which is itself an important
property to point out in your pitch (it's WHY you report probabilistic lift,
not "we always win").

```
true_logit = BASE
    + SALARY_WINDOW_BOOST * is_salary_window
    + BANK_RELIABILITY[bank_name]
    + PAYER_ARCHETYPE_EFFECT[payer_archetype]
    + DAY_OF_WEEK_EFFECT[day_of_week]      (weekends slightly lower — banking ops)
    + AMOUNT_TIER_EFFECT[amount_tier]       (higher amount = slightly lower prob)
    - ATTEMPT_FATIGUE * (attempt_number - 1) (later retries slightly less likely to succeed if underlying issue persists)
    + noise ~ Normal(0, NOISE_STD)

true_probability = sigmoid(true_logit)
outcome_success  = Bernoulli(true_probability)
```

**All constants (BASE, SALARY_WINDOW_BOOST, etc.) are declared at the top of
`data_gen.py` as named, commented values — not buried magic numbers.** This is
what makes the methodology auditable: someone reading your code can see
exactly what assumptions drive the "ground truth," and you can defend each one
individually if asked (e.g., "salary-window boost is based on the general,
widely-observed pattern that Autopay success rates rise near the 1st of the
month — we don't have real Razorpay data, so we've made this an explicit,
documented assumption rather than hiding it").

## Critical design rule: no label leakage
The model (Day 4) and the policy engine (Day 5) NEVER see `payer_archetype`
or the `true_logit`/`true_probability` directly — only the observable,
engineered features (`payer_historical_success_rate`, `bank_name`,
`day_of_month`, etc.). This mirrors reality: you never get to see a customer's
"true reliability score," only their observable history. This distinction
matters if a judge asks "isn't the model just reading the answer key" — the
answer is no, and this document is the proof.

## Bank archetypes (documented assumption, not arbitrary)
8 synthetic banks split into 3 reliability tiers — this is a modeling
simplification, disclosed as such:
- **Tier 1 (high reliability):** 3 banks, few server-error failures
- **Tier 2 (medium):** 3 banks, occasional server issues
- **Tier 3 (lower reliability):** 2 banks, more frequent technical declines

## Retry cap assumption
Max 4 total attempts per mandate (1 original + 3 retries), after which the
mandate falls back to the non-retry recovery path (payment link + notification).
This is a documented, conservative assumption modeled on typical Autopay retry
practices — call this out explicitly as an assumption in your README, since
exact NPCI limits vary and you don't have authoritative access to confirm the
precise number.

## Day 2 checklist
- [ ] Read through `data_gen.py` (below) and understand every constant
- [ ] Run it, confirm both CSVs generate without errors
- [ ] Sanity-check distributions (next section) before trusting the data
- [ ] Do NOT tune constants after seeing model results on Day 4 — that would be
      the exact "rigged baseline" problem this doc is designed to prevent.
      Lock these values today.
