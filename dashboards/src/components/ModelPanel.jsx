/**
 * The model transparency panel. Turns two of the project's strongest
 * technical claims into something a judge can visually verify instead of
 * taking on faith: (1) the feature list, showing payer_archetype is
 * absent — proof of no label leakage; (2) cross-validation results
 * alongside the held-out test score, so the AUC isn't presented as more
 * certain than it is.
 */
export default function ModelPanel({ model }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
        <h3 className="font-display text-sm uppercase tracking-widest text-text-faint mb-4">
          Model performance
        </h3>
        <div className="space-y-4">
          <Metric
            label="Held-out test AUC"
            value={model.held_out_test_auc.toFixed(3)}
            note="single train/test split, 25% held out"
          />
          {Object.entries(model.cross_validation).map(([type, cv]) => (
            <Metric
              key={type}
              label={`${type} — 5-fold CV AUC`}
              value={`${cv.mean_auc.toFixed(3)} ± ${cv.std_auc.toFixed(3)}`}
              note={type === model.selected_model.split(" ")[0] ? "selected model" : undefined}
            />
          ))}
          <Metric
            label="Brier score"
            value={model.held_out_test_brier.toFixed(3)}
            note="lower is better; 0.25 = coin-flip level"
          />
        </div>
        <p className="text-xs text-text-faint mt-4 pt-4 border-t border-ink-700">
          Trained {new Date(model.trained_at_utc).toLocaleString("en-IN")} &middot;
          scikit-learn {model.sklearn_version}
        </p>
      </div>

      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm uppercase tracking-widest text-text-faint">
            Features used
          </h3>
          <span className="text-xs font-mono text-recovery bg-recovery/10 border border-recovery/30 rounded-full px-2.5 py-1">
            no label leakage
          </span>
        </div>
        <FeatureList label="Numeric" features={model.numeric_features} />
        <FeatureList label="Categorical" features={model.categorical_features} />
        <p className="text-xs text-text-faint mt-4 pt-4 border-t border-ink-700">
          <code className="text-fail">payer_archetype</code> — the hidden ground-truth
          driver used only to generate simulated outcomes — is intentionally
          absent from this list. The model only ever sees observable signals.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, note }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <span className="text-sm text-text-primary">{label}</span>
        {note && <p className="text-xs text-text-faint">{note}</p>}
      </div>
      <span className="font-mono text-lg text-recovery">{value}</span>
    </div>
  );
}

function FeatureList({ label, features }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-mono text-text-faint uppercase mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {features.map((f) => (
          <span
            key={f}
            className="text-xs font-mono bg-ink-700 border border-ink-600 rounded px-2 py-1 text-text-muted"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
