// ── Sources (Research-and-Capture) API Service ─────────────────────────────
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
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const sourcesAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return apiFetch(`/sources${qs ? `?${qs}` : ''}`);
  },
  create: (body)       => apiFetch('/sources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body)   => apiFetch(`/sources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id)         => apiFetch(`/sources/${id}`, { method: 'DELETE' }),
};
