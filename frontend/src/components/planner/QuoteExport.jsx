import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plane, Building2, MapPin, FileText, PercentCircle, Users,
  TrendingUp, Globe, Settings, MessageSquare, Package,
  Zap, FileDown, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { Button }   from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Switch }   from '../ui/switch';
import { Badge }    from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import { toast }                from 'sonner';
import { format, parseISO }    from 'date-fns';
import { FlightTab }           from '../quotes/FlightTab';
import { HotelTab }            from '../quotes/HotelTab';
import { TourTransferTab }     from '../quotes/TourTransferTab';
import { VisaOtherTab }        from '../quotes/VisaOtherTab';

// ── Utilities ─────────────────────────────────────────────────────────────────
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const safeDate = (str) => {
  try { return format(parseISO(str), 'd MMM yyyy'); } catch { return str || ''; }
};

const calcNights = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
};

const extractDate = (dt) => {
  if (!dt) return '';
  try { return (dt.split('T')[0] || '').split(' ')[0] || ''; } catch { return ''; }
};

const extractTime = (dt) => {
  if (!dt) return '';
  try {
    const t = dt.split('T');
    if (t.length > 1) return t[1].slice(0, 5);
    const m = dt.match(/(\d{2}:\d{2})/);
    return m ? m[1] : '';
  } catch { return ''; }
};

async function loadImageBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CURRENCIES   = ['INR','USD','AED','EUR','GBP','SGD','THB','MYR','LKR','NPR'];
const QUOTE_TYPES  = ['International Tour','International Tour + Cruise','Domestic'];

const CATEGORY_TABS = [
  { key:'flights', label:'Flights',       icon:Plane,         cats:['Flights'],                color:'#4AA3FF', bg:'rgba(74,163,255,0.16)',   ring:'rgba(74,163,255,0.40)' },
  { key:'hotels',  label:'Hotels',        icon:Building2,     cats:['Hotels'],                 color:'#27AE60', bg:'rgba(39,174,96,0.16)',    ring:'rgba(39,174,96,0.40)'  },
  { key:'tours',   label:'Tours & Trans', icon:MapPin,        cats:['Sightseeing','Transfers'],color:'#F0B429', bg:'rgba(240,180,41,0.16)',   ring:'rgba(240,180,41,0.40)' },
  { key:'visa',    label:'Visa & Others', icon:FileText,      cats:['Visa Fees','Misc'],       color:'#8B7CFF', bg:'rgba(139,124,255,0.16)',  ring:'rgba(139,124,255,0.40)'},
  { key:'markup',  label:'Markup & Tax',  icon:PercentCircle, cats:[],                         color:'#E8A830', bg:'rgba(232,168,48,0.16)',   ring:'rgba(232,168,48,0.40)' },
];

const CAT_COLORS = {
  Flights:'#4AA3FF', Hotels:'#27AE60', Sightseeing:'#F0B429',
  Transfers:'#F0B429', 'Visa Fees':'#8B7CFF', Misc:'#a0b4d0', Package:'#E8A830',
};

// ── Shared style tokens ───────────────────────────────────────────────────────
const QBI = 'h-9 text-sm px-3 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] focus:outline-none focus:border-[var(--qb-field-border-focus)] focus:ring-0 rounded-lg w-full transition-colors duration-150';
const QB_LABEL = 'text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--app-muted)] mb-1.5 block';
const QB_SEL   = 'h-9 text-sm bg-[var(--qb-field)] text-[var(--app-fg)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] focus:border-[var(--qb-field-border-focus)] rounded-lg';

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, label, accentColor, children, headerRight }) {
  return (
    <div
      className="relative rounded-[var(--r-card)] overflow-hidden"
      style={{ backgroundColor:'var(--qb-modal-2)', border:'1px solid var(--stroke-soft)', boxShadow:'0 2px 12px rgba(0,0,0,0.18)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />
      <div
        className="flex items-center justify-between pl-5 pr-4 py-3"
        style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color:'var(--app-muted)', fontFamily:'Figtree, DM Sans, sans-serif' }}
          >{label}</p>
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      <div className="pl-5 pr-4 py-4">{children}</div>
    </div>
  );
}

