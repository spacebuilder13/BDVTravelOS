import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverAnchor } from '../ui/popover';
import { Plus, Trash2, Building2, Check, ChevronDown, Moon, StickyNote, ChevronUp, Clock } from 'lucide-react';
import { getROE } from '../../utils/roeStorage';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];
const ROOM_TYPES = ['Standard', 'Deluxe', 'Superior', 'Suite', 'Family Room', 'Twin', 'Triple', 'Executive', 'Junior Suite', 'Presidential Suite'];
const MEAL_PLANS = ['BB', 'HB', 'FB', 'AI', 'RO', 'EP'];
const MEAL_PLAN_LABELS = {
  BB: 'BB – Bed & Breakfast', HB: 'HB – Half Board', FB: 'FB – Full Board',
  AI: 'AI – All Inclusive', RO: 'RO – Room Only', EP: 'EP – European Plan',
};
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const calcNights = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
};

// ── Editable Room Type Combobox ──────────────────────────────────────────────
function RoomTypeCombobox({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const filtered = ROOM_TYPES.filter(r => !value || r.toLowerCase().includes(value.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            className="h-7 text-xs px-2 pr-7 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] border border-[rgba(39,174,96,0.30)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(39,174,96,0.5)] w-full"
            value={value || ''}
            onChange={e => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
            placeholder="e.g. Deluxe, Suite..."
            data-testid="hotel-room-type-input"
          />
          <button type="button" tabIndex={-1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[var(--app-muted)] hover:text-[#27AE60]"
            onClick={() => setOpen(!open)}>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[200px] p-1.5" align="start" sideOffset={4}>
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--app-muted)] px-2 py-1.5 italic">Custom: {value} will be used</p>
        ) : (
          filtered.map(r => (
            <button key={r} type="button"
              className={`w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                value === r ? 'bg-[rgba(39,174,96,0.10)] text-[#27AE60] font-semibold' : 'text-[var(--app-fg)] hover:bg-[rgba(39,174,96,0.10)] hover:text-[#27AE60]'
              }`}
              onMouseDown={e => { e.preventDefault(); onChange(r); setOpen(false); }}>
              {value === r ? <Check className="w-3 h-3 flex-shrink-0 text-[#27AE60]" /> : <span className="w-3 flex-shrink-0" />}
              {r}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Sticky Notes Panel ──────────────────────────────────────────────────────────
function StickyNotesPanel({ storageKey }) {
  const [collapsed, setCollapsed] = useState(false);
  const [note, setNote] = useState(() => localStorage.getItem(storageKey) || '');
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimeout = React.useRef(null);

  const handleChange = useCallback((val) => {
    setNote(val);
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(storageKey, val);
      setLastSaved(new Date());
    }, 800);
  }, [storageKey]);

  useEffect(() => () => clearTimeout(saveTimeout.current), []);

  const fmtTime = (d) => d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 rounded-xl shadow-xl flex flex-col overflow-hidden"
      style={{ width: 280, border: '1px solid #e8d89a', backgroundColor: '#FFFDE7', fontFamily: 'inherit' }}
      data-testid="sticky-notes-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? 'none' : '1px solid #e8d89a', backgroundColor: '#FFF9C4' }}
        onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" style={{ color: '#9a8200' }} />
          <p className="text-xs font-semibold" style={{ color: '#9a8200' }}>Hotel Notes</p>
        </div>
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#9a8200' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#9a8200' }} />}
      </div>
      {/* Body */}
      {!collapsed && (
        <div className="flex flex-col" style={{ height: 168 }}>
          <textarea
            className="flex-1 resize-none text-xs p-2.5 focus:outline-none"
            style={{ backgroundColor: 'transparent', color: '#5a4a00', lineHeight: '1.6' }}
            value={note}
            onChange={e => handleChange(e.target.value)}
            placeholder="Quick notes about hotels, preferences, requests..."
            data-testid="sticky-notes-textarea"
          />
          <div className="px-2.5 pb-1.5 flex items-center gap-1" style={{ borderTop: '1px solid #e8d89a' }}>
            <Clock className="w-2.5 h-2.5" style={{ color: '#9a8200' }} />
            <p className="text-[9px]" style={{ color: '#9a8200' }}>
              {lastSaved ? `Saved ${fmtTime(lastSaved)}` : 'Auto-saves as you type'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main HotelTab ──────────────────────────────────────────────────────────────
export function HotelTab({ items, onAdd, onUpdate, onRemove, baseCurrency, quoteId }) {
  const hotelItems = items.filter(i => i.category === 'Hotels');
  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const notesKey = `hotel_notes_${quoteId || 'draft'}`;

  const addHotel = () => {
    onAdd({
      id: newId(), category: 'Hotels', title: '', description: '', qty: 1, unit_price: 0,
      currency: baseCurrency, roe_to_base: 1.0, city: '', hotel_name: '',
      check_in: '', check_out: '', nights: 0, room_type: 'Deluxe', meal_plan: 'BB',
      no_of_rooms: 1, rate_per_night: 0,
    });
  };

  const handleField = (item, field, value) => {
    const updated = { ...item, [field]: value };
    const ci = field === 'check_in' ? value : updated.check_in;
    const co = field === 'check_out' ? value : updated.check_out;
    updated.nights = calcNights(ci, co);
    const rooms = parseInt(field === 'no_of_rooms' ? value : updated.no_of_rooms) || 1;
    const rate = parseFloat(field === 'rate_per_night' ? value : updated.rate_per_night) || 0;
    updated.qty = Math.max(1, updated.nights * rooms);
    updated.unit_price = rate;
    if (field === 'hotel_name') updated.title = value || 'Hotel';
    if (field === 'currency' && value === baseCurrency) updated.roe_to_base = 1.0;
    else if (field === 'currency' && value !== baseCurrency) updated.roe_to_base = getROE(value, baseCurrency);
    onUpdate(item.id, updated);
  };

  const totalInBase = (item) =>
    (parseFloat(item.unit_price) || 0) * (parseInt(item.qty) || 1) * (parseFloat(item.roe_to_base) || 1);

  const inp = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(39,174,96,0.5)] w-full transition-colors duration-150';

  if (hotelItems.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-[rgba(39,174,96,0.10)] border border-[rgba(39,174,96,0.30)] flex items-center justify-center mb-3">
            <Building2 className="w-4 h-4 text-[#27AE60]" />
          </div>
          <p className="text-sm font-medium text-[var(--app-fg)]">No hotels added yet</p>
          <p className="text-xs text-[var(--app-muted)] mt-0.5">Add hotel stays with room and meal plan details</p>
          <Button type="button" size="sm" onClick={addHotel}
            className="mt-3 gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-[rgba(39,174,96,0.12)] text-white">
            <Plus className="w-3.5 h-3.5" /> Add Hotel
          </Button>
        </div>
        <StickyNotesPanel storageKey={notesKey} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {hotelItems.map((item, idx) => (
          <div key={item.id} className="rounded-xl border border-[rgba(39,174,96,0.30)] overflow-hidden shadow-sm"
            data-testid={`hotel-item-${idx}`}>
            <div className="flex items-center justify-between px-3 py-2 bg-[rgba(39,174,96,0.10)] border-b border-[rgba(39,174,96,0.30)]">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-[#27AE60]" />
                <span className="text-xs font-semibold text-[#27AE60]">
                  Hotel {idx + 1}{item.hotel_name && <span className="ml-1.5 text-[#27AE60]/70 font-normal">— {item.hotel_name}</span>}
                </span>
                {item.nights > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(39,174,96,0.10)] text-[#27AE60] font-semibold">
                    <Moon className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />{item.nights}N
                  </span>
                )}
                {item.city && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[rgba(39,174,96,0.30)] text-[#27AE60]" style={{ backgroundColor: 'rgba(39,174,96,0.10)' }}>{item.city}</span>}
              </div>
              <button type="button" onClick={() => onRemove(item.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#27AE60]/60 hover:text-red-500"
                data-testid={`hotel-remove-${idx}`}><Trash2 className="w-3 h-3" /></button>
            </div>
            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Hotel Name</Label>
                  <input className={inp} value={item.hotel_name || ''} onChange={e => handleField(item, 'hotel_name', e.target.value)} placeholder="e.g. JW Marriott" /></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>City</Label>
                  <input className={inp} value={item.city || ''} onChange={e => handleField(item, 'city', e.target.value)} placeholder="e.g. Dubai" /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Check-in</Label>
                  <input className={inp} type="date" value={item.check_in || ''} onChange={e => handleField(item, 'check_in', e.target.value)} /></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Check-out</Label>
                  <input className={inp} type="date" value={item.check_out || ''} onChange={e => handleField(item, 'check_out', e.target.value)} /></div>
                <div><Label className="text-[10px] text-[#27AE60] mb-1 block font-semibold">Nights (auto)</Label>
                  <div className="h-7 flex items-center px-2 rounded-md bg-[rgba(39,174,96,0.10)] border border-[rgba(39,174,96,0.30)] text-xs font-bold text-[#27AE60]">{item.nights || 0} nts</div></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Rooms</Label>
                  <input className={`${inp} text-center`} type="number" min="1" value={item.no_of_rooms || 1}
                    data-testid={`hotel-rooms-${idx}`} onChange={e => handleField(item, 'no_of_rooms', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Room Type</Label>
                  <RoomTypeCombobox value={item.room_type || 'Deluxe'} onChange={v => handleField(item, 'room_type', v)} /></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Meal Plan</Label>
                  <Select value={item.meal_plan || 'BB'} onValueChange={v => handleField(item, 'meal_plan', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{MEAL_PLANS.map(m => <SelectItem key={m} value={m}>{MEAL_PLAN_LABELS[m]}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-4 gap-2 items-end pt-1 border-t border-[rgba(39,174,96,0.30)]">
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Rate / Night</Label>
                  <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.rate_per_night || 0}
                    data-testid={`hotel-rate-per-night-${idx}`} onChange={e => handleField(item, 'rate_per_night', e.target.value)} /></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Currency</Label>
                  <Select value={item.currency || baseCurrency} onValueChange={v => handleField(item, 'currency', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>ROE → {baseCurrency}</Label>
                  <input className={`${inp} text-right ${item.currency === baseCurrency ? 'bg-[#f2f4f8] cursor-not-allowed' : ''}`}
                    type="number" min="0" step="0.0001" value={item.roe_to_base || 1}
                    disabled={item.currency === baseCurrency} onChange={e => handleField(item, 'roe_to_base', e.target.value)} /></div>
                <div><Label className="text-[10px] text-[#27AE60] mb-1 block font-semibold">Amt ({baseCurrency})</Label>
                  <div className="h-7 flex items-center px-2 rounded-md text-xs font-bold justify-end" style={{ background: 'linear-gradient(135deg, rgba(232,168,48,0.18), rgba(232,168,48,0.08))', border: '1px solid rgba(232,168,48,0.35)', color: 'var(--cta)' }}>
                    {fmt(totalInBase(item))}</div></div>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" size="sm" onClick={addHotel} variant="outline"
          className="w-full gap-1.5 h-8 text-xs border-dashed border-2 border-[rgba(39,174,96,0.30)] bg-transparent text-[#27AE60] hover:bg-[rgba(39,174,96,0.10)] hover:border-emerald-300"
          data-testid="add-hotel-btn">
          <Plus className="w-3.5 h-3.5" /> Add Another Hotel
        </Button>
      </div>
      {/* Sticky notes - always shown when hotels tab is visible */}
      <StickyNotesPanel storageKey={notesKey} />
    </>
  );
}
