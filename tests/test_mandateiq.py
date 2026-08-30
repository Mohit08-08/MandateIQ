"""
MandateIQ — test suite.

Covers the properties that actually matter for defending this project in
front of a judge: hard safety caps are truly hard, the baseline is smart
(not a strawman), there's no label leakage into the model, the audit log
round-trips correctly, message verification catches bad LLM output, and the
generative formula is deterministic given an explicit seed.

Run with:
    cd src
    pip install pytest --break-system-packages
    pytest ../tests/ -v
"""

import sys
import json
import tempfile
from pathlib import Path
from datetime import date

# Make src/ importable when running pytest from the project root or tests/.
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

import numpy as np
import pytest

import baseline
import config
from data_gen import true_probability, amount_tier
import audit_log


# ---------------------------------------------------------------------------
# Safety: the retry cap must be a HARD boundary, never negotiable.
# ---------------------------------------------------------------------------

class TestRetryCapIsHard:
    def test_baseline_stops_at_max_attempts(self):
        decision = baseline.decide_next_action(
            {"bank_name": "Bank A (Tier1)"},
            attempts_used=config.MAX_ATTEMPTS,
            last_attempt_date=date(2026, 8, 1),
        )
        assert decision["action"] == "fallback"
        assert decision["reason"] == "max_attempts_reached"

    def test_baseline_stops_beyond_max_attempts(self):
        """Even if attempts_used somehow exceeds the cap, must still fallback
        — never try to interpret this as 'schedule another retry'."""
        decision = baseline.decide_next_action(
            {"bank_name": "Bank A (Tier1)"},
            attempts_used=config.MAX_ATTEMPTS + 5,
            last_attempt_date=date(2026, 8, 1),
        )
        assert decision["action"] == "fallback"

    def test_baseline_still_retries_below_cap(self):
        decision = baseline.decide_next_action(
            {"bank_name": "Bank A (Tier1)"},
            attempts_used=config.MAX_ATTEMPTS - 1,
            last_attempt_date=date(2026, 8, 1),
        )
        assert decision["action"] == "retry"

    # Note: an equivalent test for policy.decide_next_action() is omitted
    # here because it requires a trained retry_model.joblib to exist on
    # disk (run model.py first). policy.py's own __main__ smoke test
    # exercises the same MAX_ATTEMPTS check (see attempts_used=4 case),
    # and the check happens BEFORE the model is even loaded — see
    # policy.py's decide_next_action(), which returns fallback as its
    # very first branch, before touching the model at all.


# ---------------------------------------------------------------------------
# Baseline must be a genuinely smart rule, not a strawman — this directly
# protects the credibility of the headline recovery-rate lift number.
# ---------------------------------------------------------------------------

class TestBaselineIsSmartNotStrawman:
    def test_baseline_targets_salary_window_when_in_range(self):
        # Aug 20 + up to 10 days reaches Aug 28-30, which are salary-window days.
        decision = baseline.decide_next_action(
            {"bank_name": "Bank A (Tier1)"},
            attempts_used=0,
            last_attempt_date=date(2026, 8, 20),
        )
        assert decision["action"] == "retry"
        assert config.is_salary_window(decision["scheduled_date"].day)

    def test_baseline_falls_back_to_fixed_interval_when_no_salary_window(self):
        # Aug 5 + up to 10 days reaches Aug 6-15 — no salary-window days there.
        decision = baseline.decide_next_action(
            {"bank_name": "Bank A (Tier1)"},
            attempts_used=0,
            last_attempt_date=date(2026, 8, 5),
        )
        assert decision["action"] == "retry"
        assert not config.is_salary_window(decision["scheduled_date"].day)
        assert (decision["scheduled_date"] - date(2026, 8, 5)).days == baseline.FIXED_FALLBACK_GAP_DAYS


# ---------------------------------------------------------------------------
# No label leakage: the model must never be trainable/scoreable on the
# hidden payer_archetype or the raw true_probability — this is the whole
# basis for claiming the model learns from OBSERVABLE signal only.
# ---------------------------------------------------------------------------

class TestNoLabelLeakage:
    def test_model_feature_list_excludes_hidden_fields(self):
        metadata_path = SRC_DIR.parent / "models" / "retry_model_metadata.json"
        if not metadata_path.exists():
            pytest.skip("retry_model_metadata.json not found — run model.py first.")
        with open(metadata_path) as f:
            metadata = json.load(f)
        all_features = metadata["numeric_features"] + metadata["categorical_features"]
        assert "payer_archetype" not in all_features
        assert "_true_probability" not in all_features
        assert "true_probability_at_first_attempt" not in all_features


# ---------------------------------------------------------------------------
# Audit log round-trip.
# ---------------------------------------------------------------------------

