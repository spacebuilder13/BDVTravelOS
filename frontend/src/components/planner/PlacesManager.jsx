import React, { useState, useEffect, useCallback } from 'react';
import {
  Utensils, Landmark, Info, MapPin, Plus, Trash2, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Globe, Clock, Phone, Tag,
  DollarSign, CalendarDays, Link2,
} from 'lucide-react';
import { Button }   from '../ui/button';
import { Badge }    from '../ui/badge';
import { toast }    from 'sonner';
import {
  addRestaurant, deleteRestaurant, updateRestaurant,
  addAttraction, deleteAttraction, updateAttraction,
  addInfoPoint, deleteInfoPoint, updateInfoPoint,
  addMeetingPoint, deleteMeetingPoint, updateMeetingPoint,
} from '../../services/tripAPI';

// ── Style tokens ──────────────────────────────────────────────────────────────
const QBI    = 'h-9 text-sm px-3 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] focus:outline-none focus:border-[var(--qb-field-border-focus)] focus:ring-0 rounded-lg w-full transition-colors duration-150';
const LABEL  = 'text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--app-muted)] mb-1 block';

// ── Category configs ──────────────────────────────────────────────────────────
const CATS = [
  { key:'restaurants',    label:'Restaurants',    singular:'Restaurant',   Icon:Utensils, color:'#FF8C42', bg:'rgba(255,140,66,0.14)',  ring:'rgba(255,140,66,0.40)' },
  { key:'attractions',    label:'Attractions',    singular:'Attraction',   Icon:Landmark, color:'#4AA3FF', bg:'rgba(74,163,255,0.14)',  ring:'rgba(74,163,255,0.40)' },
  { key:'info_points',    label:'Tourist Info',   singular:'Tourist Info', Icon:Info,     color:'#27AE60', bg:'rgba(39,174,96,0.14)',   ring:'rgba(39,174,96,0.40)'  },
  { key:'meeting_points', label:'Meeting Points', singular:'Meeting Point',Icon:MapPin,   color:'#8B7CFF', bg:'rgba(139,124,255,0.14)', ring:'rgba(139,124,255,0.40)'},
];

const ATTRACTION_CATS = ['Museum','Park','Landmark','Beach','Viewpoint','Entertainment','Market','Other'];