// ── Summary Panel ─────────────────────────────────────────────────────────────
function SummaryPanel({ totals, form }) {
  const { operatingCost, byCategory, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal } = totals;
  const catOrder    = ['Flights','Hotels','Sightseeing','Transfers','Visa Fees','Misc','Package'];
  const activeCats  = catOrder.filter(c => byCategory[c] > 0);
  const muLabel     = form.markup_type === 'percentage'
    ? `Markup (${parseFloat(form.markup_value) || 0}%)`
    : 'Markup (Fixed)';
  const bc = form.base_currency || 'INR';
  const itemCount = (form.items || []).length;

  return (
    <div className="flex flex-col h-full" data-testid="quote-summary-panel">
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.15)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color:'var(--cta)', fontFamily:'Figtree, sans-serif' }}>
          Live Summary
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-1">
          {activeCats.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color:'rgba(160,180,208,0.55)' }}>
                By Category
              </p>
              {activeCats.map(cat => (
                <div key={cat}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg mb-1"
                  style={{ backgroundColor:'rgba(0,0,0,0.18)', border:'1px solid var(--qb-divider)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[cat] || '#a0b4d0' }} />
                    <span className="text-xs" style={{ color:'var(--app-muted)', fontFamily:'Figtree, sans-serif' }}>{cat}</span>
                  </div>
                  <span className="text-xs font-semibold font-mono" style={{ color:'var(--app-fg)' }}>{fmt(byCategory[cat])}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--qb-divider)' }}>
            {[
              { label:'Operating Cost', value:operatingCost, bold:true },
              { label:muLabel,          value:markupAmount,  accent:true },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom:'1px solid var(--qb-divider)' }}>
                <span className="text-xs" style={{
                  color: row.bold ? 'var(--app-fg)' : 'var(--app-muted)',
                  fontWeight: row.bold ? 600 : 400,
                  fontFamily: 'Figtree, sans-serif',
                }}>{row.label}</span>
                <span className="text-xs font-semibold font-mono" style={{ color: row.accent ? 'var(--cta)' : 'var(--app-fg)' }}>
                  {bc} {fmt(row.value)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor:'rgba(0,0,0,0.18)' }}>
              <span className="text-xs font-bold" style={{ color:'var(--app-fg)', fontFamily:'Figtree, sans-serif' }}>Sub-total</span>
              <span className="text-sm font-bold font-mono" style={{ color:'var(--app-fg)' }}>{bc} {fmt(subtotal)}</span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs" style={{ color:'var(--app-muted)' }}>GST ({parseFloat(form.gst_rate)||0}%)</span>
              <span className="text-xs font-mono" style={{ color:'var(--app-muted)' }}>{bc} {fmt(gstAmount)}</span>
            </div>
            {form.tcs_enabled && (
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs" style={{ color:'var(--app-muted)' }}>TCS ({parseFloat(form.tcs_rate)||0}%)</span>
                <span className="text-xs font-mono" style={{ color:'var(--app-muted)' }}>{bc} {fmt(tcsAmount)}</span>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div
        className="flex-shrink-0 mx-3 mb-3 rounded-[var(--r-card)] px-4 py-3.5"
        style={{
          background:'linear-gradient(135deg, rgba(232,168,48,0.14) 0%, rgba(232,168,48,0.06) 100%)',
          border:'1px solid rgba(232,168,48,0.35)',
        }}
        data-testid="quote-grand-total-summary"
      >
        <p className="text-[9px] uppercase tracking-[0.35em] font-bold mb-1.5" style={{ color:'var(--cta)', fontFamily:'Figtree, sans-serif' }}>
          Grand Total ({bc})
        </p>
        <p className="text-2xl font-bold font-mono" style={{ color:'var(--app-fg)', fontVariantNumeric:'tabular-nums' }}
          data-testid="quote-summary-grand-total">
          {fmt(grandTotal)}
        </p>
        <p className="text-[10px] mt-1" style={{ color:'rgba(160,180,208,0.6)' }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ── Markup Tab ────────────────────────────────────────────────────────────────
function MarkupTab({ form, setField, totals }) {
  const { operatingCost, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal } = totals;
  const bc = form.base_currency || 'INR';

  return (
    <div className="space-y-4">
      {/* Markup Configuration */}
      <div className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor:'var(--qb-modal-2)', border:'1px solid var(--stroke-soft)' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor:'#E8A830' }} />
        <div className="flex items-center gap-2 pl-5 pr-4 py-3"
          style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.12)' }}>
          <TrendingUp className="w-3.5 h-3.5" style={{ color:'#E8A830' }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color:'var(--app-muted)' }}>Markup Configuration</p>
        </div>
        <div className="pl-5 pr-4 py-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={QB_LABEL}>Markup Type</p>
              <div className="flex gap-2">
                {[['percentage','% on OC'],['fixed','Fixed Amt']].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setField('markup_type', val)}
                    className="flex-1 h-9 text-xs rounded-lg border transition-colors duration-150 font-semibold"
                    style={{
                      backgroundColor: form.markup_type === val ? 'rgba(232,168,48,0.20)' : 'var(--qb-field)',
                      border: form.markup_type === val ? '1.5px solid rgba(232,168,48,0.55)' : '1.5px solid var(--qb-field-border)',
                      color: form.markup_type === val ? '#E8A830' : 'var(--app-muted)',
                    }}
                  >{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <p className={QB_LABEL}>{form.markup_type === 'percentage' ? 'Markup %' : `Amount (${bc})`}</p>
              <input
                className={`${QBI} text-right font-semibold font-mono`}
                type="number" min="0" step={form.markup_type === 'percentage' ? '0.1' : '1'}
                value={form.markup_value}
                onChange={e => setField('markup_value', e.target.value)}
                data-testid="markup-value-input"
              />
            </div>
          </div>
          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor:'rgba(232,168,48,0.08)', border:'1px solid rgba(232,168,48,0.25)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color:'var(--app-muted)' }}>Operating Cost</span>
              <span className="font-semibold font-mono" style={{ color:'var(--app-fg)' }}>{bc} {fmt(operatingCost)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color:'var(--app-muted)' }}>
                {form.markup_type === 'percentage' ? `Markup (${parseFloat(form.markup_value)||0}%)` : 'Markup (Fixed)'}
              </span>
              <span className="font-semibold font-mono" style={{ color:'#E8A830' }}>{bc} {fmt(markupAmount)}</span>
            </div>
            <div className="h-px" style={{ backgroundColor:'rgba(232,168,48,0.25)' }} />
            <div className="flex justify-between text-xs">
              <span className="font-bold" style={{ color:'var(--app-fg)' }}>Sub-total</span>
              <span className="font-bold font-mono" style={{ color:'var(--app-fg)' }}>{bc} {fmt(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GST */}
      <div className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor:'var(--qb-modal-2)', border:'1px solid var(--stroke-soft)' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor:'#27AE60' }} />
        <div className="flex items-center gap-2 pl-5 pr-4 py-3"
          style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.12)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color:'var(--app-muted)' }}>GST (on Sub-total)</p>
        </div>
        <div className="pl-5 pr-4 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className={QB_LABEL}>GST Rate %</p>
              <input className={`${QBI} text-right font-semibold font-mono`}
                type="number" min="0" max="100" step="0.5" value={form.gst_rate}
                onChange={e => setField('gst_rate', e.target.value)} data-testid="gst-rate-input" />
            </div>
            <div className="flex-1">
              <p className={QB_LABEL}>GST Amount</p>
              <div className="h-9 flex items-center px-3 rounded-lg font-bold font-mono text-sm text-right justify-end"
                style={{ backgroundColor:'rgba(39,174,96,0.12)', border:'1px solid rgba(39,174,96,0.30)', color:'#27AE60' }}>
                {bc} {fmt(gstAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TCS */}
      <div className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor:'var(--qb-modal-2)', border:'1px solid var(--stroke-soft)' }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor:'#F0B429' }} />
        <div className="flex items-center justify-between pl-5 pr-4 py-3"
          style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.12)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color:'var(--app-muted)' }}>
            TCS (Tax Collected at Source)
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color:'var(--app-muted)' }}>{form.tcs_enabled ? 'Enabled' : 'Off'}</span>
            <Switch checked={form.tcs_enabled} onCheckedChange={v => setField('tcs_enabled', v)} data-testid="tcs-enabled-switch" />
          </div>
        </div>
        <div className="pl-5 pr-4 py-4">
          {form.tcs_enabled ? (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <p className={QB_LABEL}>TCS Rate %</p>
                <input className={`${QBI} text-right font-semibold font-mono`}
                  type="number" min="0" max="100" step="0.5" value={form.tcs_rate}
                  onChange={e => setField('tcs_rate', e.target.value)} data-testid="tcs-rate-input" />
              </div>
              <div className="flex-1">
                <p className={QB_LABEL}>TCS Amount</p>
                <div className="h-9 flex items-center px-3 rounded-lg font-bold font-mono text-sm text-right justify-end"
                  style={{ backgroundColor:'rgba(240,180,41,0.12)', border:'1px solid rgba(240,180,41,0.30)', color:'#F0B429' }}>
                  {bc} {fmt(tcsAmount)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color:'rgba(160,180,208,0.55)' }}>
              TCS applies on international packages above ₹7 lakhs (LRS limit).
            </p>
          )}
        </div>
      </div>

      {/* Grand Total preview */}
      <div
        className="rounded-[var(--r-card)] px-5 py-4"
        style={{
          background:'linear-gradient(135deg, rgba(232,168,48,0.14) 0%, rgba(232,168,48,0.05) 100%)',
          border:'1.5px solid rgba(232,168,48,0.40)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.35em] font-bold" style={{ color:'var(--cta)' }}>Grand Total ({bc})</p>
            <p className="text-[10px] mt-0.5" style={{ color:'rgba(160,180,208,0.55)' }}>
              OC + Markup + GST{form.tcs_enabled ? ' + TCS' : ''}
            </p>
          </div>
          <p className="text-3xl font-bold font-mono" style={{ color:'var(--app-fg)', fontVariantNumeric:'tabular-nums' }}>
            {fmt(grandTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main QuoteExport Component
// ══════════════════════════════════════════════════════════════════════════════
export function QuoteExport({ trip }) {
  const [items, setItems] = useState([]);
  const [form, setFormState] = useState({
    quote_type:   'International Tour',
    base_currency:'INR',
    client_name:  '',
    phone:        '',
    email:        '',
    destination:  '',
    travel_date:  '',
    return_date:  '',
    pax_adults:   2,
    pax_children: 0,
    pax_infant:   0,
    validity_date:'',
    notes:        '',
    markup_type:  'percentage',
    markup_value: 18,
    gst_rate:     5,
    tcs_enabled:  false,
    tcs_rate:     5,
  });
  const [activeTab,     setActiveTab]     = useState('flights');
  const [generating,   setGenerating]    = useState(false);
  const [done,         setDone]          = useState(false);
  const [smartFilling, setSmartFilling]  = useState(false);
  const [fillCount,    setFillCount]     = useState(0);

  // ── Sync form from trip on trip change ─────────────────────────────────────
  useEffect(() => {
    if (!trip) return;
    setFormState(f => ({
      ...f,
      client_name:   trip.client_name  || f.client_name,
      phone:         trip.client_phone || f.phone,
      email:         trip.client_email || f.email,
      base_currency: trip.currency     || f.base_currency,
      travel_date:   trip.start_date   || f.travel_date,
      return_date:   trip.end_date     || f.return_date,
      pax_adults:    trip.adults       || f.pax_adults,
      pax_children:  (trip.children || []).length || f.pax_children,
      destination:   (trip.stops || []).map(s => s.place_name).join(', ') || f.destination,
      markup_value:  trip.margin_pct   ?? f.markup_value,
    }));
    setItems([]);
    setFillCount(0);
    setDone(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id]);

  const setField = useCallback((key, value) =>
    setFormState(f => ({ ...f, [key]: value })), []);

  // formWithItems: merge items into form so SummaryPanel can read form.items.length
  const formWithItems = useMemo(() => ({ ...form, items }), [form, items]);

  // ── Item CRUD ──────────────────────────────────────────────────────────────
  const addItem    = useCallback((item)         => setItems(prev => [...prev, item]), []);
  const updateItem = useCallback((id, updated)  => setItems(prev => prev.map(i => i.id === id ? updated : i)), []);
  const removeItem = useCallback((id)           => setItems(prev => prev.filter(i => i.id !== id)), []);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byCategory = {};
    let operatingCost = 0;
    items.forEach(item => {
      const qty = parseFloat(item.qty)         || 0;
      const up  = parseFloat(item.unit_price)  || 0;
      const roe = parseFloat(item.roe_to_base) || 1;
      const amt = qty * up * roe;
      operatingCost += amt;
      const cat = item.category || 'Misc';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    });
    const muType   = form.markup_type  || 'percentage';
    const muVal    = parseFloat(form.markup_value) || 0;
    const markupAmount = muType === 'percentage' ? operatingCost * muVal / 100 : muVal;
    const subtotal     = operatingCost + markupAmount;
    const gstRate      = parseFloat(form.gst_rate)  || 0;
    const gstAmount    = subtotal * gstRate / 100;
    const tcsEnabled   = form.tcs_enabled || false;
    const tcsRate      = parseFloat(form.tcs_rate)  || 0;
    const tcsAmount    = tcsEnabled ? (subtotal + gstAmount) * tcsRate / 100 : 0;
    const grandTotal   = subtotal + gstAmount + tcsAmount;
    return { operatingCost, byCategory, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal };
  }, [items, form.markup_type, form.markup_value, form.gst_rate, form.tcs_enabled, form.tcs_rate]);

  const tabCount = (cats) => {
    if (!cats.length) return null;
    const c = items.filter(i => cats.includes(i.category)).length;
    return c > 0 ? c : null;
  };

  // ── Smart Fill ─────────────────────────────────────────────────────────────
  const handleSmartFill = useCallback(() => {
    if (!trip) return;
    const stops    = trip.stops  || [];
    const legs     = trip.legs   || [];
    const currency = trip.currency || 'INR';
    const adults   = trip.adults   || 1;
    const children = (trip.children || []).length;

    // Build stop lookup
    const stopMap = {};
    stops.forEach(s => { stopMap[s.id] = s; });
    stopMap['origin'] = {
      place_name:  trip.origin_name,
      country:     trip.origin_country || '',
      arrive_date: trip.start_date,
      depart_date: trip.start_date,
    };

    const newItems = [];
    const addedCountries = new Set();

    // ── Legs → Flights / Transfers ─────────────────────────────────────────
    for (const leg of legs) {
      const fromStop  = stopMap[leg.from_stop_id] || { place_name: leg.from_stop_id };
      const toStop    = stopMap[leg.to_stop_id]   || { place_name: leg.to_stop_id   };
      const fromName  = fromStop.place_name || leg.from_point  || leg.from_stop_id  || '';
      const toName    = toStop.place_name   || leg.to_point    || leg.to_stop_id    || '';
      const legDate   = extractDate(leg.depart_datetime) || fromStop.depart_date || trip.start_date || '';
      const depTime   = extractTime(leg.depart_datetime) || '';
      const arrTime   = extractTime(leg.arrive_datetime) || '';
      const legCost   = parseFloat(leg.cost) || 0;
      const isFlightMode = (leg.mode || '').toLowerCase() === 'flight';

      if (isFlightMode) {
        const fareAdult = adults > 0 && legCost > 0 ? Math.round(legCost / adults) : 0;
        newItems.push({
          id:           newId(),
          category:     'Flights',
          title:        fromName && toName ? `${fromName} \u2192 ${toName}` : 'Flight',
          description:  leg.notes || '',
          qty:          1,
          unit_price:   legCost,
          currency,
          roe_to_base:  1.0,
          from_location: fromName,
          to_location:  toName,
          flight_date:  legDate,
          dep_time:     depTime,
          arr_time:     arrTime,
          airline:      leg.operator || '',
          flight_no:    leg.from_point || '',
          flight_class: 'Economy',
          pnr:          '',
          fare_adult:   fareAdult,
          fare_child:   0,
          fare_infant:  0,
          no_adults:    adults,
          no_children:  children,
          no_infants:   0,
          stopovers:    [],
          show_stopovers: false,
        });
      } else {
        const modeLabel = leg.mode
          ? leg.mode.charAt(0).toUpperCase() + leg.mode.slice(1)
          : 'Transfer';
        newItems.push({
          id:           newId(),
          category:     'Transfers',
          title:        leg.operator || `${modeLabel}: ${fromName} \u2192 ${toName}`,
          description:  leg.notes || '',
          qty:          1,
          unit_price:   legCost,
          currency,
          roe_to_base:  1.0,
          rate_type:    'Per Group',
          service_count: 1,
          flight_date:  legDate,
        });
      }
    }

    // ── Stays (nested in stops) → Hotels ──────────────────────────────────
    for (const stop of stops) {
      const checkIn  = stop.arrive_date  || '';
      const checkOut = stop.depart_date  || '';
      const nights   = stop.nights || calcNights(checkIn, checkOut) || 1;

      for (const stay of (stop.stays || [])) {
        const stayCost     = parseFloat(stay.cost) || 0;
        const ratePerNight = nights > 0 ? stayCost / nights : stayCost;
        newItems.push({
          id:           newId(),
          category:     'Hotels',
          title:        stay.hotel_name || 'Hotel',
          description:  stay.notes || '',
          qty:          Math.max(1, nights),
          unit_price:   ratePerNight,
          currency,
          roe_to_base:  1.0,
          city:         stop.place_name || '',
          hotel_name:   stay.hotel_name || '',
          check_in:     checkIn,
          check_out:    checkOut,
          nights,
          room_type:    stay.room_type || 'Deluxe',
          meal_plan:    stay.board || 'BB',
          no_of_rooms:  1,
          rate_per_night: ratePerNight,
        });
      }

      // Track unique countries for visa
      const country = (stop.country || '').trim() || (stop.place_name || '').split(',').pop().trim();
      if (country && !addedCountries.has(country)
          && country !== trip.origin_country
          && country !== trip.origin_name) {
        addedCountries.add(country);
      }
    }

    // ── Countries → Visa Fees ──────────────────────────────────────────────
    for (const country of addedCountries) {
      newItems.push({
        id:          newId(),
        category:    'Visa Fees',
        title:       `${country} Visa`,
        description: `Visa fees for ${country} — ${adults + children} pax`,
        qty:         adults + children,
        unit_price:  0,
        currency,
        roe_to_base: 1.0,
      });
    }

    // ── Restaurants & Attractions → Sightseeing ────────────────────────────
    for (const stop of stops) {
      const stopDate = stop.arrive_date || '';

      for (const r of (stop.restaurants || [])) {
        const cost = parseFloat(r.cost) || 0;
        if (cost > 0) {
          newItems.push({
            id:           newId(),
            category:     'Sightseeing',
            title:        r.name || 'Restaurant',
            description:  `${r.cuisine ? `${r.cuisine} restaurant` : 'Restaurant'} · ${stop.place_name}${r.address ? ` · ${r.address}` : ''}`,
            qty:          adults + children || 1,
            unit_price:   cost,
            currency,
            roe_to_base:  1.0,
            rate_type:    'Per Person',
            service_count: adults + children,
            city:         stop.place_name,
            flight_date:  stopDate,
          });
        }
      }

      for (const a of (stop.attractions || [])) {
        const cost = parseFloat(a.cost) || 0;
        if (cost > 0) {
          newItems.push({
            id:           newId(),
            category:     'Sightseeing',
            title:        a.name || 'Attraction',
            description:  `${a.category || 'Attraction'} · ${stop.place_name}${a.duration ? ` · ${a.duration}` : ''}${a.schedule ? ` · ${a.schedule}` : ''}`,
            qty:          adults + children || 1,
            unit_price:   cost,
            currency,
            roe_to_base:  1.0,
            rate_type:    'Per Person',
            service_count: adults + children,
            city:         stop.place_name,
            flight_date:  stopDate,
          });
        }
      }

      for (const mp of (stop.meeting_points || [])) {
        newItems.push({
          id:          newId(),
          category:    'Misc',
          title:       `Meeting Point: ${mp.name}`,
          description: `${mp.address || ''}${mp.meeting_url ? ` · ${mp.meeting_url}` : ''}`,
          qty:         1,
          unit_price:  0,
          currency,
          roe_to_base: 1.0,
        });
      }
    }

    setItems(prev => [...prev, ...newItems]);
    setFillCount(newItems.length);
    setSmartFilling(false);

    const flightCt   = newItems.filter(i => i.category === 'Flights').length;
    const hotelCt    = newItems.filter(i => i.category === 'Hotels').length;
    const transCt    = newItems.filter(i => i.category === 'Transfers').length;
    const visaCt     = newItems.filter(i => i.category === 'Visa Fees').length;
    const sightCt    = newItems.filter(i => i.category === 'Sightseeing').length;
    const miscCt     = newItems.filter(i => i.category === 'Misc').length;
    const parts = [
      flightCt  && `${flightCt} flight${flightCt  > 1 ? 's' : ''}`,
      hotelCt   && `${hotelCt}  hotel${hotelCt   > 1 ? 's' : ''}`,
      transCt   && `${transCt}  transfer${transCt > 1 ? 's' : ''}`,
      visaCt    && `${visaCt}   visa${visaCt     > 1 ? 's' : ''}`,
      sightCt   && `${sightCt}  activity${sightCt > 1 ? 'ies' : 'y'}`,
      miscCt    && `${miscCt}   misc`,
    ].filter(Boolean);

    if (newItems.length === 0) {
      toast.info('No trip data found to fill. Add legs and stays first.');
    } else {
      toast.success(`Smart Fill complete! Added ${parts.join(', ')}.`);
    }
  }, [trip]);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!trip) return;
    setGenerating(true);
    setDone(false);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const W = 210, margin = 15;
      let y = margin;

      const NAVY  = [46, 67, 116];
      const GOLD  = [200, 160, 30];
      const LGRAY = [240, 243, 248];
      const DGRAY = [80, 100, 120];
      const BLACK = [20, 30, 45];
      const bc    = form.base_currency || trip.currency || 'INR';
      const paxLabel = `${trip.adults||0} Adult${(trip.adults||0)!==1?'s':''}${(trip.children||[]).length?` + ${trip.children.length} Child`:''}`;

      // ── Helpers ────────────────────────────────────────────────────────
      const checkPage = (needed = 15) => {
        if (y + needed > 275) { doc.addPage(); y = margin; }
      };

      const sectionHeader = (title, colorArr = NAVY) => {
        checkPage(12);
        doc.setFillColor(...colorArr);
        doc.rect(margin, y, W - margin * 2, 7, 'F');
        doc.setFont('helvetica','bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin + 3, y + 4.8);
        y += 9;
      };

      // ── Logo ───────────────────────────────────────────────────────────
      const logo = await loadImageBase64(window.location.origin + '/assets/bdv-logo-horizontal.png');
      if (logo) {
        doc.addImage(logo, 'PNG', margin, y, 55, 18);
      } else {
        doc.setFontSize(14); doc.setTextColor(...NAVY); doc.setFont('helvetica','bold');
        doc.text('Blue Diamond Voyage', margin, y + 12);
      }

      doc.setFillColor(...NAVY);
      doc.rect(W - margin - 65, y, 65, 18, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,255,255);
      doc.text('TRAVEL QUOTE', W - margin - 5, y + 7, { align:'right' });
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(200,215,235);
      doc.text(`Prepared: ${format(new Date(),'d MMM yyyy')}`, W - margin - 5, y + 14, { align:'right' });
      y += 24;

      // ── ESTIMATED banner ───────────────────────────────────────────────
      doc.setFillColor(...GOLD);
      doc.rect(margin, y, W - margin * 2, 8, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...BLACK);
      doc.text('ALL PRICES ARE ESTIMATED AND SUBJECT TO CHANGE WITHOUT NOTICE', W/2, y + 5.5, { align:'center' });
      y += 13;

      // ── Trip Summary block ─────────────────────────────────────────────
      // Pre-calculate route string height so the block expands for long routes
      const routeStr   = (trip.stops||[]).map(s => s.place_name).join(' \u2192 ');
      const fullRoute  = `Route: ${trip.origin_name}${routeStr ? ' \u2192 ' + routeStr + ' \u2192 ' + trip.origin_name : ''}`;
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      const routeLines = doc.splitTextToSize(fullRoute, W - margin * 2 - 8);
      const routeH     = routeLines.length * 5;           // 5mm per wrapped line
      const smH        = Math.max(36, 22 + routeH + 4);  // minimum 36mm, expands for long routes
      checkPage(smH + 6);
      doc.setFillColor(...LGRAY);
      doc.rect(margin, y, W - margin * 2, smH, 'F');
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
      doc.rect(margin, y, W - margin * 2, smH);
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...BLACK);
      doc.text(form.client_name || trip.client_name || 'Client', margin + 4, y + 8);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...DGRAY);
      let smY = y + 15;
      if (form.phone || trip.client_phone) {
        doc.text(`Phone: ${form.phone || trip.client_phone}`, margin + 4, smY); smY += 6;
      }
      if (form.email || trip.client_email) {
        doc.text(`Email: ${form.email || trip.client_email}`, margin + 4, smY); smY += 6;
      }
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
      doc.text(`Brand: ${trip.brand}  \u00B7  Status: ${trip.status}  \u00B7  Type: ${form.quote_type}`, margin + 4, y + smH - 9 - routeH);
      // Route — rendered line by line so it stays within the box
      let routeY = y + smH - 4 - (routeLines.length - 1) * 5;
      for (const rl of routeLines) {
        doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY);
        doc.text(rl, margin + 4, routeY);
        routeY += 5;
      }
      y += smH + 4;

      // ── Travel Details bar ─────────────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
      const detailStr = [
        `${safeDate(form.travel_date||trip.start_date)} \u2192 ${safeDate(form.return_date||trip.end_date)}`,
        `${trip.total_nights||'?'} nights`,
        paxLabel,
        `Currency: ${bc}`,
        form.validity_date ? `Valid till: ${safeDate(form.validity_date)}` : '',
      ].filter(Boolean).join('  \u00B7  ');
      const detailLines = doc.splitTextToSize(detailStr, W - margin * 2 - 8);
      const detailBarH  = Math.max(9, detailLines.length * 5 + 4);
      checkPage(detailBarH + 2);
      doc.setFillColor(46, 67, 116, 20);
      doc.rect(margin, y, W - margin * 2, detailBarH, 'F');
      let detY = y + 5;
      for (const dl of detailLines) {
        doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
        doc.text(dl, margin + 4, detY);
        detY += 5;
      }
      y += detailBarH + 5;

      // ══ FLIGHTS ══════════════════════════════════════════════════════════
      const flightItems = items.filter(i => i.category === 'Flights');
      if (flightItems.length > 0) {
        sectionHeader(`FLIGHTS  (${flightItems.length} sector${flightItems.length!==1?'s':''})`, [30,100,200]);
        // col x positions
        const cx = [margin, margin+22, margin+44, margin+62, margin+80, margin+100, margin+120, margin+138, margin+152, margin+168];
        const cw = [22,     22,        18,        18,        20,        20,         18,         14,         16,         W-margin*2-153];
        // header
        doc.setFillColor(74,163,255,35);
        doc.rect(margin, y, W-margin*2, 6, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(30,80,160);
        ['From','To','Date','Dep','Arr','Airline','Flight No','Class','PNR','Total'].forEach((h,i)=>doc.text(h,cx[i]+1.5,y+4.2));
        y += 7;
        let tog = false;
        for (const f of flightItems) {
          checkPage(9);
          if (tog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,7,'F'); }
          tog = !tog;
          const fAmt = (parseFloat(f.unit_price)||0) * (parseFloat(f.roe_to_base)||1);
          doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BLACK);
          [
            f.from_location||'', f.to_location||'', safeDate(f.flight_date)||'',
            f.dep_time||'', f.arr_time||'',
            f.airline||'', f.flight_no||'', f.flight_class||'',
            f.pnr||'', fAmt>0?`${bc} ${fmt(fAmt)}`:'TBD',
          ].forEach((d,i)=>doc.text(String(d),cx[i]+1.5,y+4.8,{maxWidth:cw[i]-3}));
          y += 7;
          // Pax fare breakdown
          const hasFares = (parseFloat(f.fare_adult)||0)>0 || (parseFloat(f.fare_child)||0)>0;
          if (hasFares) {
            checkPage(6);
            doc.setFontSize(6.5); doc.setTextColor(...DGRAY);
            const pd = [];
            if ((parseFloat(f.fare_adult)||0)>0) pd.push(`Adults: ${f.no_adults||0} \u00D7 ${bc} ${fmt(f.fare_adult)}`);
            if ((parseFloat(f.fare_child)||0)>0) pd.push(`Children: ${f.no_children||0} \u00D7 ${bc} ${fmt(f.fare_child)}`);
            if ((parseFloat(f.fare_infant)||0)>0) pd.push(`Infants: ${f.no_infants||0} \u00D7 ${bc} ${fmt(f.fare_infant)}`);
            doc.text('  \u21B3 ' + pd.join('  \u00B7  '), margin+3, y+3.5, {maxWidth:W-margin*2-6});
            y += 5;
          }
          // Stopovers
          for (const sv of (f.stopovers||[])) {
            checkPage(5);
            doc.setFontSize(6.5); doc.setTextColor(139,124,255);
            doc.text(
              `  \u21AA Via ${sv.city||'?'} (${sv.duration||'?'}) ${sv.airline||''} ${sv.flight_no||''} ${sv.dep_time||''}-${sv.arr_time||''}`,
              margin+4, y+3.5
            );
            y += 4.5;
          }
        }
        y += 5;
      }

      // ══ HOTELS ═══════════════════════════════════════════════════════════
      const hotelItems = items.filter(i => i.category === 'Hotels');
      if (hotelItems.length > 0) {
        sectionHeader(`HOTELS  (${hotelItems.length} propert${hotelItems.length!==1?'ies':'y'})`, [20,130,70]);
        const cx = [margin, margin+46, margin+70, margin+90, margin+106, margin+122, margin+138, margin+154, margin+166];
        const cw = [46,     24,        20,        16,        16,         16,         16,         12,         W-margin*2-151];
        doc.setFillColor(39,174,96,25);
        doc.rect(margin,y,W-margin*2,6,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(20,110,60);
        ['Hotel','City','Check-in','Check-out','Nights','Rooms','Room Type','Plan','Total'].forEach((h,i)=>doc.text(h,cx[i]+1.5,y+4.2));
        y += 7;
        let tog = false;
        for (const h of hotelItems) {
          // Calculate row height — hotel name may need to wrap in its wider column
          doc.setFontSize(7);
          const hotelNameLines = doc.splitTextToSize(h.hotel_name||h.title||'', cw[0]-3);
          const rowH = Math.max(7, hotelNameLines.length * 4.5 + 2);
          checkPage(rowH + (h.description ? 5 : 0));
          if (tog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,rowH,'F'); }
          tog = !tog;
          const hAmt = (parseFloat(h.unit_price)||0) * (parseInt(h.qty)||1) * (parseFloat(h.roe_to_base)||1);
          doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BLACK);
          // Hotel name — render wrapped lines
          let hotelNameY = y + 4.8;
          for (const hn of hotelNameLines) {
            doc.text(hn, cx[0]+1.5, hotelNameY); hotelNameY += 4.5;
          }
          // Remaining columns — single line each, rendered at mid-row
          const midRow = y + rowH * 0.55;
          [
            h.city||'',
            safeDate(h.check_in)||'', safeDate(h.check_out)||'',
            String(h.nights||0), String(h.no_of_rooms||1),
            h.room_type||'Deluxe', h.meal_plan||'BB',
            hAmt>0?`${bc} ${fmt(hAmt)}`:'TBD',
          ].forEach((d, i) => doc.text(String(d), cx[i+1]+1.5, midRow, {maxWidth: cw[i+1]-3}));
          y += rowH;
          if (h.description) {
            const descLines = doc.splitTextToSize('  '+h.description, W-margin*2-4);
            checkPage(descLines.length * 4.5 + 1);
            doc.setFontSize(6.5); doc.setTextColor(...DGRAY);
            let dY = y + 3.5;
            for (const dl of descLines) { doc.text(dl, margin+2, dY); dY += 4.5; }
            y += descLines.length * 4.5 + 1;
          }
        }
        y += 5;
      }

      // ══ TOURS & TRANSFERS ════════════════════════════════════════════════
      const tourItems = items.filter(i => ['Sightseeing','Transfers'].includes(i.category));
      if (tourItems.length > 0) {
        sectionHeader(`TOURS & TRANSFERS  (${tourItems.length} item${tourItems.length!==1?'s':''})`, [170,110,20]);
        const cx = [margin, margin+55, margin+90, margin+110, margin+128, margin+148, margin+165];
        const cw = [55,     35,        20,        18,         20,         17,         W-margin*2-150];
        doc.setFillColor(240,180,41,25);
        doc.rect(margin,y,W-margin*2,6,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(150,90,0);
        ['Title','Type','Date','Count','Rate Type','Currency','Amount'].forEach((h,i)=>doc.text(h,cx[i]+1.5,y+4.2));
        y += 7;
        let tog = false;
        for (const t of tourItems) {
          doc.setFontSize(7);
          const titleLines = doc.splitTextToSize(t.title||'', cw[0]-3);
          const rowH = Math.max(7, titleLines.length * 4.5 + 2);
          checkPage(rowH + (t.description ? 5 : 0));
          if (tog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,rowH,'F'); }
          tog = !tog;
          const tAmt = (parseFloat(t.unit_price)||0) * (parseFloat(t.qty)||1) * (parseFloat(t.roe_to_base)||1);
          doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BLACK);
          let titleY = y + 4.8;
          for (const tl of titleLines) { doc.text(tl, cx[0]+1.5, titleY); titleY += 4.5; }
          const midRow = y + rowH * 0.55;
          [
            t.category||'',
            safeDate(t.flight_date)||'',
            String(t.service_count||t.qty||1),
            t.rate_type||'Per Group', t.currency||bc,
            tAmt>0?`${bc} ${fmt(tAmt)}`:'TBD',
          ].forEach((d,i)=>doc.text(String(d),cx[i+1]+1.5,midRow,{maxWidth:cw[i+1]-3}));
          y += rowH;
          if (t.description) {
            const descLines = doc.splitTextToSize('  '+t.description, W-margin*2-4);
            checkPage(descLines.length * 4.5 + 1);
            doc.setFontSize(6.5); doc.setTextColor(...DGRAY);
            let dY = y + 3.5;
            for (const dl of descLines) { doc.text(dl, margin+2, dY); dY += 4.5; }
            y += descLines.length * 4.5 + 1;
          }
        }
        y += 5;
      }

      // ══ VISA & OTHERS ════════════════════════════════════════════════════
      const visaItems = items.filter(i => ['Visa Fees','Misc'].includes(i.category));
      if (visaItems.length > 0) {
        sectionHeader(`VISA & OTHERS  (${visaItems.length} item${visaItems.length!==1?'s':''})`, [80,60,180]);
        const cx = [margin, margin+52, margin+92, margin+112, margin+132, margin+155];
        const cw = [52,     40,        20,        20,         23,         W-margin*2-140];
        doc.setFillColor(139,124,255,20);
        doc.rect(margin,y,W-margin*2,6,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(70,50,160);
        ['Title','Description','Qty','Unit Price','Currency','Total (Base)'].forEach((h,i)=>doc.text(h,cx[i]+1.5,y+4.2));
        y += 7;
        let tog = false;
        for (const v of visaItems) {
          // Title and description can both be long — wrap both
          doc.setFontSize(7);
          const vTitleLines = doc.splitTextToSize(v.title||'', cw[0]-3);
          const vDescLines  = doc.splitTextToSize(v.description||'', cw[1]-3);
          const rowH = Math.max(7, Math.max(vTitleLines.length, vDescLines.length) * 4.5 + 2);
          checkPage(rowH);
          if (tog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,rowH,'F'); }
          tog = !tog;
          const vAmt = (parseFloat(v.unit_price)||0) * (parseFloat(v.qty)||1) * (parseFloat(v.roe_to_base)||1);
          doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BLACK);
          // Title column — wrapped
          let vtY = y + 4.8;
          for (const vt of vTitleLines) { doc.text(vt, cx[0]+1.5, vtY); vtY += 4.5; }
          // Description column — wrapped
          let vdY = y + 4.8;
          for (const vd of vDescLines) { doc.text(vd, cx[1]+1.5, vdY); vdY += 4.5; }
          // Remaining scalar columns at mid-row
          const midRow = y + rowH * 0.55;
          [
            String(v.qty||1),
            v.unit_price?`${v.currency||bc} ${fmt(v.unit_price)}`:'TBD',
            v.currency||bc,
            vAmt>0?`${bc} ${fmt(vAmt)}`:'TBD',
          ].forEach((d,i)=>doc.text(String(d),cx[i+2]+1.5,midRow,{maxWidth:cw[i+2]-3}));
          y += rowH;
        }
        y += 5;
      }

      // ══ COST SUMMARY ═════════════════════════════════════════════════════
      checkPage(65);
      sectionHeader('COST SUMMARY', NAVY);

      // Category breakdown
      const catOrder = ['Flights','Hotels','Sightseeing','Transfers','Visa Fees','Misc'];
      let tog = false;
      for (const cat of catOrder) {
        if (!totals.byCategory[cat]) continue;
        checkPage(7);
        if (tog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,7,'F'); }
        tog = !tog;
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...DGRAY);
        doc.text(cat, margin+4, y+5);
        doc.text(`${bc} ${fmt(totals.byCategory[cat])}`, W-margin-4, y+5, { align:'right' });
        y += 7;
      }

      // Summary table
      const sumRows = [
        ['Operating Cost',   totals.operatingCost,  false],
        [`Markup (${form.markup_type==='percentage'?`${parseFloat(form.markup_value)||0}%`:'Fixed'})`, totals.markupAmount, false],
        ['Sub-total',        totals.subtotal,        false],
        [`GST (${parseFloat(form.gst_rate)||0}%)`,  totals.gstAmount, false],
        ...(form.tcs_enabled?[[`TCS (${parseFloat(form.tcs_rate)||0}%)`, totals.tcsAmount, false]]:[]),
        ['GRAND TOTAL',      totals.grandTotal,      true ],
      ];
      let altTog = false;
      for (const [label, val, isTotal] of sumRows) {
        checkPage(10);
        const rH = isTotal ? 9 : 8;
        if (isTotal) {
          doc.setFillColor(...NAVY);
          doc.rect(margin,y,W-margin*2,rH,'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(255,255,255);
        } else {
          if (altTog) { doc.setFillColor(...LGRAY); doc.rect(margin,y,W-margin*2,rH,'F'); }
          altTog = !altTog;
          doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...DGRAY);
        }
        doc.text(String(label), margin+4, y+rH*0.65);
        const valStr = val>0?`${bc} ${fmt(val)} (ESTIMATED)`:'TBD';
        doc.text(valStr, W-margin-4, y+rH*0.65, { align:'right' });
        y += rH;
      }
      y += 8;

      // ── Notes ─────────────────────────────────────────────────────────
      if (form.notes) {
        checkPage(20);
        sectionHeader('NOTES & TERMS', DGRAY);
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...DGRAY);
        const lines = doc.splitTextToSize(form.notes, W-margin*2-8);
        for (const line of lines) { checkPage(6); doc.text(line,margin+4,y+4); y+=5; }
        y += 4;
      }

      // ── Children ──────────────────────────────────────────────────────
      if ((trip.children||[]).length>0) {
        checkPage(15);
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
        doc.text('CHILDREN', margin, y); y += 5;
        trip.children.forEach(c => {
          checkPage(6);
          doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...DGRAY);
          doc.text(`\u2022 ${c.name||'Child'}  Age: ${c.age??'?'}${c.dob?`  DOB: ${c.dob}`:''}`, margin+3, y);
          y += 5;
        });
        y += 4;
      }

      // ── Footer on every page ──────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        const fY = 287;
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
        doc.line(margin, fY-4, W-margin, fY-4);
        doc.setFont('helvetica','italic'); doc.setFontSize(6.5); doc.setTextColor(...DGRAY);
        doc.text(
          'This document is a preliminary estimate only. Prices are subject to availability and seasonal variation. Not a confirmed booking.',
          W/2, fY, { align:'center', maxWidth:W-margin*2 }
        );
        doc.text(`Blue Diamond Voyage  |  www.bluediamondvoyage.com  |  Page ${pg} of ${totalPages}`, W/2, fY+5, { align:'center' });
      }

      const filename = `BDV_Quote_${(form.client_name||trip.client_name||'Client').replace(/\s+/g,'_')}_${trip.start_date}.pdf`;
      doc.save(filename);
      setDone(true);
      toast.success(`PDF saved: ${filename}`);
    } catch (err) {
      toast.error('PDF generation failed: ' + err.message);
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [trip, form, items, totals]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!trip) return null;

  const stops   = trip.stops || [];
  const legs    = trip.legs  || [];
  const hasData = legs.length > 0 || stops.some(s => (s.stays||[]).length > 0);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-testid="quote-export"
      style={{ background:'var(--qb-modal, var(--app-bg))' }}
    >
      {/* ── Smart Fill Banner ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5"
        style={{
          borderBottom:'1px solid var(--stroke-soft)',
          background: fillCount > 0 ? 'rgba(39,174,96,0.07)' : 'rgba(0,229,255,0.04)',
        }}
        data-testid="smart-fill-banner"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color:'var(--cta)' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color:'var(--app-fg)', fontFamily:'Figtree, sans-serif' }}>
              {fillCount > 0 ? `Smart Fill \u2014 ${fillCount} item${fillCount!==1?'s':''} auto-populated` : 'Smart Fill from Trip Data'}
            </p>
            <p className="text-[10px] truncate" style={{ color:'var(--app-muted)', fontFamily:'Figtree, sans-serif' }}>
              {fillCount > 0
                ? 'Review items below — edit any field or add more manually'
                : 'Auto-populate Flights, Hotels, Transfers & Visas from your trip legs and stays'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              data-testid="clear-items-btn"
              onClick={() => { setItems([]); setFillCount(0); setDone(false); }}
              className="h-7 px-3 text-[10px] rounded-lg border font-medium transition-colors duration-150"
              style={{ borderColor:'rgba(255,80,80,0.30)', color:'rgba(255,80,80,0.75)', background:'rgba(255,80,80,0.06)' }}
            >
              Clear All
            </button>
          )}
          <Button
            type="button"
            data-testid="smart-fill-btn"
            onClick={() => { setSmartFilling(true); setTimeout(handleSmartFill, 60); }}
            disabled={smartFilling || !hasData}
            className="h-8 px-4 text-xs font-semibold gap-1.5"
            style={{ background:'var(--cta)', color:'var(--app-bg)', fontFamily:'Figtree, sans-serif' }}
          >
            {smartFilling
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Filling&hellip;</>
              : <><Zap className="w-3.5 h-3.5" /> Smart Fill from Trip</>
            }
          </Button>
        </div>
      </div>

      {/* ── Main: Editor + Summary ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Editor (scrollable) */}
        <ScrollArea
          className="flex-1"
          style={{ borderRight:'1px solid var(--qb-divider, var(--stroke-soft))' }}
        >
          <div className="p-5 space-y-4">

            {/* Quote Configuration */}
            <SectionCard icon={Settings} label="Quote Configuration" accentColor="#E8A830">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className={QB_LABEL}>Quote Type</p>
                  <Select value={form.quote_type} onValueChange={v => setField('quote_type', v)}>
                    <SelectTrigger className={QB_SEL} data-testid="quote-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{QUOTE_TYPES.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className={QB_LABEL}>Base Currency</p>
                  <Select value={form.base_currency} onValueChange={v => setField('base_currency', v)}>
                    <SelectTrigger className={QB_SEL} data-testid="quote-currency-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className={QB_LABEL}>Valid Until</p>
                  <input className={QBI} type="date" value={form.validity_date}
                    onChange={e => setField('validity_date', e.target.value)} data-testid="quote-validity-date" />
                </div>
              </div>
            </SectionCard>

            {/* Client Details */}
            <SectionCard icon={Users} label="Client Details" accentColor="#4AA3FF">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className={QB_LABEL}>Client Name</p>
                  <input className={QBI} value={form.client_name}
                    onChange={e => setField('client_name', e.target.value)}
                    placeholder="Full name" data-testid="quote-client-name" />
                </div>
                <div>
                  <p className={QB_LABEL}>Phone</p>
                  <input className={QBI} value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    placeholder="+91 ..." data-testid="quote-client-phone" />
                </div>
                <div>
                  <p className={QB_LABEL}>Email</p>
                  <input className={QBI} type="email" value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="email@example.com" data-testid="quote-client-email" />
                </div>
              </div>
            </SectionCard>

            {/* Travel Details */}
            <SectionCard icon={Globe} label="Travel Details" accentColor="#27AE60">
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <p className={QB_LABEL}>Destination</p>
                    <input className={QBI} value={form.destination}
                      onChange={e => setField('destination', e.target.value)}
                      placeholder="e.g. Dubai, UAE" data-testid="quote-destination" />
                  </div>
                  <div>
                    <p className={QB_LABEL}>Travel Date</p>
                    <input className={QBI} type="date" value={form.travel_date}
                      onChange={e => setField('travel_date', e.target.value)} data-testid="quote-travel-date" />
                  </div>
                  <div>
                    <p className={QB_LABEL}>Return Date</p>
                    <input className={QBI} type="date" value={form.return_date}
                      onChange={e => setField('return_date', e.target.value)} data-testid="quote-return-date" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className={QB_LABEL}>Adults</p>
                    <input className={`${QBI} text-center font-semibold`} type="number" min="1"
                      value={form.pax_adults} onChange={e => setField('pax_adults', e.target.value)} data-testid="quote-pax-adults" />
                  </div>
                  <div>
                    <p className={QB_LABEL}>Children (2-11)</p>
                    <input className={`${QBI} text-center font-semibold`} type="number" min="0"
                      value={form.pax_children} onChange={e => setField('pax_children', e.target.value)} data-testid="quote-pax-children" />
                  </div>
                  <div>
                    <p className={QB_LABEL}>Infants (u2)</p>
                    <input className={`${QBI} text-center font-semibold`} type="number" min="0"
                      value={form.pax_infant} onChange={e => setField('pax_infant', e.target.value)} data-testid="quote-pax-infant" />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Package Items with Tabs */}
            <div
              className="relative rounded-[var(--r-card)] overflow-hidden"
              style={{ backgroundColor:'var(--qb-modal-2)', border:'1px solid var(--stroke-soft)' }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor:'var(--cta)' }} />
              <div
                className="flex items-center justify-between pl-5 pr-4 py-3"
                style={{ borderBottom:'1px solid var(--qb-divider)', backgroundColor:'rgba(0,0,0,0.12)' }}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" style={{ color:'var(--cta)' }} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color:'var(--app-muted)' }}>
                    Package Items
                  </p>
                </div>
                {items.length > 0 && (
                  <Badge className="h-5 px-2 text-[9px] font-bold rounded-full"
                    style={{ backgroundColor:'rgba(232,168,48,0.18)', color:'var(--cta)', border:'1px solid rgba(232,168,48,0.35)' }}>
                    {items.length} item{items.length!==1?'s':''}
                  </Badge>
                )}
              </div>

              <div className="pl-5 pr-4 py-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList
                    className="h-auto p-1.5 gap-1 w-full justify-start flex-wrap"
                    style={{ backgroundColor:'rgba(0,0,0,0.25)', border:'1px solid var(--qb-divider)', borderRadius:'12px' }}
                  >
                    {CATEGORY_TABS.map(tab => {
                      const count    = tabCount(tab.cats);
                      const isActive = activeTab === tab.key;
                      return (
                        <TabsTrigger
                          key={tab.key} value={tab.key}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-[9px] transition-all duration-150 focus-visible:ring-0"
                          style={isActive ? {
                            backgroundColor: tab.bg,
                            color: tab.color,
                            border: `1.5px solid ${tab.ring}`,
                            boxShadow: `0 0 18px ${tab.ring}`,
                          } : { color:'var(--app-muted)', border:'1.5px solid transparent' }}
                          data-testid={`tab-${tab.key}`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          {tab.label}
                          {count !== null && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                              style={{
                                backgroundColor: isActive ? tab.color : 'rgba(232,168,48,0.20)',
                                color: isActive ? '#0a1628' : 'var(--cta)',
                              }}
                            >{count}</span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <div className="mt-4">
                    <TabsContent value="flights" className="mt-0">
                      <FlightTab
                        items={items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                        baseCurrency={form.base_currency} travelDate={form.travel_date}
                        hasLinkedEnquiry={false}
                        paxAdults={parseInt(form.pax_adults)||1}
                        paxChildren={parseInt(form.pax_children)||0}
                        paxInfants={parseInt(form.pax_infant)||0}
                      />
                    </TabsContent>
                    <TabsContent value="hotels" className="mt-0">
                      <HotelTab
                        items={items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                        baseCurrency={form.base_currency}
                        quoteId={trip.id || 'trip-draft'}
                      />
                    </TabsContent>
                    <TabsContent value="tours" className="mt-0">
                      <TourTransferTab
                        items={items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                        baseCurrency={form.base_currency}
                      />
                    </TabsContent>
                    <TabsContent value="visa" className="mt-0">
                      <VisaOtherTab
                        items={items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                        baseCurrency={form.base_currency}
                      />
                    </TabsContent>
                    <TabsContent value="markup" className="mt-0">
                      <MarkupTab form={form} setField={setField} totals={totals} />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>

            {/* Notes & Terms */}
            <SectionCard icon={MessageSquare} label="Notes & Terms" accentColor="#a0b4d0">
              <Textarea
                data-testid="quote-notes"
                value={form.notes || ''}
                onChange={e => setField('notes', e.target.value)}
                style={{ backgroundColor:'var(--qb-field)', color:'var(--app-fg)', borderColor:'var(--qb-field-border)', resize:'none' }}
                className="text-sm border rounded-lg focus-visible:ring-0 focus:outline-none"
                placeholder="Inclusions, exclusions, payment terms, cancellation policy..."
                rows={3}
              />
            </SectionCard>

          </div>
        </ScrollArea>

        {/* Summary Panel */}
        <div
          className="w-[270px] flex-shrink-0 flex flex-col"
          style={{ background:'var(--qb-modal, var(--app-bg))' }}
        >
          <SummaryPanel totals={totals} form={formWithItems} />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 gap-4"
        style={{ borderTop:'1px solid var(--qb-divider, var(--stroke-soft))', backgroundColor:'rgba(0,0,0,0.15)' }}
      >
        {!hasData ? (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color:'#FFB300' }} />
            <p className="text-xs" style={{ color:'var(--app-muted)', fontFamily:'Figtree, sans-serif' }}>
              No legs or stays yet. Add them in Legs &amp; Stays first, then Smart Fill.
            </p>
          </div>
        ) : (
          <p className="text-xs" style={{ color:'var(--app-muted)', fontFamily:'Figtree, sans-serif' }}>
            {items.length > 0
              ? `${items.length} item${items.length!==1?'s':''} ready \u2022 Grand Total: ${form.base_currency} ${fmt(totals.grandTotal)}`
              : 'Click Smart Fill or add items manually, then export PDF.'}
          </p>
        )}

        <Button
          data-testid="export-pdf-btn"
          onClick={generate}
          disabled={generating}
          className="h-10 gap-2 text-sm font-semibold flex-shrink-0"
          style={{ background:'var(--cta)', color:'var(--app-bg)', fontFamily:'Figtree, sans-serif' }}
        >
          {generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF&hellip;</>
            : done
              ? <><CheckCircle2 className="w-4 h-4" /> Download Again</>
              : <><FileDown className="w-4 h-4" /> Export Full PDF Quote</>
          }
        </Button>
      </div>
    </div>
  );
}
