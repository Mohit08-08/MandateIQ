import { useCountUp } from "../hooks/useCountUp";
import { formatRupees } from "./Scoreboard";

/**
 * A single-glance visualization of where the at-risk revenue ended up:
 * recovered vs. remaining exposure (fallback-pending), as a stacked bar
 * rather than another card of numbers.
 */
export default function RevenueAtRisk({ summary }) {
  const { agent } = summary;
  const remaining = agent.amount_at_risk - agent.amount_recovered;
  const recoveredPct = (agent.amount_recovered / agent.amount_at_risk) * 100;

  const atRisk = useCountUp(agent.amount_at_risk, 1100, 0);
  const recoveredAmt = useCountUp(agent.amount_recovered, 1100, 0);
  const remainingAmt = useCountUp(remaining, 1100, 0);

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
      <h3 className="font-display text-sm uppercase tracking-widest text-text-faint mb-1">
        Revenue at risk
      </h3>
      <p className="text-2xl font-display font-semibold text-text-primary mb-4 tabular-nums">
        {formatRupees(atRisk)}
      </p>

      <div className="h-3 rounded-full bg-ink-700 overflow-hidden flex risk-bar">
        <div className="h-full bg-recovery" style={{ width: `${recoveredPct}%` }} />
        <div className="h-full bg-fail/50" style={{ width: `${100 - recoveredPct}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-recovery" />
          <span className="text-text-muted">Recovered</span>
          <span className="font-mono text-recovery tabular-nums">{formatRupees(recoveredAmt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fail/50" />
          <span className="text-text-muted">Remaining exposure</span>
          <span className="font-mono text-fail tabular-nums">{formatRupees(remainingAmt)}</span>
        </div>
      </div>

      <style>{`
        .risk-bar > div {
          animation: risk-grow 1s cubic-bezier(0.65,0,0.35,1) backwards;
          transform-origin: left;
        }
        .risk-bar > div:nth-child(2) { animation-delay: 0.15s; }
        @keyframes risk-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
