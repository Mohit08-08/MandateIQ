import { useEffect, useState } from "react";
import { getSummary, getMandates, getMandateDetail, getModelInfo, getFallbackActions } from "./api";
import Scoreboard from "./components/Scoreboard";
import ComparisonChart from "./components/ComparisonChart";
import MandatesTable from "./components/MandatesTable";
import MandateDrillDown from "./components/MandateDrillDown";
import ModelPanel from "./components/ModelPanel";
import FallbackPanel from "./components/FallbackPanel";

const TABS = ["Overview", "Mandates", "Model", "Fallback Actions"];

export default function App() {
  const [summary, setSummary] = useState(null);
  const [mandates, setMandates] = useState(null);
  const [model, setModel] = useState(null);
  const [fallbackActions, setFallbackActions] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedMandate, setSelectedMandate] = useState(null);

  useEffect(() => {
    Promise.all([
      getSummary(),
      getMandates("agent"),
      getModelInfo(),
      getFallbackActions("agent"),
    ])
      .then(([s, m, mo, fa]) => {
        setSummary(s);
        setMandates(m);
        setModel(mo);
        setFallbackActions(fa);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSelectMandate(mandateId) {
    try {
      const detail = await getMandateDetail(mandateId);
      setSelectedMandate(detail);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <p className="font-display text-xl text-fail mb-2">Couldn't reach the backend</p>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <p className="text-xs text-text-faint font-mono">
            Make sure FastAPI is running: cd backend &amp;&amp; uvicorn main:app --reload --port 8000
          </p>
        </div>
      </div>
    );
  }

  if (!summary || !mandates || !model) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-faint font-mono text-sm animate-pulse">Loading MandateIQ…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-600 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-text-primary">
              Mandate<span className="text-recovery">IQ</span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Smart retry-timing agent for failed UPI Autopay mandates
            </p>
          </div>
          <span className="text-xs font-mono text-text-faint bg-ink-800 border border-ink-600 rounded-full px-3 py-1.5">
            {summary.agent.total_mandates} mandates &middot; batch complete
          </span>
        </div>
      </header>

      <nav className="border-b border-ink-600 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-recovery text-text-primary"
                  : "border-transparent text-text-faint hover:text-text-muted"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            <Scoreboard summary={summary} />
            <ComparisonChart agent={summary.agent} baseline={summary.baseline} />
          </div>
        )}

        {activeTab === "Mandates" && (
          <MandatesTable mandates={mandates} onSelect={handleSelectMandate} />
        )}

        {activeTab === "Model" && <ModelPanel model={model} />}

        {activeTab === "Fallback Actions" && (
          <FallbackPanel actions={fallbackActions ?? []} />
        )}
      </main>

      {selectedMandate && (
        <MandateDrillDown data={selectedMandate} onClose={() => setSelectedMandate(null)} />
      )}
    </div>
  );
}
