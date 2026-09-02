import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const NAV_ITEMS = ["Overview", "Mandates", "Agent", "Model", "Fallback Actions", "Audit Trail"];

export default function Sidebar({ activeTab, onSelectTab, mobileOpen, onCloseMobile }) {
  const { exitDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink-950/70 z-40 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-ink-800 border-r border-ink-600 flex flex-col z-50 transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-ink-600">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-xl font-semibold text-text-primary">
              Mandate<span className="text-recovery">IQ</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item;
            return (
              <button
                key={item}
                onClick={() => { onSelectTab(item); onCloseMobile?.(); }}
                className={`relative w-full text-left px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors ${
                  active ? "text-text-primary bg-ink-700/60" : "text-text-faint hover:text-text-muted hover:bg-ink-700/30"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-recovery nav-indicator" />
                )}
                {item}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-ink-600 space-y-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between text-sm text-text-muted hover:text-text-primary border border-ink-600 rounded-lg px-3 py-2 transition-colors"
          >
            <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
            {theme === "dark" ? <MoonIcon /> : <SunIcon />}
          </button>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-recovery status-dot" />
            <span className="text-text-muted">Agent Status &middot; Operational</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-baseline bg-baseline/10 border border-baseline/30 rounded-full px-2 py-1">
              Demo Environment
            </span>
          </div>
          <button
            onClick={exitDemo}
            className="w-full text-left text-xs text-text-faint hover:text-text-muted transition-colors"
          >
            Demo User &middot; Exit demo
          </button>
        </div>

        <style>{`
          .nav-indicator { animation: indicator-in 0.2s ease-out; }
          @keyframes indicator-in { from { height: 0; opacity: 0; } to { height: 20px; opacity: 1; } }
          .status-dot { animation: status-pulse 2s ease-in-out infinite; }
          @keyframes status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        `}</style>
      </aside>
    </>
  );
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#0B1220" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#2DD4A7" strokeWidth="2" opacity="0.35" />
      <path d="M9 18 L13 14 L17 17 L23 9" fill="none" stroke="#2DD4A7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 9 L23 9 L23 14" fill="none" stroke="#2DD4A7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 9.5A6 6 0 116.5 2.5a5 5 0 007 7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
