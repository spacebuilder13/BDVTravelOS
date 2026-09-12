import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Loader2, Plane, Train, Bus, Car, Ship, RefreshCw,
  ChevronDown, ChevronUp, Hotel, AlertCircle, CheckCircle2, X, Link2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { addLeg, updateLeg, deleteLeg, addStay, updateStay, deleteStay, validateTrip, getTripFull } from '../../services/tripAPI';
import { sourcesAPI } from '../../services/sourcesAPI';
import { SourceBadgeList } from './SourceBadge';
import { AttachSourceDialog } from './AttachSourceDialog';

const LEG_MODES = [
  { value: 'flight',   label: 'Flight',    Icon: Plane  },
  { value: 'train',    label: 'Train',     Icon: Train  },
  { value: 'bus',      label: 'Bus',       Icon: Bus    },
  { value: 'car',      label: 'Car',       Icon: Car    },
  { value: 'ferry',    label: 'Ferry',     Icon: Ship   },
  { value: 'transfer', label: 'Transfer',  Icon: Car    },
];

const BOARD_OPTIONS = ['RO', 'BB', 'HB', 'FB', 'AI'];

function ModeIcon({ mode, size = 'w-3.5 h-3.5' }) {
  const m = LEG_MODES.find(x => x.value === mode) || LEG_MODES[0];
  return <m.Icon className={size} />;
}

const FIELD_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--stroke-soft)',
  color: 'var(--app-fg)',
  fontFamily: 'Figtree, sans-serif',
};
const SELECT_STYLE = { ...FIELD_STYLE, height: '32px', padding: '0 8px', borderRadius: '6px', outline: 'none', width: '100%', fontSize: '12px' };

