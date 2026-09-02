import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/**
 * Premium fintech login screen. Honest about what it is: the email/
 * password form is present for the visual/product feel, but neither
 * "Sign in" nor "Create account" creates or checks a real account —
 * there's no backend auth system. Both paths are transparent about this
 * and lead to the same real destination: the demo environment. Nothing
 * here pretends persistent accounts exist.
 */
export default function Login() {
  const { enterDemo } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [notice, setNotice] = useState(null);

  function goToDemo(delay = 380) {
    setTransitioning(true);
    setTimeout(() => enterDemo(), delay);
  }

  function handleCreateAccount() {
    setNotice("This demo build doesn't have persistent accounts yet — taking you to the live demo environment instead.");
    setTimeout(() => goToDemo(), 900);
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-6 relative overflow-hidden ${transitioning ? "login-exit" : ""}`}>
      <AmbientBackground visible={theme === "dark"} />

      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-2">
          <LogoMark />
          <span className="font-display text-2xl font-semibold text-text-primary">
            Mandate<span className="text-recovery">IQ</span>
          </span>
        </div>
        <p className="text-base text-text-muted mb-8">Payment recovery intelligence</p>

        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-8">
          <div className="space-y-5">
            <Field label="Work email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-ink-900 border border-ink-600 rounded-lg px-4 py-3 text-[15px] text-text-primary placeholder:text-text-faint outline-none focus:border-ink-500"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-ink-900 border border-ink-600 rounded-lg px-4 py-3 pr-16 text-[15px] text-text-primary placeholder:text-text-faint outline-none focus:border-ink-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-text-faint hover:text-text-muted"
                >
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-faint cursor-pointer">
                <input type="checkbox" className="accent-recovery w-4 h-4" />
                Remember me
              </label>
              <span className="text-text-faint">Forgot password?</span>
            </div>

            <button
              type="button"
              disabled
              title="This is a hackathon demo build — no real account system exists yet. Use 'Enter Demo Environment' below."
              className="w-full rounded-lg border border-ink-600 bg-ink-700/50 text-text-faint text-[15px] font-medium py-3 cursor-not-allowed"
            >
              Sign in
            </button>

            <p className="text-center text-sm text-text-faint">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={handleCreateAccount}
                className="text-recovery hover:underline font-medium"
              >
                Create account
              </button>
            </p>
          </div>

          {notice && (
            <p className="mt-4 text-xs text-baseline bg-baseline/10 border border-baseline/30 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-ink-600" />
            <span className="text-xs font-mono text-text-faint uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-ink-600" />
          </div>

          <button
            onClick={() => goToDemo()}
            className="w-full rounded-lg bg-recovery text-ink-950 text-[15px] font-semibold py-3 hover:bg-recovery/90 transition-colors"
          >
            Enter Demo Environment →
          </button>
          <p className="text-xs text-text-faint text-center mt-3">
            No account needed — explore MandateIQ with real audited results from a live batch run.
          </p>
        </div>

        <p className="text-sm text-text-faint text-center mt-6">
          Built for Razorpay AI Buildathon 2026 &middot; AI Revenue Recovery track
        </p>
      </div>

      <style>{`
        .login-exit {
          animation: login-exit 0.38s ease-in forwards;
        }
        @keyframes login-exit {
          to { opacity: 0; transform: scale(0.98); }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-faint uppercase tracking-wide mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#0B1220" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#2DD4A7" strokeWidth="2" opacity="0.35" />
      <path d="M9 18 L13 14 L17 17 L23 9" fill="none" stroke="#2DD4A7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 9 L23 9 L23 14" fill="none" stroke="#2DD4A7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AmbientBackground({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-recovery/10"
            style={{
              width: 200,
              height: 200,
              animation: `radar-expand 5s ease-out ${i * 1.5}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes radar-expand {
          0% { width: 60px; height: 60px; opacity: 0; }
          15% { opacity: 0.5; }
          100% { width: 1000px; height: 1000px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
