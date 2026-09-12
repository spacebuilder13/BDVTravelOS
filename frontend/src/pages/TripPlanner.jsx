import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map, Plus, Search, Loader2, Copy, Calendar, Users,
  ChevronRight, Filter, Route
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { listTrips, createTrip, cloneTrip, updateTrip } from '../services/tripAPI';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:               { label: 'Draft',       bg: 'rgba(143,179,199,0.10)', text: '#8FB3C7', border: 'rgba(143,179,199,0.22)' },
  quoted:              { label: 'Quoted',      bg: 'rgba(255,179,0,0.12)',   text: '#FFB300', border: 'rgba(255,179,0,0.30)'   },
  sent:                { label: 'Sent',        bg: 'rgba(79,195,247,0.12)',  text: '#4FC3F7', border: 'rgba(79,195,247,0.28)'  },
  approved:            { label: 'Approved',    bg: 'rgba(47,158,111,0.14)', text: '#2F9E6F', border: 'rgba(47,158,111,0.30)'  },
  booked:              { label: 'Booked',      bg: 'rgba(0,214,194,0.12)',  text: '#00D6C2', border: 'rgba(0,214,194,0.28)'   },
  itinerary_generated: { label: 'Itinerary',  bg: 'rgba(0,229,255,0.10)',  text: '#00E5FF', border: 'rgba(0,229,255,0.25)'   },
  cancelled:           { label: 'Cancelled',   bg: 'rgba(192,57,43,0.12)',  text: '#C0392B', border: 'rgba(192,57,43,0.28)'   },
  // Legacy
  Enquiry:   { label: 'Enquiry',   bg: 'rgba(143,179,199,0.10)', text: '#8FB3C7', border: 'rgba(143,179,199,0.22)' },
  Quoted:    { label: 'Quoted',    bg: 'rgba(255,179,0,0.12)',   text: '#FFB300', border: 'rgba(255,179,0,0.30)'   },
  Confirmed: { label: 'Confirmed', bg: 'rgba(47,158,111,0.14)',  text: '#2F9E6F', border: 'rgba(47,158,111,0.30)'  },
  Sent:      { label: 'Sent',      bg: 'rgba(79,195,247,0.12)',  text: '#4FC3F7', border: 'rgba(79,195,247,0.28)'  },
  Lost:      { label: 'Lost',      bg: 'rgba(192,57,43,0.12)',   text: '#C0392B', border: 'rgba(192,57,43,0.28)'   },
};

const STATUS_FILTERS = [
  { key: 'all',                label: 'All' },
  { key: 'draft',              label: 'Draft' },
  { key: 'quoted',             label: 'Quoted' },
  { key: 'sent',               label: 'Sent' },
  { key: 'approved',           label: 'Approved' },
  { key: 'booked',             label: 'Booked' },
  { key: 'itinerary_generated',label: 'Itinerary' },
  { key: 'cancelled',          label: 'Cancelled' },
];

const fmt = (d) => { try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); } catch { return d || ''; } };

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
      data-testid="trip-status-badge"
    >
      {sc.label}
    </span>
  );
}

