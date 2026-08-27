"""
MandateIQ — run_batch.py

The day the loop closes. Runs BOTH the agent (policy.py) and the baseline
(baseline.py) against the same 60 held-out failed mandates, simulating
whether each scheduled retry actually succeeds using the TRUE (hidden)
generative formula from data_gen.py — the same formula that produced the
training data, so simulated outcomes are consistent with what the model
was trained to predict, without ever leaking the hidden payer_archetype
to the model/policy/baseline themselves.

This is the single most important script in the project: its output is
the recovery-rate lift number your whole demo and pitch hang on.

Usage:
    python run_batch.py
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import date, datetime

import baseline
import policy
import audit_log
from data_gen import true_probability, MAX_ATTEMPTS

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
REPORTS_DIR = SCRIPT_DIR.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

# Separate, documented RNG for the SIMULATION step only — distinct from the
# RNG inside data_gen.py used to generate the original datasets. Seeded so
# results are reproducible run-to-run, but this is simulating "what if we
# retried here" outcomes, not generating new ground-truth data.
SIM_SEED = 777


def load_batch():
    batch = pd.read_csv(DATA_DIR / "active_batch.csv")
    hidden = pd.read_csv(DATA_DIR / "active_batch_hidden_outcomes.csv")
    merged = batch.merge(hidden, on="mandate_id", how="left")
    merged["attempt_date"] = pd.to_datetime(merged["attempt_date"]).dt.date
    return merged


def simulate_outcome(mandate_row, payer_archetype, scheduled_date, scheduled_hour,
                      attempt_number, rng):
    """Uses the SAME transparent formula from data_gen.py to decide whether
    this specific scheduled retry succeeds. This is what makes the
    simulation honest: it's not a new made-up rule, it's the same generative
    truth used to build the training data in the first place."""
    prob = true_probability(
        day_of_month=scheduled_date.day,
        day_of_week=scheduled_date.weekday(),
        bank_name=mandate_row["bank_name"],
        payer_archetype=payer_archetype,
        amount_tier_val=mandate_row["amount_tier"],
        attempt_number=attempt_number,
    )
    return bool(rng.random() < prob)


def run_recovery_workflow(mandate_row, payer_archetype, decide_fn, rng, side_name):
    """Runs ONE mandate through a full decide->act->observe loop until
    either success or fallback. Works identically for the agent
    (policy.decide_next_action) and the baseline (baseline.decide_next_action)
    since both share the same decision interface. Every decision and outcome
    is written to the audit log as it happens (see audit_log.py)."""
    mandate_id = mandate_row["mandate_id"]
    attempts_used = 1  # the initial failed attempt already happened
    last_attempt_date = mandate_row["attempt_date"]
    retries_taken = 0
    log = []

    while True:
        decision = decide_fn(mandate_row.to_dict(), attempts_used, last_attempt_date)

        if decision["action"] == "fallback":
            log.append({"step": retries_taken + 1, "action": "fallback",
                        "reason": decision["reason"]})
            audit_log.log_event("decision", mandate_id, side_name, {
                "action": "fallback",
                "reason": decision["reason"],
                "attempts_used": attempts_used,
            })
            return {
                "recovered": False,
                "recovered_via": "fallback_pending",
                "retries_taken": retries_taken,
                "log": log,
            }

        scheduled_date = decision["scheduled_date"]
        scheduled_hour = decision["scheduled_hour"]
        next_attempt_number = attempts_used + 1

        audit_log.log_event("decision", mandate_id, side_name, {
            "action": "retry",
            "scheduled_date": scheduled_date,
            "scheduled_hour": scheduled_hour,
            "attempt_number": next_attempt_number,
            "reasoning": decision.get("reasoning", ""),
            "predicted_success_probability": decision.get("predicted_success_probability"),
        })

        success = simulate_outcome(
            mandate_row, payer_archetype, scheduled_date, scheduled_hour,
            next_attempt_number, rng
        )
        retries_taken += 1
        log.append({
            "step": retries_taken,
            "action": "retry",
            "scheduled_date": str(scheduled_date),
            "scheduled_hour": scheduled_hour,
            "reasoning": decision.get("reasoning", ""),
            "outcome": "success" if success else "failed",
        })

        audit_log.log_event("outcome", mandate_id, side_name, {
            "scheduled_date": scheduled_date,
            "attempt_number": next_attempt_number,
            "outcome": "success" if success else "failed",
        })

        if success:
            return {
                "recovered": True,
                "recovered_via": "retry",
                "retries_taken": retries_taken,
                "log": log,
            }

        attempts_used = next_attempt_number
        last_attempt_date = scheduled_date
        # loop continues; next iteration's decide_fn call will hit the
        # MAX_ATTEMPTS check and return fallback if exhausted


def run_batch():
    audit_log.clear_audit_log()  # fresh log for this run, no stale entries
    df = load_batch()
    results = []

    for side_name, decide_fn, seed_offset in [
        ("agent", policy.decide_next_action, 0),
        ("baseline", baseline.decide_next_action, 100000),
    ]:
        for _, mandate_row in df.iterrows():
            # Deterministic per-mandate, per-side RNG: reproducible across
            # runs, and using a seed_offset keeps the agent's and baseline's
            # random draws independent (fair — neither side is secretly
            # sharing "lucky" draws with the other).
            mandate_seed = SIM_SEED + seed_offset + int(mandate_row["mandate_id"].split("_")[-1])
            rng = np.random.default_rng(mandate_seed)

            outcome = run_recovery_workflow(
                mandate_row, mandate_row["payer_archetype"], decide_fn, rng, side_name
            )
            results.append({
                "side": side_name,
                "mandate_id": mandate_row["mandate_id"],
                "subscription_amount": mandate_row["subscription_amount"],
                "recovered": outcome["recovered"],
                "retries_taken": outcome["retries_taken"],
                "recovered_via": outcome["recovered_via"],
            })

    results_df = pd.DataFrame(results)
    results_df.to_csv(REPORTS_DIR / "batch_results_detail.csv", index=False)

    summary_lines = ["MandateIQ — Batch run results", "=" * 40, ""]
    for side in ["agent", "baseline"]:
        side_df = results_df[results_df["side"] == side]
        total = len(side_df)
        recovered = side_df["recovered"].sum()
        recovery_rate = recovered / total
        amount_at_risk = side_df["subscription_amount"].sum()
        amount_recovered = side_df.loc[side_df["recovered"], "subscription_amount"].sum()
        avg_retries = side_df["retries_taken"].mean()

        summary_lines.append(f"[{side.upper()}]")
        summary_lines.append(f"  Mandates in batch:      {total}")
        summary_lines.append(f"  Recovered:              {recovered} ({recovery_rate:.1%})")
        summary_lines.append(f"  Total value at risk:    Rs.{amount_at_risk:,.0f}")
        summary_lines.append(f"  Total value recovered:  Rs.{amount_recovered:,.0f}")
        summary_lines.append(f"  Avg retries per mandate:{avg_retries:.2f}")
        summary_lines.append("")

    agent_rate = results_df[results_df.side == "agent"]["recovered"].mean()
    baseline_rate = results_df[results_df.side == "baseline"]["recovered"].mean()
    lift_pct_points = (agent_rate - baseline_rate) * 100
    lift_relative = (agent_rate - baseline_rate) / baseline_rate * 100 if baseline_rate > 0 else float("nan")

    agent_amt = results_df[(results_df.side == "agent") & results_df.recovered]["subscription_amount"].sum()
    baseline_amt = results_df[(results_df.side == "baseline") & results_df.recovered]["subscription_amount"].sum()

    summary_lines.append("[HEADLINE RESULT]")
    summary_lines.append(f"  Agent recovery rate:    {agent_rate:.1%}")
    summary_lines.append(f"  Baseline recovery rate: {baseline_rate:.1%}")
    summary_lines.append(f"  Lift:                   +{lift_pct_points:.1f} percentage points "
                          f"({lift_relative:+.1f}% relative)")
    summary_lines.append(f"  Additional Rs. recovered by agent vs baseline: Rs.{agent_amt - baseline_amt:,.0f}")

    summary_text = "\n".join(summary_lines)
    print(summary_text)

    with open(REPORTS_DIR / "batch_results_summary.txt", "w") as f:
        f.write(summary_text)

    print(f"\nSaved: {REPORTS_DIR / 'batch_results_detail.csv'}")
    print(f"Saved: {REPORTS_DIR / 'batch_results_summary.txt'}")


if __name__ == "__main__":
    run_batch()
