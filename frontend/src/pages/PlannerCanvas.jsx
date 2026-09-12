import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Map, BookOpen, MapPin, Loader2, Copy, RefreshCw, AlertCircle,
  BookCheck, FileEdit, ChevronDown, AlertTriangle, X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getTripFull, cloneTrip, updateTrip } from '../services/tripAPI';
import { listComponents, generateItinerary, flagDivergence } from '../services/plannerAPI';
import { TripRail } from '../components/planner/TripRail';
import { PlannerMap } from '../components/planner/PlannerMap';
import { PlacesLibrary } from '../components/planner/PlacesLibrary';
import { QuoteSummaryBar } from '../components/planner/QuoteSummaryBar';
import { QuoteDrawer } from '../components/planner/QuoteDrawer';
import { ComponentEditModal } from '../components/planner/ComponentEditModal';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:               { label: 'Draft',      bg: 'rgba(143,179,199,0.10)', text: '#8FB3C7', border: 'rgba(143,179,199,0.22)' },
  quoted:              { label: 'Quoted',     bg: 'rgba(255,179,0,0.12)',   text: '#FFB300', border: 'rgba(255,179,0,0.30)'   },
  sent:                { label: 'Sent',       bg: 'rgba(79,195,247,0.12)',  text: '#4FC3F7', border: 'rgba(79,195,247,0.28)'  },
  approved:            { label: 'Approved',   bg: 'rgba(47,158,111,0.14)', text: '#2F9E6F', border: 'rgba(47,158,111,0.30)'  },
  booked:              { label: 'Booked',     bg: 'rgba(0,214,194,0.12)',  text: '#00D6C2', border: 'rgba(0,214,194,0.28)'   },
  itinerary_generated: { label: 'Itinerary', bg: 'rgba(0,229,255,0.10)',  text: '#00E5FF', border: 'rgba(0,229,255,0.25)'   },
  cancelled:           { label: 'Cancelled',  bg: 'rgba(192,57,43,0.12)',  text: '#C0392B', border: 'rgba(192,57,43,0.28)'   },
  Enquiry:   { label: 'Enquiry',   bg: 'rgba(143,179,199,0.10)', text: '#8FB3C7', border: 'rgba(143,179,199,0.22)' },
  Quoted:    { label: 'Quoted',    bg: 'rgba(255,179,0,0.12)',   text: '#FFB300', border: 'rgba(255,179,0,0.30)'   },
  Confirmed: { label: 'Confirmed', bg: 'rgba(47,158,111,0.14)', text: '#2F9E6F', border: 'rgba(47,158,111,0.30)'  },
  Sent:      { label: 'Sent',      bg: 'rgba(79,195,247,0.12)', text: '#4FC3F7', border: 'rgba(79,195,247,0.28)'  },
  Lost:      { label: 'Lost',      bg: 'rgba(192,57,43,0.12)',  text: '#C0392B', border: 'rgba(192,57,43,0.28)'   },
};

const TRIP_STATUSES = ['draft', 'quoted', 'sent', 'approved', 'booked', 'itinerary_generated', 'cancelled'];

