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
    message that quotes money."""
    prompt = f"""You are drafting a short SMS/notification message for a customer
whose automatic subscription payment (UPI Autopay) has failed multiple times
and could not be retried further within the allowed retry window.

Facts you MUST use exactly as given, and must not alter, invent, or recompute:
- Amount due: Rs.{mandate_row['subscription_amount']:.0f}
- Payment link: {payment_link_url}

Write a short (under 300 characters), polite, clear message asking the
customer to complete payment manually via the link. Do not add any other
amount, discount, or promise not stated above. Do not mention retries,
banks, or internal system details. Plain text only, no markdown."""

    last_error = None
    for attempt in range(MAX_RETRIES_ON_RATE_LIMIT):
        try:
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            last_error = e
            wait = 2 ** attempt
            print(f"  [gemini] attempt {attempt + 1} failed ({e}); retrying in {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Gemini call failed after {MAX_RETRIES_ON_RATE_LIMIT} attempts: {last_error}")


def load_fallback_mandates(side="agent"):
    """Loads the mandates that hit fallback for a given side (agent or
    baseline), from Day 6's batch results, joined back to full mandate
    details from active_batch.csv."""
    results = pd.read_csv(REPORTS_DIR / "batch_results_detail.csv")
    fallback_ids = results[
        (results["side"] == side) & (results["recovered_via"] == "fallback_pending")
    ]["mandate_id"].tolist()

    batch = pd.read_csv(DATA_DIR / "active_batch.csv")
    return batch[batch["mandate_id"].isin(fallback_ids)].copy()


def run_fallback_agent(side="agent"):
    mandates = load_fallback_mandates(side=side)
    if len(mandates) == 0:
        print(f"No fallback mandates for side='{side}'. Nothing to do.")
        return

    print(f"Processing {len(mandates)} fallback mandate(s) for side='{side}'...")
    rzp_client = get_razorpay_client()
    gemini_client = get_gemini_client()

    records = []
    for _, mandate_row in mandates.iterrows():
        print(f"\n-> {mandate_row['mandate_id']} (Rs.{mandate_row['subscription_amount']:.0f})")

        link_url, link_id = create_fallback_payment_link(rzp_client, mandate_row)
        print(f"   Payment link created: {link_url}")

        message = draft_fallback_message(gemini_client, mandate_row, link_url)
        print(f"   Message: {message}")

        audit_log.log_event("fallback_action", mandate_row["mandate_id"], side, {
            "payment_link_id": link_id,
            "payment_link_url": link_url,
            "message": message,
            "subscription_amount": mandate_row["subscription_amount"],
        })

        records.append({
            "mandate_id": mandate_row["mandate_id"],
            "subscription_amount": mandate_row["subscription_amount"],
            "payment_link_id": link_id,
            "payment_link_url": link_url,
            "message": message,
        })

    out_df = pd.DataFrame(records)
    out_path = REPORTS_DIR / f"fallback_actions_{side}.csv"
    out_df.to_csv(out_path, index=False)
    print(f"\nSaved {len(out_df)} fallback action(s) to {out_path}")


if __name__ == "__main__":
    run_fallback_agent(side="agent")
