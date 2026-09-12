// ── Planner API Service (Pass 2 — trip_components, places, tax_profiles, quote_terms) ──
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('bdvv_token');
  const res = await fetch(`${BACKEND}/api${path}`, {
    ...opts,
    credentials: 'include',   // still send the httpOnly cookie when the browser allows it
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const err = await res.json();
      msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch (_) { /* non-JSON body */ }
    if (res.status === 401) {
      // Only redirect if not already on login page to avoid infinite redirect loops
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('bdvv_user');
        localStorage.removeItem('bdvv_token');
        window.location.href = '/login';
      }
    }
    throw new Error(msg);
  }
  return res.json();
}

// ── Places ────────────────────────────────────────────────────────────────────
export const listPlaces  = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return apiFetch(`/places${qs ? `?${qs}` : ''}`);
};
export const createPlace = (body)       => apiFetch('/places',       { method: 'POST',   body: JSON.stringify(body) });
export const updatePlace = (id, body)   => apiFetch(`/places/${id}`, { method: 'PUT',    body: JSON.stringify(body) });
export const deletePlace = (id)         => apiFetch(`/places/${id}`, { method: 'DELETE' });

// ── Trip Components ───────────────────────────────────────────────────────────
export const listComponents    = (tripId, params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return apiFetch(`/trips/${tripId}/components${qs ? `?${qs}` : ''}`);
};
export const createComponent   = (tripId, body)        => apiFetch(`/trips/${tripId}/components`,              { method: 'POST',   body: JSON.stringify(body) });
export const updateComponent   = (tripId, compId, body)=> apiFetch(`/trips/${tripId}/components/${compId}`,    { method: 'PUT',    body: JSON.stringify(body) });
export const deleteComponent   = (tripId, compId)      => apiFetch(`/trips/${tripId}/components/${compId}`,    { method: 'DELETE' });
export const reorderComponents = (tripId, order)       => apiFetch(`/trips/${tripId}/components/reorder`,      { method: 'PUT',    body: JSON.stringify({ order }) });

// ── Tax Profiles ──────────────────────────────────────────────────────────────
export const listTaxProfiles  = ()           => apiFetch('/tax-profiles');
export const createTaxProfile = (body)       => apiFetch('/tax-profiles',       { method: 'POST',   body: JSON.stringify(body) });
export const updateTaxProfile = (id, body)   => apiFetch(`/tax-profiles/${id}`, { method: 'PUT',    body: JSON.stringify(body) });
export const deleteTaxProfile = (id)         => apiFetch(`/tax-profiles/${id}`, { method: 'DELETE' });

// ── Quote Terms Template ──────────────────────────────────────────────────────
export const getQuoteTerms    = ()     => apiFetch('/quote-terms-template');
export const updateQuoteTerms = (body) => apiFetch('/quote-terms-template', { method: 'PUT', body: JSON.stringify(body) });

// ── Pass 3: Itinerary Handoff & Divergence ────────────────────────────────────
export const generateItinerary = (tripId) =>
  apiFetch(`/trips/${tripId}/generate-itinerary`, { method: 'POST' });

export const flagDivergence = (tripId, payload) =>
  apiFetch(`/trips/${tripId}/divergence`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

// ── Compass AI × Itinerary Auto-Build ────────────────────────────────────────
export const aiGenerateItinerary = (payload) =>
  apiFetch('/itinerary/ai-generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
