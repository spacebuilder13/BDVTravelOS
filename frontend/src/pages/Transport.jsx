import React, { useState, useEffect, useCallback } from 'react';
import { transportAPI } from '../services/api';
import { toast } from 'sonner';
import {
  Plane, Train, Bus, Car, Plus, Trash2, Pencil, X,
  MapPin, Clock, Users, CreditCard, RefreshCw, Search
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';

// ── Transport type config ────────────────────────────────────────────────────
const TRANSPORT_TYPES = [
  { id: 'all',    label: 'All',     icon: null },
  { id: 'flight', label: 'Flights', icon: Plane },
  { id: 'train',  label: 'Trains',  icon: Train },
  { id: 'bus',    label: 'Bus',     icon: Bus   },
  { id: 'taxi',   label: 'Taxis',   icon: Car   },
];

const TYPE_ICONS = { flight: Plane, train: Train, bus: Bus, taxi: Car };
const TYPE_COLORS = {
  flight: { bg: 'rgba(74,163,255,0.12)', accent: '#4aa3ff', label: '#4aa3ff' },
  train:  { bg: 'rgba(39,174,96,0.12)',  accent: '#27ae60', label: '#27ae60' },
  bus:    { bg: 'rgba(232,168,48,0.12)', accent: '#e8a830', label: '#e8a830' },
  taxi:   { bg: 'rgba(192,57,43,0.12)',  accent: '#e8765a', label: '#e8765a' },
};

const STATUS_COLORS = {
  Confirmed: { bg: 'rgba(39,174,96,0.15)',  text: '#27ae60' },
  Pending:   { bg: 'rgba(232,168,48,0.15)', text: '#e8a830' },
  Cancelled: { bg: 'rgba(192,57,43,0.15)',  text: '#c0392b' },
};

const EMPTY_FORM = {
  transport_type: 'flight',
  booking_ref: '',
  from_location: '',
  to_location: '',
  dep_date: '',
  dep_time: '',
  arr_time: '',
  carrier_name: '',
  carrier_code: '',
  pax_adults: 1,
  pax_children: 0,
  pax_infants: 0,
  amount: '',
  currency: 'INR',
  travel_class: '',
  seat_numbers: '',
  client_name: '',
  status: 'Confirmed',
  notes: '',
};

// ── Boarding Pass Card Component ────────────────────────────────────────────
function BoardingPassCard({ booking, onEdit, onDelete }) {
  const Icon = TYPE_ICONS[booking.transport_type] || Plane;
  const colors = TYPE_COLORS[booking.transport_type] || TYPE_COLORS.flight;
  const statusStyle = STATUS_COLORS[booking.status] || STATUS_COLORS.Confirmed;

  return (
    <div
      data-testid={`transport-card-${booking.id}`}
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-elev-1), var(--inner-glow)',
        border: `1px solid ${colors.accent}30`,
      }}
    >
      {/* Top accent strip */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${colors.accent}, transparent)` }}
      />

      <div className="p-4">
        {/* Header row: type + ref + status + actions */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: colors.bg }}
            >
              <Icon className="w-4 h-4" style={{ color: colors.accent }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.label }}>
                {booking.transport_type}
              </p>
              {booking.booking_ref && (
                <p className="text-[10px] font-mono" style={{ color: 'var(--app-muted)' }}>
                  Ref: {booking.booking_ref}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
            >
              {booking.status}
            </span>
            <button
              data-testid={`transport-edit-${booking.id}`}
              onClick={() => onEdit(booking)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/8 transition-colors"
              style={{ color: 'var(--app-muted)' }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              data-testid={`transport-delete-${booking.id}`}
              onClick={() => onDelete(booking.id)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/10 transition-colors"
              style={{ color: '#fca5a5' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Route: FROM --- icon --- TO */}
        <div
          className="flex items-center gap-2 py-3 px-3 rounded-xl mb-3"
          style={{ backgroundColor: colors.bg, border: `1px dashed ${colors.accent}40` }}
        >
          <div className="text-center flex-1">
            <p
              className="text-lg font-bold font-mono tracking-widest"
              style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}
            >
              {booking.from_location}
            </p>
            {booking.dep_time && (
              <p className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>{booking.dep_time}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5 px-2">
            <Icon className="w-4 h-4" style={{ color: colors.accent }} />
            <div className="w-12 h-px" style={{ backgroundColor: `${colors.accent}60` }} />
          </div>
          <div className="text-center flex-1">
            <p
              className="text-lg font-bold font-mono tracking-widest"
              style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}
            >
              {booking.to_location}
            </p>
            {booking.arr_time && (
              <p className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>{booking.arr_time}</p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" style={{ color: 'var(--app-muted)' }} />
            <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>
              {booking.dep_date}
            </span>
          </div>
          {booking.carrier_name && (
            <div className="flex items-center gap-1">
              <Icon className="w-3 h-3" style={{ color: 'var(--app-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
                {booking.carrier_name}{booking.carrier_code ? ` · ${booking.carrier_code}` : ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" style={{ color: 'var(--app-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
              {booking.pax_adults + (booking.pax_children || 0)} pax
            </span>
          </div>
          {booking.travel_class && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-3)', color: 'var(--app-fg)' }}
            >
              {booking.travel_class}
            </span>
          )}
        </div>

        {/* Footer: client + amount */}
        {(booking.client_name || booking.amount > 0) && (
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: '1px solid var(--stroke-soft)' }}
          >
            {booking.client_name && (
              <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
                {booking.client_name}
              </span>
            )}
            {booking.amount > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                <CreditCard className="w-3 h-3" style={{ color: 'var(--cta)' }} />
                <span className="text-sm font-semibold font-mono" style={{ color: 'var(--cta)' }}>
                  {booking.currency} {Number(booking.amount).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add/Edit Dialog ──────────────────────────────────────────────────────────
function TransportDialog({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initialData?.id;

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
    }
  }, [open, initialData]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.from_location || !form.to_location || !form.dep_date) {
      toast.error('Please fill in From, To, and Departure Date');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 };
      await onSave(payload);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "rounded-[var(--radius-input)] bg-[var(--surface)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)] focus-visible:shadow-[var(--ring)] transition-colors h-9 text-sm";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--stroke)',
          borderRadius: 'var(--radius-modal)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}>
            {isEdit ? 'Edit Transport Booking' : 'New Transport Booking'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Type */}
          <div className="col-span-2">
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Type</label>
            <div className="flex gap-2 flex-wrap">
              {['flight','train','bus','taxi'].map(t => {
                const Icon = TYPE_ICONS[t];
                const active = form.transport_type === t;
                return (
                  <button
                    key={t}
                    data-testid={`transport-type-btn-${t}`}
                    onClick={() => set('transport_type', t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize"
                    style={{
                      backgroundColor: active ? 'rgba(232,168,48,0.15)' : 'var(--surface-2)',
                      border: active ? '1.5px solid var(--cta)' : '1.5px solid var(--stroke)',
                      color: active ? 'var(--cta)' : 'var(--app-muted)',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* From / To */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>From *</label>
            <Input data-testid="transport-form-from" placeholder="e.g. BOM / Mumbai" value={form.from_location} onChange={e => set('from_location', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>To *</label>
            <Input data-testid="transport-form-to" placeholder="e.g. DXB / Dubai" value={form.to_location} onChange={e => set('to_location', e.target.value)} className={inputClass} />
          </div>

          {/* Dates */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Departure Date *</label>
            <Input data-testid="transport-form-dep-date" type="date" value={form.dep_date} onChange={e => set('dep_date', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Booking Ref</label>
            <Input data-testid="transport-form-ref" placeholder="PNR / Reference" value={form.booking_ref} onChange={e => set('booking_ref', e.target.value)} className={inputClass} />
          </div>

          {/* Times */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Dep. Time</label>
            <Input data-testid="transport-form-dep-time" placeholder="HH:MM" value={form.dep_time} onChange={e => set('dep_time', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Arr. Time</label>
            <Input data-testid="transport-form-arr-time" placeholder="HH:MM" value={form.arr_time} onChange={e => set('arr_time', e.target.value)} className={inputClass} />
          </div>

          {/* Carrier */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Carrier / Operator</label>
            <Input data-testid="transport-form-carrier" placeholder="Airline / Train / Operator" value={form.carrier_name} onChange={e => set('carrier_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Flight / Train No.</label>
            <Input data-testid="transport-form-carrier-code" placeholder="e.g. AI-102" value={form.carrier_code} onChange={e => set('carrier_code', e.target.value)} className={inputClass} />
          </div>

          {/* Pax */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Adults</label>
            <Input data-testid="transport-form-adults" type="number" min="1" value={form.pax_adults} onChange={e => set('pax_adults', parseInt(e.target.value) || 1)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Children</label>
            <Input data-testid="transport-form-children" type="number" min="0" value={form.pax_children} onChange={e => set('pax_children', parseInt(e.target.value) || 0)} className={inputClass} />
          </div>

          {/* Class + Status */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Class</label>
            <Input data-testid="transport-form-class" placeholder="Economy / Business / AC" value={form.travel_class} onChange={e => set('travel_class', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Status</label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger data-testid="transport-form-status" className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client + Amount */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Client Name</label>
            <Input data-testid="transport-form-client" placeholder="Client / Pax name" value={form.client_name} onChange={e => set('client_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Amount (INR)</label>
            <Input data-testid="transport-form-amount" type="number" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputClass} />
          </div>

          {/* Seats / Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Seat Numbers</label>
            <Input data-testid="transport-form-seats" placeholder="e.g. 12A, 12B" value={form.seat_numbers} onChange={e => set('seat_numbers', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Notes</label>
            <Input data-testid="transport-form-notes" placeholder="Additional info" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="transport-dialog-cancel"
            className="rounded-full"
            style={{ color: 'var(--app-muted)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="transport-dialog-save"
            className="rounded-full"
            style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEdit ? 'Update Booking' : 'Add Booking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Transport Page ──────────────────────────────────────────────────────
export default function Transport() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeType !== 'all') params.transport_type = activeType;
      const res = await transportAPI.list(params);
      setBookings(res.data);
    } catch (e) {
      console.error('[Transport] Failed to load bookings:', e);
      toast.error('Failed to load transport bookings');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (editingBooking) {
      await transportAPI.update(editingBooking.id, data);
      toast.success('Booking updated');
    } else {
      await transportAPI.create(data);
      toast.success('Booking added');
    }
    setEditingBooking(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this booking?')) return;
    try {
      await transportAPI.delete(id);
      toast.success('Booking deleted');
      setBookings(b => b.filter(x => x.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingBooking(null);
    setDialogOpen(true);
  };

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.from_location?.toLowerCase().includes(q) ||
      b.to_location?.toLowerCase().includes(q) ||
      b.booking_ref?.toLowerCase().includes(q) ||
      b.carrier_name?.toLowerCase().includes(q) ||
      b.client_name?.toLowerCase().includes(q)
    );
  });

  // Summary counts
  const counts = { flight: 0, train: 0, bus: 0, taxi: 0 };
  bookings.forEach(b => { if (counts[b.transport_type] !== undefined) counts[b.transport_type]++; });

  return (
    <div className="space-y-5" data-testid="transport-page">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[22px] font-bold tracking-wide"
            style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}
            data-testid="transport-page-title"
          >
            Transport
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted)' }}>
            Flights, trains, buses &amp; taxi transfers
          </p>
        </div>
        <Button
          onClick={openAdd}
          data-testid="transport-add-btn"
          className="rounded-full flex items-center gap-2"
          style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}
        >
          <Plus className="w-4 h-4" /> Add Booking
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(counts).map(([type, count]) => {
          const Icon = TYPE_ICONS[type];
          const colors = TYPE_COLORS[type];
          return (
            <div
              key={type}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.accent}40` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: colors.accent }} />
              <span className="text-xs font-semibold font-mono" style={{ color: colors.label }}>
                {count}
              </span>
              <span className="text-xs capitalize" style={{ color: 'var(--app-muted)' }}>{type}s</span>
            </div>
          );
        })}
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--stroke-soft)' }}>
          {TRANSPORT_TYPES.map(t => (
            <button
              key={t.id}
              data-testid={`transport-filter-${t.id}`}
              onClick={() => setActiveType(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                backgroundColor: activeType === t.id ? 'var(--cta)' : 'transparent',
                color: activeType === t.id ? '#1a2a4a' : 'var(--app-muted)',
              }}
            >
              {t.icon && <t.icon className="w-3.5 h-3.5" />} {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
          <Input
            data-testid="transport-search"
            placeholder="Search bookings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm rounded-full bg-[var(--surface)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)]"
          />
        </div>

        <button
          data-testid="transport-refresh"
          onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/8 transition-colors"
          style={{ color: 'var(--app-muted)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" style={{ backgroundColor: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[var(--radius-card)]"
          style={{ backgroundColor: 'var(--surface)', border: '1px dashed var(--stroke)' }}
          data-testid="transport-empty"
        >
          <Plane className="w-10 h-10 mb-3" style={{ color: 'var(--app-muted)', opacity: 0.4 }} />
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-fg)' }}>
            {search ? 'No bookings match your search' : 'No transport bookings yet'}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--app-muted)' }}>
            {search ? 'Try a different search term' : 'Add flights, trains, buses, or taxi transfers'}
          </p>
          {!search && (
            <Button
              onClick={openAdd}
              data-testid="transport-empty-add"
              className="rounded-full text-sm"
              style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add First Booking
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="transport-grid">
          {filtered.map(b => (
            <BoardingPassCard key={b.id} booking={b} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Dialog */}
      <TransportDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingBooking(null); }}
        onSave={handleSave}
        initialData={editingBooking}
      />
    </div>
  );
}
