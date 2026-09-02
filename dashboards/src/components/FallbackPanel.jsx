import { useState } from "react";
import { formatRupees } from "./Scoreboard";
import MessagePreviewModal from "./MessagePreviewModal";

/**
 * Shows the real Razorpay test-mode payment links and Gemini-drafted
 * messages generated for mandates that exhausted their retry cap — plus
 * the "verified" badge, which is the concrete, demoable answer to "how
 * do you stop the LLM from hallucinating a wrong amount into a message
 * about money" (see fallback_agent.py's verify_message()).
 */
export default function FallbackPanel({ actions, onSelectMandate }) {
  const [previewAction, setPreviewAction] = useState(null);

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((a) => (
          <div key={a.mandate_id} className="card-interactive rounded-2xl border border-ink-600 bg-ink-800 p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-baseline uppercase tracking-wider">Fallback required</span>
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
            <span className="font-mono text-sm text-text-primary block mb-2">{a.mandate_id}</span>
            <div className="space-y-1 mb-3 text-xs">
              <CheckLine label="Customer message generated" />
              <CheckLine label="Payment link generated" />
              <CheckLine label="Link verified" ok={a.message_verified} />
              <CheckLine label="Audit event created" />
            </div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-mono text-text-faint">{formatRupees(a.subscription_amount)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewAction(a)}
                className="flex-1 text-xs font-mono text-text-muted hover:text-recovery border border-ink-600 rounded-lg py-2 transition-colors"
              >
                Preview message
              </button>
              {onSelectMandate && (
                <button
                  onClick={() => onSelectMandate(a.mandate_id)}
                  className="flex-1 text-xs font-mono text-text-muted hover:text-text-primary border border-ink-600 rounded-lg py-2 transition-colors"
                >
                  View mandate
                </button>
              )}
              <a
                href={a.payment_link_url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-center text-xs font-mono text-recovery border border-recovery/30 rounded-lg py-2 hover:bg-recovery/10 transition-colors"
              >
                Open link ↗
              </a>
            </div>
          </div>
        ))}
      </div>
      {previewAction && (
        <MessagePreviewModal action={previewAction} onClose={() => setPreviewAction(null)} />
      )}
    </>
  );
}

function CheckLine({ label, ok = true }) {
  return (
    <div className="flex items-center gap-1.5 text-text-muted">
      <span className={ok ? "text-recovery" : "text-fail"}>{ok ? "✓" : "✗"}</span>
      {label}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
