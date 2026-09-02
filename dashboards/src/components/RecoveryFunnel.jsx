import { useCountUp } from "../hooks/useCountUp";
import { formatRupees } from "./Scoreboard";

/**
 * A funnel view of the same real numbers already in /api/summary,
 * presented as a narrative sequence rather than a table — analyzed →
 * failed → recovered → fallback. Every number here is real, just
 * re-framed for clarity.
 */
export default function RecoveryFunnel({ summary }) {
  const { agent } = summary;
  const total = useCountUp(agent.total_mandates, 900, 0);
  const failed = useCountUp(agent.total_mandates, 900, 0); // all 60 start as failures, by construction
  const recovered = useCountUp(agent.recovered, 1000, 0);
  const fallback = useCountUp(agent.total_mandates - agent.recovered, 1000, 0);
  const amount = useCountUp(agent.amount_recovered, 1200, 0);

  const stages = [
    { label: "Mandates analyzed", value: total, width: 100 },
    { label: "Failures identified", value: failed, width: 100 },
    { label: "Recovered", value: recovered, width: (agent.recovered / agent.total_mandates) * 100, color: "recovery" },
    { label: "Fallback required", value: fallback, width: ((agent.total_mandates - agent.recovered) / agent.total_mandates) * 100, color: "baseline" },
  ];

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
      <h3 className="font-display text-sm uppercase tracking-widest text-text-faint mb-5">
        Mandate recovery funnel
      </h3>
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-text-muted">{s.label}</span>
              <span className="font-mono text-sm text-text-primary tabular-nums">{Math.round(s.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-ink-700 overflow-hidden">
              <div
                className={`h-full rounded-full funnel-bar ${
                  s.color === "recovery" ? "bg-recovery" : s.color === "baseline" ? "bg-baseline" : "bg-ink-500"
                }`}
                style={{ width: `${s.width}%`, animationDelay: `${i * 0.15}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-ink-700 flex items-baseline justify-between">
        <span className="text-xs text-text-faint">Revenue recovered</span>
        <span className="font-mono text-lg text-recovery">{formatRupees(amount)}</span>
      </div>
      <style>{`
        .funnel-bar {
          animation: funnel-grow 0.8s cubic-bezier(0.65,0,0.35,1) backwards;
        }
        @keyframes funnel-grow {
          from { transform: scaleX(0); transform-origin: left; }
          to { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>
    </div>
  );
}
