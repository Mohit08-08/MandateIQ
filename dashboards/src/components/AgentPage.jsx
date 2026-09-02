import { useState } from "react";
import AgentDemoModal from "./AgentDemoModal";
import PageHeader from "./PageHeader";

const PIPELINE = ["Detect", "Analyze", "Predict", "Retry", "Verify", "Stop"];

export default function AgentPage({ summary }) {
  const [demoOpen, setDemoOpen] = useState(false);
  const { agent } = summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Recovery Agent" subtitle="Bounded by policy — every retry is capped, logged, and explainable." />
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-recovery status-dot" />
            <span className="text-sm font-mono text-text-muted">Operational</span>
          </div>
          <button
            onClick={() => setDemoOpen(true)}
            className="rounded-lg bg-recovery text-ink-950 text-sm font-semibold px-4 py-2.5 hover:bg-recovery/90 transition-colors"
          >
            Run recovery agent →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Mandates processed" value={agent.total_mandates} />
          <Stat label="Successful recoveries" value={agent.recovered} color="text-recovery" />
          <Stat label="Fallbacks" value={agent.total_mandates - agent.recovered} color="text-baseline" />
          <Stat label="Avg. retries" value={agent.avg_retries.toFixed(2)} />
        </div>

        <div className="pt-5 border-t border-ink-700">
          <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-3">Pipeline</p>
          <div className="flex items-center flex-wrap gap-2">
            {PIPELINE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted border border-ink-600 rounded-full px-3 py-1.5">
                  {step}
                </span>
                {i < PIPELINE.length - 1 && <span className="text-text-faint">→</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-text-faint mt-3">
            Every retry is bounded by a hard-coded policy: a maximum attempt count and minimum
            gap between retries enforced in code, never left to the model to decide.
          </p>
        </div>
      </div>

      {demoOpen && <AgentDemoModal onClose={() => setDemoOpen(false)} />}

      <style>{`
        .status-dot { animation: status-pulse 2s ease-in-out infinite; }
        @keyframes status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function Stat({ label, value, color = "text-text-primary" }) {
  return (
    <div>
      <p className="text-xs text-text-faint mb-1">{label}</p>
      <p className={`font-display text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
