import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, Plane, GitBranch } from 'lucide-react';
import { getROE } from '../../utils/roeStorage';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];
const FLIGHT_CLASSES = ['Economy', 'Premium Economy', 'Business', 'First'];
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const computeFlightTotal = (item) => {
  const a = (parseFloat(item.fare_adult) || 0) * (parseInt(item.no_adults) || 0);
  const c = (parseFloat(item.fare_child) || 0) * (parseInt(item.no_children) || 0);
  const i = (parseFloat(item.fare_infant) || 0) * (parseInt(item.no_infants) || 0);
  return a + c + i;
};

// ── Stopover Row ────────────────────────────────────────────────────────────
function StopoverRow({ stop, idx, onUpdate, onRemove }) {
  const si = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.5)] w-full transition-colors duration-150';
  return (
    <div className="rounded-lg p-2.5" data-testid={`stopover-row-${idx}`} style={{ backgroundColor: 'rgba(139,124,255,0.08)', border: '1px solid rgba(139,124,255,0.25)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#8B7CFF' }}>Stopover {idx + 1}</p>
        <button type="button" onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 transition-colors" style={{ color: 'rgba(139,124,255,0.5)' }}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>City / Airport</Label>
          <input className={si} value={stop.city || ''}
            onChange={e => onUpdate('city', e.target.value)} placeholder="e.g. IST" />
        </div>
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: '#8B7CFF' }}>Stop Duration (HH:MM)</Label>
          <input className={si} value={stop.duration || ''}
            onChange={e => onUpdate('duration', e.target.value)} placeholder="02:45" />
        </div>
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: '#8B7CFF' }}>Connecting Flight No</Label>
          <input className={si} value={stop.flight_no || ''}
            onChange={e => onUpdate('flight_no', e.target.value)} placeholder="TK 001" />
        </div>
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: '#8B7CFF' }}>Connecting Airline</Label>
          <input className={si} value={stop.airline || ''}
            onChange={e => onUpdate('airline', e.target.value)} placeholder="Turkish Airlines" />
        </div>
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: '#8B7CFF' }}>Dep Time</Label>
          <input className={si} type="time" value={stop.dep_time || ''}
            onChange={e => onUpdate('dep_time', e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] mb-1 block" style={{ color: '#8B7CFF' }}>Arr Time</Label>
          <input className={si} type="time" value={stop.arr_time || ''}
            onChange={e => onUpdate('arr_time', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export function FlightTab({ items, onAdd, onUpdate, onRemove, baseCurrency, paxAdults, paxChildren, paxInfants, travelDate, hasLinkedEnquiry }) {
  const flightItems = items.filter(i => i.category === 'Flights');
  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const addFlight = () => {
    onAdd({
      id: newId(),
      category: 'Flights',
      title: '',
      description: '',
      qty: 1,
      unit_price: 0,
      currency: baseCurrency,
      roe_to_base: 1.0,
      from_location: '',
      to_location: '',
      flight_date: travelDate || '',  // Auto-populate from enquiry
      dep_time: '',
      arr_time: '',
      airline: '',
      flight_no: '',
      flight_class: 'Economy',
      pnr: '',
      fare_adult: 0,
      fare_child: 0,
      fare_infant: 0,
      no_adults: paxAdults || 1,
      no_children: paxChildren || 0,
      no_infants: paxInfants || 0,
      stopovers: [],
      show_stopovers: false,
    });
  };

  const handleField = (item, field, value) => {
    const updated = { ...item, [field]: value };
    if (['fare_adult', 'fare_child', 'fare_infant', 'no_adults', 'no_children', 'no_infants'].includes(field)) {
      updated[field] = value;
      updated.unit_price = computeFlightTotal(updated);
      updated.qty = 1;
    }
    if (field === 'from_location' || field === 'to_location') {
      const from = field === 'from_location' ? value : updated.from_location;
      const to = field === 'to_location' ? value : updated.to_location;
      if (from && to) updated.title = `${from} \u2192 ${to}`;
    }
    if (field === 'currency' && value === baseCurrency) updated.roe_to_base = 1.0;
    else if (field === 'currency' && value !== baseCurrency) updated.roe_to_base = getROE(value, baseCurrency);
    onUpdate(item.id, updated);
  };

  const addStopover = (item) => {
    const updated = { ...item, stopovers: [...(item.stopovers || []), { id: newId(), city: '', duration: '', flight_no: '', airline: '', dep_time: '', arr_time: '' }], show_stopovers: true };
    onUpdate(item.id, updated);
  };

  const updateStopover = (item, stopId, field, value) => {
    const updated = { ...item, stopovers: (item.stopovers || []).map(s => s.id === stopId ? { ...s, [field]: value } : s) };
    onUpdate(item.id, updated);
  };

  const removeStopover = (item, stopId) => {
    const stopovers = (item.stopovers || []).filter(s => s.id !== stopId);
    onUpdate(item.id, { ...item, stopovers, show_stopovers: stopovers.length > 0 });
  };

  const totalInBase = (item) =>
    (parseFloat(item.unit_price) || 0) * (parseFloat(item.roe_to_base) || 1);

  const inp = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(74,163,255,0.5)] w-full transition-colors duration-150';

  if (flightItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(74,163,255,0.12)', border: '1px solid rgba(74,163,255,0.25)' }}>
          <Plane className="w-4 h-4" style={{ color: '#4AA3FF' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--app-fg)' }}>No flights added yet</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>Add flight sectors with fare breakdown</p>
        {!hasLinkedEnquiry && travelDate === '' && (
          <p className="text-[10px] mt-1.5 px-2 py-1 rounded-md" style={{ color: '#F0B429', backgroundColor: 'rgba(240,180,41,0.10)' }}>
            Tip: Link an enquiry to auto-fill travel dates
          </p>
        )}
        <Button type="button" size="sm" onClick={addFlight}
          className="mt-3 gap-1.5 h-8 text-xs" style={{ backgroundColor: '#4AA3FF', color: '#0a1628' }}>
          <Plus className="w-3.5 h-3.5" /> Add Flight
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hasLinkedEnquiry && flightItems.length > 0 && !travelDate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.25)' }}>
          <p className="text-xs" style={{ color: '#F0B429' }}>
            No enquiry linked — travel dates not auto-filled. Link an enquiry in Quote Configuration to sync dates.
          </p>
        </div>
      )}
      {flightItems.map((item, idx) => (
        <div key={item.id} className="rounded-xl overflow-hidden shadow-sm"
          style={{ backgroundColor: 'var(--qb-modal-2)', border: '1px solid rgba(74,163,255,0.25)' }}
          data-testid={`flight-item-${idx}`}>
          {/* Card Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: 'rgba(74,163,255,0.10)', borderBottom: '1px solid rgba(74,163,255,0.20)' }}>
            <div className="flex items-center gap-2">
              <Plane className="w-3.5 h-3.5" style={{ color: '#4AA3FF' }} />
              <span className="text-xs font-semibold" style={{ color: '#4AA3FF' }}>
                Flight {idx + 1}{item.title && <span className="ml-1.5 font-normal" style={{ color: 'rgba(74,163,255,0.70)' }}>— {item.title}</span>}
              </span>
              {item.flight_class && item.flight_class !== 'Economy' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(74,163,255,0.18)', color: '#4AA3FF' }}>{item.flight_class}</span>
              )}
              {/* Stopover toggle */}
              <button type="button"
                onClick={() => handleField(item, 'show_stopovers', !item.show_stopovers)}
                className="flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium transition-colors duration-150"
                style={item.stopovers?.length > 0
                  ? { backgroundColor: 'rgba(139,124,255,0.18)', color: '#8B7CFF', border: '1px solid rgba(139,124,255,0.35)' }
                  : { backgroundColor: 'transparent', border: '1px solid rgba(74,163,255,0.30)', color: '#4AA3FF' }}
                data-testid={`stopover-toggle-${idx}`}>
                <GitBranch className="w-2.5 h-2.5" />
                {item.stopovers?.length > 0 ? `${item.stopovers.length} Stopover${item.stopovers.length !== 1 ? 's' : ''}` : 'Stopover'}
              </button>
            </div>
            <button type="button" onClick={() => onRemove(item.id)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10 transition-colors"
              style={{ color: 'rgba(74,163,255,0.50)' }}
              data-testid={`flight-remove-${idx}`}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Card Body */}
          <div className="p-3 space-y-2.5">
            {/* Sector row */}
            <div className="grid grid-cols-5 gap-2">
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>From</Label>
                <input className={`${inp} w-full`} value={item.from_location || ''} onChange={e => handleField(item, 'from_location', e.target.value)} placeholder="BOM" /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>To</Label>
                <input className={`${inp} w-full`} value={item.to_location || ''} onChange={e => handleField(item, 'to_location', e.target.value)} placeholder="DXB" /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Date</Label>
                <input className={`${inp} w-full`} type="date" value={item.flight_date || ''} onChange={e => handleField(item, 'flight_date', e.target.value)} /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Dep</Label>
                <input className={`${inp} w-full`} type="time" value={item.dep_time || ''} onChange={e => handleField(item, 'dep_time', e.target.value)} /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Arr</Label>
                <input className={`${inp} w-full`} type="time" value={item.arr_time || ''} onChange={e => handleField(item, 'arr_time', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Airline</Label>
                <input className={`${inp} w-full`} value={item.airline || ''} onChange={e => handleField(item, 'airline', e.target.value)} placeholder="EK, AI, 6E..." /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Flight No</Label>
                <input className={`${inp} w-full`} value={item.flight_no || ''} onChange={e => handleField(item, 'flight_no', e.target.value)} placeholder="EK 521" /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Class</Label>
                <Select value={item.flight_class || 'Economy'} onValueChange={v => handleField(item, 'flight_class', v)}>
                  <SelectTrigger className="h-7 text-xs bg-[var(--qb-field)] border-[var(--qb-field-border)] text-[var(--app-fg)]"><SelectValue /></SelectTrigger>
                  <SelectContent>{FLIGHT_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>PNR</Label>
                <input className={`${inp} w-full uppercase`} value={item.pnr || ''} onChange={e => handleField(item, 'pnr', e.target.value)} placeholder="ABC123" /></div>
            </div>
            {/* Fare breakdown */}
            <div className="grid grid-cols-3 gap-2 rounded-lg p-2" style={{ backgroundColor: 'rgba(74,163,255,0.08)', border: '1px solid rgba(74,163,255,0.20)' }}>
              {[['fare_adult','no_adults','Adult Fare × Pax'],['fare_child','no_children','Child Fare × Pax (2-11)'],['fare_infant','no_infants','Infant Fare × Pax (u2)']].map(([fKey,nKey,lbl]) => (
                <div key={fKey}><Label className="text-[10px] mb-1 block font-medium" style={{ color: '#4AA3FF' }}>{lbl}</Label>
                  <div className="flex items-center gap-1">
                    <input className={`${inp} w-full`} type="number" min="0" value={item[fKey] || 0} onChange={e => handleField(item, fKey, e.target.value)} placeholder="Fare" style={{width:'75%'}} />
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(74,163,255,0.70)' }}>×</span>
                    <input className={`${inp} text-center`} type="number" min="0" value={item[nKey] || 0} onChange={e => handleField(item, nKey, e.target.value)} style={{width:'25%'}} />
                  </div></div>
              ))}
            </div>
            {/* Currency / ROE / Totals */}
            <div className="grid grid-cols-4 gap-2 items-end pt-1" style={{ borderTop: '1px solid rgba(74,163,255,0.20)' }}>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Currency</Label>
                <Select value={item.currency || baseCurrency} onValueChange={v => handleField(item, 'currency', v)}>
                  <SelectTrigger className="h-7 text-xs bg-[var(--qb-field)] border-[var(--qb-field-border)] text-[var(--app-fg)]"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>ROE → {baseCurrency}</Label>
                <input className={`${inp} w-full text-right ${item.currency === baseCurrency ? 'opacity-50 cursor-not-allowed' : ''}`}
                  type="number" min="0" step="0.0001" value={item.roe_to_base || 1} disabled={item.currency === baseCurrency}
                  onChange={e => handleField(item, 'roe_to_base', e.target.value)} /></div>
              <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Total ({item.currency || baseCurrency})</Label>
                <div className="h-7 flex items-center px-2 rounded-md text-xs font-semibold text-right justify-end font-mono" style={{ backgroundColor: 'rgba(74,163,255,0.12)', border: '1px solid rgba(74,163,255,0.28)', color: '#4AA3FF' }}>
                  {fmt(item.unit_price || 0)}</div></div>
              <div><Label className="text-[10px] mb-1 block font-semibold" style={{ color: 'var(--cta)' }}>Amt ({baseCurrency})</Label>
                <div className="h-7 flex items-center px-2 rounded-md text-xs font-bold justify-end font-mono" style={{ background: 'linear-gradient(135deg, rgba(232,168,48,0.18), rgba(232,168,48,0.08))', border: '1px solid rgba(232,168,48,0.35)', color: 'var(--cta)' }}>
                  {fmt(totalInBase(item))}</div></div>
            </div>

            {/* Stopover Section */}
            {item.show_stopovers && (
              <div className="pt-2.5 mt-1 space-y-2" style={{ borderTop: '1px solid rgba(139,124,255,0.25)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1" style={{ color: '#8B7CFF' }}>
                    <GitBranch className="w-3 h-3" /> Stopovers
                  </p>
                  <button type="button" onClick={() => addStopover(item)}
                    className="h-6 px-2 text-[10px] rounded-md border flex items-center gap-1"
                    style={{ borderColor: 'rgba(139,124,255,0.40)', color: '#8B7CFF', backgroundColor: 'rgba(139,124,255,0.08)' }}>
                    <Plus className="w-2.5 h-2.5" /> Add Stopover
                  </button>
                </div>
                {(item.stopovers || []).length === 0 && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--app-muted)' }}>No stopovers yet. Click "Add Stopover" above.</p>
                )}
                {(item.stopovers || []).map((stop, si) => (
                  <StopoverRow key={stop.id} stop={stop} idx={si}
                    onUpdate={(field, value) => updateStopover(item, stop.id, field, value)}
                    onRemove={() => removeStopover(item, stop.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <Button type="button" size="sm" onClick={addFlight} variant="outline"
        className="w-full gap-1.5 h-8 text-xs border-dashed border-2 bg-transparent"
        style={{ borderColor: 'rgba(74,163,255,0.40)', color: '#4AA3FF' }}
        data-testid="add-flight-btn">
        <Plus className="w-3.5 h-3.5" /> Add Another Flight
      </Button>
    </div>
  );
}
