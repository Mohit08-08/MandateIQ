import { useMemo, useState } from "react";
import StatusPill from "./StatusPill";
import { formatRupees } from "./Scoreboard";

/**
 * The mandates table, upgraded to be genuinely explorable: search, status
 * filter, sortable columns, a "swing" column showing whether the agent
 * and baseline AGREED or DIFFERED on this specific mandate (the real
 * evidence behind the aggregate lift number), and CSV export.
 */
export default function MandatesTable({ mandates, baselineMandates, onSelect }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("mandate_id");
  const [sortDir, setSortDir] = useState("asc");

  const baselineByMandate = useMemo(() => {
    const map = {};
    (baselineMandates || []).forEach((m) => { map[m.mandate_id] = m; });
    return map;
  }, [baselineMandates]);

  const enriched = useMemo(() => {
    return mandates.map((m) => {
      const b = baselineByMandate[m.mandate_id];
      let swing = "unknown";
      if (b) {
        if (m.recovered && b.recovered) swing = "both";
        else if (m.recovered && !b.recovered) swing = "agent_only";
        else if (!m.recovered && b.recovered) swing = "baseline_only";
        else swing = "neither";
      }
      return { ...m, swing };
    });
  }, [mandates, baselineByMandate]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (statusFilter === "recovered") rows = rows.filter((m) => m.recovered);
    if (statusFilter === "fallback") rows = rows.filter((m) => !m.recovered);
    if (statusFilter === "agent_only") rows = rows.filter((m) => m.swing === "agent_only");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (m) => m.mandate_id.toLowerCase().includes(q) || m.bank_name.toLowerCase().includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [enriched, statusFilter, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const headers = ["mandate_id", "bank_name", "subscription_amount", "retries_taken", "recovered", "swing"];
    const rows = filtered.map((m) => headers.map((h) => m[h]).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mandateiq_mandates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const agentOnlyCount = enriched.filter((m) => m.swing === "agent_only").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search mandate ID or bank…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-ink-800 border border-ink-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-recovery/50"
        />
        <FilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label="All" />
        <FilterButton active={statusFilter === "recovered"} onClick={() => setStatusFilter("recovered")} label="Recovered" />
        <FilterButton active={statusFilter === "fallback"} onClick={() => setStatusFilter("fallback")} label="Fallback" />
        <FilterButton
          active={statusFilter === "agent_only"}
          onClick={() => setStatusFilter("agent_only")}
          label={`Agent-only wins (${agentOnlyCount})`}
        />
        <button
          onClick={exportCsv}
          className="text-xs font-mono text-text-muted hover:text-recovery border border-ink-600 rounded-lg px-3 py-2 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-600 text-left text-text-faint font-mono text-xs uppercase tracking-wider">
                <SortableHeader label="Mandate" columnKey="mandate_id" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                <SortableHeader label="Bank" columnKey="bank_name" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                <SortableHeader label="Amount" columnKey="subscription_amount" align="right" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                <SortableHeader label="Retries" columnKey="retries_taken" align="center" sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">vs. Baseline</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
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
                  <td className="px-4 py-3 font-mono text-center text-text-muted">{m.retries_taken}</td>
                  <td className="px-4 py-3">
                    <StatusPill recovered={m.recovered} recoveredVia={m.recovered_via} />
                  </td>
                  <td className="px-4 py-3">
                    <SwingBadge swing={m.swing} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-faint text-sm">
                    No mandates match this search/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-text-faint mt-2">
        Showing {filtered.length} of {enriched.length} mandates.
      </p>
    </div>
  );
}

function FilterButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-mono rounded-lg px-3 py-2 border transition-colors ${
        active
          ? "border-recovery/50 bg-recovery/10 text-recovery"
          : "border-ink-600 text-text-muted hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function SortableHeader({ label, columnKey, sortKey, sortDir, toggleSort, align = "left" }) {
  const isActive = sortKey === columnKey;
  return (
    <th
      onClick={() => toggleSort(columnKey)}
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-text-primary transition-colors ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      {label}
      {isActive && <span className="ml-1 text-recovery">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function SwingBadge({ swing }) {
  const map = {
    both: { label: "both recovered", cls: "text-text-muted" },
    agent_only: { label: "agent-only win", cls: "text-recovery" },
    baseline_only: { label: "baseline-only win", cls: "text-baseline" },
    neither: { label: "neither recovered", cls: "text-fail" },
    unknown: { label: "—", cls: "text-text-faint" },
  };
  const { label, cls } = map[swing] || map.unknown;
  return <span className={`text-xs font-mono ${cls}`}>{label}</span>;
}
