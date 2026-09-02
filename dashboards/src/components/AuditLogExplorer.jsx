import { useEffect, useState } from "react";
import { getAuditLog } from "../api";

const EVENT_TYPES = ["decision", "outcome", "fallback_action", "fallback_action_error"];

/**
 * Browse the FULL audit trail across all 60 mandates, not just one at a
 * time via the drill-down. This is what turns "we have an audit trail"
 * from a claim into a genuinely explorable dataset — every decision, its
 * reasoning, and its outcome, filterable and searchable.
 */
export default function AuditLogExplorer() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("");
  const [side, setSide] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      getAuditLog({ eventType: eventType || undefined, side: side || undefined, mandateId: search || undefined, limit: 200 })
        .then((data) => {
          setEntries(data.entries);
          setTotal(data.total);
        })
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    }, 250); // debounce search-as-you-type
    return () => clearTimeout(handle);
  }, [eventType, side, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search mandate ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-ink-800 border border-ink-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-recovery/50"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value)}
          className="bg-ink-800 border border-ink-600 rounded-lg px-3 py-2 text-xs font-mono text-text-muted outline-none"
        >
          <option value="">All sides</option>
          <option value="agent">Agent</option>
          <option value="baseline">Baseline</option>
        </select>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="bg-ink-800 border border-ink-600 rounded-lg px-3 py-2 text-xs font-mono text-text-muted outline-none"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-text-faint mb-3 font-mono">
        {loading ? "loading…" : `${total} matching event(s), showing most recent ${entries.length}`}
      </p>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 divide-y divide-ink-700 max-h-[600px] overflow-y-auto">
        {entries.length === 0 && !loading && (
          <p className="text-sm text-text-faint text-center py-8">No events match this filter.</p>
        )}
        {entries.map((e, i) => (
          <LogRow key={i} entry={e} />
        ))}
      </div>
    </div>
  );
}

function LogRow({ entry }) {
  const time = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })
    : "";
  const sideColor = entry.side === "agent" ? "text-recovery" : entry.side === "baseline" ? "text-baseline" : "text-text-faint";

  return (
    <div className="px-4 py-3 flex items-start gap-4 text-sm hover:bg-ink-700/30">
      <span className="font-mono text-xs text-text-faint w-36 shrink-0">{time}</span>
      <span className={`font-mono text-xs w-16 shrink-0 ${sideColor}`}>{entry.side}</span>
      <span className="font-mono text-xs text-text-muted w-32 shrink-0">{entry.event_type}</span>
      <span className="font-mono text-xs text-text-primary w-40 shrink-0">{entry.mandate_id}</span>
      <span className="text-xs text-text-muted flex-1">{describeEntry(entry)}</span>
    </div>
  );
}

function describeEntry(e) {
  if (e.event_type === "decision" && e.action === "retry") {
    return `Scheduled retry for ${e.scheduled_date}${e.scheduled_hour != null ? ` at ${e.scheduled_hour}:00` : ""}${
      e.predicted_success_probability != null ? ` — predicted ${(e.predicted_success_probability * 100).toFixed(1)}%` : ""
    }`;
  }
  if (e.event_type === "decision" && e.action === "fallback") {
    return `Fallback triggered (${(e.reason || "").replaceAll("_", " ")})`;
  }
  if (e.event_type === "outcome") {
    return `Attempt ${e.attempt_number}: ${e.outcome}`;
  }
  if (e.event_type === "fallback_action") {
    return `Payment link + message generated${e.message_verified === false ? " — VERIFICATION FAILED" : " — verified"}`;
  }
  return JSON.stringify(e).slice(0, 100);
}
