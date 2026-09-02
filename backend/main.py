"""
MandateIQ — backend/main.py

A thin FastAPI read layer over the already-computed, already-audited
pipeline outputs (reports/, models/, data/). Deliberately does NOT
duplicate any business logic from src/ — it reads the same CSVs, the same
audit_log.jsonl, and the same model metadata that the CLI scripts already
produced and that the test suite already verified. If you want to change
what number the dashboard shows, you change the pipeline in src/ and
re-run it — this API never computes its own version of the truth.

Run with:
    pip install fastapi uvicorn[standard] --break-system-packages
    uvicorn main:app --reload --port 8000

Then the React dev server (Day 11) talks to http://localhost:8000.
"""

import json
import math
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
REPORTS_DIR = PROJECT_ROOT / "reports"
SRC_DIR = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC_DIR))  # so we can import policy.py for REAL live inference
                                    # in the interactive agent-demo endpoint below —
                                    # never a second copy of the scoring logic.

app = FastAPI(title="MandateIQ API", version="1.0")

# Dev-friendly CORS: this API is read-only, serves no secrets, and every
# response is either public demo data or the person's own uploaded batch —
# there's nothing here that credentials/cookies could leak. That's what
# makes allow_origins=["*"] a safe, deliberate choice for a hackathon
# deployment rather than an oversight — no auth tokens or cookies are ever
# sent, so a wildcard origin can't be abused to steal a session.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _require_file(path: Path, hint: str):
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"{path.name} not found. {hint}",
        )