// ── Inline Add Form ──────────────────────────────────────────────────────────
function AddForm({ catKey, tripId, stopId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cat = CATS.find(c => c.key === catKey);

  const blankFields = useCallback(() => {
    if (catKey === 'restaurants')   return { name:'', cuisine:'', address:'', booking_url:'', cost:'', notes:'' };
    if (catKey === 'attractions')   return { name:'', category:'Museum', address:'', booking_url:'', cost:'', duration:'', schedule:'', notes:'' };
    if (catKey === 'info_points')   return { name:'', address:'', phone:'', hours:'', website:'', notes:'' };
    if (catKey === 'meeting_points')return { name:'', address:'', meeting_url:'', notes:'' };
    return {};
  }, [catKey]);

  const [fields, setFields] = useState(blankFields());
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!fields.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const body = { ...fields, stop_id: stopId, trip_id: tripId };
      if (catKey === 'restaurants')    await addRestaurant(tripId, stopId, body);
      if (catKey === 'attractions')    await addAttraction(tripId, stopId, body);
      if (catKey === 'info_points')    await addInfoPoint(tripId, stopId, body);
      if (catKey === 'meeting_points') await addMeetingPoint(tripId, stopId, body);
      setFields(blankFields());
      setOpen(false);
      onAdded();
      toast.success(`${cat.singular} added!`);
    } catch (e) { toast.error('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const inp = (label, key, opts = {}) => (
    <div>
      <p className={LABEL}>{label}</p>
      <input className={QBI} value={fields[key]||''} onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder||''} type={opts.type||'text'} />
    </div>
  );

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg border transition-colors duration-150"
          style={{ borderColor: cat.ring, color: cat.color, background: cat.bg }}
          data-testid={`add-${catKey}-btn`}
        >
          <Plus className="w-3.5 h-3.5" /> Add {cat.singular}
        </button>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${cat.ring}`, background:'rgba(0,0,0,0.20)' }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom:`1px solid rgba(255,255,255,0.06)`, background: cat.bg }}>
            <div className="flex items-center gap-2">
              <cat.Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
              <span className="text-xs font-bold" style={{ color: cat.color }}>
                New {cat.singular}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[10px]" style={{ color:'var(--app-muted)' }}>Cancel</button>
          </div>
          <div className="p-4 space-y-3">
            {/* Restaurant fields */}
            {catKey === 'restaurants' && <>
              <div className="grid grid-cols-2 gap-3">
                {inp('Restaurant Name *', 'name', { placeholder:'e.g. La Boqueria' })}
                {inp('Cuisine Type', 'cuisine', { placeholder:'Spanish, Italian…' })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {inp('Address', 'address', { placeholder:'Street address' })}
                {inp('Cost per Person (INR)', 'cost', { placeholder:'0', type:'number' })}
              </div>
              {inp('Booking URL', 'booking_url', { placeholder:'https://...' })}
              <div><p className={LABEL}>Notes</p>
                <textarea className={`${QBI} h-16 resize-none`} value={fields.notes||''} onChange={e => set('notes', e.target.value)} placeholder="Reservation details, dietary options…" /></div>
            </>}

            {/* Attraction fields */}
            {catKey === 'attractions' && <>
              <div className="grid grid-cols-2 gap-3">
                {inp('Attraction Name *', 'name', { placeholder:'e.g. Sagrada Família' })}
                <div><p className={LABEL}>Category</p>
                  <select className={QBI} value={fields.category||'Museum'} onChange={e => set('category', e.target.value)}>
                    {ATTRACTION_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {inp('Cost per Person (INR)', 'cost', { placeholder:'0', type:'number' })}
                {inp('Duration', 'duration', { placeholder:'2h, half-day…' })}
                {inp('Schedule / Hours', 'schedule', { placeholder:'9 AM – 6 PM' })}
              </div>
              {inp('Address', 'address', { placeholder:'Street address or area' })}
              {inp('Booking URL', 'booking_url', { placeholder:'https://...' })}
              <div><p className={LABEL}>Notes</p>
                <textarea className={`${QBI} h-16 resize-none`} value={fields.notes||''} onChange={e => set('notes', e.target.value)} placeholder="Tips, skip-the-line info…" /></div>
            </>}

            {/* Tourist Info fields */}
            {catKey === 'info_points' && <>
              <div className="grid grid-cols-2 gap-3">
                {inp('Name / Office *', 'name', { placeholder:'e.g. Tourist Office Madrid' })}
                {inp('Phone', 'phone', { placeholder:'+34 ...' })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {inp('Address', 'address', { placeholder:'Street address' })}
                {inp('Opening Hours', 'hours', { placeholder:'Mon–Fri 9–5' })}
              </div>
              {inp('Website', 'website', { placeholder:'https://...' })}
              <div><p className={LABEL}>Notes</p>
                <textarea className={`${QBI} h-16 resize-none`} value={fields.notes||''} onChange={e => set('notes', e.target.value)} placeholder="What services are available…" /></div>
            </>}

            {/* Meeting Point fields */}
            {catKey === 'meeting_points' && <>
              <div className="grid grid-cols-2 gap-3">
                {inp('Meeting Point Name *', 'name', { placeholder:'e.g. Hotel Lobby' })}
                {inp('Address / Landmark', 'address', { placeholder:'Specific location' })}
              </div>
              {inp('Google Maps Link', 'meeting_url', { placeholder:'https://maps.google.com/...' })}
              <div><p className={LABEL}>Notes</p>
                <textarea className={`${QBI} h-16 resize-none`} value={fields.notes||''} onChange={e => set('notes', e.target.value)} placeholder="Instructions for group…" /></div>
            </>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-8 px-4 text-xs">Cancel</Button>
              <Button type="button" onClick={save} disabled={saving} className="h-8 px-4 text-xs font-semibold"
                style={{ background: cat.color, color:'#0a1628' }}>
                {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, catKey, tripId, onDelete, onUpdate }) {
  const [deleting, setDeleting] = useState(false);
  const cat = CATS.find(c => c.key === catKey);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (catKey === 'restaurants')    await deleteRestaurant(tripId, item.id);
      if (catKey === 'attractions')    await deleteAttraction(tripId, item.id);
      if (catKey === 'info_points')    await deleteInfoPoint(tripId, item.id);
      if (catKey === 'meeting_points') await deleteMeetingPoint(tripId, item.id);
      onDelete(item.id);
      toast.success('Removed');
    } catch (e) { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  const metaChips = [];
  if (item.cuisine)    metaChips.push({ Icon:Tag,          text: item.cuisine });
  if (item.category)   metaChips.push({ Icon:Tag,          text: item.category });
  if (item.cost > 0)   metaChips.push({ Icon:DollarSign,   text: `₹${Number(item.cost).toLocaleString('en-IN')}` });
  if (item.duration)   metaChips.push({ Icon:Clock,        text: item.duration });
  if (item.schedule || item.hours) metaChips.push({ Icon:CalendarDays, text: item.schedule || item.hours });
  if (item.phone)      metaChips.push({ Icon:Phone,        text: item.phone });

  const linkUrl = item.booking_url || item.meeting_url || item.website;

  return (
    <div
      className="group flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-150"
      style={{ background:'rgba(0,0,0,0.22)', border:`1px solid rgba(255,255,255,0.06)` }}
      data-testid={`${catKey}-item-${item.id}`}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cat.bg, border:`1px solid ${cat.ring}` }}>
        <cat.Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color:'var(--app-fg)', fontFamily:'Figtree, sans-serif' }}>
          {item.name}
        </p>
        {item.address && (
          <p className="text-xs mt-0.5 truncate" style={{ color:'var(--app-muted)' }}>{item.address}</p>
        )}
        {metaChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {metaChips.map(({ Icon, text }, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                style={{ background:'rgba(255,255,255,0.06)', color:'var(--app-muted)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <Icon className="w-2.5 h-2.5" />{text}
              </span>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="text-[10px] mt-1 leading-relaxed" style={{ color:'rgba(143,179,199,0.65)' }}>{item.notes}</p>
        )}
        {linkUrl && (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] mt-1.5 transition-opacity hover:opacity-80"
            style={{ color: cat.color }}>
            <Link2 className="w-2.5 h-2.5" />
            {catKey === 'meeting_points' ? 'Open in Maps' : 'View / Book'}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150"
        style={{ background:'rgba(255,80,80,0.15)', color:'rgba(255,80,80,0.80)' }}
        data-testid={`delete-${catKey}-${item.id}`}
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ── Category Section ─────────────────────────────────────────────────────────
function CategorySection({ catKey, items, tripId, stopId, onRefresh }) {
  const cat = CATS.find(c => c.key === catKey);
  const [open, setOpen] = useState(true);
  const [localItems, setLocalItems] = useState(items);

  // Sync when items prop changes (after full refresh)
  useEffect(() => { setLocalItems(items); }, [items]);

  const handleDelete = (id) => setLocalItems(prev => prev.filter(i => i.id !== id));
  const handleAdded  = () => onRefresh();

  return (
    <div className="rounded-[var(--r-card)] overflow-hidden" style={{ border:'1px solid var(--stroke-soft)' }}>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors duration-150"
        style={{ background: open ? cat.bg : 'rgba(0,0,0,0.20)', borderBottom: open ? `1px solid ${cat.ring}` : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:`${cat.color}22` }}>
            <cat.Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
          </div>
          <span className="text-sm font-bold" style={{ color: cat.color, fontFamily:'Figtree, sans-serif' }}>
            {cat.label}
          </span>
          {localItems.length > 0 && (
            <Badge className="h-5 px-1.5 text-[9px] font-bold rounded-full"
              style={{ background:`${cat.color}22`, color: cat.color, border:`1px solid ${cat.ring}` }}>
              {localItems.length}
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--app-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color:'var(--app-muted)' }} />}
      </button>

      {open && (
        <div className="p-4 space-y-2" style={{ background:'var(--qb-modal-2)' }}>
          {localItems.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color:'rgba(143,179,199,0.40)' }}>
              No {cat.label.toLowerCase()} added yet for this stop
            </p>
          )}
          {localItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              catKey={catKey}
              tripId={tripId}
              onDelete={handleDelete}
              onUpdate={handleAdded}
            />
          ))}
          <AddForm catKey={catKey} tripId={tripId} stopId={stopId} onAdded={handleAdded} />
        </div>
      )}
    </div>
  );
}

// ── Main PlacesManager ───────────────────────────────────────────────────────
export function PlacesManager({ trip, onRefreshTrip }) {
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const stops = trip?.stops || [];

  // Auto-select first stop
  useEffect(() => {
    if (stops.length > 0 && !selectedStopId) {
      setSelectedStopId(stops[0].id);
    }
  }, [stops, selectedStopId]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    onRefreshTrip?.();
  }, [onRefreshTrip]);

  const selectedStop = stops.find(s => s.id === selectedStopId);

  if (!trip) return null;

  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color:'var(--app-muted)' }}>
        <MapPin className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="font-semibold text-sm mb-1" style={{ color:'var(--app-fg)' }}>No stops added yet</p>
          <p className="text-xs">Add destinations in Map Builder first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" data-testid="places-manager">
      {/* ── Left: Stop Selector ────────────────────────────────────── */}
      <div
        className="w-[220px] flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ borderRight:'1px solid var(--stroke-soft)', background:'rgba(0,0,0,0.20)' }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--stroke-soft)' }}>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color:'var(--cta)', fontFamily:'Figtree, sans-serif' }}>
            Destinations
          </p>
          <p className="text-[10px] mt-0.5" style={{ color:'var(--app-muted)' }}>{stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {stops.map(stop => {
            const totalPOIs = (stop.restaurants?.length || 0) + (stop.attractions?.length || 0) +
                              (stop.info_points?.length || 0) + (stop.meeting_points?.length || 0);
            const isActive = stop.id === selectedStopId;
            return (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedStopId(stop.id)}
                className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150"
                style={{
                  background: isActive ? 'rgba(0,229,255,0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(0,229,255,0.30)' : '1px solid transparent',
                }}
                data-testid={`stop-tab-${stop.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--cta)' : 'var(--app-fg)' }}>
                      {stop.place_name}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--app-muted)' }}>
                      {stop.nights || 0}N · {stop.country || ''}
                    </p>
                  </div>
                  {totalPOIs > 0 && (
                    <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:'rgba(0,229,255,0.16)', color:'var(--cta)', border:'1px solid rgba(0,229,255,0.30)' }}>
                      {totalPOIs}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Category Sections ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedStop ? (
          <>
            <div className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
              style={{ borderBottom:'1px solid var(--stroke-soft)', background:'rgba(0,0,0,0.14)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color:'var(--app-fg)', fontFamily:'Figtree, sans-serif' }}>
                  {selectedStop.place_name}
                </p>
                <p className="text-xs" style={{ color:'var(--app-muted)' }}>
                  {selectedStop.nights || 0} nights
                  {selectedStop.arrive_date ? ` · ${selectedStop.arrive_date}` : ''}
                  {selectedStop.country ? ` · ${selectedStop.country}` : ''}
                </p>
              </div>
              <div className="flex-1" />
              {CATS.map(cat => {
                const count = (selectedStop[cat.key] || []).length;
                return count > 0 ? (
                  <Badge key={cat.key} className="h-5 px-2 text-[9px] rounded-full"
                    style={{ background: cat.bg, color: cat.color, border:`1px solid ${cat.ring}` }}>
                    <cat.Icon className="w-2.5 h-2.5 mr-1" />{count}
                  </Badge>
                ) : null;
              })}
            </div>

            <div
              key={`${selectedStop.id}-${refreshKey}`}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {CATS.map(cat => (
                <CategorySection
                  key={`${cat.key}-${selectedStop.id}-${refreshKey}`}
                  catKey={cat.key}
                  items={selectedStop[cat.key] || []}
                  tripId={trip.id}
                  stopId={selectedStop.id}
                  onRefresh={refresh}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color:'var(--app-muted)' }}>
            <p className="text-sm">Select a destination from the left</p>
          </div>
        )}
      </div>
    </div>
  );
}
