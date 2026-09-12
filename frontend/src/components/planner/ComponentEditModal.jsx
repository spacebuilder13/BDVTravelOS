import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Save, X, MapPin, Search, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { createComponent, updateComponent } from '../../services/plannerAPI';
import { DivergenceWarningDialog } from './DivergenceWarningDialog';

const COMPONENT_TYPES = [
  'flight', 'train', 'bus', 'ferry', 'cruise', 'transfer', 'self_drive',
  'stay', 'activity', 'attraction', 'meal', 'visa', 'insurance', 'misc',
];

const MARKUP_TYPES = ['percentage', 'fixed'];

const EMPTY_FORM = {
  type: 'flight', title: '', supplier_name: '', reference_no: '',
  start_datetime: '', end_datetime: '', nights: '', pax_count: '',
  net_cost: '', net_currency: 'INR', fx_rate: 1, markup_type: 'percentage',
  markup_value: 0, sell_price: '', sell_currency: 'INR',
  // location fields
  location_query: '',
  latitude: null,
  longitude: null,
};

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR'];

const inputClass = 'h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[var(--qb-field-border)] focus:outline-none focus:border-[var(--cta)] transition-colors';

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>{label}</p>
      {children}
    </div>
  );
}

export function ComponentEditModal({ open, onClose, tripId, component, defaultType, onSaved, hasItinerary, onDivergenceFlagged }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!component;

  // Divergence warning state
  const [divergenceDialog, setDivergenceDialog] = useState({ open: false, field: '' });
  // Pending save payload — held while user decides on divergence
  const [pendingPayload, setPendingPayload] = useState(null);

  // ── Location geocoder state ───────────────────────────────────────────────
  const [geoLoading,     setGeoLoading]     = useState(false);
  const [geoSuggestions, setGeoSuggestions] = useState([]);
  const suggRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (component) {
        setForm({
          ...EMPTY_FORM,
          type:          component.type || 'flight',
          title:         component.title || '',
          supplier_name: component.supplier_name || '',
          reference_no:  component.reference_no || '',
          start_datetime: component.start_datetime ? component.start_datetime.slice(0, 16) : '',
          end_datetime:   component.end_datetime   ? component.end_datetime.slice(0, 16)   : '',
          nights:        component.nights != null ? String(component.nights) : '',
          pax_count:     component.pax_count != null ? String(component.pax_count) : '',
          net_cost:      component.net_cost != null ? String(component.net_cost) : '',
          net_currency:  component.net_currency || 'INR',
          fx_rate:       component.fx_rate || 1,
          markup_type:   component.markup_type || 'percentage',
          markup_value:  component.markup_value || 0,
          sell_price:    component.sell_price != null ? String(component.sell_price) : '',
          sell_currency: component.sell_currency || 'INR',
          location_query: '',      // don't reverse-geocode; user re-searches if needed
          latitude:  component.latitude  ?? null,
          longitude: component.longitude ?? null,
        });
      } else {
        setForm({ ...EMPTY_FORM, type: defaultType || 'flight' });
      }
      setGeoSuggestions([]);
    }
  }, [open, component, defaultType]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Nominatim geocoder ───────────────────────────────────────────────────
  const geocodeLocation = async () => {
    const q = form.location_query.trim();
    if (!q) return;
    setGeoLoading(true);
    setGeoSuggestions([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      if (!data.length) toast.info('No locations found. Try a broader search.');
      setGeoSuggestions(data.slice(0, 5));
    } catch {
      toast.error('Location search failed. Check your connection.');
    } finally {
      setGeoLoading(false);
    }
  };

  const pickSuggestion = (s) => {
    const shortName = s.display_name.split(',').slice(0, 2).join(', ');
    setForm(f => ({
      ...f,
      latitude:       parseFloat(s.lat),
      longitude:      parseFloat(s.lon),
      location_query: shortName,
    }));
    setGeoSuggestions([]);
  };

  const clearLocation = () => setForm(f => ({
    ...f, latitude: null, longitude: null, location_query: '',
  }));

  // ── Internal save helper ──────────────────────────────────────────────────
  const executeSave = async (payload, flagDivergenceField = null) => {
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await updateComponent(tripId, component.id, payload);
        toast.success('Component updated');
      } else {
        saved = await createComponent(tripId, payload);
        toast.success('Component added');
      }
      // If we're flagging a divergence, call back to parent first
      if (flagDivergenceField && onDivergenceFlagged) {
        onDivergenceFlagged({
          component_id: component?.id,
          field: flagDivergenceField,
          old_value: component?.[flagDivergenceField],
          new_value: payload[flagDivergenceField],
        });
      }
      onSaved(saved, isEdit);
      onClose();
    } catch (e) {
      toast.error((isEdit ? 'Update' : 'Create') + ' failed: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }

    const payload = {
      type:          form.type,
      title:         form.title.trim(),
      trip_id:       tripId,
      supplier_name: form.supplier_name || null,
      reference_no:  form.reference_no  || null,
      start_datetime: form.start_datetime || null,
      end_datetime:   form.end_datetime   || null,
      nights:        form.nights        ? parseInt(form.nights)        : null,
      pax_count:     form.pax_count     ? parseInt(form.pax_count)     : null,
      net_cost:      form.net_cost      ? parseFloat(form.net_cost)    : null,
      net_currency:  form.net_currency  || 'INR',
      fx_rate:       parseFloat(form.fx_rate) || 1,
      markup_type:   form.markup_type,
      markup_value:  parseFloat(form.markup_value) || 0,
      sell_price:    form.sell_price    ? parseFloat(form.sell_price)  : null,
      sell_currency: form.sell_currency || 'INR',
      // location
      latitude:  form.latitude  ?? null,
      longitude: form.longitude ?? null,
    };

    // ── Divergence Rule ────────────────────────────────────────────────────
    // If an itinerary exists for this trip AND we're editing a price-sensitive
    // field, block silent save and show the divergence warning.
    if (isEdit && hasItinerary) {
      const origNetCost   = component?.net_cost   ?? null;
      const origSellPrice = component?.sell_price ?? null;
      const newNetCost    = payload.net_cost;
      const newSellPrice  = payload.sell_price;

      const netChanged  = origNetCost   !== newNetCost   && !(origNetCost == null && newNetCost == null);
      const sellChanged = origSellPrice !== newSellPrice && !(origSellPrice == null && newSellPrice == null);

      if (netChanged || sellChanged) {
        const changedField = netChanged ? 'net_cost' : 'sell_price';
        setPendingPayload({ payload, field: changedField });
        setDivergenceDialog({ open: true, field: changedField });
        return; // Hold until user decides
      }
    }

    await executeSave(payload);
  };

  const isStay      = form.type === 'stay';
  const isTransport = ['flight', 'train', 'bus', 'ferry', 'cruise', 'transfer', 'self_drive'].includes(form.type);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
        data-testid="component-edit-modal"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}>
            {isEdit ? 'Edit Component' : 'Add Component'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type selector */}
          <Field label="Type *">
            <select
              value={form.type}
              onChange={e => set('type', e.target.value)}
              className={inputClass}
              data-testid="comp-type-select"
            >
              {COMPONENT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </Field>

          {/* Title */}
          <Field label="Title *">
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder={isTransport ? 'e.g. Mumbai → Dubai' : isStay ? 'e.g. Atlantis The Palm' : 'e.g. Burj Khalifa Tour'}
              className={inputClass}
              data-testid="comp-title-input"
            />
          </Field>

          {/* Location — geocoded via Nominatim, stores lat/lng → shown on route map */}
          <Field label="Location (map pin)">
            <div style={{ position: 'relative' }}>
              <div className="flex gap-2">
                <input
                  value={form.location_query}
                  onChange={e => { set('location_query', e.target.value); setGeoSuggestions([]); }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), geocodeLocation())}
                  placeholder="e.g. Dubai, UAE · Charles de Gaulle Airport"
                  className={inputClass}
                  style={{ flex: 1 }}
                  data-testid="comp-location-input"
                />
                <button
                  type="button"
                  onClick={geocodeLocation}
                  disabled={geoLoading || !form.location_query.trim()}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(74,163,255,0.14)',
                    border:     '1px solid rgba(74,163,255,0.35)',
                    color:      '#4AA3FF',
                    height:     32,
                    cursor:     geoLoading || !form.location_query.trim() ? 'not-allowed' : 'pointer',
                    opacity:    geoLoading || !form.location_query.trim() ? 0.5 : 1,
                  }}
                  data-testid="comp-location-search-btn"
                >
                  {geoLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Search className="w-3.5 h-3.5" />}
                  Find
                </button>
              </div>

              {/* Nominatim suggestions dropdown */}
              {geoSuggestions.length > 0 && (
                <div
                  ref={suggRef}
                  style={{
                    position:     'absolute',
                    top:          '100%',
                    left:         0,
                    right:        0,
                    zIndex:       10001,
                    marginTop:    4,
                    background:   '#0f1a33',
                    border:       '1px solid rgba(143,179,199,0.25)',
                    borderRadius: 10,
                    overflow:     'hidden',
                    boxShadow:    '0 8px 28px rgba(0,0,0,0.55)',
                  }}
                >
                  {geoSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="w-full text-left px-3 py-2.5 text-xs transition-colors"
                      style={{
                        color:        'var(--app-dim)',
                        borderBottom: i < geoSuggestions.length - 1
                          ? '1px solid rgba(143,179,199,0.10)'
                          : 'none',
                        background:   'transparent',
                        display:      'flex',
                        alignItems:   'flex-start',
                        gap:          6,
                        cursor:       'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,163,255,0.10)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: '#4AA3FF' }} />
                      <span style={{ lineHeight: 1.45 }}>{s.display_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Located indicator */}
              {form.latitude != null && (
                <div className="flex items-center gap-1.5 mt-1.5" data-testid="comp-location-set-indicator">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: '#2aaf69' }} />
                  <span className="text-[10px]" style={{ color: '#2aaf69' }}>
                    Located · {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="text-[10px] ml-auto transition-colors hover:opacity-80"
                    style={{ color: 'var(--app-muted)' }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <input value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="Emirates, etc." className={inputClass} />
            </Field>
            <Field label="Ref No">
              <input value={form.reference_no} onChange={e => set('reference_no', e.target.value)} placeholder="PNR / booking ref" className={inputClass} />
            </Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={isTransport ? 'Departure' : isStay ? 'Check-in' : 'Start Date'}>
              <input type="datetime-local" value={form.start_datetime} onChange={e => set('start_datetime', e.target.value)} className={inputClass} />
            </Field>
            <Field label={isTransport ? 'Arrival' : isStay ? 'Check-out' : 'End Date'}>
              <input type="datetime-local" value={form.end_datetime} onChange={e => set('end_datetime', e.target.value)} className={inputClass} />
            </Field>
          </div>

          {/* Nights (stay only) + Pax */}
          <div className="grid grid-cols-2 gap-3">
            {isStay && (
              <Field label="Nights">
                <input type="number" value={form.nights} onChange={e => set('nights', e.target.value)} placeholder="3" min="0" className={inputClass} />
              </Field>
            )}
            <Field label="Pax">
              <input type="number" value={form.pax_count} onChange={e => set('pax_count', e.target.value)} placeholder="2" min="1" className={inputClass} />
            </Field>
          </div>

          {/* Pricing section */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--cta)' }}>Pricing</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Net Cost">
                <input type="number" value={form.net_cost} onChange={e => set('net_cost', e.target.value)} placeholder="0.00" step="0.01" className={inputClass} />
              </Field>
              <Field label="Net Currency">
                <select value={form.net_currency} onChange={e => set('net_currency', e.target.value)} className={inputClass}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="FX Rate">
                <input type="number" value={form.fx_rate} onChange={e => set('fx_rate', e.target.value)} step="0.0001" className={inputClass} />
              </Field>
              <Field label="Markup Type">
                <select value={form.markup_type} onChange={e => set('markup_type', e.target.value)} className={inputClass}>
                  {MARKUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Markup Value">
                <input type="number" value={form.markup_value} onChange={e => set('markup_value', e.target.value)} step="0.01" className={inputClass} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sell Price (auto if blank)">
                <input type="number" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} placeholder="Auto" step="0.01" className={inputClass} />
              </Field>
              <Field label="Sell Currency">
                <select value={form.sell_currency} onChange={e => set('sell_currency', e.target.value)} className={inputClass}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} style={{ color: 'var(--app-muted)' }}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ background: 'var(--cta)', color: 'var(--app-bg)' }}
            data-testid="comp-save-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {isEdit ? 'Save Changes' : 'Add Component'}
          </Button>
        </div>
      </DialogContent>

      {/* Divergence warning — rendered outside DialogContent to avoid z-index conflict */}
      <DivergenceWarningDialog
        open={divergenceDialog.open}
        fieldName={divergenceDialog.field}
        componentTitle={component?.title || ''}
        onClose={() => {
          setDivergenceDialog({ open: false, field: '' });
          setPendingPayload(null);
        }}
        onCreateRevised={async () => {
          setDivergenceDialog({ open: false, field: '' });
          if (pendingPayload) {
            await executeSave(pendingPayload.payload, pendingPayload.field);
            setPendingPayload(null);
          }
        }}
      />
    </Dialog>
  );
}