def _sanitize(obj):
    """Recursively replaces pandas/numpy NaN with None (JSON null).
    NaN is a legitimate, expected value in this project (e.g.
    prior_failure_reason is genuinely absent for a mandate's first
    attempt — see day2_schema.md) but raw NaN is not valid JSON, so it
    must become null before crossing the API boundary, not be silently
    dropped or crash the response."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary")
def get_summary():
    """Headline agent-vs-baseline numbers, read straight from
    batch_results_detail.csv — the exact same file the CLI's
    [HEADLINE RESULT] block is computed from, so the dashboard can never
    show a number that disagrees with what run_batch.py printed."""
    path = REPORTS_DIR / "batch_results_detail.csv"
    _require_file(path, "Run 'python run_batch.py' from src/ first.")
    df = pd.read_csv(path)

    summary = {}
    for side in ["agent", "baseline"]:
        side_df = df[df["side"] == side]
        total = len(side_df)
        recovered = int(side_df["recovered"].sum())
        amount_at_risk = float(side_df["subscription_amount"].sum())
        amount_recovered = float(side_df.loc[side_df["recovered"], "subscription_amount"].sum())
        summary[side] = {
            "total_mandates": total,
            "recovered": recovered,
            "recovery_rate": round(recovered / total, 4) if total else 0,
            "amount_at_risk": round(amount_at_risk, 2),
            "amount_recovered": round(amount_recovered, 2),
            "avg_retries": round(float(side_df["retries_taken"].mean()), 2) if total else 0,
        }

    agent_rate = summary["agent"]["recovery_rate"]
    baseline_rate = summary["baseline"]["recovery_rate"]
    summary["lift"] = {
        "percentage_points": round((agent_rate - baseline_rate) * 100, 2),
        "relative_pct": round(
            (agent_rate - baseline_rate) / baseline_rate * 100, 2
        ) if baseline_rate else None,
        "additional_amount_recovered": round(
            summary["agent"]["amount_recovered"] - summary["baseline"]["amount_recovered"], 2
        ),
    }
    return summary


@app.get("/api/mandates")
def get_mandates(side: Optional[str] = None):
    """One row per mandate per side (or filtered to one side), for the
    dashboard's table view. Joins batch results back to full mandate
    details so the table can show bank, amount, etc. without a second
    round trip."""
    results_path = REPORTS_DIR / "batch_results_detail.csv"
    batch_path = DATA_DIR / "active_batch.csv"
    _require_file(results_path, "Run 'python run_batch.py' from src/ first.")
    _require_file(batch_path, "Run 'python data_gen.py' from src/ first.")

    results = pd.read_csv(results_path)
    batch = pd.read_csv(batch_path)

    if side:
        if side not in ("agent", "baseline"):
            raise HTTPException(400, "side must be 'agent' or 'baseline'")
        results = results[results["side"] == side]

    merged = results.merge(
        batch[["mandate_id", "bank_name", "amount_tier", "attempt_date"]],
        on="mandate_id", how="left",
    )
    return _sanitize(merged.to_dict(orient="records"))


@app.get("/api/mandates/{mandate_id}")
def get_mandate_detail(mandate_id: str):
    """Full drill-down for ONE mandate: its base details, the batch
    outcome for both sides, and the complete audit trail (every decision
    and outcome event) for both sides — the exact data the "the bar"
    requirement (visible, complete audit trail) is meant to satisfy."""
    batch_path = DATA_DIR / "active_batch.csv"
    results_path = REPORTS_DIR / "batch_results_detail.csv"
    audit_path = REPORTS_DIR / "audit_log.jsonl"
    _require_file(batch_path, "Run 'python data_gen.py' from src/ first.")
    _require_file(results_path, "Run 'python run_batch.py' from src/ first.")

    batch = pd.read_csv(batch_path)
    mandate_rows = batch[batch["mandate_id"] == mandate_id]
    if len(mandate_rows) == 0:
        raise HTTPException(404, f"Mandate '{mandate_id}' not found.")
    mandate_info = mandate_rows.iloc[0].to_dict()

    results = pd.read_csv(results_path)
    outcomes = results[results["mandate_id"] == mandate_id].to_dict(orient="records")

    audit_entries = []
    if audit_path.exists():
        with open(audit_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("mandate_id") == mandate_id:
                    audit_entries.append(entry)

    return {
        "mandate_id": mandate_id,
        "details": _sanitize(mandate_info),
        "outcomes": _sanitize(outcomes),
        "audit_trail": {
            "agent": _sanitize([e for e in audit_entries if e.get("side") == "agent"]),
            "baseline": _sanitize([e for e in audit_entries if e.get("side") == "baseline"]),
        },
    }


@app.get("/api/model")
def get_model_info():
    """Model transparency panel data — feature schema (proof of no label
    leakage), CV results, calibration decision, training timestamp."""
    metadata_path = MODELS_DIR / "retry_model_metadata.json"
    _require_file(metadata_path, "Run 'python model.py' from src/ first.")
    with open(metadata_path) as f:
        return json.load(f)


@app.get("/api/fallback-actions")
def get_fallback_actions(side: str = "agent"):
    """The fallback agent's real Razorpay payment links + Gemini-drafted
    messages + automated verification status, for the mandates that
    exhausted their retry cap."""
    path = REPORTS_DIR / f"fallback_actions_{side}.csv"
    if not path.exists():
        return []  # not an error — this side may have had zero fallbacks
    df = pd.read_csv(path)
    return _sanitize(df.to_dict(orient="records"))


@app.get("/api/audit-log")
def get_audit_log(
    event_type: Optional[str] = None,
    side: Optional[str] = None,
    mandate_id: Optional[str] = None,
    limit: int = 500,
):
    """Browse the FULL audit trail across all mandates, not just one at a
    time — this is what turns 'we have an audit trail' from a per-mandate
    drill-down into an actually explorable dataset. Filters are all
    optional and combine with AND. `mandate_id` does a substring match so
    the frontend can support live search-as-you-type."""
    path = REPORTS_DIR / "audit_log.jsonl"
    if not path.exists():
        return {"entries": [], "total": 0}

    entries = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event_type and entry.get("event_type") != event_type:
                continue
            if side and entry.get("side") != side:
                continue
            if mandate_id and mandate_id.lower() not in entry.get("mandate_id", "").lower():
                continue
            entries.append(entry)

    total = len(entries)
    # Most-recent-first is more useful for browsing than file order.
    entries = list(reversed(entries))[:limit]
    return {"entries": _sanitize(entries), "total": total}


@app.get("/api/retry-timing")
def get_retry_timing(side: str = "agent"):
    """Aggregates scheduled_hour across every 'retry' decision event for
    one side, straight from the audit log — real data, not illustration.
    Powers the retry-hour distribution chart: which hours does the agent
    actually favor, versus the baseline's fixed default hour."""
    path = REPORTS_DIR / "audit_log.jsonl"
    if not path.exists():
        return []

    hour_counts = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("side") != side or entry.get("event_type") != "decision":
                continue
            if entry.get("action") != "retry":
                continue
            hour = entry.get("scheduled_hour")
            if hour is None:
                continue
            hour_counts[hour] = hour_counts.get(hour, 0) + 1

    return sorted(
        [{"hour": h, "count": c} for h, c in hour_counts.items()],
        key=lambda x: x["hour"],
    )


@app.get("/api/demo-mandates")
def get_demo_mandates():
    """A small, curated set of real mandates for the 'Simulate Failed
    Mandate' picker — real mandates from the real dataset, not fabricated
    scenarios. Guarantees at least one mandate whose real historical
    outcome was a fallback (not just recovery-success cases), so the
    interactive demo can honestly show either branch, not only the
    happy path."""
    batch_path = DATA_DIR / "active_batch.csv"
    results_path = REPORTS_DIR / "batch_results_detail.csv"
    _require_file(batch_path, "Run 'python data_gen.py' from src/ first.")
    df = pd.read_csv(batch_path)

    fallback_ids = set()
    if results_path.exists():
        results = pd.read_csv(results_path)
        fallback_ids = set(
            results[(results["side"] == "agent") & (results["recovered_via"] == "fallback_pending")]
            ["mandate_id"]
        )

    picks = []
    seen_reasons = set()
    for _, row in df.iterrows():
        reason = row.get("failure_reason")
        reason = None if pd.isna(reason) else reason
        label = reason or "unclassified"
        if label in seen_reasons:
            continue
        seen_reasons.add(label)
        picks.append({
            "mandate_id": row["mandate_id"],
            "failure_reason": label,
            "subscription_amount": float(row["subscription_amount"]),
            "bank_name": row["bank_name"],
            "historical_outcome": "fallback" if row["mandate_id"] in fallback_ids else "recovered",
        })

    # Ensure at least one guaranteed-fallback option is present, so the
    # picker can demonstrate both real outcome branches.
    if fallback_ids and not any(p["historical_outcome"] == "fallback" for p in picks):
        fb_id = sorted(fallback_ids)[0]
        row = df[df["mandate_id"] == fb_id].iloc[0]
        reason = row.get("failure_reason")
        reason = None if pd.isna(reason) else (reason or "unclassified")
        picks.append({
            "mandate_id": fb_id,
            "failure_reason": reason or "unclassified",
            "subscription_amount": float(row["subscription_amount"]),
            "bank_name": row["bank_name"],
            "historical_outcome": "fallback",
        })

    return picks


