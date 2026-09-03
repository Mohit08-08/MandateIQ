# MandateIQ

**An ML-driven, policy-bounded agent that decides *when* to retry a failed UPI Autopay/e-mandate debit** — instead of a fixed retry schedule — benchmarked against a documented smart-rule baseline, with hard safety caps and a full, queryable audit trail.

Built solo for Razorpay AI Buildathon 2026 — **AI Revenue Recovery** track.

---

## 🔗 Live demo

**[mandate-iq-eight.vercel.app](https://mandate-iq-eight.vercel.app)** — click **Enter Demo Environment**, no account needed.

> Backend runs on Render's free tier, which sleeps after 15 minutes idle — if the site says "Couldn't reach the backend" on first load, wait ~30 seconds and refresh; it's waking up, not broken.

Full setup instructions to run it locally are below. Deployment steps (Render + Vercel) are in `DEPLOYMENT_GUIDE.md`.

---

## Headline result

| | Agent | Smart-rule baseline |
|---|---|---|
| Recovery rate | **93.3%** (56/60) | 88.3% (53/60) |
| Avg. retries per mandate | **1.40** | 1.55 |
| Value recovered | Rs.1,18,044 | Rs.1,02,847 |

**Lift: +5.0 percentage points (+5.7% relative), Rs.15,197 additional value recovered on the same 60-mandate held-out batch — with the agent using *fewer* retries, not more.**

The baseline isn't a strawman: it already targets the nearest salary-credit window within a 10-day lookout, which is what a competent ops analyst would do by hand. The agent beats it using a real, cross-validated ML model (AUC 0.695 held-out / 0.666+/-0.043 across 5-fold CV) picking retry timing at day-and-hour granularity, bounded by a deterministic policy engine that enforces the retry cap in code — never in a prompt.

---

## What this actually is

1. **A trained model** (`src/model.py`) predicts the probability a given retry attempt succeeds, using only observable signal (bank, day/hour, payer history, amount) — never the hidden ground-truth driver used to generate the simulation.
2. **A deterministic policy engine** (`src/policy.py`) consumes that prediction but enforces every hard safety rule itself: max retry attempts, minimum gap between retries, retry-window bounds. The model proposes; the policy disposes.
3. **A batch runner** (`src/run_batch.py`) simulates the full decide->act->observe loop for every mandate, for both the agent and the baseline, and produces the comparison above.
4. **A fallback agent** (`src/fallback_agent.py`) handles mandates that exhaust their retry cap: creates a real Razorpay test-mode Payment Link, drafts a customer message with Gemini, and **programmatically verifies** the message contains the correct amount and link before it's ever used.
5. **A full audit trail** (`src/audit_log.py`) logs every decision, its reasoning, and its outcome — queryable per mandate, per side, and browsable end-to-end in the dashboard's Audit Trail tab.
6. **A FastAPI backend + React dashboard** (`backend/`, `dashboards/`) — a thin, honest read layer over the already-computed, already-tested results above, plus a live interactive "Run Recovery Agent" demo that does genuine on-demand model inference (not a lookup table) and honestly replays each mandate's real historical outcome.

### Dashboard features
- **Login** — demo-only session (no real backend auth exists; this is disclosed on the screen itself), light/dark theme
- **Overview** — animated scoreboard, recovery funnel, revenue-at-risk visual, retry-hour distribution (real audit-log data)
- **Mandates** — searchable/filterable/sortable table with a per-mandate agent-vs-baseline "swing" comparison and CSV export
- **Agent** — pipeline overview + an interactive live demo: pick a real failure scenario, watch the model score candidate retry slots live, see the actual historical outcome (success or fallback, never scripted)
- **Model** — cross-validation results, calibration check, and the exact feature list (visibly proving no label leakage)
- **Fallback Actions** — real Razorpay payment links, Gemini-drafted messages, and a message-preview modal
- **Audit Trail** — browse/filter/search the full 365-event decision log across all 60 mandates

---

## Quick start (local)

### 1. Core pipeline (Python)
```bash
pip install -r requirements.txt
cd src
python data_gen.py    # generates synthetic training + held-out batch data
python model.py       # trains + cross-validates the retry-timing model
python run_batch.py   # runs the agent vs. baseline comparison -> the headline result above
```

### 2. Automated tests
```bash
pip install pytest --break-system-packages   # if not already installed
pytest tests/ -v      # 21 tests: safety caps, no label leakage, audit log integrity,
                       # generative determinism, message verification
```

### 3. Fallback agent (requires free API keys)
```bash
cd src
python fallback_agent.py   # only needed for mandates that exhaust their retry cap
```
Requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (free Razorpay test-mode keys, no KYC needed) and `GEMINI_API_KEY` (free tier, no card needed) as environment variables. See `.env.example`.

### 4. Backend API
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Dashboard
```bash
cd dashboards
npm install
npm run dev
```
Open the URL Vite prints (typically `http://localhost:5173`). Requires the backend running simultaneously (step 4).

---

## Project structure

```
MandateIQ/
|-- src/                     Core pipeline
|   |-- config.py            Shared constants (retry cap, windows) - single source of truth
|   |-- data_gen.py          Synthetic data generator (documented generative formula)
|   |-- model.py             Model training, 5-fold CV, calibration check, metadata export
|   |-- baseline.py          The smart-rule competitor (not a strawman)
|   |-- policy.py            The agent's decision-maker (model + hard-coded safety bounds)
|   |-- run_batch.py         Batch simulation, agent vs. baseline
|   |-- fallback_agent.py    Real Razorpay + Gemini fallback path, with verification
|   `-- audit_log.py         Structured, queryable decision logging
|-- tests/
|   `-- test_mandateiq.py    21 tests covering safety, correctness, and no-leakage properties
|-- backend/
|   `-- main.py              FastAPI read layer + live model-inference endpoints for the demo
|-- dashboards/               React + Vite + Tailwind dashboard (login, theme toggle, 6 tabs)
|-- data/                    Generated CSVs (regenerated by data_gen.py)
|-- models/                  Trained model + metadata (regenerated by model.py)
|-- reports/                 Batch results, audit log, eval reports (regenerated by run_batch.py)
`-- docs/                    Design/methodology notes from each build day

DEPLOYMENT_GUIDE.md          Exact steps to deploy backend (Render) + frontend (Vercel)
PROJECT_EXPLANATION.md       Judge-facing one-pager: problem, approach, honesty notes
DEMO_SCRIPT.md               Timestamped 5-minute walkthrough script
```

---

## Methodology & honesty

- **All synthetic data is generated from a documented, auditable logistic formula** in `data_gen.py` (salary-window effect, bank reliability tier, day-of-week, amount tier, hour-of-day, attempt fatigue - every coefficient is a named, commented constant). See `docs/day2_schema.md`.
- **No label leakage**: the model never sees the hidden `payer_archetype` used to generate outcomes - only observable proxies. Verified by an automated test, not just an assertion in prose.
- **The baseline is genuinely competitive**, not a strawman - it targets the same salary-window signal a smart human analyst would use.
- **This project went through a full internal audit** that found and fixed two real bugs: a shared-RNG reproducibility issue that made simulation outcomes silently order-dependent, and a data-generation inconsistency where a forced "failed" label didn't match its underlying true probability. Fixing these **reduced** the headline lift from an earlier, buggy +10.0pp to the current, correct +5.0pp - a smaller number that is actually true beats a larger number that wasn't.
- **The dashboard's interactive Agent Demo never fabricates an outcome** - it replays each mandate's real historical result (success or fallback) rather than always showing a scripted success.
- **Every claim in this README is backed by an automated fresh-clone reproducibility test**: the pipeline was regenerated from nothing and reproduced the same numbers exactly.

---

## Tech stack

Python (pandas, scikit-learn, joblib) for the ML pipeline, FastAPI for the API layer, React + Vite + Tailwind CSS v4 + Recharts for the dashboard, Razorpay test-mode Payment Links API, Google Gemini API (free tier), pytest for automated testing, Render (backend hosting) + Vercel (frontend hosting).

**Total cost to build and run: Rs.0** - Razorpay test mode is free by design, Gemini's free tier requires no card, and both hosting platforms' free tiers cover this project's scale.