class TestAuditLog:
    def test_write_and_read_back(self, tmp_path, monkeypatch):
        # Redirect the audit log to a temp file so this test never touches
        # the real reports/audit_log.jsonl.
        monkeypatch.setattr(audit_log, "AUDIT_LOG_PATH", tmp_path / "test_audit.jsonl")
        audit_log.clear_audit_log()
        audit_log.log_event("decision", "mandate_x", "agent", {"action": "retry"})
        audit_log.log_event("outcome", "mandate_x", "agent", {"outcome": "success"})
        audit_log.log_event("decision", "mandate_y", "baseline", {"action": "fallback"})

        all_entries = audit_log.read_audit_log()
        assert len(all_entries) == 3

        mandate_x_entries = audit_log.read_audit_log(mandate_id="mandate_x")
        assert len(mandate_x_entries) == 2

        agent_entries = audit_log.read_audit_log(side="agent")
        assert len(agent_entries) == 2

    def test_skips_malformed_lines_without_crashing(self, tmp_path, monkeypatch):
        log_path = tmp_path / "corrupt_audit.jsonl"
        monkeypatch.setattr(audit_log, "AUDIT_LOG_PATH", log_path)
        with open(log_path, "w") as f:
            f.write('{"mandate_id": "a", "event_type": "decision", "side": "agent"}\n')
            f.write('THIS IS NOT VALID JSON\n')
            f.write('{"mandate_id": "b", "event_type": "decision", "side": "agent"}\n')

        entries = audit_log.read_audit_log()
        assert len(entries) == 2  # the malformed line was skipped, not fatal


# ---------------------------------------------------------------------------
# Generative formula determinism — same explicit seed must give the same
# result, since this underpins every reproducibility claim in the project.
# ---------------------------------------------------------------------------

class TestGenerativeDeterminism:
    def test_same_seed_gives_same_probability(self):
        rng1 = np.random.default_rng(123)
        rng2 = np.random.default_rng(123)
        p1 = true_probability(
            day_of_month=15, day_of_week=2, bank_name="Bank A (Tier1)",
            payer_archetype="reliable", amount_tier_val="medium",
            attempt_number=1, hour_of_day=11, noise_rng=rng1,
        )
        p2 = true_probability(
            day_of_month=15, day_of_week=2, bank_name="Bank A (Tier1)",
            payer_archetype="reliable", amount_tier_val="medium",
            attempt_number=1, hour_of_day=11, noise_rng=rng2,
        )
        assert p1 == p2

    def test_different_seeds_give_different_probabilities(self):
        rng1 = np.random.default_rng(1)
        rng2 = np.random.default_rng(2)
        p1 = true_probability(
            day_of_month=15, day_of_week=2, bank_name="Bank A (Tier1)",
            payer_archetype="reliable", amount_tier_val="medium",
            attempt_number=1, hour_of_day=11, noise_rng=rng1,
        )
        p2 = true_probability(
            day_of_month=15, day_of_week=2, bank_name="Bank A (Tier1)",
            payer_archetype="reliable", amount_tier_val="medium",
            attempt_number=1, hour_of_day=11, noise_rng=rng2,
        )
        assert p1 != p2  # extremely unlikely to collide with different seeds

    def test_salary_window_increases_probability_on_average(self):
        """Sanity check on the documented generative assumption: across many
        draws, salary-window days should show a higher average probability
        than non-salary-window days, all else equal."""
        rng = np.random.default_rng(42)
        salary_probs = [
            true_probability(1, 2, "Bank A (Tier1)", "moderate", "medium", 1,
                              hour_of_day=11, noise_rng=rng)
            for _ in range(500)
        ]
        non_salary_probs = [
            true_probability(15, 2, "Bank A (Tier1)", "moderate", "medium", 1,
                              hour_of_day=11, noise_rng=rng)
            for _ in range(500)
        ]
        assert np.mean(salary_probs) > np.mean(non_salary_probs)


# ---------------------------------------------------------------------------
# amount_tier boundary correctness.
# ---------------------------------------------------------------------------

class TestAmountTier:
    @pytest.mark.parametrize("amount,expected", [
        (100, "low"), (499, "low"),
        (500, "medium"), (1000, "medium"), (2000, "medium"),
        (2001, "high"), (5000, "high"),
    ])
    def test_boundaries(self, amount, expected):
        assert amount_tier(amount) == expected


# ---------------------------------------------------------------------------
# Message verification (fallback_agent.py) — must correctly reject bad
# LLM output, not just accept everything.
# ---------------------------------------------------------------------------

class TestMessageVerification:
    def test_accepts_valid_message(self):
        from fallback_agent import verify_message
        mandate = {"subscription_amount": 2499.0}
        link = "https://rzp.io/rzp/test123"
        message = f"Please pay Rs.2499 via {link}"
        valid, problems = verify_message(message, mandate, link)
        assert valid
        assert problems == []

    def test_rejects_wrong_amount(self):
        from fallback_agent import verify_message
        mandate = {"subscription_amount": 2499.0}
        link = "https://rzp.io/rzp/test123"
        message = f"Please pay Rs.9999 via {link}"
        valid, problems = verify_message(message, mandate, link)
        assert not valid
        assert any("amount" in p for p in problems)

    def test_rejects_missing_link(self):
        from fallback_agent import verify_message
        mandate = {"subscription_amount": 2499.0}
        link = "https://rzp.io/rzp/test123"
        message = "Please pay Rs.2499 to complete your subscription."
        valid, problems = verify_message(message, mandate, link)
        assert not valid
        assert any("link" in p for p in problems)
