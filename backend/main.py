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

app = FastAPI(title="MandateIQ API", version="1.0")

# Dev-friendly CORS: the React dev server runs on a different port than
# this API. Restricted to localhost origins only — this API is read-only,
# serves no secrets, and is never meant to be deployed publicly, so a
# wide-open dev CORS policy here is a deliberate, documented, low-risk
# choice, not an oversight.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",  # Vite dev server
        "http://localhost:3000", "http://127.0.0.1:3000",  # fallback CRA-style port
    ],
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
