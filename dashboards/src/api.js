/**
 * Thin fetch wrapper around the FastAPI backend. Every function here maps
 * 1:1 to a backend endpoint (see backend/main.py) — no client-side
 * recomputation of numbers the backend already computed and the test
 * suite already verified. If a number looks wrong, the fix belongs in
 * src/ or backend/main.py, never patched over here.
 */

async function apiFetch(path) {
  const res = await fetch(path);
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
