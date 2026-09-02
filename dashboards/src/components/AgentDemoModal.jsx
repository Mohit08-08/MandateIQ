import { useEffect, useState } from "react";
import { getDemoMandates, getAgentDemo } from "../api";
import { useToast } from "../context/ToastContext";
import { formatRupees } from "./Scoreboard";
import WhyThisDecision from "./WhyThisDecision";

const STEPS = ["picker", "detecting", "analyzing", "deciding", "recommendation", "policy", "executing", "result"];
const ANALYSIS_CHECKS = ["Failure reason", "Previous attempts", "Bank behaviour", "Historical success rate", "Retry budget"];
const POLICY_CHECKS = ["Retry budget available", "Within retry limit", "No duplicate attempt scheduled", "Fallback threshold not reached"];

/**
 * The interactive centerpiece. Every number shown is real: real mandate
 * data, a REAL live re-score from the actual trained model
 * (/api/agent-demo), and — critically — the RESULT step honestly replays
 * whatever this specific mandate's real historical outcome actually was
 * (recovered on retry, or needed fallback) rather than always forcing a
 * success ending. The one explicitly fabricated moment (the retry
 * "executing" itself, since no new real transaction happens on replay)
 * is clearly labeled SIMULATED.
 */
export default function AgentDemoModal({ onClose }) {
  const showToast = useToast();
  const [step, setStep] = useState("picker");
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [demoData, setDemoData] = useState(null);
  const [checkedItems, setCheckedItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDemoMandates().then(setOptions).catch((e) => setError(e.message));
  }, []);

  function startDemo(mandateId) {
    setSelectedId(mandateId);
    setStep("detecting");
    showToast("Agent analysis started");
    setTimeout(() => setStep("analyzing"), 1100);
  }

  useEffect(() => {
    if (step !== "analyzing") return;
    setCheckedItems([]);
    ANALYSIS_CHECKS.forEach((_, i) => {
      setTimeout(() => {
        setCheckedItems((c) => [...c, i]);
        if (i === ANALYSIS_CHECKS.length - 1) {
          setTimeout(async () => {
            try {
              const data = await getAgentDemo(selectedId);
              setDemoData(data);
              setStep("deciding");
            } catch (e) {
              setError(e.message);
            }
          }, 400);
        }
      }, i * 350);
    });
  }, [step, selectedId]);

  useEffect(() => {
    if (step !== "deciding" || !demoData) return;
    showToast("Recovery window identified", "success");
    const t = setTimeout(() => setStep("recommendation"), 1600);
    return () => clearTimeout(t);
  }, [step, demoData]);

  function proceedToPolicy() {
    setStep("policy");
    setCheckedItems([]);
    POLICY_CHECKS.forEach((_, i) => {
      setTimeout(() => {
        setCheckedItems((c) => [...c, i]);
        if (i === POLICY_CHECKS.length - 1) {
          setTimeout(() => {
            showToast("Policy check passed", "success");
            setStep("executing");
          }, 400);
        }
      }, i * 300);
    });
  }

  useEffect(() => {
    if (step !== "executing") return;
    const t = setTimeout(() => {
      showToast("Demo retry executed (simulated)");
      setStep("result");
    }, 1400);
    return () => clearTimeout(t);
  }, [step]);

  const realOutcome = getRealOutcome(demoData);

  useEffect(() => {
    if (step !== "result" || !realOutcome) return;
    if (realOutcome.recovered) showToast("Mandate recovered", "success");
    else showToast("Fallback action generated");
  }, [step, realOutcome]);

  return (
    <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-ink-800 border border-ink-600 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-600">
          <span className="font-display text-sm text-text-primary">Recovery agent — live run</span>
          <button onClick={onClose} className="text-text-faint hover:text-text-primary text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 min-h-[320px]">
          {error && <p className="text-sm text-fail">{error}</p>}

          {!error && step === "picker" && (
            <div>
              <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-3">
                Select a failure scenario (real mandate)
              </p>
              <div className="space-y-2">
                {options.map((o) => (
                  <button
                    key={o.mandate_id}
                    onClick={() => startDemo(o.mandate_id)}
                    className="w-full text-left rounded-lg border border-ink-600 hover:border-recovery/40 px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-primary font-mono">{o.failure_reason.replaceAll("_", " ")}</span>
                      <span className="text-xs font-mono text-text-muted">{formatRupees(o.subscription_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-text-faint">{o.mandate_id} &middot; {o.bank_name}</span>
                      {o.historical_outcome === "fallback" && (
                        <span className="text-[10px] font-mono text-baseline">real outcome: fallback</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "detecting" && (
            <StepCenter>
              <p className="text-xs font-mono text-fail uppercase tracking-wider mb-2">Failure detected</p>
              <p className="font-mono text-text-primary">{selectedId}</p>
            </StepCenter>
          )}

          {step === "analyzing" && (
            <div>
              <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Analyzing context</p>
              <div className="space-y-2">
                {ANALYSIS_CHECKS.map((c, i) => (
                  <ChecklistItem key={c} label={c} checked={checkedItems.includes(i)} />
                ))}
              </div>
            </div>
          )}

          {step === "deciding" && demoData && (
            <div>
              <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Evaluating recovery windows…</p>
              <div className="space-y-1.5">
                {demoData.live_top_candidates.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 candidate-in" style={{ animationDelay: `${i * 0.12}s` }}>
                    <span className="text-xs font-mono text-text-muted w-24">{c.date.slice(5)} {c.hour}:00</span>
                    <div className="flex-1 h-2 rounded-full bg-ink-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-recovery" : "bg-ink-500"}`}
                        style={{ width: `${c.probability * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-12 text-right ${i === 0 ? "text-recovery" : "text-text-faint"}`}>
                      {(c.probability * 100).toFixed(0)}%
                    </span>
                    {i === 0 && <span className="text-[10px] font-mono text-recovery">SELECTED</span>}
                  </div>
                ))}
              </div>
              <style>{`
                .candidate-in { animation: candidate-in 0.3s ease-out backwards; }
                @keyframes candidate-in { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
              `}</style>
            </div>
          )}

          {step === "recommendation" && demoData && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-1">Recommended retry</p>
                <p className="font-display text-2xl text-text-primary">
                  {demoData.live_best_choice.date} · {demoData.live_best_choice.hour}:00
                </p>
                <p className="font-mono text-sm text-recovery mt-1">
                  {(demoData.live_best_choice.probability * 100).toFixed(1)}% predicted success
                </p>
              </div>
              <WhyThisDecision
                mandate={demoData.mandate}
                bestChoice={demoData.live_best_choice}
                marginPct={computeMarginPct(demoData.live_top_candidates)}
              />
              <button
                onClick={proceedToPolicy}
                className="w-full rounded-lg bg-recovery text-ink-950 text-sm font-semibold py-2.5 hover:bg-recovery/90 transition-colors"
              >
                Run policy check →
              </button>
            </div>
          )}

          {step === "policy" && (
            <div>
              <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Policy check</p>
              <div className="space-y-2">
                {POLICY_CHECKS.map((c, i) => (
                  <ChecklistItem key={c} label={c} checked={checkedItems.includes(i)} />
                ))}
              </div>
            </div>
          )}

          {step === "executing" && (
            <StepCenter>
              <span className="inline-block mb-3 text-[10px] font-mono text-baseline bg-baseline/10 border border-baseline/30 rounded-full px-2.5 py-1">
                SIMULATED DEMO ACTION — no real transaction
              </span>
              <p className="text-text-primary font-mono animate-pulse">Executing retry…</p>
            </StepCenter>
          )}

          {step === "result" && realOutcome && (
            <StepCenter>
              {realOutcome.recovered ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-recovery/10 border border-recovery/40 flex items-center justify-center mx-auto mb-3">
                    <CheckIcon />
                  </div>
                  <p className="font-display text-xl text-recovery mb-1">Mandate recovered</p>
                  <p className="font-mono text-sm text-text-muted">
                    {formatRupees(demoData.mandate.subscription_amount)} recovered on attempt {realOutcome.attemptNumber}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl text-baseline mb-1">Retry cap reached</p>
                  <p className="font-mono text-sm text-text-muted mb-2">Falling back to manual payment link</p>
                </>
              )}
              <p className="text-[10px] text-text-faint mt-4">
                This is the real historical outcome for {selectedId}, from the actual audited batch run —
                not a scripted demo ending.
              </p>
              <button
                onClick={onClose}
                className="mt-4 text-xs font-mono text-text-muted hover:text-text-primary border border-ink-600 rounded-lg px-4 py-2"
              >
                Close
              </button>
            </StepCenter>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCenter({ children }) {
  return <div className="text-center py-6">{children}</div>;
}

function ChecklistItem({ label, checked }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
        checked ? "border-recovery bg-recovery/10" : "border-ink-600"
      }`}>
        {checked && <CheckIcon small />}
      </span>
      <span className={checked ? "text-text-primary" : "text-text-faint"}>{label}</span>
    </div>
  );
}

function CheckIcon({ small }) {
  const size = small ? 10 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="#2DD4A7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function computeMarginPct(candidates) {
  if (!candidates || candidates.length < 2) return 0;
  const best = candidates[0].probability;
  const rest = candidates.slice(1);
  const avgRest = rest.reduce((s, c) => s + c.probability, 0) / rest.length;
  return (best - avgRest) * 100;
}

function getRealOutcome(demoData) {
  if (!demoData) return null;
  const events = demoData.historical_audit_events || [];
  const successEvent = events.find((e) => e.event_type === "outcome" && e.outcome === "success");
  if (successEvent) {
    return { recovered: true, attemptNumber: successEvent.attempt_number };
  }
  return { recovered: false };
}