// ── Leg Editor ────────────────────────────────────────────────────────────────
function LegEditor({ trip, leg, stopOptions, onSaved, onClose }) {
  const isEdit = !!leg?.id;
  const [form, setForm] = useState({
    mode:                leg?.mode                || 'flight',
    from_stop_id:        leg?.from_stop_id        || 'origin',
    to_stop_id:          leg?.to_stop_id          || (stopOptions[0]?.value || ''),
    operator:            leg?.operator            || '',
    from_point:          leg?.from_point          || '',
    to_point:            leg?.to_point            || '',
    depart_datetime:     leg?.depart_datetime     || '',
    arrive_datetime:     leg?.arrive_datetime     || '',
    cost:                leg?.cost                ?? '',
    cancellation_policy: leg?.cancellation_policy || '',
    notes:               leg?.notes              || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.cancellation_policy.trim()) { toast.error('Cancellation policy is required on every leg'); return; }
    if (!form.to_stop_id) { toast.error('Destination stop is required'); return; }
    setSaving(true);
    try {
      const payload = {
        trip_id:             trip.id,
        mode:                form.mode,
        from_stop_id:        form.from_stop_id,
        to_stop_id:          form.to_stop_id,
        operator:            form.operator || null,
        from_point:          form.from_point || null,
        to_point:            form.to_point || null,
        depart_datetime:     form.depart_datetime || null,
        arrive_datetime:     form.arrive_datetime || null,
        cost:                form.cost !== '' ? Number(form.cost) : null,
        cancellation_policy: form.cancellation_policy,
        notes:               form.notes || null,
      };
      if (isEdit) await updateLeg(trip.id, leg.id, payload);
      else        await addLeg(trip.id, payload);
      toast.success(isEdit ? 'Leg updated' : 'Leg added');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
          {isEdit ? 'Edit Leg' : 'Add Transport Leg'}
        </span>
        <button onClick={onClose} style={{ color: 'var(--app-muted)' }}><X className="w-3.5 h-3.5" /></button>
      </div>

      {/* Mode */}
      <div className="flex gap-1.5 flex-wrap">
        {LEG_MODES.map(m => (
          <button
            key={m.value}
            onClick={() => set('mode', m.value)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] transition-all"
            style={{
              background: form.mode === m.value ? 'rgba(0,229,255,0.12)' : 'var(--surface)',
              border: `1px solid ${form.mode === m.value ? 'var(--cta)' : 'var(--stroke-soft)'}`,
              color: form.mode === m.value ? 'var(--cta)' : 'var(--app-muted)',
              fontFamily: 'Figtree, sans-serif',
            }}
          >
            <m.Icon className="w-3 h-3" /> {m.label}
          </button>
        ))}
      </div>

      {/* From / To stops */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>From</Label>
          <select value={form.from_stop_id} onChange={e => set('from_stop_id', e.target.value)} style={SELECT_STYLE}>
            <option value="origin">{trip.origin_name} (Origin)</option>
            {stopOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>To <span style={{ color: 'var(--danger)' }}>*</span></Label>
          <select value={form.to_stop_id} onChange={e => set('to_stop_id', e.target.value)} style={SELECT_STYLE}>
            <option value="origin">{trip.origin_name} (Return)</option>
            {stopOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Operator + Points */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Operator</Label>
          <Input value={form.operator} onChange={e => set('operator', e.target.value)} placeholder="Air India, SNCF…" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Cost ({trip.currency})</Label>
          <Input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
      </div>

      {/* Terminals */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>From Terminal</Label>
          <Input value={form.from_point} onChange={e => set('from_point', e.target.value)} placeholder="T2, CDG T1…" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>To Terminal</Label>
          <Input value={form.to_point} onChange={e => set('to_point', e.target.value)} placeholder="T1, LHR T5…" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
      </div>

      {/* Datetimes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Depart</Label>
          <Input type="datetime-local" value={form.depart_datetime?.slice(0,16) || ''} onChange={e => set('depart_datetime', e.target.value)} className="h-8 text-xs" style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Arrive</Label>
          <Input type="datetime-local" value={form.arrive_datetime?.slice(0,16) || ''} onChange={e => set('arrive_datetime', e.target.value)} className="h-8 text-xs" style={{ ...FIELD_STYLE, colorScheme: 'dark' }} />
        </div>
      </div>

      {/* Cancellation Policy */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--danger)', fontFamily: 'Figtree, sans-serif' }}>
          Cancellation Policy <span style={{ color: 'var(--danger)' }}>* Required</span>
        </Label>
        <Input
          data-testid="leg-cancellation-input"
          value={form.cancellation_policy}
          onChange={e => set('cancellation_policy', e.target.value)}
          placeholder="e.g. Non-refundable / Free until 48h prior"
          className="h-8 text-xs"
          style={{ ...FIELD_STYLE, borderColor: form.cancellation_policy ? 'var(--j-green)' : 'var(--danger)' }}
        />
      </div>

      {/* Notes */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Notes</Label>
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" className="h-8 text-xs" style={FIELD_STYLE} />
      </div>

      <Button
        data-testid="save-leg-btn"
        onClick={save}
        disabled={saving}
        size="sm"
        className="w-full h-8 text-xs font-semibold"
        style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
        {isEdit ? 'Save Changes' : 'Add Leg'}
      </Button>
    </div>
  );
}

// ── Stay Editor ───────────────────────────────────────────────────────────────
function StayEditor({ trip, stop, stay, onSaved, onClose }) {
  const isEdit = !!stay?.id;
  const [form, setForm] = useState({
    hotel_name:          stay?.hotel_name          || '',
    stars:               stay?.stars               ?? 4,
    room_type:           stay?.room_type           || '',
    board:               stay?.board               || 'BB',
    distance_from_centre: stay?.distance_from_centre || '',
    cost:                stay?.cost                ?? '',
    cancellation_policy: stay?.cancellation_policy || '',
    notes:               stay?.notes              || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.hotel_name.trim())         { toast.error('Hotel name is required'); return; }
    if (!form.cancellation_policy.trim()) { toast.error('Cancellation policy is required on every stay'); return; }
    setSaving(true);
    try {
      const payload = {
        stop_id:              stop.id,
        trip_id:              trip.id,
        hotel_name:           form.hotel_name,
        stars:                Number(form.stars),
        room_type:            form.room_type || null,
        board:                form.board,
        distance_from_centre: form.distance_from_centre || null,
        cost:                 form.cost !== '' ? Number(form.cost) : null,
        cancellation_policy:  form.cancellation_policy,
        notes:                form.notes || null,
      };
      if (isEdit) await updateStay(stay.id, payload);
      else        await addStay(payload);
      toast.success(isEdit ? 'Stay updated' : 'Stay added');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--j-blue2)', fontFamily: 'Figtree, sans-serif' }}>
          {isEdit ? 'Edit Stay' : `Add Hotel — ${stop.place_name}`}
        </span>
        <button onClick={onClose} style={{ color: 'var(--app-muted)' }}><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Hotel Name *</Label>
          <Input data-testid="hotel-name-input" value={form.hotel_name} onChange={e => set('hotel_name', e.target.value)} placeholder="Hotel name" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Stars</Label>
          <select value={form.stars} onChange={e => set('stars', e.target.value)} style={SELECT_STYLE}>
            {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} ★</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Board Basis</Label>
          <select value={form.board} onChange={e => set('board', e.target.value)} style={SELECT_STYLE}>
            {BOARD_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Room Type</Label>
          <Input value={form.room_type} onChange={e => set('room_type', e.target.value)} placeholder="Deluxe, Suite…" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Cost ({trip.currency})</Label>
          <Input type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Distance to Centre</Label>
          <Input value={form.distance_from_centre} onChange={e => set('distance_from_centre', e.target.value)} placeholder="500m, 2km…" className="h-8 text-xs" style={FIELD_STYLE} />
        </div>
      </div>

      <div>
        <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--danger)', fontFamily: 'Figtree, sans-serif' }}>
          Cancellation Policy <span style={{ color: 'var(--danger)' }}>* Required</span>
        </Label>
        <Input
          data-testid="stay-cancellation-input"
          value={form.cancellation_policy}
          onChange={e => set('cancellation_policy', e.target.value)}
          placeholder="e.g. Free until 48h before check-in"
          className="h-8 text-xs"
          style={{ ...FIELD_STYLE, borderColor: form.cancellation_policy ? 'var(--j-green)' : 'var(--danger)' }}
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Notes</Label>
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" className="h-8 text-xs" style={FIELD_STYLE} />
      </div>

      <Button
        data-testid="save-stay-btn"
        onClick={save}
        disabled={saving}
        size="sm"
        className="w-full h-8 text-xs font-semibold"
        style={{ background: 'var(--j-blue)', color: 'white', fontFamily: 'Figtree, sans-serif' }}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Hotel className="w-3 h-3 mr-1" />}
        {isEdit ? 'Save Changes' : 'Add Stay'}
      </Button>
    </div>
  );
}

// ── Validation banner ─────────────────────────────────────────────────────────
function ValidationBanner({ tripId }) {
  const [checks, setChecks] = useState([]);
  const [valid, setValid]   = useState(null);
  const [loading, setLoad]  = useState(false);

  const run = async () => {
    setLoad(true);
    try {
      const res = await validateTrip(tripId);
      setValid(res.valid);
      setChecks(res.checks || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoad(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg flex-shrink-0"
      style={{ background: valid === true ? 'rgba(47,158,111,0.08)' : valid === false ? 'rgba(192,57,43,0.08)' : 'var(--surface-2)', border: `1px solid ${valid === true ? 'rgba(47,158,111,0.3)' : valid === false ? 'rgba(192,57,43,0.3)' : 'var(--stroke-soft)'}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>
          Trip Validation {valid === true && '· Ready'}{valid === false && '· Incomplete'}
        </span>
        <button
          data-testid="validate-trip-btn"
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)', color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run Checklist
        </button>
      </div>
      {checks.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {checks.map(c => (
            <div key={c.id} className="flex items-start gap-1.5 text-[11px]">
              {c.pass
                ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--j-green)' }} />
                : <AlertCircle  className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              }
              <span style={{ color: c.pass ? 'var(--app-muted)' : 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
                {c.label}
                {!c.pass && c.detail && <span className="block text-[10px]" style={{ color: 'var(--danger)' }}>{c.detail}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main LegsAndStays ─────────────────────────────────────────────────────────
export function LegsAndStays({ trip, onUpdate }) {
  const [editingLeg,  setEditingLeg]  = useState(null); // null | 'new' | leg object
  const [editingStay, setEditingStay] = useState(null); // null | { stop, stay? }
  const [deletingLeg, setDeletingLeg] = useState(null);
  const [deletingStay,setDeletingStay]= useState(null);
  const [attachingSource, setAttachingSource] = useState(null); // null | { componentId, componentType }

  // IMPORTANT: All hooks must be called before any early return
  const refresh = useCallback(async () => {
    if (!trip) return;
    const updated = await getTripFull(trip.id).catch(() => null);
    if (updated) onUpdate(updated);
  }, [trip, onUpdate]);

  // Extract data before early return to use in memoized hooks
  const stops   = trip?.stops  || [];
  const legs    = trip?.legs   || [];

  // Memoize derived data to avoid re-computing on every render
  const stopOptions = useMemo(
    () => stops.map(s => ({ value: s.id, label: s.place_name })),
    [stops]
  );

  // Pre-group legs by from_stop_id once instead of calling .filter() in JSX
  const legsByOrigin = useMemo(() => {
    const map = {};
    for (const leg of legs) {
      const key = leg.from_stop_id || 'origin';
      if (!map[key]) map[key] = [];
      map[key].push(leg);
    }
    return map;
  }, [legs]);

  // Return legs: legs that end at origin and didn't also START at origin
  const returnLegs = useMemo(
    () => legs.filter(l => l.to_stop_id === 'origin' && l.from_stop_id !== 'origin'),
    [legs]
  );

  // Group trip-level sources by component_id for quick lookup
  const sourcesByComponent = useMemo(() => {
    const map = {};
    for (const src of (trip?.sources || [])) {
      const key = src.component_id || '__trip__';
      if (!map[key]) map[key] = [];
      map[key].push(src);
    }
    return map;
  }, [trip?.sources]);

  const handleDeleteSource = useCallback(async (sourceId) => {
    if (!window.confirm('Remove this source?')) return;
    try {
      await sourcesAPI.delete(sourceId);
      toast.success('Source removed');
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Failed to remove source');
    }
  }, [refresh]);

  // Early return AFTER all hooks
  if (!trip) return null;

  const handleDeleteLeg = async (legId) => {
    if (!window.confirm('Remove this leg?')) return;
    setDeletingLeg(legId);
    try {
      await deleteLeg(trip.id, legId);
      toast.success('Leg removed');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingLeg(null);
    }
  };

  const handleDeleteStay = async (stayId) => {
    if (!window.confirm('Remove this stay?')) return;
    setDeletingStay(stayId);
    try {
      await deleteStay(stayId);
      toast.success('Stay removed');
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingStay(null);
    }
  };

  return (
    <>
    <div className="flex h-full" data-testid="legs-and-stays">
      {/* ── Left: timeline + editors ─────────────────────────────────────── */}
      <div
        className="flex flex-col overflow-y-auto flex-shrink-0"
        style={{ width: 420, background: 'var(--surface)', borderRight: '1px solid var(--stroke-soft)' }}
      >
        {/* Validation banner */}
        <div className="p-3">
          <ValidationBanner tripId={trip.id} />
        </div>

        {/* Timeline */}
        <div className="flex-1 px-3 pb-6">
          <p className="text-[10px] uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>¬ Timeline ¬</p>

          {/* ORIGIN node */}
          <TimelineNode label={`${trip.origin_name} — Departure`} sublabel="Origin" color="#FFB300" isOrigin />

          {/* Legs from origin */}
          {(legsByOrigin['origin'] || []).map(leg => (
            <LegRow key={leg.id} leg={leg} currency={trip.currency}
              onEdit={() => setEditingLeg(leg)} onDelete={() => handleDeleteLeg(leg.id)} deleting={deletingLeg === leg.id}
              sources={sourcesByComponent[leg.id] || []}
              onAttachSource={(cid, ctype) => setAttachingSource({ componentId: cid, componentType: ctype })}
            />
          ))}

          {/* Stops with their legs + stays */}
          {stops.map((stop, i) => {
            const stopLegs  = legsByOrigin[stop.id] || [];
            const stopStays = stop.stays || [];
            return (
              <React.Fragment key={stop.id}>
                <TimelineNode label={stop.place_name} sublabel={`${stop.nights}N · ${stop.country}`} color="var(--cta)" num={i + 1} />

                {/* Stays at this stop */}
                {stopStays.map(stay => (
                  <StayRow key={stay.id} stay={stay} currency={trip.currency}
                    onEdit={() => setEditingStay({ stop, stay })}
                    onDelete={() => handleDeleteStay(stay.id)}
                    deleting={deletingStay === stay.id}
                    sources={sourcesByComponent[stay.id] || []}
                    onAttachSource={(cid, ctype) => setAttachingSource({ componentId: cid, componentType: ctype })}
                  />
                ))}
                <button
                  data-testid={`add-stay-btn-${stop.id}`}
                  onClick={() => setEditingStay({ stop })}
                  className="flex items-center gap-1.5 ml-6 mb-2 px-2.5 py-1 rounded text-[10px] transition-colors"
                  style={{ border: '1px dashed var(--stroke)', color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--j-blue)'; e.currentTarget.style.color = 'var(--j-blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; e.currentTarget.style.color = 'var(--app-muted)'; }}
                >
                  <Hotel className="w-3 h-3" /> Add Stay
                </button>

                {/* Legs from this stop */}
                {stopLegs.map(leg => (
                  <LegRow key={leg.id} leg={leg} currency={trip.currency}
                    onEdit={() => setEditingLeg(leg)} onDelete={() => handleDeleteLeg(leg.id)} deleting={deletingLeg === leg.id}
                    sources={sourcesByComponent[leg.id] || []}
                    onAttachSource={(cid, ctype) => setAttachingSource({ componentId: cid, componentType: ctype })}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* Return leg to origin */}
          {returnLegs.map(leg => (
            <LegRow key={leg.id + 'r'} leg={leg} currency={trip.currency}
              onEdit={() => setEditingLeg(leg)} onDelete={() => handleDeleteLeg(leg.id)} deleting={deletingLeg === leg.id}
              sources={sourcesByComponent[leg.id] || []}
              onAttachSource={(cid, ctype) => setAttachingSource({ componentId: cid, componentType: ctype })}
            />
          ))}

          <TimelineNode label={`${trip.origin_name} — Return`} sublabel="End of trip" color="#FFB300" isOrigin />

          {/* Add leg button */}
          <button
            data-testid="add-leg-btn"
            onClick={() => setEditingLeg('new')}
            className="flex items-center gap-1.5 w-full mt-3 px-3 py-2 rounded text-xs transition-colors"
            style={{ border: '1px dashed var(--stroke)', color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.color = 'var(--cta)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; e.currentTarget.style.color = 'var(--app-muted)'; }}
          >
            <Plane className="w-3 h-3" /> Add Transport Leg
          </button>
        </div>
      </div>

      {/* ── Right: Editor panel ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {editingLeg && (
          <LegEditor
            trip={trip}
            leg={editingLeg === 'new' ? null : editingLeg}
            stopOptions={stopOptions}
            onSaved={async () => { setEditingLeg(null); await refresh(); }}
            onClose={() => setEditingLeg(null)}
          />
        )}
        {editingStay && (
          <StayEditor
            trip={trip}
            stop={editingStay.stop}
            stay={editingStay.stay}
            onSaved={async () => { setEditingStay(null); await refresh(); }}
            onClose={() => setEditingStay(null)}
          />
        )}
        {!editingLeg && !editingStay && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid var(--stroke)' }}>
              <Plane className="w-5 h-5" style={{ color: 'var(--cta)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Select a leg or stay to edit,<br />or add new ones from the timeline.</p>
          </div>
        )}
      </div>
    </div>

    {/* Attach Source Dialog — shared across legs & stays */}
    {attachingSource && (
      <AttachSourceDialog
        open={!!attachingSource}
        onClose={() => setAttachingSource(null)}
        tripId={trip.id}
        componentId={attachingSource.componentId}
        componentType={attachingSource.componentType}
        onSaved={async () => { await refresh(); }}
      />
    )}
  </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TimelineNode({ label, sublabel, color, num, isOrigin }) {
  return (
    <div className="flex items-center gap-3 mb-1 py-2">
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{ background: isOrigin ? color : 'var(--surface-2)', border: `2px solid ${color}`, color: isOrigin ? '#050A14' : color }}
      >
        {isOrigin ? '✦' : num}
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>{sublabel}</p>
      </div>
    </div>
  );
}

function LegRow({ leg, currency, onEdit, onDelete, deleting, sources = [], onAttachSource }) {
  const m = LEG_MODES.find(x => x.value === leg.mode) || LEG_MODES[0];
  const hasPolicy = leg.cancellation_policy?.trim();
  return (
    <div
      data-testid={`leg-row-${leg.id}`}
      className="group ml-3 mb-1.5 rounded transition-colors"
      style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.10)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.10)' }}>
          <m.Icon className="w-3 h-3" style={{ color: 'var(--cta)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
            {m.label}{leg.operator ? ` · ${leg.operator}` : ''}
            {leg.cost != null && <span className="ml-2" style={{ color: 'var(--app-muted)' }}>{currency} {Number(leg.cost).toLocaleString()}</span>}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {hasPolicy
              ? <span className="text-[9px]" style={{ color: 'var(--j-green)' }}>✓ {leg.cancellation_policy}</span>
              : <span className="text-[9px]" style={{ color: 'var(--danger)' }}>⚠ No cancellation policy</span>
            }
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 rounded"
            style={{ color: 'var(--cta)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          ><ChevronDown className="w-3 h-3" /></button>
          <button
            onClick={() => onAttachSource(leg.id, 'leg')}
            className="p-1 rounded"
            data-testid={`leg-attach-source-${leg.id}`}
            style={{ color: 'var(--j-blue2)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,156,252,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Attach research source"
          ><Link2 className="w-3 h-3" /></button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1 rounded"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {/* Source badges */}
      {sources.length > 0 && (
        <div className="px-3 pb-2">
          <SourceBadgeList sources={sources} onDelete={null} />
        </div>
      )}
    </div>
  );
}

function StayRow({ stay, currency, onEdit, onDelete, deleting, sources = [], onAttachSource }) {
  const hasPolicy = stay.cancellation_policy?.trim();
  return (
    <div
      data-testid={`stay-row-${stay.id}`}
      className="group ml-3 mb-1.5 rounded"
      style={{ background: 'rgba(27,156,252,0.06)', border: '1px solid rgba(27,156,252,0.14)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(27,156,252,0.12)' }}>
          <Hotel className="w-3 h-3" style={{ color: 'var(--j-blue)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
            {stay.hotel_name}{stay.stars ? ` ${'★'.repeat(stay.stars)}` : ''}
            {stay.cost != null && <span className="ml-2" style={{ color: 'var(--app-muted)' }}>{currency} {Number(stay.cost).toLocaleString()}</span>}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {hasPolicy
              ? <span className="text-[9px]" style={{ color: 'var(--j-green)' }}>✓ {stay.cancellation_policy}</span>
              : <span className="text-[9px]" style={{ color: 'var(--danger)' }}>⚠ No cancellation policy</span>
            }
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 rounded"
            style={{ color: 'var(--j-blue)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,156,252,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          ><ChevronDown className="w-3 h-3" /></button>
          <button
            onClick={() => onAttachSource(stay.id, 'stay')}
            className="p-1 rounded"
            data-testid={`stay-attach-source-${stay.id}`}
            style={{ color: 'var(--j-blue2)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,156,252,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Attach research source"
          ><Link2 className="w-3 h-3" /></button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1 rounded"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {/* Source badges */}
      {sources.length > 0 && (
        <div className="px-3 pb-2">
          <SourceBadgeList sources={sources} onDelete={null} />
        </div>
      )}
    </div>
  );
}
