import { formatRupees } from "./Scoreboard";

/**
 * The audit-trail drill-down. This is the concrete answer to "show me
 * why the agent did what it did" — every decision, its reasoning, and
 * its outcome, for both the agent and the baseline, side by side, on one
 * specific mandate. This is what makes the project's audit-trail claim
 * demonstrable rather than assertable.
 */
export default function MandateDrillDown({ data, onClose }) {
  if (!data) return null;
  const { mandate_id, details, audit_trail } = data;

  return (
    <div
      className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-full bg-ink-900 border-l border-ink-600 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-ink-900/95 backdrop-blur border-b border-ink-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-lg text-text-primary">{mandate_id}</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {details.bank_name} &middot; {formatRupees(details.subscription_amount)} &middot;{" "}
              {details.amount_tier} tier
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text-primary text-2xl leading-none px-2"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <Timeline title="Agent" color="recovery" events={audit_trail.agent} />
          <Timeline title="Baseline" color="baseline" events={audit_trail.baseline} />
        </div>
      </div>
    </div>
  );
}

function Timeline({ title, color, events }) {
  const colorClass = color === "recovery" ? "text-recovery" : "text-baseline";
  const dotClass = color === "recovery" ? "bg-recovery" : "bg-baseline";

  return (
    <div>
      <h3 className={`font-display text-sm uppercase tracking-widest mb-3 ${colorClass}`}>
        {title}
      </h3>
      {events.length === 0 ? (
        <p className="text-sm text-text-faint">No audit events recorded.</p>
      ) : (
        <ol className="space-y-4">
          {events.map((event, i) => (
            <li key={i} className="relative pl-5">
              <span
                className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${dotClass}`}
              />
              {i < events.length - 1 && (
                <span className="absolute left-[3px] top-4 bottom-[-1rem] w-px bg-ink-600" />
              )}
              <EventCard event={event} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EventCard({ event }) {
  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "";

  if (event.event_type === "decision" && event.action === "retry") {
    return (
      <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-text-faint">DECISION &middot; {time}</span>
        </div>
        <p className="text-sm text-text-primary">
          Scheduled retry for{" "}
          <span className="font-mono">{event.scheduled_date}</span>
          {event.scheduled_hour != null && (
            <span className="font-mono"> at {event.scheduled_hour}:00</span>
          )}
        </p>
        {event.predicted_success_probability != null && (
          <p className="text-xs text-text-muted mt-1 font-mono">
            predicted success: {(event.predicted_success_probability * 100).toFixed(1)}%
          </p>
        )}
        {event.reasoning && (
          <p className="text-xs text-text-faint mt-1.5 italic">{event.reasoning}</p>
        )}
      </div>
    );
  }

  if (event.event_type === "decision" && event.action === "fallback") {
    return (
      <div className="rounded-lg border border-fail/30 bg-fail/5 p-3">
        <span className="text-xs font-mono text-text-faint">DECISION &middot; {time}</span>
        <p className="text-sm text-fail mt-1">
          Fallback triggered ({event.reason?.replaceAll("_", " ")})
        </p>
      </div>
    );
  }

  if (event.event_type === "outcome") {
    const success = event.outcome === "success";
    return (
      <div
        className={`rounded-lg border p-3 ${
          success ? "border-recovery/30 bg-recovery/5" : "border-ink-600 bg-ink-800"
        }`}
      >
        <span className="text-xs font-mono text-text-faint">OUTCOME &middot; {time}</span>
        <p className={`text-sm mt-1 ${success ? "text-recovery" : "text-text-muted"}`}>
          Attempt {event.attempt_number}: {event.outcome}
        </p>
      </div>
    );
  }

  if (event.event_type === "fallback_action") {
    return (
      <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
        <span className="text-xs font-mono text-text-faint">FALLBACK ACTION &middot; {time}</span>
        <p className="text-sm text-text-primary mt-1">{event.message}</p>
        {event.payment_link_url && (
          <a
            href={event.payment_link_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-recovery hover:underline mt-1 inline-block"
          >
            {event.payment_link_url}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
      <span className="text-xs font-mono text-text-faint">{event.event_type}</span>
    </div>
  );
}
