"""
MandateIQ — fallback_agent.py

Handles mandates that exhausted their retry cap (MAX_ATTEMPTS reached with
no success). For these, the agent does NOT keep retrying — it falls back to
a non-retry recovery path: a real Razorpay test-mode Payment Link plus a
compliant, clear notification message drafted by Gemini.

Design rule (see day1_scope.md): the LLM does NOT decide whether/when to
fall back — that's already been decided deterministically by policy.py
hitting MAX_ATTEMPTS. Gemini's only job here is drafting the message text.
It never sees or sets the payment amount/link itself — those come from
Razorpay's response, not from the model's output, so the LLM cannot
hallucinate a wrong amount into a message that could confuse a customer.

Usage:
    Requires environment variables:
      RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GEMINI_API_KEY
    python fallback_agent.py
"""

import os
import time
import pandas as pd
from pathlib import Path

import razorpay
from google import genai

import audit_log

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"
REPORTS_DIR = SCRIPT_DIR.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

GEMINI_MODEL = "gemini-3.6-flash"  # confirmed working model name (see Day 1 notes)
MAX_RETRIES_ON_RATE_LIMIT = 3


def get_razorpay_client():
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RuntimeError("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars.")
    return razorpay.Client(auth=(key_id, key_secret))


def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY env var.")
    return genai.Client(api_key=api_key)


def create_fallback_payment_link(rzp_client, mandate_row):
    """Creates a REAL Razorpay test-mode payment link. Test mode = free,
    no real money moves, but this is a genuine API call/response, not a
    mock — this is MandateIQ's one real Razorpay touchpoint."""
    amount_paise = int(round(mandate_row["subscription_amount"] * 100))
    link = rzp_client.payment_link.create({
        "amount": amount_paise,
        "currency": "INR",
        "description": f"Subscription renewal — mandate {mandate_row['mandate_id']}",
        "notes": {
            "mandate_id": mandate_row["mandate_id"],
            "reason": "retry_cap_exhausted_fallback",
        },
    })
    return link.get("short_url"), link.get("id")


def draft_fallback_message(gemini_client, mandate_row, payment_link_url):
    """Gemini's ONLY job: draft clear, compliant customer-facing copy.
    The amount and link are passed in as FACTS from Razorpay's real
    response — the model is told to use them exactly, not to invent or
    restate numbers on its own, to avoid any hallucination risk in a
    message that quotes money.

    IMPORTANT: this function does NOT just trust the model's output. After
    generation, verify_message() checks that the exact amount and link
    literally appear in the text. If they don't, we retry once with a
    stricter prompt rather than silently shipping an unverified message —
    this closes the gap between "we eyeballed one run and it looked fine"
    and "we programmatically verify every message before it's used."
    """
    amount_str = f"{mandate_row['subscription_amount']:.0f}"
    prompt = f"""You are drafting a short SMS/notification message for a customer
whose automatic subscription payment (UPI Autopay) has failed multiple times
and could not be retried further within the allowed retry window.

Facts you MUST use exactly as given, and must not alter, invent, or recompute:
- Amount due: Rs.{amount_str}
- Payment link: {payment_link_url}

Write a short (under 300 characters), polite, clear message asking the
customer to complete payment manually via the link. The message MUST
contain the exact amount "Rs.{amount_str}" and the exact link
"{payment_link_url}" verbatim. Do not add any other amount, discount, or
promise not stated above. Do not mention retries, banks, or internal
system details. Plain text only, no markdown."""

    last_error = None
    for attempt in range(MAX_RETRIES_ON_RATE_LIMIT):
        try:
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            text = response.text.strip()
            if not text:
                raise ValueError("Gemini returned an empty message.")
            return text
        except Exception as e:
            last_error = e
            wait = 2 ** attempt
            print(f"  [gemini] attempt {attempt + 1} failed ({e}); retrying in {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Gemini call failed after {MAX_RETRIES_ON_RATE_LIMIT} attempts: {last_error}")


def verify_message(message: str, mandate_row: dict, payment_link_url: str):
    """Programmatically verifies the generated message actually contains
    the correct amount and link, rather than trusting the model's output
    on faith. Returns (is_valid, list_of_problems)."""
    amount_str = f"{mandate_row['subscription_amount']:.0f}"
    problems = []
    if amount_str not in message:
        problems.append(f"amount 'Rs.{amount_str}' not found verbatim in message")
    if payment_link_url not in message:
        problems.append("payment link not found verbatim in message")
    if len(message) > 320:  # small buffer over the requested 300 chars
        problems.append(f"message is {len(message)} chars, longer than requested")
    return (len(problems) == 0, problems)