export default function PlannerCanvas() {
  const { tripId }  = useParams();
  const navigate    = useNavigate();

  const [trip,        setTrip]       = useState(null);
  const [components,  setComponents] = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState(null);
  const [cloning,     setCloning]    = useState(false);

  // Panel state
  const [showPlacesLibrary,  setShowPlacesLibrary]  = useState(false);
  const [showQuoteDrawer,    setShowQuoteDrawer]    = useState(false);
  const [editComponent,      setEditComponent]      = useState(null);  // component obj for edit
  const [addComponentType,   setAddComponentType]   = useState(null);  // type string for add
  const [editModalOpen,      setEditModalOpen]      = useState(false);

  // ── Pass 3: Generate Itinerary dialog state ───────────────────────────────
  // genItinDialog: null | 'confirm' | 'set_status'
  const [genItinDialog,   setGenItinDialog]   = useState(null);
  const [genItinLoading,  setGenItinLoading]  = useState(false);
  const [setStatusValue,  setSetStatusValue]  = useState('quoted');

  // Load trip + components
  const loadAll = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const [tripData, comps] = await Promise.all([
        getTripFull(tripId),
        listComponents(tripId),
      ]);
      setTrip(tripData);
      setComponents(comps || []);
    } catch (e) {
      console.error('PlannerCanvas load', e);
      setError(e.message);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshTrip = useCallback(async () => {
    try {
      const tripData = await getTripFull(tripId);
      setTrip(tripData);
    } catch (e) { console.error('refreshTrip', e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await updateTrip(tripId, { status: newStatus });
      setTrip(updated);
      toast.success(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (e) { toast.error('Status update failed'); }
  };

  const handleClone = async () => {
    if (!window.confirm(`Clone trip for "${trip?.client_name}"?`)) return;
    setCloning(true);
    try {
      const newTrip = await cloneTrip(tripId);
      toast.success(`Cloned → "${newTrip.client_name}"`);
      navigate(`/app/planner/${newTrip.id}`);
    } catch (e) { toast.error('Clone failed: ' + e.message); }
    finally { setCloning(false); }
  };

  // ── Pass 3: Generate Itinerary handlers ──────────────────────────────────
  const handleGenerateItineraryConfirm = async () => {
    setGenItinLoading(true);
    try {
      const result = await generateItinerary(tripId);
      toast.success('Itinerary generated successfully!');
      setGenItinDialog(null);
      // Navigate to ItineraryDesigner and open the new itinerary
      navigate('/app/itinerary', { state: { openItineraryId: result.itinerary_id } });
    } catch (e) {
      toast.error('Failed to generate itinerary: ' + e.message);
    } finally {
      setGenItinLoading(false);
    }
  };

  const handleSetStatus = async () => {
    if (!setStatusValue) return;
    try {
      const updated = await updateTrip(tripId, { status: setStatusValue });
      setTrip(updated);
      toast.success(`Status updated to "${STATUS_CONFIG[setStatusValue]?.label || setStatusValue}"`);
      setGenItinDialog(null);
    } catch (e) {
      toast.error('Status update failed: ' + e.message);
    }
  };

  // ── Pass 3: Divergence callback ───────────────────────────────────────────
  const handleDivergenceFlagged = useCallback(async (divergenceInfo) => {
    try {
      const updated = await flagDivergence(tripId, divergenceInfo);
      setTrip(updated);
      // Open quote drawer so user can create a revised quote
      setShowQuoteDrawer(true);
      toast.warning('Divergence flagged — please create a revised quote', { duration: 5000 });
    } catch (e) {
      console.error('flagDivergence error', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Component edit/add handlers
  const openEditModal = (comp) => { setEditComponent(comp); setAddComponentType(null); setEditModalOpen(true); };
  const openAddModal  = (type) => { setEditComponent(null); setAddComponentType(type); setEditModalOpen(true); };
  const closeEditModal = () => { setEditModalOpen(false); setEditComponent(null); setAddComponentType(null); };

  const handleComponentSaved = (saved, isEdit) => {
    setComponents(prev =>
      isEdit ? prev.map(c => c.id === saved.id ? saved : c)
             : [...prev, saved].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    );
  };

  const handleAddPlaceToTrip = (place) => {
    openAddModal('activity');
    setShowPlacesLibrary(false);
    toast.info(`Add "${place.name}" as a component`);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cta)' }} />
          <p className="text-sm" style={{ color: 'var(--app-muted)' }}>Loading trip…</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-10 h-10" style={{ color: '#C0392B' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }}>Trip not found</p>
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>{error}</p>
          <Button variant="ghost" onClick={() => navigate('/app/planner')} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Trip Planner
          </Button>
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[trip.status] || STATUS_CONFIG.draft;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--app-bg)' }} data-testid="planner-canvas">
      {/* ── Header bar ───────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 h-12"
        style={{
          borderBottom: '1px solid var(--stroke-soft)',
          background: 'rgba(6,14,26,0.85)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={() => navigate('/app/planner')}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
          style={{ color: 'rgba(143,179,199,0.75)' }}
          data-testid="back-to-planner-btn"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Trip Planner</span>
        </button>

        <span style={{ color: 'rgba(143,179,199,0.30)' }}>/</span>

        <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
          {trip.client_name}
        </p>

        {/* Status badge + dropdown */}
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all"
            style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
            data-testid="trip-status-btn"
          >
            {sc.label}
          </button>
          {/* Status dropdown */}
          <div
            className="absolute top-full left-0 mt-1 z-50 w-36 rounded-xl shadow-xl overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity"
            style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
          >
            {TRIP_STATUSES.map(s => {
              const c = STATUS_CONFIG[s] || {};
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/5"
                  style={{ color: c.text || 'var(--app-fg)' }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {trip.quote_no && (
          <span className="text-[10px] font-mono" style={{ color: 'rgba(0,229,255,0.55)' }}>#{trip.quote_no}</span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlacesLibrary(true)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(143,179,199,0.08)', color: 'var(--app-muted)', border: '1px solid var(--stroke-soft)' }}
            data-testid="places-library-btn"
          >
            <MapPin className="w-3 h-3" /> Places
          </button>

          <button
            type="button"
            onClick={handleClone}
            disabled={cloning}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(143,179,199,0.06)', color: 'var(--app-muted)', border: '1px solid var(--stroke-soft)' }}
            data-testid="canvas-clone-btn"
            title="Clone this trip"
          >
            {cloning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={refreshTrip}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(143,179,199,0.06)', color: 'var(--app-muted)', border: '1px solid var(--stroke-soft)' }}
            data-testid="canvas-refresh-btn"
            title="Refresh trip data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>

          {/* Generate Itinerary — visible only for booked trips */}
          {trip.status === 'booked' && (
            <button
              type="button"
              onClick={() => setGenItinDialog('confirm')}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: 'rgba(0,214,194,0.14)',
                color: '#00D6C2',
                border: '1px solid rgba(0,214,194,0.35)',
              }}
              data-testid="generate-itinerary-btn"
            >
              <BookCheck className="w-3.5 h-3.5" /> Generate Itinerary
            </button>
          )}
        </div>
      </div>

      {/* ── Divergence Banner ────────────────────────────────────────── */}
      {trip.divergence_flagged && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs"
          style={{
            background: 'rgba(232,168,48,0.10)',
            borderBottom: '1px solid rgba(232,168,48,0.25)',
          }}
          data-testid="divergence-banner"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#E8A830' }} />
          <span style={{ color: '#E8A830', fontWeight: 600 }}>Price Divergence Detected</span>
          <span style={{ color: 'var(--app-muted)' }}>
            A component price was edited after the itinerary was generated. Issue a revised quote to maintain financial integrity.
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowQuoteDrawer(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(232,168,48,0.18)', color: '#E8A830', border: '1px solid rgba(232,168,48,0.35)' }}
            data-testid="divergence-create-quote-btn"
          >
            <FileEdit className="w-3.5 h-3.5" /> Create Revised Quote
          </button>
        </div>
      )}

      {/* ── 2-panel body ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Trip Rail (40%) */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '38%',
            minWidth: '280px',
            maxWidth: '440px',
            borderRight: '1px solid var(--stroke-soft)',
            background: 'var(--surface)',
          }}
          data-testid="planner-rail-panel"
        >
          <TripRail
            tripId={tripId}
            components={components}
            onComponentsChange={setComponents}
            onEditComponent={openEditModal}
            onAddComponent={openAddModal}
          />
        </div>

        {/* Right: Dynamic routing map — isolation:isolate contains Leaflet's internal z-indices */}
        <div
          className="flex-1 overflow-hidden"
          style={{ position: 'relative', isolation: 'isolate', zIndex: 0 }}
          data-testid="planner-map-panel"
        >
          <PlannerMap components={components} trip={trip} />
        </div>
      </div>

      {/* ── Quote Summary Bar ─────────────────────────────────────── */}
      <QuoteSummaryBar
        components={components}
        trip={trip}
        onOpenQuote={() => setShowQuoteDrawer(true)}
      />

      {/* ── Overlays ─────────────────────────────────────────────── */}
      <PlacesLibrary
        open={showPlacesLibrary}
        onClose={() => setShowPlacesLibrary(false)}
        tripId={tripId}
        onAddToTrip={handleAddPlaceToTrip}
      />

      <QuoteDrawer
        open={showQuoteDrawer}
        onClose={() => setShowQuoteDrawer(false)}
        trip={trip}
        components={components}
      />

      <ComponentEditModal
        open={editModalOpen}
        onClose={closeEditModal}
        tripId={tripId}
        component={editComponent}
        defaultType={addComponentType}
        onSaved={handleComponentSaved}
        hasItinerary={!!(trip.linked_itinerary_id)}
        onDivergenceFlagged={handleDivergenceFlagged}
      />

      {/* ── Generate Itinerary Dialog ────────────────────────────── */}
      {genItinDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          data-testid="gen-itin-dialog-overlay"
        >
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl p-6"
            style={{
              background: 'var(--qb-modal, #0f1a33)',
              border: '1px solid rgba(0,214,194,0.30)',
            }}
            data-testid="gen-itin-dialog"
          >
            {/* Close */}
            <button
              onClick={() => setGenItinDialog(null)}
              className="absolute top-4 right-4 p-1 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--app-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>

            {genItinDialog === 'confirm' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(0,214,194,0.15)', border: '1px solid rgba(0,214,194,0.30)' }}
                  >
                    <BookCheck className="w-5 h-5" style={{ color: '#00D6C2' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}>
                      Generate Itinerary
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
                      For {trip?.client_name || 'this trip'}
                    </p>
                  </div>
                </div>

                <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--app-dim)' }}>
                  Is the <strong style={{ color: '#00D6C2' }}>quotation confirmed</strong> by the client?
                  This will convert all trip components into a structured itinerary document.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setGenItinDialog('set_status')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(143,179,199,0.08)',
                      color: 'var(--app-muted)',
                      border: '1px solid var(--stroke-soft)',
                    }}
                    data-testid="gen-itin-no-btn"
                  >
                    No — Update Status First
                  </button>
                  <button
                    onClick={handleGenerateItineraryConfirm}
                    disabled={genItinLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: genItinLoading ? 'rgba(0,214,194,0.20)' : 'rgba(0,214,194,0.18)',
                      color: '#00D6C2',
                      border: '1px solid rgba(0,214,194,0.35)',
                    }}
                    data-testid="gen-itin-yes-btn"
                  >
                    {genItinLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><BookCheck className="w-4 h-4" /> Yes, Generate Itinerary</>
                    }
                  </button>
                </div>
              </>
            )}

            {genItinDialog === 'set_status' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(143,179,199,0.10)', border: '1px solid var(--stroke-soft)' }}
                  >
                    <ChevronDown className="w-5 h-5" style={{ color: 'var(--app-muted)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}>
                      Update Quotation Status
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
                      Set the correct stage for this trip
                    </p>
                  </div>
                </div>

                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                  Select the new status for this trip:
                </p>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {TRIP_STATUSES.filter(s => s !== 'itinerary_generated').map(s => {
                    const c = STATUS_CONFIG[s] || {};
                    return (
                      <button
                        key={s}
                        onClick={() => setSetStatusValue(s)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: setStatusValue === s ? c.bg : 'rgba(143,179,199,0.05)',
                          color: setStatusValue === s ? c.text : 'var(--app-muted)',
                          border: setStatusValue === s ? `1px solid ${c.border}` : '1px solid var(--stroke-soft)',
                        }}
                        data-testid={`status-option-${s}`}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: c.text || 'var(--app-muted)' }}
                        />
                        {c.label || s}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setGenItinDialog('confirm')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(143,179,199,0.08)',
                      color: 'var(--app-muted)',
                      border: '1px solid var(--stroke-soft)',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSetStatus}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: STATUS_CONFIG[setStatusValue]?.bg || 'rgba(143,179,199,0.10)',
                      color: STATUS_CONFIG[setStatusValue]?.text || 'var(--app-fg)',
                      border: `1px solid ${STATUS_CONFIG[setStatusValue]?.border || 'var(--stroke-soft)'}`,
                    }}
                    data-testid="gen-itin-update-status-btn"
                  >
                    Update Status
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
