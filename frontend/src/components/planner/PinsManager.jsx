import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, MapPin, RefreshCw, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { listPins, createPin, deletePin } from '../../services/tripAPI';

const PIN_TYPE_COLORS = {
  hotel:      '#1B9CFC',
  attraction: '#2F9E6F',
  transport:  '#9B59B6',
  border:     '#FFB300',
  contact:    '#00D6C2',
  other:      '#8FB3C7',
};

const FIELD_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--stroke-soft)',
  color: 'var(--app-fg)',
  fontFamily: 'Figtree, sans-serif',
};

export function PinsManager() {
  const [pins, setPins]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState({ name: '', pin_type: 'hotel', lat: '', lng: '', country: '', notes: '' });
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setPins(await listPins()); } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.lat || !form.lng) { toast.error('Name, latitude and longitude are required'); return; }
    setSaving(true);
    try {
      const pin = await createPin({ ...form, lat: Number(form.lat), lng: Number(form.lng), rating: null });
      setPins(prev => [pin, ...prev]);
      setForm({ name: '', pin_type: 'hotel', lat: '', lng: '', country: '', notes: '' });
      setShowForm(false);
      toast.success('Pin saved');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pin?')) return;
    setDeleting(id);
    try {
      await deletePin(id);
      setPins(prev => prev.filter(p => p.id !== id));
      toast.success('Pin deleted');
    } catch (err) { toast.error(err.message); } finally { setDeleting(null); }
  };

  return (
    <div className="flex flex-col h-full" data-testid="pins-manager">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--surface)' }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>Global Pins</p>
        <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Saved points of interest</p>
        <div className="flex-1" />
        <button
          onClick={load}
          className="h-8 w-8 flex items-center justify-center rounded"
          style={{ border: '1px solid var(--stroke-soft)', color: 'var(--app-muted)' }}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <Button
          data-testid="add-pin-btn"
          onClick={() => setShowForm(s => !s)}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'Add Pin'}
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--surface-2)' }}>
          <div className="max-w-lg grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Name *</Label>
              <Input data-testid="pin-name-input" placeholder="Pin name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={FIELD_STYLE} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Type</Label>
              <select
                data-testid="pin-type-select"
                value={form.pin_type}
                onChange={e => setForm(f => ({ ...f, pin_type: e.target.value }))}
                style={{ ...FIELD_STYLE, height: '36px', padding: '0 8px', borderRadius: '6px', outline: 'none', width: '100%' }}
              >
                {Object.keys(PIN_TYPE_COLORS).map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Country</Label>
              <Input placeholder="France…" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} style={FIELD_STYLE} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Latitude *</Label>
              <Input data-testid="pin-lat-input" type="number" placeholder="48.8566" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} style={FIELD_STYLE} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Longitude *</Label>
              <Input data-testid="pin-lng-input" type="number" placeholder="2.3522" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} style={FIELD_STYLE} />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Notes</Label>
              <Input placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={FIELD_STYLE} />
            </div>
            <div className="col-span-2">
              <Button
                data-testid="save-pin-btn"
                onClick={handleCreate}
                disabled={saving}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                Save Pin
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pin list */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" style={{ background: 'var(--surface)' }} />)}
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <MapPin className="w-8 h-8 opacity-20" style={{ color: 'var(--cta)' }} />
            <p className="text-sm" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>No pins saved yet</p>
            <p className="text-xs" style={{ color: 'var(--app-dim)' }}>Click on the map to add pins, or use the Add Pin button above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pins.map(pin => (
              <div
                key={pin.id}
                data-testid={`pin-card-${pin.id}`}
                className="group flex items-start gap-3 p-3 rounded-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${PIN_TYPE_COLORS[pin.pin_type] || '#888'}18`, border: `1px solid ${PIN_TYPE_COLORS[pin.pin_type] || '#888'}40` }}
                >
                  <MapPin className="w-4 h-4" style={{ color: PIN_TYPE_COLORS[pin.pin_type] || '#888' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>{pin.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>
                    {pin.pin_type} {pin.country ? `· ${pin.country}` : ''}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--app-dim)' }}>
                    {pin.lat?.toFixed(4)}, {pin.lng?.toFixed(4)}
                  </p>
                  {pin.notes && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--app-muted)' }}>{pin.notes}</p>}
                </div>
                <button
                  data-testid={`delete-pin-${pin.id}`}
                  onClick={() => handleDelete(pin.id)}
                  disabled={deleting === pin.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                  style={{ color: 'var(--danger)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {deleting === pin.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