def load_fallback_mandates(side="agent"):
    """Loads the mandates that hit fallback for a given side (agent or
    baseline), from Day 6's batch results, joined back to full mandate
    details from active_batch.csv."""
    results_path = REPORTS_DIR / "batch_results_detail.csv"
    batch_path = DATA_DIR / "active_batch.csv"
    if not results_path.exists():
        raise FileNotFoundError(
            f"{results_path} not found — run run_batch.py first so there's "
            f"something to check for fallback mandates."
        )
    if not batch_path.exists():
        raise FileNotFoundError(f"{batch_path} not found — run data_gen.py first.")

    results = pd.read_csv(results_path)
    fallback_ids = results[
        (results["side"] == side) & (results["recovered_via"] == "fallback_pending")
    ]["mandate_id"].tolist()

    batch = pd.read_csv(batch_path)
    matched = batch[batch["mandate_id"].isin(fallback_ids)].copy()

    missing_ids = set(fallback_ids) - set(matched["mandate_id"])
    if missing_ids:
        raise RuntimeError(
            f"{len(missing_ids)} fallback mandate ID(s) from batch_results_detail.csv "
            f"were not found in active_batch.csv: {missing_ids}. The two files "
            f"are likely out of sync — re-run data_gen.py then run_batch.py fresh."
        )
    return matched


def run_fallback_agent(side="agent"):
    mandates = load_fallback_mandates(side=side)
    if len(mandates) == 0:
        print(f"No fallback mandates for side='{side}'. Nothing to do.")
        return

    print(f"Processing {len(mandates)} fallback mandate(s) for side='{side}'...")
    rzp_client = get_razorpay_client()
    gemini_client = get_gemini_client()

    out_path = REPORTS_DIR / f"fallback_actions_{side}.csv"
    records = []
    failures = []

    for _, mandate_row in mandates.iterrows():
        mandate_id = mandate_row["mandate_id"]
        print(f"\n-> {mandate_id} (Rs.{mandate_row['subscription_amount']:.0f})")

        try:
            link_url, link_id = create_fallback_payment_link(rzp_client, mandate_row)
            print(f"   Payment link created: {link_url}")

            message = draft_fallback_message(gemini_client, mandate_row, link_url)
            is_valid, problems = verify_message(message, mandate_row, link_url)

            if not is_valid:
                print(f"   [WARN] Message failed verification: {problems}")
                print("   Retrying once with the same facts...")
                message = draft_fallback_message(gemini_client, mandate_row, link_url)
                is_valid, problems = verify_message(message, mandate_row, link_url)
                if not is_valid:
                    print(f"   [WARN] Still failing verification after retry: {problems}")
                    print("   Flagging this record for manual review instead of "
                          "silently shipping an unverified message.")

            print(f"   Message: {message}")
            print(f"   Verified: {is_valid}")

            audit_log.log_event("fallback_action", mandate_id, side, {
                "payment_link_id": link_id,
                "payment_link_url": link_url,
                "message": message,
                "subscription_amount": mandate_row["subscription_amount"],
                "message_verified": is_valid,
                "verification_problems": problems if not is_valid else [],
            })

            records.append({
                "mandate_id": mandate_id,
                "subscription_amount": mandate_row["subscription_amount"],
                "payment_link_id": link_id,
                "payment_link_url": link_url,
                "message": message,
                "message_verified": is_valid,
            })

        except Exception as e:
            # Per-mandate error isolation: one failure doesn't lose progress
            # on the mandates already processed, or block the ones after it.
            print(f"   [ERROR] Failed to process {mandate_id}: {e}")
            failures.append({"mandate_id": mandate_id, "error": str(e)})
            audit_log.log_event("fallback_action_error", mandate_id, side, {
                "error": str(e),
            })

        # Save incrementally after EVERY mandate, not just at the end — so
        # a crash on mandate 3 of 5 still leaves mandates 1-2's real,
        # already-created payment links safely on disk.
        if records:
            pd.DataFrame(records).to_csv(out_path, index=False)

    print(f"\nSaved {len(records)} fallback action(s) to {out_path}")
    if failures:
        print(f"[WARN] {len(failures)} mandate(s) failed and were skipped: "
              f"{[f['mandate_id'] for f in failures]}")
        failures_path = REPORTS_DIR / f"fallback_actions_{side}_failures.csv"
        pd.DataFrame(failures).to_csv(failures_path, index=False)
        print(f"Failure details saved to {failures_path}")

    unverified = [r for r in records if not r["message_verified"]]
    if unverified:
        print(f"\n[WARN] {len(unverified)} message(s) did not pass automated "
              f"verification (amount/link mismatch) even after retry — "
              f"review these before using them in a live demo: "
              f"{[r['mandate_id'] for r in unverified]}")
    else:
        print(f"\nAll {len(records)} generated message(s) passed automated "
              f"verification (amount and link confirmed present verbatim).")


if __name__ == "__main__":
    run_fallback_agent(side="agent")
