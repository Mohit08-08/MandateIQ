"""
MandateIQ — synthetic data generator.

Generates two files:
  1. mandate_retry_history.csv  — ~2000 historical attempts WITH outcomes,
     for training model.py on Day 4.
  2. active_batch.csv           — 50+ currently-failed mandates (no outcomes
     shown) for the final agent-vs-baseline demo/evaluation.
  3. active_batch_hidden_outcomes.csv — the TRUE outcomes for active_batch,
     kept separate so the model/policy never sees them during decision-making.
     Only used afterward to score results.

Usage:
    pip install pandas numpy --break-system-packages
    python data_gen.py

All generative constants are declared here, named and commented, so the
methodology is fully auditable. See day2_schema.md for the full writeup.
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta
from pathlib import Path

# Paths resolved relative to THIS file's location, not the current working
# directory — so this works whether you run "python data_gen.py" from
# inside src/ or "python src/data_gen.py" from the project root.
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Reproducibility — same seed always produces the same data.
# ---------------------------------------------------------------------------
SEED = 42
rng = np.random.default_rng(SEED)

# ---------------------------------------------------------------------------
# Generative constants (documented assumptions — see day2_schema.md).
# Lock these before looking at any model results.
# ---------------------------------------------------------------------------
BASE_LOGIT = -0.2                 # baseline tendency, roughly ~45% base success
SALARY_WINDOW_BOOST = 0.9         # days 1-3 and 28-31 of the month
DAY_OF_WEEK_EFFECT = {            # Mon=0 ... Sun=6; weekends slightly lower
    0: 0.05, 1: 0.05, 2: 0.05, 3: 0.05, 4: 0.0, 5: -0.25, 6: -0.3,
}
AMOUNT_TIER_EFFECT = {"low": 0.3, "medium": 0.0, "high": -0.35}
ATTEMPT_FATIGUE = 0.15            # each subsequent retry slightly less likely
NOISE_STD = 0.6                   # random unexplained variation

BANKS = {
    # bank_name: (reliability_tier, logit_effect)
    "Bank A (Tier1)": ("Tier1", 0.5),
    "Bank B (Tier1)": ("Tier1", 0.45),
    "Bank C (Tier1)": ("Tier1", 0.4),
    "Bank D (Tier2)": ("Tier2", 0.1),
    "Bank E (Tier2)": ("Tier2", 0.05),
    "Bank F (Tier2)": ("Tier2", 0.0),
    "Bank G (Tier3)": ("Tier3", -0.4),
    "Bank H (Tier3)": ("Tier3", -0.5),
}
BANK_NAMES = list(BANKS.keys())
BANK_WEIGHTS = np.array([0.15, 0.13, 0.12, 0.13, 0.12, 0.1, 0.13, 0.12])
BANK_WEIGHTS = BANK_WEIGHTS / BANK_WEIGHTS.sum()

PAYER_ARCHETYPES = {
    # archetype: (population_share, logit_effect)
    "reliable": (0.4, 0.7),
    "moderate": (0.4, 0.0),
    "unreliable": (0.2, -0.8),
}

FAILURE_REASONS = [
    "insufficient_funds", "bank_server_error", "account_frozen",
    "limit_exceeded", "technical_decline",
]
FAILURE_REASON_WEIGHTS = [0.45, 0.2, 0.05, 0.1, 0.2]

MAX_ATTEMPTS = 4  # documented retry-cap assumption, see day2_schema.md


def amount_tier(amount: float) -> str:
    if amount < 500:
        return "low"
    elif amount <= 2000:
        return "medium"
    return "high"


def is_salary_window(day_of_month: int) -> bool:
    return day_of_month in {1, 2, 3, 28, 29, 30, 31}


def true_probability(day_of_month, day_of_week, bank_name, payer_archetype,
                      amount_tier_val, attempt_number):
    """The transparent, documented generative formula. See day2_schema.md."""
    logit = BASE_LOGIT
    logit += SALARY_WINDOW_BOOST * is_salary_window(day_of_month)
    logit += BANKS[bank_name][1]
    logit += PAYER_ARCHETYPES[payer_archetype][1]
    logit += DAY_OF_WEEK_EFFECT[day_of_week]
    logit += AMOUNT_TIER_EFFECT[amount_tier_val]
    logit -= ATTEMPT_FATIGUE * (attempt_number - 1)
    logit += rng.normal(0, NOISE_STD)
    return 1 / (1 + np.exp(-logit))


def sample_payer_archetype():
    archetypes = list(PAYER_ARCHETYPES.keys())
    weights = [PAYER_ARCHETYPES[a][0] for a in archetypes]
    return rng.choice(archetypes, p=weights)


def sample_bank():
    return rng.choice(BANK_NAMES, p=BANK_WEIGHTS)


def random_date_in_range(start: date, end: date):
    delta = (end - start).days
    return start + timedelta(days=int(rng.integers(0, delta + 1)))


def generate_payer_pool(n_payers: int):
    """Pre-generate a pool of payers with fixed archetype + tenure + rolling
    historical success rate, so the same payer can appear across multiple
    mandate attempts consistently."""
    payers = []
    for i in range(n_payers):
        archetype = sample_payer_archetype()
        tenure = int(rng.integers(1, 37))
        # historical_success_rate is an OBSERVABLE proxy correlated with but
        # not identical to the hidden archetype — this is the feature the
        # model actually gets to see (no direct archetype leakage).
        archetype_base = {"reliable": 0.8, "moderate": 0.55, "unreliable": 0.3}[archetype]
        historical_rate = float(np.clip(rng.normal(archetype_base, 0.1), 0.05, 0.98))
        payers.append({
            "payer_id": f"payer_{i:05d}",
            "payer_archetype": archetype,  # HIDDEN from model — used only to
                                            # drive true_probability generation
            "payer_tenure_months": tenure,
            "payer_historical_success_rate": round(historical_rate, 3),
        })
    return payers


def generate_attempt_row(mandate_id, payer, attempt_number, attempt_date):
    bank_name = sample_bank()
    subscription_amount = round(float(rng.choice([199, 299, 499, 999, 1499, 2499, 4999])), 2)
    tier = amount_tier(subscription_amount)
    dow = attempt_date.weekday()
    dom = attempt_date.day
    hour = int(rng.integers(6, 23))

    prob = true_probability(dom, dow, bank_name, payer["payer_archetype"],
                             tier, attempt_number)
    outcome = bool(rng.random() < prob)
    failure_reason = rng.choice(FAILURE_REASONS, p=FAILURE_REASON_WEIGHTS)

    return {
        "mandate_id": mandate_id,
        "payer_id": payer["payer_id"],
        "attempt_number": attempt_number,
        "attempt_date": attempt_date.isoformat(),
        "day_of_month": dom,
        "day_of_week": dow,
        "hour_of_day": hour,
        "is_salary_window": is_salary_window(dom),
        "bank_name": bank_name,
        "payer_historical_success_rate": payer["payer_historical_success_rate"],
        "payer_tenure_months": payer["payer_tenure_months"],
        "subscription_amount": subscription_amount,
        "amount_tier": tier,
        "prior_failure_reason": None if attempt_number == 1 else failure_reason,
        "_true_probability": round(float(prob), 4),  # kept for audit only,
                                                       # NOT a model feature
        "outcome_success": outcome,
    }


def generate_training_history(n_mandates=600):
    """Generates mandate_retry_history.csv — historical attempts with
    outcomes, used to TRAIN the model."""
    payers = generate_payer_pool(n_mandates)
    start = date(2025, 1, 1)
    end = date(2026, 6, 30)
    rows = []
    for i, payer in enumerate(payers):
        mandate_id = f"mandate_{i:05d}"
        first_attempt_date = random_date_in_range(start, end)
        attempt_date = first_attempt_date
        for attempt_number in range(1, MAX_ATTEMPTS + 1):
            row = generate_attempt_row(mandate_id, payer, attempt_number, attempt_date)
            rows.append(row)
            if row["outcome_success"]:
                break  # mandate resolved, stop retry chain
            attempt_date = attempt_date + timedelta(days=int(rng.integers(1, 6)))
    return pd.DataFrame(rows)


def generate_active_batch(n_mandates=60):
    """Generates the held-out batch of CURRENTLY-FAILED mandates for the
    final demo. Only the first (failed) attempt is generated here — retry
    decisions for these are made LIVE by the model/policy/baseline in
    run_batch.py, not pre-generated."""
    payers = generate_payer_pool(n_mandates)
    today = date(2026, 8, 1)
    rows = []
    hidden = []
    for i, payer in enumerate(payers):
        mandate_id = f"active_mandate_{i:05d}"
        first_attempt_date = random_date_in_range(today - timedelta(days=10), today)
        row = generate_attempt_row(mandate_id, payer, 1, first_attempt_date)
        # Force this first attempt to have failed (it's the trigger event) —
        # if it happened to sample as success, resample a failed outcome
        # bank/day combo by nudging attempt_number in the formula only for
        # the purposes of this seed record (documented simplification).
        if row["outcome_success"]:
            row["outcome_success"] = False
        true_prob = row.pop("_true_probability")
        hidden.append({"mandate_id": mandate_id, "true_probability_at_first_attempt": true_prob})
        row["retries_used_so_far"] = 0
        rows.append(row)
    batch_df = pd.DataFrame(rows).drop(columns=["outcome_success"])
    hidden_df = pd.DataFrame(hidden)
    return batch_df, hidden_df


if __name__ == "__main__":
    print(f"Generating mandate_retry_history.csv (training data) -> {DATA_DIR}")
    history_df = generate_training_history(n_mandates=600)
    history_df.drop(columns=["_true_probability"]).to_csv(
        DATA_DIR / "mandate_retry_history.csv", index=False
    )
    print(f"  -> {len(history_df)} attempt rows written.")
    print(f"  -> Overall observed success rate: {history_df['outcome_success'].mean():.1%}")

    print("\nGenerating active_batch.csv (held-out demo batch)...")
    batch_df, hidden_df = generate_active_batch(n_mandates=60)
    batch_df.to_csv(DATA_DIR / "active_batch.csv", index=False)
    hidden_df.to_csv(DATA_DIR / "active_batch_hidden_outcomes.csv", index=False)
    print(f"  -> {len(batch_df)} active failed mandates written to active_batch.csv")
    print("  -> Hidden true-probability reference written to "
          "active_batch_hidden_outcomes.csv (do NOT read this in model.py/policy.py)")

    print("\nDone. Next: sanity-check distributions before trusting this data.")
