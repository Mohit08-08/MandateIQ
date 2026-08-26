"""
MandateIQ — baseline.py

The "smart rule" baseline: what a competent ops team would do WITHOUT ML.
This is deliberately NOT a strawman (e.g. "always retry tomorrow") — it
already encodes the one piece of domain knowledge any experienced payments
team would know: retries succeed more near salary-credit windows. This is
important: your model's lift has to beat THIS, not a naive baseline, or the
result isn't credible. See day2_schema.md / MandateIQ Day5 notes.

Same decision interface as policy.py so run_batch.py can compare them
apples-to-apples:
    decide_next_action(mandate_row, attempts_used, last_attempt_date)
        -> {"action": "retry", "scheduled_date": date, "scheduled_hour": int}
        -> {"action": "fallback", "reason": str}
"""

from datetime import date, timedelta

MAX_ATTEMPTS = 4            # must match data_gen.py's MAX_ATTEMPTS assumption
RETRY_WINDOW_DAYS = 10       # how far ahead we're willing to schedule a retry
MIN_GAP_DAYS = 1             # don't retry the very next day
FIXED_FALLBACK_GAP_DAYS = 3  # if no salary window in range, retry every N days
DEFAULT_HOUR = 11            # simple fixed hour choice (no time-of-day logic)


def is_salary_window(day_of_month: int) -> bool:
    return day_of_month in {1, 2, 3, 28, 29, 30, 31}


def decide_next_action(mandate_row: dict, attempts_used: int, last_attempt_date: date):
    """The smart-rule baseline decision.

    Logic: look ahead up to RETRY_WINDOW_DAYS days from the last attempt.
    If a salary-window day (1-3 or 28-31 of the month) falls within that
    window and respects MIN_GAP_DAYS, schedule the retry there — this
    mirrors what a smart ops analyst would do by hand. Otherwise, fall back
    to a fixed FIXED_FALLBACK_GAP_DAYS interval.
    """
    if attempts_used >= MAX_ATTEMPTS:
        return {"action": "fallback", "reason": "max_attempts_reached"}

    candidate_dates = [
        last_attempt_date + timedelta(days=d)
        for d in range(MIN_GAP_DAYS, RETRY_WINDOW_DAYS + 1)
    ]
    salary_window_dates = [d for d in candidate_dates if is_salary_window(d.day)]

    if salary_window_dates:
        chosen_date = salary_window_dates[0]  # nearest salary-window day
    else:
        chosen_date = last_attempt_date + timedelta(days=FIXED_FALLBACK_GAP_DAYS)

    return {
        "action": "retry",
        "scheduled_date": chosen_date,
        "scheduled_hour": DEFAULT_HOUR,
        "reasoning": (
            "nearest salary-window day within lookout window"
            if salary_window_dates else
            f"no salary-window day within {RETRY_WINDOW_DAYS}d; fixed {FIXED_FALLBACK_GAP_DAYS}d interval"
        ),
    }


if __name__ == "__main__":
    # Quick smoke test
    test_row = {"bank_name": "Bank A (Tier1)"}
    for attempts_used, last_date in [
        (0, date(2026, 8, 5)),
        (1, date(2026, 8, 20)),
        (3, date(2026, 8, 22)),
        (4, date(2026, 8, 25)),
    ]:
        decision = decide_next_action(test_row, attempts_used, last_date)
        print(f"attempts_used={attempts_used}, last_attempt={last_date} -> {decision}")
