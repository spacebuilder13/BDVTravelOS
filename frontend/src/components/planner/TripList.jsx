import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, ChevronRight, Loader2, Calendar, Users, MapPin, RefreshCw, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { listTrips, deleteTrip, cloneTrip } from '../../services/tripAPI';
import { format, parseISO } from 'date-fns';

const STATUS_STYLES = {
  Draft:      { bg: 'rgba(143,179,199,0.12)', color: 'var(--app-muted)',   border: 'rgba(143,179,199,0.25)' },
  Sent:       { bg: 'rgba(27,156,252,0.12)',  color: 'var(--j-blue)',      border: 'rgba(27,156,252,0.28)' },
  Confirmed:  { bg: 'rgba(47,158,111,0.12)',  color: 'var(--j-green)',     border: 'rgba(47,158,111,0.28)' },
  Lost:       { bg: 'rgba(192,57,43,0.12)',   color: 'var(--danger)',      border: 'rgba(192,57,43,0.28)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}

function TripCard({ trip, onOpen, onDelete, onClone }) {
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning]   = useState(false);
  const nights = trip.total_nights ?? 0;
  const pax = `${trip.adults || 0}A${trip.children?.length ? ` + ${trip.children.length}C` : ''}`;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete trip for ${trip.client_name}?`)) return;
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      toast.success('Trip deleted');
      onDelete(trip.id);
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  const handleClone = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Clone trip for ${trip.client_name}? A full duplicate will be created in Draft status.`)) return;
    setCloning(true);
    try {
      const newTrip = await cloneTrip(trip.id);
      toast.success(`Trip cloned — "${newTrip.client_name}" is ready`, { duration: 4000 });
      onClone(newTrip);
    } catch (err) {
      toast.error(`Clone failed: ${err.message}`);
    } finally {
      setCloning(false);
    }
  };

  let startLabel = '', endLabel = '';
  try { startLabel = format(parseISO(trip.start_date), 'd MMM yyyy'); } catch (_) { startLabel = trip.start_date || ''; }
  try { endLabel   = format(parseISO(trip.end_date),   'd MMM yyyy'); } catch (_) { endLabel   = trip.end_date   || ''; }

  return (
    <div
      data-testid={`trip-card-${trip.id}`}
      onClick={() => onOpen(trip)}
      className="group relative flex flex-col gap-2 p-4 rounded-lg cursor-pointer transition-all duration-150"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--stroke-soft)',
        boxShadow: 'var(--shadow-1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.boxShadow = 'var(--glow-cyan-sm)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke-soft)'; e.currentTarget.style.boxShadow = 'var(--shadow-1)'; }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
            {trip.client_name}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>
            {trip.brand}
          </p>
        </div>
        <StatusBadge status={trip.status} />
      </div>

      {/* Origin */}
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cta)' }} />
        <span className="text-xs truncate" style={{ color: 'var(--app-muted)' }}>
          {trip.origin_name}{trip.origin_country ? `, ${trip.origin_country}` : ''}
        </span>
      </div>

      {/* Dates + pax */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--j-blue2)' }} />
          <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {startLabel} — {endLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--j-blue2)' }} />
          <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {pax} · {nights}N
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
          {trip.currency}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            data-testid={`clone-trip-${trip.id}`}
            onClick={handleClone}
            disabled={cloning || deleting}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--j-blue)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,156,252,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Clone trip"
          >
            {cloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            data-testid={`delete-trip-${trip.id}`}
            onClick={handleDelete}
            disabled={deleting || cloning}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Delete trip"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--cta)' }} />
        </div>
      </div>
    </div>
  );
}

export function TripList({ onOpen, onNew }) {
  const [trips, setTrips]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [status, setStatus]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTrips({ q: query || undefined, status: status || undefined });
      setTrips(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full" data-testid="trip-list">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--surface)' }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
          <Input
            data-testid="trip-search-input"
            placeholder="Search client or origin…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
          />
        </div>
        <select
          data-testid="trip-status-filter"
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-8 px-2 rounded text-xs"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif', outline: 'none' }}
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Lost">Lost</option>
        </select>
        <button
          data-testid="refresh-trips-btn"
          onClick={load}
          className="h-8 w-8 flex items-center justify-center rounded transition-colors"
          style={{ border: '1px solid var(--stroke-soft)', color: 'var(--app-muted)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cta)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--stroke-soft)'}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <Button
          data-testid="new-trip-btn"
          onClick={onNew}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Trip
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <MapPin className="w-10 h-10 opacity-20" style={{ color: 'var(--cta)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>No trips found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--app-muted)' }}>Create your first trip to get started</p>
            </div>
            <Button
              data-testid="empty-new-trip-btn"
              onClick={onNew}
              size="sm"
              style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Trip
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onOpen={onOpen}
                onDelete={id => setTrips(prev => prev.filter(t => t.id !== id))}
                onClone={newTrip => setTrips(prev => [newTrip, ...prev])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
