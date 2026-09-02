import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

/**
 * Minimal toast system. Used ONLY for feedback on real, meaningful state
 * changes (demo steps, filter actions) — not decoration on every click.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in rounded-lg border px-4 py-2.5 text-sm font-mono shadow-lg backdrop-blur ${
              t.tone === "success"
                ? "border-recovery/40 bg-ink-800/95 text-recovery"
                : t.tone === "error"
                ? "border-fail/40 bg-ink-800/95 text-fail"
                : "border-ink-600 bg-ink-800/95 text-text-primary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        .toast-in {
          animation: toast-in 0.25s ease-out;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
