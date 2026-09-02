/**
 * Thin fetch wrapper around the FastAPI backend. Every function here maps
 * 1:1 to a backend endpoint (see backend/main.py) — no client-side
 * recomputation of numbers the backend already computed and the test
 * suite already verified. If a number looks wrong, the fix belongs in
 * src/ or backend/main.py, never patched over here.
 *
 * API_BASE: empty string locally (Vite's dev proxy forwards /api/* to
 * localhost:8000 — see vite.config.js). In production, set
 * VITE_API_BASE_URL to the deployed backend's full URL (e.g.
 * https://mandateiq-backend.onrender.com), since there's no dev proxy
 * once this is deployed as a static site talking to a separate server.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON; keep statusText
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const getSummary = () => apiFetch("/api/summary");
export const getMandates = (side) =>
  apiFetch(side ? `/api/mandates?side=${side}` : "/api/mandates");
export const getMandateDetail = (mandateId) =>
  apiFetch(`/api/mandates/${encodeURIComponent(mandateId)}`);
export const getModelInfo = () => apiFetch("/api/model");
export const getFallbackActions = (side = "agent") =>
  apiFetch(`/api/fallback-actions?side=${side}`);
export const getAuditLog = ({ eventType, side, mandateId, limit = 500 } = {}) => {
  const params = new URLSearchParams();
  if (eventType) params.set("event_type", eventType);
  if (side) params.set("side", side);
  if (mandateId) params.set("mandate_id", mandateId);
  if (limit) params.set("limit", limit);
  const qs = params.toString();
  return apiFetch(qs ? `/api/audit-log?${qs}` : "/api/audit-log");
};
export const getRetryTiming = (side = "agent") =>
  apiFetch(`/api/retry-timing?side=${side}`);
export const getDemoMandates = () => apiFetch("/api/demo-mandates");
export const getAgentDemo = (mandateId) =>
  apiFetch(`/api/agent-demo/${encodeURIComponent(mandateId)}`);
export const predict = (params) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(`/api/predict?${qs}`);
};