@app.get("/api/agent-demo/{mandate_id}")
def get_agent_demo(mandate_id: str):
    """Powers the interactive 'Run Recovery Agent' demo. Everything here
    is REAL: the mandate's real details, the real recorded decision from
    the audit log, and a LIVE re-scoring of every candidate (date, hour)
    slot using the actual trained model via policy.py's own internals —
    not a second, fake copy of the scoring logic, and not a fabricated
    decision. This is the model genuinely thinking again, live, on demand.
    """
    import policy
    from config import MIN_GAP_DAYS, RETRY_WINDOW_DAYS
    from datetime import timedelta

    batch_path = DATA_DIR / "active_batch.csv"
    _require_file(batch_path, "Run 'python data_gen.py' from src/ first.")
    batch = pd.read_csv(batch_path)
    rows = batch[batch["mandate_id"] == mandate_id]
    if len(rows) == 0:
        raise HTTPException(404, f"Mandate '{mandate_id}' not found.")
    mandate = rows.iloc[0].to_dict()
    last_attempt_date = pd.to_datetime(mandate["attempt_date"]).date()

    try:
        policy._validate_mandate_row(mandate)
        model = policy._get_model()
    except policy.ModelNotFoundError:
        raise HTTPException(503, "Model not found — run 'python model.py' from src/ first.")

    candidates = []
    for d_offset in range(MIN_GAP_DAYS, RETRY_WINDOW_DAYS + 1):
        candidate_date = last_attempt_date + timedelta(days=d_offset)
        for hour in policy.CANDIDATE_HOURS:
            candidates.append((candidate_date, hour))

    feature_rows = [policy._build_feature_row(mandate, 2, d, h) for d, h in candidates]
    X = pd.DataFrame(feature_rows)
    probs = model.predict_proba(X)[:, 1]

    scored = sorted(
        [
            {"date": str(d), "hour": h, "probability": round(float(p), 4)}
            for (d, h), p in zip(candidates, probs)
        ],
        key=lambda x: x["probability"],
        reverse=True,
    )
    best = scored[0]

    # Pull the REAL recorded audit-trail decision + outcome for this
    # mandate, for the "why this decision" explainer and to show the
    # actual historical result alongside the live re-score.
    audit_path = REPORTS_DIR / "audit_log.jsonl"
    real_events = []
    if audit_path.exists():
        with open(audit_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("mandate_id") == mandate_id and entry.get("side") == "agent":
                    real_events.append(entry)

    return {
        "mandate": _sanitize(mandate),
        "live_top_candidates": scored[:6],
        "live_best_choice": best,
        "historical_audit_events": _sanitize(real_events),
    }


@app.get("/api/predict")
def predict(
    bank_name: str,
    subscription_amount: float,
    amount_tier: str,
    attempt_number: int = 2,
    payer_historical_success_rate: float = 0.5,
    payer_tenure_months: int = 6,
    prior_failure_reason: Optional[str] = None,
    day_of_month: int = 15,
    hour_of_day: int = 11,
):
    """Live model inference for the 'Test a mandate' interactive feature
    on the Model page — a real prediction from the real trained model for
    hypothetical inputs the user supplies, not a lookup table."""
    import policy
    from datetime import date as date_cls
    from config import is_salary_window

    try:
        model = policy._get_model()
    except policy.ModelNotFoundError:
        raise HTTPException(503, "Model not found — run 'python model.py' from src/ first.")

    # day_of_week is derived from a representative date matching the
    # requested day_of_month, so the feature schema matches training exactly.
    representative_date = date_cls(2026, 8, min(max(day_of_month, 1), 28))
    feature_row = {
        "attempt_number": attempt_number,
        "day_of_month": day_of_month,
        "hour_of_day": hour_of_day,
        "payer_historical_success_rate": payer_historical_success_rate,
        "payer_tenure_months": payer_tenure_months,
        "subscription_amount": subscription_amount,
        "day_of_week": str(representative_date.weekday()),
        "bank_name": bank_name,
        "amount_tier": amount_tier,
        "prior_failure_reason": prior_failure_reason or "none",
        "is_salary_window": str(is_salary_window(day_of_month)),
    }
    X = pd.DataFrame([feature_row])
    prob = float(model.predict_proba(X)[:, 1][0])
    return {"predicted_success_probability": round(prob, 4), "features_used": feature_row}
