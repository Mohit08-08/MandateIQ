/**
 * The signature visual moment: a terminal/scoreboard-style readout of the
 * agent-vs-baseline recovery rate, with the lift as the focal element.
 * This is deliberately the FIRST thing on the page — the whole project's
 * credibility rests on this one honest number, so it gets top billing,
 * not buried under a KPI-card grid.
 */
export default function Scoreboard({ summary }) {
  const { agent, baseline, lift } = summary;
  const liftIsPositive = lift.percentage_points >= 0;

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8">
      <div className="flex items-center justify-between gap-8">
        <ScoreBlock
          label="AGENT"
          rate={agent.recovery_rate}
          color="text-recovery"
          sublabel={`${agent.recovered} / ${agent.total_mandates} recovered`}
        />

        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
            lift
          </span>
          <span
            className={`font-display text-3xl md:text-4xl font-semibold ${
              liftIsPositive ? "text-recovery" : "text-fail"
            }`}
          >
            {liftIsPositive ? "+" : ""}
            {lift.percentage_points.toFixed(1)}
            <span className="text-lg">pp</span>
          </span>
          <span className="font-mono text-xs text-text-muted">
            {lift.relative_pct != null ? `${lift.relative_pct.toFixed(1)}% relative` : "—"}
          </span>
        </div>

        <ScoreBlock
          label="BASELINE"
          rate={baseline.recovery_rate}
          color="text-baseline"
          sublabel={`${baseline.recovered} / ${baseline.total_mandates} recovered`}
          align="right"
        />
      </div>

      <div className="mt-6 pt-6 border-t border-ink-600 flex flex-wrap gap-x-10 gap-y-2 justify-center font-mono text-sm">
        <Stat label="At risk" value={formatRupees(agent.amount_at_risk)} />
        <Stat
          label="Recovered by agent"
          value={formatRupees(agent.amount_recovered)}
          color="text-recovery"
        />
        <Stat
          label="Additional vs baseline"
          value={
            (lift.additional_amount_recovered >= 0 ? "+" : "") +
            formatRupees(lift.additional_amount_recovered)
          }
          color={lift.additional_amount_recovered >= 0 ? "text-recovery" : "text-fail"}
        />
      </div>
    </div>
  );
}

function ScoreBlock({ label, rate, color, sublabel, align = "left" }) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
        {label}
      </span>
      <span className={`font-display text-5xl md:text-6xl font-bold ${color}`}>
        {(rate * 100).toFixed(1)}
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
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

export function formatRupees(amount) {
  return "Rs." + Math.round(amount).toLocaleString("en-IN");
}
