import StatusPill from "./StatusPill";
import { formatRupees } from "./Scoreboard";

/**
 * Dense, ledger-style table. IDs and amounts are set in mono deliberately
 * — this isn't decoration, monospace genuinely helps column alignment for
 * numeric/ID data, the way a real financial system would render it.
 */
export default function MandatesTable({ mandates, onSelect }) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-600 text-left text-text-faint font-mono text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Mandate</th>
              <th className="px-4 py-3 font-medium">Bank</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium text-center">Retries</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {mandates.map((m) => (
              <tr
                key={m.mandate_id}
                onClick={() => onSelect(m.mandate_id)}
                className="border-b border-ink-700 last:border-0 hover:bg-ink-700/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-text-primary">{m.mandate_id}</td>
                <td className="px-4 py-3 text-text-muted">{m.bank_name}</td>
                <td className="px-4 py-3 font-mono text-right text-text-primary">
                  {formatRupees(m.subscription_amount)}
                </td>
                <td className="px-4 py-3 font-mono text-center text-text-muted">
                  {m.retries_taken}
                </td>
                <td className="px-4 py-3">
                  <StatusPill recovered={m.recovered} recoveredVia={m.recovered_via} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
