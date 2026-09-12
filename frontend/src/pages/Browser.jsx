import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { quickLinksAPI } from '../services/api';
import { sourcesAPI } from '../services/sourcesAPI';
import { listTrips } from '../services/tripAPI';
import { toast } from 'sonner';
import {
  Plus, Trash2, Globe, X, ExternalLink, RefreshCw, Search,
  Bookmark, Link2, DollarSign, FileText, Camera, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { SourceBadge } from '../components/planner/SourceBadge';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_SUGGESTIONS = [
  { label: 'Amadeus',           url: 'https://amadeus.com',              icon: '✈️', category: 'GDS',     color: '#4aa3ff' },
  { label: 'Galileo',           url: 'https://travelport.com',           icon: '🌐', category: 'GDS',     color: '#27ae60' },
  { label: 'MakeMyTrip B2B',    url: 'https://b2b.makemytrip.com',       icon: '🛫', category: 'Flights', color: '#e8a830' },
  { label: 'Cleartrip B2B',     url: 'https://cleartrip.com',            icon: '🏷️', category: 'Flights', color: '#4aa3ff' },
  { label: 'Booking.com',       url: 'https://booking.com',              icon: '🏨', category: 'Hotels',  color: '#0071c2' },
  { label: 'Expedia Affiliate', url: 'https://expediaaffiliate.com',     icon: '🏩', category: 'Hotels',  color: '#27ae60' },
  { label: 'VFS Global',        url: 'https://vfsglobal.com',            icon: '🛂', category: 'Visa',    color: '#c0392b' },
  { label: 'BLS International', url: 'https://blsinternational.com',     icon: '📋', category: 'Visa',    color: '#e8765a' },
  { label: 'Skyscanner',        url: 'https://skyscanner.com',           icon: '🔍', category: 'Search',  color: '#0770e3' },
  { label: 'Google Flights',    url: 'https://flights.google.com',       icon: '🔎', category: 'Search',  color: '#4aa3ff' },
  { label: 'IRCTC',             url: 'https://irctc.co.in',              icon: '🚂', category: 'Rail',    color: '#e8a830' },
  { label: 'RedBus',            url: 'https://redbus.in',                icon: '🚌', category: 'Bus',     color: '#c0392b' },
];

const CATEGORIES = ['All', 'GDS', 'Flights', 'Hotels', 'Visa', 'Search', 'Rail', 'Bus', 'General'];

const CATEGORY_COLORS = {
  GDS: '#4aa3ff', Flights: '#e8a830', Hotels: '#27ae60',
  Visa: '#c0392b', Search: '#a0b4d0', Rail: '#f2b84a',
  Bus: '#e8765a', General: '#a0b4d0',
};

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];

