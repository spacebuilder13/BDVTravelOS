import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Loader2, Search, User, Calendar, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { createTrip, updateTrip } from '../../services/tripAPI';

// ── Nominatim geocoding ───────────────────────────────────────────────────────
async function geocodePlace(q) {
  if (!q || q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BDV-TravelOS/1.0' } });
    const data = await res.json();
    return data.map(r => ({
      label: r.display_name,
      name: r.name || r.display_name.split(',')[0].trim(),
      country: r.address?.country || '',
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch { return []; }
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <Label
        className="text-[11px] uppercase tracking-wider"
        style={{ color: required ? 'var(--cta)' : 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
      >
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </Label>
      {children}
      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}

// ── Origin search with Nominatim ──────────────────────────────────────────────
function OriginSearch({ value, onChange }) {
  const [query, setQuery]     = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const debounceRef           = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.length < 3) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await geocodePlace(q);
      setResults(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 350);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin" style={{ color: 'var(--cta)' }} />
          : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
        }
        <Input
          data-testid="origin-search-input"
          placeholder="Search city or airport…"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="pl-8 text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
        />
      </div>
      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg overflow-hidden"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-2)' }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              data-testid={`origin-result-${i}`}
              onMouseDown={() => {
                setQuery(r.name);
                setOpen(false);
                onChange({ name: r.name, country: r.country, lat: r.lat, lng: r.lng });
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-medium">{r.name}</span>
              <span className="ml-1" style={{ color: 'var(--app-muted)' }}>{r.country}</span>
            </button>
          ))}
        </div>
      )}
      {value?.lat && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--j-green)' }}>
          ✓ {value.country} · {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </p>
      )}
    </div>
  );
}

