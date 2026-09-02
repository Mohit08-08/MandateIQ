/**
 * The methodology/architecture story, browsable inside the app itself —
 * so a judge exploring the live URL doesn't have to leave and find the
 * GitHub README to understand what they're looking at. Content mirrors
 * the README's "Methodology & honesty" section, not a separate narrative.
 */
export default function AboutPanel() {
  return (
    <div className="max-w-3xl space-y-8">
      <Section title="What this is">
        <p>
          An ML-driven, policy-bounded agent that decides <em>when</em> to retry a failed
          UPI Autopay/e-mandate debit — instead of a fixed retry schedule — benchmarked
          against a documented smart-rule baseline, with hard safety caps and a full,
          queryable audit trail. Built for Razorpay AI Buildathon 2026, AI Revenue
          Recovery track.
        </p>
      </Section>

      <Section title="Architecture">
        <ol className="space-y-2 list-decimal list-inside">
          <li><span className="text-text-primary">A trained model</span> predicts retry-success probability from observable signal only — bank, day/hour, payer history, amount.</li>
          <li><span className="text-text-primary">A deterministic policy engine</span> consumes that prediction but enforces every hard safety rule itself, in code: max attempts, minimum gap, retry window. The model proposes; the policy disposes.</li>
          <li><span className="text-text-primary">A batch runner</span> simulates the full decide→act→observe loop for both the agent and the baseline, on the same held-out data.</li>
          <li><span className="text-text-primary">A fallback agent</span> handles mandates that exhaust their retry cap: a real Razorpay test-mode Payment Link, a Gemini-drafted message, and a programmatic check that the message actually contains the right amount and link before it's used.</li>
          <li><span className="text-text-primary">A full audit trail</span> logs every decision, its reasoning, and its outcome — browsable in the Audit Log tab, not just asserted in a report.</li>
        </ol>
      </Section>

      <Section title="Why this needs AI, not just rules">
        <p>
          A rule like "retry near the 1st of the month" captures the dominant salary-cycle
          signal cheaply. The model's honest marginal value comes from finer-grained,
          per-payer and per-bank personalization the rule can't see — which is why the
          baseline here is a genuinely competitive smart rule, not a strawman, and the
          lift is measured against it directly.
        </p>
      </Section>

      <Section title="Honesty notes">
        <ul className="space-y-2 list-disc list-inside">
          <li>All data is synthetic, generated from a documented, auditable formula — every coefficient is a named, commented constant, not a hidden magic number.</li>
          <li>The model never sees the hidden ground-truth driver used to generate outcomes — only observable proxies. Verified by an automated test, not just asserted.</li>
          <li>
            This project went through a full internal audit that found and fixed two real
            bugs — a shared-RNG reproducibility issue and a data-generation inconsistency.
            Fixing them <span className="text-recovery">reduced</span> the headline lift
            from an earlier, buggy +10.0pp to the current, correct +5.0pp. A smaller number
            that's true beats a larger one that wasn't.
          </li>
          <li>
            The agent's retry-hour choices (see Overview) cluster rather than perfectly
            tracking the documented peak hour — an honest artifact of learning from noisy,
            limited data, shown rather than hidden.
          </li>
        </ul>
      </Section>

      <Section title="Stack">
        <p className="font-mono text-xs text-text-muted leading-relaxed">
          Python · pandas · scikit-learn · joblib · FastAPI · React · Vite · Tailwind CSS v4
          · Recharts · Razorpay test-mode Payment Links API · Google Gemini API (free tier)
          · pytest (21 tests)
        </p>
        <p className="text-xs text-text-faint mt-2">Total cost to build and run: ₹0.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="font-display text-sm uppercase tracking-widest text-recovery mb-3">
        {title}
      </h3>
      <div className="text-sm text-text-muted leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
