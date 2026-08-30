import { formatRupees } from "./Scoreboard";

/**
 * Shows the real Razorpay test-mode payment links and Gemini-drafted
 * messages generated for mandates that exhausted their retry cap — plus
 * the "verified" badge, which is the concrete, demoable answer to "how
 * do you stop the LLM from hallucinating a wrong amount into a message
 * about money" (see fallback_agent.py's verify_message()).
 */
export default function FallbackPanel({ actions }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8 text-center">
        <p className="text-text-muted text-sm">
          No fallback actions recorded for this side.
        </p>
        <p className="text-text-faint text-xs mt-1">
          Run fallback_agent.py after run_batch.py to generate these.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {actions.map((a) => (
        <div key={a.mandate_id} className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm text-text-primary">{a.mandate_id}</span>
            {a.message_verified ? (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-recovery">
                <CheckIcon /> verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-fail">
                unverified — review
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted mb-3">{a.message}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-text-faint">
              {formatRupees(a.subscription_amount)}
            </span>
            <a
              href={a.payment_link_url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-recovery hover:underline"
            >
              {a.payment_link_url}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.5L4.5 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