function getFavicon(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

// ── Quick Link Card ───────────────────────────────────────────────────────────
function QuickLinkCard({ link, onDelete }) {
  const [imgError, setImgError] = useState(false);
  const favicon  = getFavicon(link.url);
  const catColor = CATEGORY_COLORS[link.category] || CATEGORY_COLORS.General;

  return (
    <div
      data-testid={`quick-link-card-${link.id}`}
      className="group relative rounded-[var(--radius-card)] transition-all duration-150 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--surface)',
        border: `1px solid ${catColor}28`,
        boxShadow: 'var(--shadow-1), var(--inner-glow)',
      }}
    >
      <div className="h-0.5 rounded-t-[var(--radius-card)]" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

      <div className="p-3 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{ backgroundColor: `${catColor}18` }}
        >
          {link.icon && !link.icon.startsWith('http') ? (
            <span>{link.icon}</span>
          ) : favicon && !imgError ? (
            <img src={favicon} alt="" className="w-5 h-5 object-contain" onError={() => setImgError(true)} />
          ) : (
            <Globe className="w-4 h-4" style={{ color: catColor }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)' }}>{link.label}</p>
          <p className="text-[10px] truncate font-mono" style={{ color: 'var(--app-muted)' }}>
            {link.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${catColor}18`, color: catColor }}
          >
            {link.category || 'General'}
          </span>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`quick-link-open-${link.id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: 'var(--app-muted)' }}
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <button
        data-testid={`quick-link-delete-${link.id}`}
        onClick={e => { e.stopPropagation(); onDelete(link.id); }}
        className="absolute top-2 right-8 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
        style={{ color: '#fca5a5' }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Add Link Dialog ───────────────────────────────────────────────────────────
function AddLinkDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({ label: '', url: '', icon: '', category: 'General' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ label: '', url: '', icon: '', category: 'General' });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.label || !form.url) { toast.error('Label and URL are required'); return; }
    let url = form.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    setSaving(true);
    try {
      await onSave({ ...form, url });
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "rounded-[var(--radius-input)] bg-[var(--surface)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)] focus-visible:shadow-[var(--ring)] transition-colors h-9 text-sm";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-modal)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>Add Quick Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Label *</label>
            <Input data-testid="add-link-label" placeholder="e.g. Amadeus" value={form.label} onChange={e => set('label', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>URL *</label>
            <Input data-testid="add-link-url" placeholder="https://example.com" value={form.url} onChange={e => set('url', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Icon (emoji)</label>
            <Input data-testid="add-link-icon" placeholder="✈️ or leave empty" value={form.icon} onChange={e => set('icon', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>Category</label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger data-testid="add-link-category" className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter(c => c !== 'All').map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} data-testid="add-link-cancel" className="rounded-full" style={{ color: 'var(--app-muted)' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="add-link-save"
            className="rounded-full" style={{ backgroundColor: 'var(--cta)', color: '#050A14', fontWeight: 600 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Capture Panel ─────────────────────────────────────────────────────────────
function CapturePanel({ trips }) {
  const [selectedTripId, setSelectedTripId] = useState('');
  const [tripSources, setTripSources]       = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [form, setForm] = useState({
    url: '',
    captured_price: '',
    captured_currency: 'INR',
    screenshot_url: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load existing sources for the selected trip
  const loadSources = useCallback(async (tripId) => {
    if (!tripId) { setTripSources([]); return; }
    setLoadingSources(true);
    try {
      const data = await sourcesAPI.list({ trip_id: tripId });
      setTripSources(data);
    } catch (err) {
      console.error('Failed to load sources', err);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadSources(selectedTripId);
  }, [selectedTripId, loadSources]);

  const handleCapture = async () => {
    if (!selectedTripId) { toast.error('Select a trip first'); return; }
    if (!form.url.trim()) { toast.error('URL is required'); return; }
    let url = form.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    setSaving(true);
    try {
      const payload = {
        trip_id:           selectedTripId,
        component_id:      null,
        component_type:    null,
        url,
        captured_price:    form.captured_price !== '' ? Number(form.captured_price) : null,
        captured_currency: form.captured_currency,
        screenshot_url:    form.screenshot_url.trim() || null,
        notes:             form.notes.trim() || null,
      };
      const created = await sourcesAPI.create(payload);
      setTripSources(prev => [created, ...prev]);
      setForm({ url: '', captured_price: '', captured_currency: 'INR', screenshot_url: '', notes: '' });
      toast.success('Source captured to trip');
    } catch (err) {
      toast.error(err.message || 'Failed to capture source');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm('Remove this source?')) return;
    try {
      await sourcesAPI.delete(sourceId);
      setTripSources(prev => prev.filter(s => s.id !== sourceId));
      toast.success('Source removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove source');
    }
  };

  const inputCls = "h-9 text-sm rounded-[var(--radius-input)] bg-[var(--surface-2)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)] transition-colors";

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--stroke-soft)',
        borderRadius: 'var(--r-card)',
      }}
      data-testid="capture-panel"
    >
      {/* Panel Header */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid var(--stroke-soft)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.18)' }}
          >
            <Link2 className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>
              Capture
            </h2>
            <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>Save URLs, prices & notes to a trip</p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Trip Selector */}
        <div>
          <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
            Trip Context *
          </label>
          <select
            data-testid="capture-trip-select"
            value={selectedTripId}
            onChange={e => setSelectedTripId(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              background: 'var(--surface-2)',
              color: selectedTripId ? 'var(--app-fg)' : 'var(--app-muted)',
              border: '1.5px solid var(--stroke)',
              borderRadius: 'var(--radius-input)',
              padding: '0 10px',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            <option value="">— Select a trip —</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>
                {t.client_name} → {t.origin_name} ({t.start_date?.slice(0, 10) || '—'})
              </option>
            ))}
          </select>
        </div>

        {/* ── Capture Form ── */}
        <div
          className="rounded-lg p-3 space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--cta)' }}>
            New Capture
          </p>

          {/* URL */}
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted)' }}>
              Source URL *
            </label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
              <Input
                data-testid="capture-url"
                placeholder="Paste URL here..."
                value={form.url}
                onChange={e => set('url', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCapture()}
                className={inputCls + ' pl-8'}
              />
            </div>
          </div>

          {/* Price + Currency */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted)' }}>Price</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--app-muted)' }} />
                <Input
                  data-testid="capture-price"
                  type="number"
                  placeholder="e.g. 8500"
                  value={form.captured_price}
                  onChange={e => set('captured_price', e.target.value)}
                  className={inputCls + ' pl-7'}
                />
              </div>
            </div>
            <div style={{ width: '88px' }}>
              <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted)' }}>Curr.</label>
              <select
                data-testid="capture-currency"
                value={form.captured_currency}
                onChange={e => set('captured_currency', e.target.value)}
                style={{
                  height: '36px',
                  width: '100%',
                  background: 'var(--surface-2)',
                  color: 'var(--app-fg)',
                  border: '1.5px solid var(--stroke)',
                  borderRadius: 'var(--radius-input)',
                  padding: '0 6px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Screenshot URL */}
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted)' }}>
              Screenshot URL
            </label>
            <div className="relative">
              <Camera className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--app-muted)' }} />
              <Input
                data-testid="capture-screenshot"
                placeholder="https://..."
                value={form.screenshot_url}
                onChange={e => set('screenshot_url', e.target.value)}
                className={inputCls + ' pl-7'}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted)' }}>Notes</label>
            <Textarea
              data-testid="capture-notes"
              placeholder="Price includes breakfast, valid until..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className={inputCls + ' h-auto py-2 resize-none text-sm'}
            />
          </div>

          {/* Save button */}
          <Button
            onClick={handleCapture}
            disabled={saving || !selectedTripId || !form.url.trim()}
            data-testid="capture-save-btn"
            className="w-full rounded-lg"
            style={{ backgroundColor: 'var(--cta)', color: '#050A14', fontWeight: 600 }}
          >
            {saving
              ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Saving...</>
              : <><Link2 className="w-4 h-4 mr-2" />Save to Trip</>
            }
          </Button>
        </div>

        {/* ── Captured Sources for this trip ── */}
        {selectedTripId && (
          <div>
            <button
              className="flex items-center gap-1.5 w-full mb-2"
              onClick={() => setSourcesExpanded(v => !v)}
              data-testid="capture-sources-toggle"
            >
              {sourcesExpanded
                ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
                : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
              }
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--app-muted)' }}>
                Captured ({tripSources.length})
              </span>
              {selectedTrip && (
                <span className="text-[10px] ml-auto truncate max-w-[100px]" style={{ color: 'var(--app-muted)' }}>
                  {selectedTrip.client_name}
                </span>
              )}
            </button>

            {sourcesExpanded && (
              loadingSources ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-10 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }} />
                  ))}
                </div>
              ) : tripSources.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-6 rounded-lg text-center"
                  style={{ border: '1px dashed var(--stroke)' }}
                  data-testid="capture-no-sources"
                >
                  <FileText className="w-6 h-6 mb-1.5" style={{ color: 'var(--app-muted)', opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: 'var(--app-muted)' }}>No sources captured yet for this trip</p>
                </div>
              ) : (
                <div className="space-y-2" data-testid="capture-sources-list">
                  {tripSources.map(src => (
                    <div key={src.id} className="rounded-lg overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }}>
                      <SourceBadge source={src} onDelete={handleDeleteSource} />
                      {src.notes && (
                        <p className="px-3 pb-2 text-[10px]" style={{ color: 'var(--app-muted)' }}>{src.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Browser Page ─────────────────────────────────────────────────────────
export default function Browser() {
  const [links, setLinks]             = useState([]);
  const [trips, setTrips]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch]           = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [linksRes, tripsData] = await Promise.all([
        quickLinksAPI.list(),
        listTrips(),
      ]);
      setLinks(linksRes.data);
      setTrips(tripsData);
    } catch {
      toast.error('Failed to load browser data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveLink = async (data) => {
    const res = await quickLinksAPI.create(data);
    setLinks(l => [...l, res.data]);
    toast.success(`"${data.label}" added to quick links`);
  };

  const handleDeleteLink = async (id) => {
    if (!window.confirm('Remove this quick link?')) return;
    try {
      await quickLinksAPI.delete(id);
      setLinks(l => l.filter(x => x.id !== id));
      toast.success('Quick link removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleAddSuggestion = async (s) => {
    const alreadyAdded = links.some(l => l.url === s.url);
    if (alreadyAdded) { toast.info(`"${s.label}" is already in your links`); return; }
    await handleSaveLink({ label: s.label, url: s.url, icon: s.icon, category: s.category });
  };

  const filteredLinks = useMemo(() => links.filter(l => {
    const matchCat    = activeCategory === 'All' || l.category === activeCategory;
    const matchSearch = !search || l.label.toLowerCase().includes(search.toLowerCase()) || l.url.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [links, activeCategory, search]);

  const usedCategories = useMemo(
    () => ['All', ...Array.from(new Set(links.map(l => l.category || 'General')))],
    [links]
  );

  const availableSuggestions = useMemo(
    () => DEFAULT_SUGGESTIONS.filter(s => !links.some(l => l.url === s.url)).slice(0, 6),
    [links]
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-9rem)]" data-testid="browser-page">

      {/* ── Left: Quick Links ────────────────────────────────────────────── */}
      <div className="flex flex-col" style={{ width: '360px', flexShrink: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-[22px] font-bold tracking-wide"
              style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}
              data-testid="browser-page-title"
            >
              Quick Links
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
              {links.length} saved · opens in new tab
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            data-testid="browser-add-link-btn"
            className="rounded-full flex items-center gap-1.5 text-sm"
            style={{ backgroundColor: 'var(--cta)', color: '#050A14', fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {usedCategories.slice(0, 8).map(cat => (
            <button
              key={cat}
              data-testid={`browser-cat-${cat}`}
              onClick={() => setActiveCategory(cat)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: activeCategory === cat ? 'rgba(0,229,255,0.12)' : 'var(--surface)',
                border: activeCategory === cat ? '1.5px solid var(--cta)' : '1.5px solid var(--stroke-soft)',
                color: activeCategory === cat ? 'var(--cta)' : 'var(--app-muted)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
          <Input
            data-testid="browser-search"
            placeholder="Search links..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs rounded-full bg-[var(--surface)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)]"
          />
        </div>

        {/* Links list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-[var(--radius-card)]" style={{ backgroundColor: 'var(--surface-2)' }} />
            ))
          ) : filteredLinks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-[var(--radius-card)] text-center"
              style={{ border: '1px dashed var(--stroke)' }}
              data-testid="browser-empty"
            >
              <Bookmark className="w-8 h-8 mb-2" style={{ color: 'var(--app-muted)', opacity: 0.4 }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-fg)' }}>No quick links saved</p>
              <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Add a link or pick from suggestions below</p>
            </div>
          ) : (
            filteredLinks.map(link => (
              <QuickLinkCard key={link.id} link={link} onDelete={handleDeleteLink} />
            ))
          )}

          {/* Suggestions */}
          {!loading && availableSuggestions.length > 0 && (
            <div className="pt-3" data-testid="browser-suggestions">
              <p className="text-[11px] uppercase tracking-[0.28em] mb-2" style={{ color: 'var(--app-muted)' }}>
                Suggestions
              </p>
              <div className="space-y-1">
                {availableSuggestions.map(s => (
                  <button
                    key={s.url}
                    data-testid={`browser-suggestion-${s.label}`}
                    onClick={() => handleAddSuggestion(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-white/5 transition-colors group"
                    style={{ border: '1px dashed var(--stroke-soft)' }}
                  >
                    <span className="text-base flex-shrink-0">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-fg)' }}>{s.label}</p>
                      <p className="text-[10px] truncate font-mono" style={{ color: 'var(--app-muted)' }}>
                        {s.url.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                    <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--cta)' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Capture Panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <CapturePanel trips={trips} />
      </div>

      {/* Add Link Dialog */}
      <AddLinkDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={handleSaveLink} />
    </div>
  );
}
