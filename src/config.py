"""
MandateIQ — config.py

Single source of truth for constants shared across data_gen.py, baseline.py,
policy.py, and run_batch.py. Previously these were duplicated in three
separate files (a real drift risk: changing a retry-cap assumption in one
place without updating the others would silently break the fair-comparison
guarantee between the agent and the baseline). Everything here is imported,
never redefined.
"""

# Retry-cap and scheduling-window assumptions (documented in day2_schema.md).
# Both the agent (policy.py) and the baseline (baseline.py) MUST use the
# exact same values here — that's what makes the recovery-rate comparison
# fair rather than accidentally favoring one side.
MAX_ATTEMPTS = 4            # 1 original attempt + 3 retries, mirrors typical
                             # UPI Autopay/e-mandate retry-count conventions
RETRY_WINDOW_DAYS = 10       # how far ahead either side is willing to schedule
MIN_GAP_DAYS = 1             # neither side may retry the very next day

SALARY_WINDOW_DAYS = {1, 2, 3, 28, 29, 30, 31}


def is_salary_window(day_of_month: int) -> bool:
    """True if this day-of-month falls in the salary-credit window
    (documented assumption — see day2_schema.md)."""
    return day_of_month in SALARY_WINDOW_DAYS