// ── Children editor ───────────────────────────────────────────────────────────
function ChildrenEditor({ children, onChange }) {
  const add = () => onChange([...children, { name: '', age: '', dob: '' }]);
  const remove = (i) => onChange(children.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...children];
    next[i] = { ...next[i], [field]: val };
    if (field === 'age') next[i].age = val === '' ? '' : parseInt(val, 10);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {children.map((child, i) => (
        <div key={i} data-testid={`child-row-${i}`} className="flex items-center gap-2">
          <Input
            placeholder={`Child ${i + 1} name`}
            value={child.name}
            onChange={e => update(i, 'name', e.target.value)}
            className="flex-1 h-8 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
          />
          <Input
            type="number" min="0" max="17"
            placeholder="Age*"
            value={child.age}
            onChange={e => update(i, 'age', e.target.value)}
            data-testid={`child-age-${i}`}
            className="w-20 h-8 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
          />
          <Input
            type="date"
            placeholder="DOB"
            value={child.dob}
            onChange={e => update(i, 'dob', e.target.value)}
            data-testid={`child-dob-${i}`}
            className="w-36 h-8 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif', colorScheme: 'dark' }}
          />
          <button
            data-testid={`remove-child-${i}`}
            onClick={() => remove(i)}
            className="p-1 rounded"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        data-testid="add-child-btn"
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
        style={{ border: '1px dashed var(--stroke)', color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.color = 'var(--cta)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; e.currentTarget.style.color = 'var(--app-muted)'; }}
      >
        <Plus className="w-3 h-3" /> Add Child
      </button>
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────────────────────
const SECTION_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--stroke-soft)',
  borderRadius: '8px',
  padding: '16px',
};

const INPUT_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--stroke-soft)',
  color: 'var(--app-fg)',
  fontFamily: 'Figtree, sans-serif',
};

const SELECT_STYLE = {
  ...INPUT_STYLE,
  height: '36px',
  padding: '0 8px',
  borderRadius: '6px',
  outline: 'none',
  width: '100%',
};

export function TripForm({ trip, onSave, onCancel }) {
  const isEdit = !!trip?.id;

  const [form, setForm] = useState({
    client_name:    trip?.client_name    || '',
    client_email:   trip?.client_email   || '',
    client_phone:   trip?.client_phone   || '',
    brand:          trip?.brand          || 'BDV',
    origin:         trip ? { name: trip.origin_name, country: trip.origin_country, lat: trip.origin_lat, lng: trip.origin_lng } : null,
    start_date:     trip?.start_date     || '',
    end_date:       trip?.end_date       || '',
    adults:         trip?.adults         ?? 2,
    rooms:          trip?.rooms          ?? 1,
    children:       trip?.children       ?? [],
    currency:       trip?.currency       || 'INR',
    margin_pct:     trip?.margin_pct     ?? 15,
    budget_indication: trip?.budget_indication || '',
    notes:          trip?.notes          || '',
    status:         trip?.status         || 'Draft',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.client_name.trim()) e.client_name = 'Client name is required';
    if (!form.origin)             e.origin      = 'Origin is required — search and select from dropdown';
    if (!form.start_date)         e.start_date  = 'Start date is required';
    if (!form.end_date)           e.end_date    = 'End date is required';
    if (form.start_date && form.end_date && form.end_date <= form.start_date)
      e.end_date = 'End date must be after start date';
    if (form.adults < 1)          e.adults      = 'At least 1 adult required';
    form.children.forEach((c, i) => {
      if (c.age === '' && !c.dob) e[`child_${i}`] = 'Age or DOB required';
    });
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); toast.error('Please fix the highlighted fields'); return; }
    setSaving(true);
    try {
      const payload = {
        client_name:       form.client_name,
        client_email:      form.client_email || null,
        client_phone:      form.client_phone || null,
        brand:             form.brand,
        origin_name:       form.origin.name,
        origin_country:    form.origin.country,
        origin_lat:        form.origin.lat,
        origin_lng:        form.origin.lng,
        start_date:        form.start_date,
        end_date:          form.end_date,
        adults:            Number(form.adults),
        rooms:             Number(form.rooms),
        children:          form.children.map(c => ({ name: c.name || '', age: c.age === '' ? null : Number(c.age), dob: c.dob || null })),
        currency:          form.currency,
        margin_pct:        Number(form.margin_pct),
        budget_indication: form.budget_indication || null,
        notes:             form.notes || null,
        status:            form.status,
      };
      const saved = isEdit
        ? await updateTrip(trip.id, payload)
        : await createTrip(payload);
      toast.success(isEdit ? 'Trip updated' : 'Trip created');
      onSave(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="trip-form">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--surface)' }}
      >
        <button
          data-testid="trip-form-back"
          onClick={onCancel}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--app-muted)', border: '1px solid var(--stroke-soft)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cta)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--stroke-soft)'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
        >
          {isEdit ? 'Edit Trip' : 'New Trip'}
        </h2>
        <div className="flex-1" />
        <Button
          data-testid="save-trip-btn"
          onClick={handleSubmit}
          disabled={saving}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {isEdit ? 'Save Changes' : 'Create Trip'}
        </Button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Client */}
          <div style={SECTION_STYLE}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              ¬ Client Details ¬
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Client Name" required error={errors.client_name}>
                <Input
                  data-testid="client-name-input"
                  placeholder="Full name"
                  value={form.client_name}
                  onChange={e => set('client_name', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Brand">
                <select
                  data-testid="brand-select"
                  value={form.brand}
                  onChange={e => set('brand', e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="BDV">Blue Diamond Voyage</option>
                  <option value="Glocalique">Glocalique</option>
                  <option value="Luxury Honeymoon UK">Luxury Honeymoon UK</option>
                </select>
              </Field>
              <Field label="Email">
                <Input
                  data-testid="client-email-input"
                  type="email" placeholder="client@email.com"
                  value={form.client_email}
                  onChange={e => set('client_email', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Phone">
                <Input
                  data-testid="client-phone-input"
                  placeholder="+91 98XXXXXXXX"
                  value={form.client_phone}
                  onChange={e => set('client_phone', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
            </div>
          </div>

          {/* Origin + Dates */}
          <div style={SECTION_STYLE}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              ¬ Origin & Dates ¬
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Field label="Departure City / Airport" required error={errors.origin}>
                  <OriginSearch
                    value={form.origin}
                    onChange={val => set('origin', val)}
                  />
                </Field>
              </div>
              <Field label="Departure Date" required error={errors.start_date}>
                <Input
                  data-testid="start-date-input"
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                />
              </Field>
              <Field label="Return Date" required error={errors.end_date}>
                <Input
                  data-testid="end-date-input"
                  type="date"
                  value={form.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  style={{ ...INPUT_STYLE, colorScheme: 'dark' }}
                />
              </Field>
            </div>
          </div>

          {/* Travellers */}
          <div style={SECTION_STYLE}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              ¬ Travellers ¬
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Field label="Adults" required error={errors.adults}>
                <Input
                  data-testid="adults-input"
                  type="number" min="1" max="20"
                  value={form.adults}
                  onChange={e => set('adults', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Rooms">
                <Input
                  data-testid="rooms-input"
                  type="number" min="1" max="10"
                  value={form.rooms}
                  onChange={e => set('rooms', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Currency">
                <select
                  data-testid="currency-select"
                  value={form.currency}
                  onChange={e => set('currency', e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>
            <Field label="Children (Age or DOB required per child)">
              <ChildrenEditor children={form.children} onChange={v => set('children', v)} />
              {Object.keys(errors).filter(k => k.startsWith('child_')).map(k => (
                <span key={k} className="text-xs" style={{ color: 'var(--danger)' }}>{errors[k]}</span>
              ))}
            </Field>
          </div>

          {/* Financials + Status */}
          <div style={SECTION_STYLE}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              ¬ Financials & Status ¬
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Margin %">
                <Input
                  data-testid="margin-input"
                  type="number" min="0" max="100" step="0.5"
                  value={form.margin_pct}
                  onChange={e => set('margin_pct', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Budget Indication">
                <Input
                  data-testid="budget-input"
                  placeholder="e.g. Premium / Mid"
                  value={form.budget_indication}
                  onChange={e => set('budget_indication', e.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="Status">
                <select
                  data-testid="status-select"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Lost">Lost</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Notes */}
          <div style={SECTION_STYLE}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              ¬ Notes ¬
            </p>
            <Textarea
              data-testid="notes-textarea"
              placeholder="Internal notes, special requests, meal preferences…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
