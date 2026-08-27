"""
MandateIQ — audit_log.py

Shared audit-logging module. Every decision made anywhere in the pipeline
(retry-timing choices, fallback actions) gets written here as one
structured JSON line — human-readable, machine-parseable, and the backbone
of the dashboard's per-record drill-down view (Day 10-11).

This directly answers the "the bar" requirement for this track: a visible,
complete audit trail, not just a final aggregate number.

Format: JSON Lines (.jsonl) — one JSON object per line, so it's easy to
append to, easy to stream-read, and easy to inspect by hand if needed.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPORTS_DIR = SCRIPT_DIR.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)
AUDIT_LOG_PATH = REPORTS_DIR / "audit_log.jsonl"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def log_event(event_type: str, mandate_id: str, side: str, payload: dict):
    """Appends one structured audit entry.

    event_type: 'decision' (a retry-timing or fallback choice),
                'outcome' (whether a scheduled retry succeeded/failed),
                'fallback_action' (payment link + message generated),
                'batch_summary' (aggregate result for a mandate's full run)
    mandate_id: which mandate this concerns
    side: 'agent' or 'baseline' (or 'system' for non-comparative events)
    payload: event-specific structured details (varies by event_type)
    """
    entry = {
        "timestamp": _now_iso(),
        "event_type": event_type,
        "mandate_id": mandate_id,
        "side": side,
        **payload,
    }
    with open(AUDIT_LOG_PATH, "a") as f:
        f.write(json.dumps(entry, default=str) + "\n")
    return entry


def read_audit_log(mandate_id: str = None, side: str = None):
    """Reads the audit log back, optionally filtered — used by the
    dashboard's drill-down view."""
    if not AUDIT_LOG_PATH.exists():
        return []
    entries = []
    with open(AUDIT_LOG_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if mandate_id and entry.get("mandate_id") != mandate_id:
                continue
            if side and entry.get("side") != side:
                continue
            entries.append(entry)
    return entries


def clear_audit_log():
    """Wipes the audit log — call this at the START of a fresh full batch
    run so re-runs don't append duplicate history on top of old runs."""
    if AUDIT_LOG_PATH.exists():
        AUDIT_LOG_PATH.unlink()


if __name__ == "__main__":
    # Smoke test
    clear_audit_log()
    log_event("decision", "test_mandate_001", "agent", {
        "action": "retry", "scheduled_date": "2026-08-10",
        "reasoning": "model-selected slot, predicted 88% success probability",
    })
    log_event("outcome", "test_mandate_001", "agent", {
        "scheduled_date": "2026-08-10", "outcome": "success",
    })
    entries = read_audit_log(mandate_id="test_mandate_001")
    print(f"Wrote and read back {len(entries)} entries:")
    for e in entries:
        print(f"  {e}")
    clear_audit_log()
    print("Smoke test passed, log cleared.")