// ── Trip Card ─────────────────────────────────────────────────────────────────
function TripCard({ trip, onClone, onOpen }) {
  const [cloning, setCloning] = useState(false);
  const stops = (trip.stops || []).map(s => s.place_name).filter(Boolean).join(' · ');

  const handleClone = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Clone trip for "${trip.client_name}"?`)) return;
    setCloning(true);
    try {
      const newTrip = await cloneTrip(trip.id);
      toast.success(`Cloned → "${newTrip.client_name}"`, { duration: 3000 });
      onClone?.(newTrip);
    } catch (err) {
      toast.error(`Clone failed: ${err.message}`);
    } finally { setCloning(false); }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(trip)}
      className="w-full text-left rounded-xl group transition-all duration-150 hover:-translate-y-0.5 animate-jarvis-enter"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--stroke-soft)',
        boxShadow: 'var(--shadow-1)',
      }}
      data-testid={`trip-card-${trip.id}`}
    >
      {/* Status bar */}
      <div
        className="h-0.5 rounded-t-xl"
        style={{ background: `linear-gradient(90deg, ${STATUS_CONFIG[trip.status]?.text || '#8FB3C7'}, transparent)` }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold leading-tight truncate"
              style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
            >
              {trip.client_name}
            </p>
            {(trip.trip_title || trip.destination_summary) && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--app-muted)' }}>
                {trip.trip_title || trip.destination_summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleClone}
              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all duration-150 hover:bg-white/10"
              style={{ color: 'var(--cta)' }}
              title="Clone trip"
              data-testid={`clone-trip-${trip.id}`}
            >
              {cloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <StatusBadge status={trip.status} />
          </div>
        </div>

        {stops && (
          <p className="text-[10px] mb-2 truncate" style={{ color: 'var(--app-muted)' }}>
            <Route className="w-2.5 h-2.5 inline mr-1" />{stops}
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {(trip.start_date || trip.end_date) && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(143,179,199,0.60)' }}>
              <Calendar className="w-2.5 h-2.5" />
              {fmt(trip.start_date)}{trip.end_date ? ` → ${fmt(trip.end_date)}` : ''}
            </span>
          )}
          {trip.total_nights > 0 && (
            <span className="text-[10px]" style={{ color: 'rgba(143,179,199,0.60)' }}>{trip.total_nights}N</span>
          )}
          {trip.adults > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(143,179,199,0.60)' }}>
              <Users className="w-2.5 h-2.5" />
              {trip.adults}A{(trip.children || []).length > 0 ? `+${trip.children.length}C` : ''}
            </span>
          )}
          {trip.quote_no && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(0,229,255,0.50)' }}>#{trip.quote_no}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── New Trip Modal ────────────────────────────────────────────────────────────
function NewTripModal({ onCreated, onClose }) {
  const [f, setF] = useState({
    client_name: '', origin_name: 'Mumbai', origin_country: 'India',
    start_date: '', end_date: '', adults: 2, currency: 'INR', brand: 'BDV', status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const inp = (label, key, opts = {}) => (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>{label}</p>
      <input
        value={f[key] || ''}
        onChange={e => set(key, e.target.value)}
        type={opts.type || 'text'}
        placeholder={opts.ph || ''}
        className="h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[var(--qb-field-border)] focus:outline-none focus:border-[var(--cta)] transition-colors"
        data-testid={`new-trip-${key}`}
      />
    </div>
  );

  const save = async () => {
    if (!f.client_name.trim()) { toast.error('Client name required'); return; }
    setSaving(true);
    try {
      const trip = await createTrip(f);
      toast.success('Trip created!');
      onCreated(trip);
    } catch (e) { toast.error('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-[540px] rounded-2xl overflow-hidden shadow-2xl animate-jarvis-enter"
        style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
        data-testid="new-trip-modal"
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--qb-divider)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>New Trip</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>Create a new trip plan</p>
          </div>
          <button onClick={onClose} className="text-xs px-3 h-7 rounded-lg transition-colors hover:bg-white/10" style={{ color: 'var(--app-muted)' }}>Cancel</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {inp('Client Name *', 'client_name', { ph: 'Full name' })}
            {inp('Origin City', 'origin_name', { ph: 'Mumbai' })}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {inp('Start Date', 'start_date', { type: 'date' })}
            {inp('End Date', 'end_date', { type: 'date' })}
            {inp('Adults', 'adults', { type: 'number', ph: '2' })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Currency</p>
              <select
                value={f.currency}
                onChange={e => set('currency', e.target.value)}
                className="h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] border-[var(--qb-field-border)] focus:outline-none"
                data-testid="new-trip-currency"
              >
                {['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Status</p>
              <select
                value={f.status}
                onChange={e => set('status', e.target.value)}
                className="h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] border-[var(--qb-field-border)] focus:outline-none"
                data-testid="new-trip-status"
              >
                {['draft', 'quoted', 'sent', 'approved', 'booked'].map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--qb-divider)', background: 'rgba(0,0,0,0.15)' }}>
          <Button variant="ghost" onClick={onClose} className="h-9 px-4 text-sm" style={{ color: 'var(--app-muted)' }}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving}
            className="h-9 px-5 text-sm font-semibold"
            style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
            data-testid="new-trip-save-btn"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Creating…</> : 'Create Trip'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main TripPlanner Page ─────────────────────────────────────────────────────
export default function TripPlanner() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [newTripOpen, setNewTripOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTrips();
      setTrips(data || []);
    } catch (e) { console.error('listTrips', e); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = trips.filter(t => {
    const matchStatus = activeStatus === 'all' || t.status === activeStatus || (STATUS_CONFIG[t.status]?.label?.toLowerCase() === activeStatus);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (t.client_name || '').toLowerCase().includes(q) ||
      (t.trip_title || '').toLowerCase().includes(q) ||
      (t.destination_summary || '').toLowerCase().includes(q) ||
      (t.quote_no || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? trips.length : trips.filter(t => t.status === f.key).length;
    return acc;
  }, {});

  const handleNewTrip = (trip) => {
    setTrips(prev => [trip, ...prev]);
    setNewTripOpen(false);
    navigate(`/app/planner/${trip.id}`);
  };

  return (
    <div className="h-full flex flex-col" data-testid="trip-planner-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-[22px] font-bold tracking-wide"
            style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}
            data-testid="trip-planner-title"
          >
            Trip Planner
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {trips.length} trip{trips.length !== 1 ? 's' : ''} in your workspace
          </p>
        </div>
        <Button
          onClick={() => setNewTripOpen(true)}
          className="h-9 px-4 gap-2 text-sm font-semibold"
          style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
          data-testid="new-trip-btn"
        >
          <Plus className="w-4 h-4" /> New Trip
        </Button>
      </div>

      {/* ── Status Filter Bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-muted)' }} />
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveStatus(f.key)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold transition-all duration-150"
            style={{
              background: activeStatus === f.key ? 'var(--cta)' : 'var(--surface)',
              color: activeStatus === f.key ? 'var(--app-bg)' : 'var(--app-muted)',
              border: `1px solid ${activeStatus === f.key ? 'var(--cta)' : 'var(--stroke-soft)'}`,
            }}
            data-testid={`status-filter-${f.key}`}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span
                className="text-[9px] font-bold px-1 rounded-full"
                style={{
                  background: activeStatus === f.key ? 'rgba(0,0,0,0.25)' : 'rgba(0,229,255,0.10)',
                  color: activeStatus === f.key ? 'var(--app-bg)' : 'var(--cta)',
                }}
              >
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-muted)' }} />
        <Input
          placeholder="Search by client, destination or quote no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--stroke-soft)',
            color: 'var(--app-fg)',
          }}
          data-testid="trip-search-input"
        />
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2" style={{ color: 'var(--app-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cta)' }} />
            <span className="text-sm">Loading trips…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40 gap-3 rounded-xl"
            style={{ border: '1px dashed var(--stroke)' }}
            data-testid="trips-empty-state"
          >
            <Map className="w-10 h-10 opacity-20" style={{ color: 'var(--cta)' }} />
            <p className="text-sm" style={{ color: 'var(--app-muted)' }}>
              {search || activeStatus !== 'all' ? 'No trips match your filter.' : 'No trips yet. Create your first one!'}
            </p>
            {!search && activeStatus === 'all' && (
              <Button
                variant="ghost"
                onClick={() => setNewTripOpen(true)}
                className="h-8 px-4 text-xs gap-2"
                style={{ color: 'var(--cta)', border: '1px solid var(--stroke-soft)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Create Trip
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
            {filtered.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onOpen={(t) => navigate(`/app/planner/${t.id}`)}
                onClone={(newTrip) => setTrips(prev => [newTrip, ...prev])}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Trip Modal ──────────────────────────────────────────── */}
      {newTripOpen && <NewTripModal onCreated={handleNewTrip} onClose={() => setNewTripOpen(false)} />}
    </div>
  );
}
