import { formatRupees } from "./Scoreboard";

/**
 * Explains a decision using ONLY real feature values the model actually
 * saw — no invented categories (e.g. no fabricated "balance pattern"
 * signal that isn't a real feature in the model's schema).
 */
export default function WhyThisDecision({ mandate, bestChoice, marginPct }) {
  const isSalaryWindow = new Date(bestChoice.date).getDate();
  const salaryDay = [1, 2, 3, 28, 29, 30, 31].includes(isSalaryWindow);

  const factors = [
    { label: "Bank", value: mandate.bank_name },
    { label: "Historical success rate", value: `${(mandate.payer_historical_success_rate * 100).toFixed(0)}%` },
    { label: "Payer tenure", value: `${mandate.payer_tenure_months} months` },
    { label: "Amount tier", value: mandate.amount_tier },
    { label: "Salary-window alignment", value: salaryDay ? "yes" : "no" },
  ];

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900 p-4">
      <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-3">
        Why this window
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
        {factors.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between">
            <span className="text-xs text-text-muted">{f.label}</span>
            <span className="text-xs font-mono text-text-primary">{f.value}</span>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-ink-700 flex items-baseline justify-between">
        <span className="text-xs text-text-muted">vs. average candidate slot</span>
        <span className="text-xs font-mono text-recovery">+{marginPct.toFixed(1)}pp</span>
      </div>
    </div>
  );
}
