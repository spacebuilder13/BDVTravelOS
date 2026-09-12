// ── Trip Planner API Service ────────────────────────────────────────────────
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BACKEND}/api${path}`, {
    ...opts,
    credentials: 'include',   // send httpOnly cookie automatically (no localStorage token)
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const err = await res.json();
      msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch (_) { /* response body is not JSON — use the status-based message */ }
    if (res.status === 401) {
      // Only redirect if not already on login page to avoid infinite redirect loops
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('bdvv_user');
        window.location.href = '/login';
      }
    }
    throw new Error(msg);
  }
  return res.json();
}

// ── Trips ────────────────────────────────────────────────────────────────────
export const listTrips = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return apiFetch(`/trips${qs ? `?${qs}` : ''}`);
};
export const createTrip  = (body)       => apiFetch('/trips', { method: 'POST', body: JSON.stringify(body) });
export const updateTrip  = (id, body)   => apiFetch(`/trips/${id}`, { method: 'PUT',  body: JSON.stringify(body) });
export const deleteTrip  = (id)         => apiFetch(`/trips/${id}`, { method: 'DELETE' });
export const cloneTrip   = (id)         => apiFetch(`/trips/${id}/clone`, { method: 'POST' });
export const getTripFull = (id)         => apiFetch(`/trips/${id}/full`);
export const validateTrip = (id)        => apiFetch(`/trips/${id}/validate`);

// ── Stops ────────────────────────────────────────────────────────────────────
export const addStop      = (tripId, body)          => apiFetch(`/trips/${tripId}/stops`,          { method: 'POST', body: JSON.stringify(body) });
export const updateStop   = (tripId, stopId, body)  => apiFetch(`/trips/${tripId}/stops/${stopId}`, { method: 'PUT',  body: JSON.stringify(body) });
export const deleteStop   = (tripId, stopId)        => apiFetch(`/trips/${tripId}/stops/${stopId}`, { method: 'DELETE' });
export const reorderStops = (tripId, order)         => apiFetch(`/trips/${tripId}/stops/reorder`,  { method: 'POST', body: JSON.stringify({ order }) });

// ── Legs ─────────────────────────────────────────────────────────────────────
export const addLeg    = (tripId, body)         => apiFetch(`/trips/${tripId}/legs`,         { method: 'POST', body: JSON.stringify(body) });
export const updateLeg = (tripId, legId, body)  => apiFetch(`/trips/${tripId}/legs/${legId}`, { method: 'PUT',  body: JSON.stringify(body) });
export const deleteLeg = (tripId, legId)        => apiFetch(`/trips/${tripId}/legs/${legId}`, { method: 'DELETE' });

// ── Stays ────────────────────────────────────────────────────────────────────
export const addStay    = (body)          => apiFetch('/stays',          { method: 'POST', body: JSON.stringify(body) });
export const updateStay = (id, body)      => apiFetch(`/stays/${id}`,    { method: 'PUT',  body: JSON.stringify(body) });
export const deleteStay = (id)            => apiFetch(`/stays/${id}`,    { method: 'DELETE' });

// ── Restaurants ──────────────────────────────────────────────────────────────
export const listRestaurants   = (tid, sid)      => apiFetch(`/trips/${tid}/stops/${sid}/restaurants`);
export const addRestaurant     = (tid, sid, b)   => apiFetch(`/trips/${tid}/stops/${sid}/restaurants`, { method:'POST', body:JSON.stringify(b) });
export const updateRestaurant  = (tid, id, b)    => apiFetch(`/trips/${tid}/restaurants/${id}`,       { method:'PUT',  body:JSON.stringify(b) });
export const deleteRestaurant  = (tid, id)       => apiFetch(`/trips/${tid}/restaurants/${id}`,       { method:'DELETE' });

// ── Attractions ───────────────────────────────────────────────────────────────
export const listAttractions   = (tid, sid)      => apiFetch(`/trips/${tid}/stops/${sid}/attractions`);
export const addAttraction     = (tid, sid, b)   => apiFetch(`/trips/${tid}/stops/${sid}/attractions`, { method:'POST', body:JSON.stringify(b) });
export const updateAttraction  = (tid, id, b)    => apiFetch(`/trips/${tid}/attractions/${id}`,        { method:'PUT',  body:JSON.stringify(b) });
export const deleteAttraction  = (tid, id)       => apiFetch(`/trips/${tid}/attractions/${id}`,        { method:'DELETE' });

// ── Tourist Info Points ───────────────────────────────────────────────────────
export const listInfoPoints    = (tid, sid)      => apiFetch(`/trips/${tid}/stops/${sid}/info_points`);
export const addInfoPoint      = (tid, sid, b)   => apiFetch(`/trips/${tid}/stops/${sid}/info_points`, { method:'POST', body:JSON.stringify(b) });
export const updateInfoPoint   = (tid, id, b)    => apiFetch(`/trips/${tid}/info_points/${id}`,        { method:'PUT',  body:JSON.stringify(b) });
export const deleteInfoPoint   = (tid, id)       => apiFetch(`/trips/${tid}/info_points/${id}`,        { method:'DELETE' });

// ── Meeting Points ────────────────────────────────────────────────────────────
export const listMeetingPoints  = (tid, sid)     => apiFetch(`/trips/${tid}/stops/${sid}/meeting_points`);
export const addMeetingPoint    = (tid, sid, b)  => apiFetch(`/trips/${tid}/stops/${sid}/meeting_points`, { method:'POST', body:JSON.stringify(b) });
export const updateMeetingPoint = (tid, id, b)   => apiFetch(`/trips/${tid}/meeting_points/${id}`,        { method:'PUT',  body:JSON.stringify(b) });
export const deleteMeetingPoint = (tid, id)      => apiFetch(`/trips/${tid}/meeting_points/${id}`,        { method:'DELETE' });

export const listPins   = ()          => apiFetch('/pins');
export const createPin  = (body)      => apiFetch('/pins',       { method: 'POST', body: JSON.stringify(body) });
export const updatePin  = (id, body)  => apiFetch(`/pins/${id}`, { method: 'PUT',  body: JSON.stringify(body) });
export const deletePin  = (id)        => apiFetch(`/pins/${id}`, { method: 'DELETE' });
