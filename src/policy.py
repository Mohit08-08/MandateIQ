"""
MandateIQ — policy.py

The AGENT's decision-maker. This is the component that makes the "is the AI
doing meaningful work / could this just be rules" question answerable: the
retry-timing CHOICE comes from the trained ML model (retry_model.joblib),
but every hard safety boundary (max attempts, retry window, minimum gap) is
enforced here in plain deterministic code — never left to the model or an
LLM to decide. The model proposes; this function disposes, within bounds
that cannot be violated regardless of what the model predicts.

Same decision interface as baseline.py so run_batch.py can compare them
apples-to-apples:
    decide_next_action(mandate_row, attempts_used, last_attempt_date)
        -> {"action": "retry", "scheduled_date": date, "scheduled_hour": int, ...}
        -> {"action": "fallback", "reason": str}
"""

from datetime import date, timedelta
import joblib
import pandas as pd
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR.parent / "models"

MAX_ATTEMPTS = 4              # matches data_gen.py / baseline.py — same rules,
                               # same cap, so the comparison is fair
RETRY_WINDOW_DAYS = 10         # same lookout window as the baseline, for parity
MIN_GAP_DAYS = 1
CANDIDATE_HOURS = [9, 12, 15, 18, 21]

_model = None  # lazy-loaded singleton


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODELS_DIR / "retry_model.joblib")
    return _model


def is_salary_window(day_of_month: int) -> bool:
    return day_of_month in {1, 2, 3, 28, 29, 30, 31}


def _build_feature_row(mandate_row: dict, attempt_number: int, candidate_date: date, hour: int):
    """Builds the exact feature schema model.py expects, for one candidate
    (date, hour) pair, so we can score it."""
    return {
        "attempt_number": attempt_number,
        "day_of_month": candidate_date.day,
        "hour_of_day": hour,
        "payer_historical_success_rate": mandate_row["payer_historical_success_rate"],
        "payer_tenure_months": mandate_row["payer_tenure_months"],
        "subscription_amount": mandate_row["subscription_amount"],
        "day_of_week": str(candidate_date.weekday()),
        "bank_name": mandate_row["bank_name"],
        "amount_tier": mandate_row["amount_tier"],
        "prior_failure_reason": mandate_row.get("prior_failure_reason") or "none",
        "is_salary_window": str(is_salary_window(candidate_date.day)),
    }


def decide_next_action(mandate_row: dict, attempts_used: int, last_attempt_date: date):
    """The agent's decision, bounded by hard safety rules.

    1. HARD STOP: if attempts_used >= MAX_ATTEMPTS, always fallback.
       This check happens BEFORE the model is even consulted — the cap
       cannot be reasoned around.
    2. Otherwise, score every candidate (date, hour) pair within the
       allowed window using the trained model, pick the highest predicted
       success probability, and schedule there.
    """
    if attempts_used >= MAX_ATTEMPTS:
        return {"action": "fallback", "reason": "max_attempts_reached"}

    model = _get_model()
    next_attempt_number = attempts_used + 1

    candidates = []
    for d_offset in range(MIN_GAP_DAYS, RETRY_WINDOW_DAYS + 1):
        candidate_date = last_attempt_date + timedelta(days=d_offset)
        for hour in CANDIDATE_HOURS:
            candidates.append((candidate_date, hour))

    feature_rows = [
        _build_feature_row(mandate_row, next_attempt_number, d, h)
        for d, h in candidates
    ]
    X = pd.DataFrame(feature_rows)
    probs = model.predict_proba(X)[:, 1]

    best_idx = probs.argmax()
    best_date, best_hour = candidates[best_idx]
    best_prob = float(probs[best_idx])

    return {
        "action": "retry",
        "scheduled_date": best_date,
        "scheduled_hour": best_hour,
        "predicted_success_probability": round(best_prob, 4),
        "reasoning": (
            f"model-selected slot out of {len(candidates)} candidates within "
            f"{RETRY_WINDOW_DAYS}d window; predicted success probability "
            f"{best_prob:.1%} (highest among candidates)"
        ),
    }


if __name__ == "__main__":
    # Quick smoke test — compare against baseline.py's test cases directly.
    import baseline

    test_row = {
        "bank_name": "Bank A (Tier1)",
        "payer_historical_success_rate": 0.7,
        "payer_tenure_months": 12,
        "subscription_amount": 999.0,
        "amount_tier": "medium",
        "prior_failure_reason": "insufficient_funds",
    }
    for attempts_used, last_date in [
        (0, date(2026, 8, 5)),
        (1, date(2026, 8, 20)),
        (3, date(2026, 8, 22)),
        (4, date(2026, 8, 25)),
    ]:
        agent_decision = decide_next_action(test_row, attempts_used, last_date)
        baseline_decision = baseline.decide_next_action(test_row, attempts_used, last_date)
        print(f"attempts_used={attempts_used}, last_attempt={last_date}")
        print(f"  AGENT:    {agent_decision}")
        print(f"  BASELINE: {baseline_decision}")
        print()
