import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { getSummary, getMandates, getMandateDetail, getModelInfo, getFallbackActions } from "./api";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import Scoreboard from "./components/Scoreboard";
import ComparisonChart from "./components/ComparisonChart";
import RetryFlowDiagram from "./components/RetryFlowDiagram";
import RetryTimingChart from "./components/RetryTimingChart";
import RecoveryFunnel from "./components/RecoveryFunnel";
import RevenueAtRisk from "./components/RevenueAtRisk";
import PageHeader from "./components/PageHeader";
import MandatesTable from "./components/MandatesTable";
import MandateDrillDown from "./components/MandateDrillDown";
import AgentPage from "./components/AgentPage";
import ModelPanel from "./components/ModelPanel";
import FallbackPanel from "./components/FallbackPanel";
import AuditLogExplorer from "./components/AuditLogExplorer";

export default function App() {
  const { isDemoActive } = useAuth();
  if (!isDemoActive) return <Login />;
  return <Dashboard />;
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [mandates, setMandates] = useState(null);
  const [baselineMandates, setBaselineMandates] = useState(null);
  const [model, setModel] = useState(null);
  const [fallbackActions, setFallbackActions] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedMandate, setSelectedMandate] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getSummary(),
      getMandates("agent"),
      getMandates("baseline"),
      getModelInfo(),
      getFallbackActions("agent"),
    ])
      .then(([s, m, bm, mo, fa]) => {
        setSummary(s);
        setMandates(m);
        setBaselineMandates(bm);
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
    <div className="min-h-screen md:flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0">
        <header className="md:hidden border-b border-ink-600 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileNavOpen(true)} className="text-text-muted">
            ☰
          </button>
          <span className="font-display text-sm text-text-primary">
            Mandate<span className="text-recovery">IQ</span>
          </span>
          <span className="w-6" />
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          <div key={activeTab} className="tab-fade-in">
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <PageHeader title="Overview" subtitle="Recover more revenue with smarter retry timing." />
                <Scoreboard summary={summary} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <RecoveryFunnel summary={summary} />
                  <RevenueAtRisk summary={summary} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="md:col-span-2">
                    <ComparisonChart agent={summary.agent} baseline={summary.baseline} />
                  </div>
                  <div className="md:col-span-3">
                    <RetryFlowDiagram />
                  </div>
                </div>
                <RetryTimingChart />
              </div>
            )}

            {activeTab === "Mandates" && (
              <div>
                <PageHeader title="Mandates" subtitle="Every mandate in the batch, agent vs. baseline outcome." />
                <MandatesTable
                  mandates={mandates}
                  baselineMandates={baselineMandates}
                  onSelect={handleSelectMandate}
                />
              </div>
            )}

            {activeTab === "Agent" && <AgentPage summary={summary} />}

            {activeTab === "Model" && (
              <div>
                <PageHeader title="Model" subtitle="What influences the recovery decision." />
                <ModelPanel model={model} />
              </div>
            )}

            {activeTab === "Fallback Actions" && (
              <div>
                <PageHeader title="Fallback Actions" subtitle="Mandates that exhausted their retry cap." />
                <FallbackPanel actions={fallbackActions ?? []} onSelectMandate={handleSelectMandate} />
              </div>
            )}

            {activeTab === "Audit Trail" && (
              <div>
                <PageHeader title="Audit Trail" subtitle="Every decision, its reasoning, and its outcome." />
                <AuditLogExplorer />
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .tab-fade-in {
          animation: tab-fade-in 0.35s ease-out;
        }
        @keyframes tab-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {selectedMandate && (
        <MandateDrillDown data={selectedMandate} onClose={() => setSelectedMandate(null)} />
      )}
    </div>
  );
}
