import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "mandateiq_demo_session";

/**
 * Frontend-only demo session state. There is no real backend auth behind
 * this — it deliberately does not pretend otherwise. "Sign in" with a
 * typed email/password does NOT create a real session (there's no
 * account system to check it against); only "Enter Demo Environment"
 * actually grants access. This keeps the premium-login visual without
 * ever implying a real account exists. Structured as a context so real
 * auth could be swapped in later without touching consuming components.
 */
export function AuthProvider({ children }) {
  const [isDemoActive, setIsDemoActive] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "true"
  );

  useEffect(() => {
    if (isDemoActive) sessionStorage.setItem(STORAGE_KEY, "true");
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [isDemoActive]);

  const enterDemo = () => setIsDemoActive(true);
  const exitDemo = () => setIsDemoActive(false);

  return (
    <AuthContext.Provider value={{ isDemoActive, enterDemo, exitDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
