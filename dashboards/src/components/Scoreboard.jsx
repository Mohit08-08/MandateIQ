import { useCountUp } from "../hooks/useCountUp";
import { useTheme } from "../context/ThemeContext";

/**
 * The signature visual moment: agent-vs-baseline recovery rate, with the
 * lift as the focal element. Numbers count up on mount. The ambient
 * radar-pulse background is a DARK-THEME-ONLY flourish (terminal/
 * monitoring aesthetic) — deliberately omitted in light theme, where it
 * would read as a generic glowing decorative element rather than
 * something purposeful.
 */
export default function Scoreboard({ summary }) {
  const { theme } = useTheme();
  const { agent, baseline, lift } = summary;
  const liftIsPositive = lift.percentage_points >= 0;

  const agentPct = useCountUp(agent.recovery_rate * 100, 1400, 1);
  const baselinePct = useCountUp(baseline.recovery_rate * 100, 1400, 1);
  const liftPct = useCountUp(lift.percentage_points, 1600, 1);
  const amountAtRisk = useCountUp(agent.amount_at_risk, 1200, 0);
  const amountRecovered = useCountUp(agent.amount_recovered, 1200, 0);
  const additionalRecovered = useCountUp(lift.additional_amount_recovered, 1200, 0);

  return (
    <div className="relative rounded-2xl border border-ink-600 bg-ink-800 p-8 overflow-hidden">
      {theme === "dark" && <RadarPulseBackground />}

      <div className="relative flex items-center justify-between gap-8">
        <ScoreBlock
          label="AGENT"
          displayValue={agentPct}
          color="text-recovery"
          sublabel={`${agent.recovered} / ${agent.total_mandates} recovered`}
        />

        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
            lift
          </span>
          <span
            className={`font-display text-3xl md:text-4xl font-semibold tabular-nums ${
              liftIsPositive ? "text-recovery" : "text-fail"
            }`}
          >
            {liftIsPositive ? "+" : ""}
            {liftPct.toFixed(1)}
            <span className="text-lg">pp</span>
          </span>
          <span className="font-mono text-xs text-text-muted">
            {lift.relative_pct != null ? `${lift.relative_pct.toFixed(1)}% relative` : "—"}
          </span>
        </div>

        <ScoreBlock
          label="BASELINE"
          displayValue={baselinePct}
          color="text-baseline"
          sublabel={`${baseline.recovered} / ${baseline.total_mandates} recovered`}
          align="right"
        />
      </div>

      <div className="relative mt-6 pt-6 border-t border-ink-600 flex flex-wrap gap-x-10 gap-y-2 justify-center font-mono text-sm">
        <Stat label="At risk" value={formatRupees(amountAtRisk)} />
        <Stat label="Recovered by agent" value={formatRupees(amountRecovered)} color="text-recovery" />
        <Stat
          label="Additional vs baseline"
          value={(lift.additional_amount_recovered >= 0 ? "+" : "") + formatRupees(additionalRecovered)}
          color={lift.additional_amount_recovered >= 0 ? "text-recovery" : "text-fail"}
        />
      </div>
    </div>
  );
}

function RadarPulseBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="radar-ring radar-ring-1" />
      <div className="radar-ring radar-ring-2" />
      <div className="radar-ring radar-ring-3" />
      <style>{`
        .radar-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 9999px;
          border: 1px solid rgba(45, 212, 167, 0.12);
          transform: translate(-50%, -50%);
        }
        .radar-ring-1 { width: 300px; height: 300px; animation: radar-expand 4s ease-out infinite; }
        .radar-ring-2 { width: 300px; height: 300px; animation: radar-expand 4s ease-out 1.3s infinite; }
        .radar-ring-3 { width: 300px; height: 300px; animation: radar-expand 4s ease-out 2.6s infinite; }
        @keyframes radar-expand {
          0% { width: 40px; height: 40px; opacity: 0; }
          15% { opacity: 0.6; }
          100% { width: 900px; height: 900px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ScoreBlock({ label, displayValue, color, sublabel, align = "left" }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
        {label}
      </span>
      <span className={`font-display text-5xl md:text-6xl font-bold tabular-nums ${color}`}>
        {displayValue.toFixed(1)}
        <span className="text-2xl">%</span>
      </span>
      <span className="font-mono text-xs text-text-muted mt-1">{sublabel}</span>
    </div>
  );
}

function Stat({ label, value, color = "text-text-primary" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-text-faint">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function formatRupees(amount) {
  return "Rs." + Math.round(amount).toLocaleString("en-IN");
}
