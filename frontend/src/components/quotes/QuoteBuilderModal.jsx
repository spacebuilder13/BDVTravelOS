import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import {
  Plane, Building2, MapPin, FileText, PercentCircle, Users,
  TrendingUp, Globe, Settings, MessageSquare, Package,
  ImageIcon, Columns, ArrowLeftRight, Pin, X as XIcon, Copy,
  FolderOpen
} from 'lucide-react';
import { quotesAPI, enquiriesAPI, uploadsAPI, itineraryAPI } from '../../services/api';
import { toast } from 'sonner';
import { FlightTab } from './FlightTab';
import { HotelTab } from './HotelTab';
import { TourTransferTab } from './TourTransferTab';
import { VisaOtherTab } from './VisaOtherTab';
import { PackageCostModal } from './PackageCostModal';
import { ScreenshotUpload } from '../common/ScreenshotUpload';
import { DocumentViewer } from './DocumentViewer';
import { bulkSaveROE } from '../../utils/roeStorage';
import { ClientDocumentsPanel } from '../crm/ClientDocumentsPanel';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];
const QUOTE_TYPES = ['International Tour', 'International Tour + Cruise', 'Domestic'];

const CATEGORY_TABS = [
  { key: 'flights', label: 'Flights',        icon: Plane,         cats: ['Flights'],               color: '#4AA3FF', bg: 'rgba(74,163,255,0.16)',   ring: 'rgba(74,163,255,0.40)' },
  { key: 'hotels',  label: 'Hotels',         icon: Building2,     cats: ['Hotels'],                color: '#27AE60', bg: 'rgba(39,174,96,0.16)',    ring: 'rgba(39,174,96,0.40)'  },
  { key: 'tours',   label: 'Tours & Trans',  icon: MapPin,        cats: ['Sightseeing','Transfers'],color: '#F0B429', bg: 'rgba(240,180,41,0.16)',   ring: 'rgba(240,180,41,0.40)' },
  { key: 'visa',    label: 'Visa & Others',  icon: FileText,      cats: ['Visa Fees','Misc'],       color: '#8B7CFF', bg: 'rgba(139,124,255,0.16)',  ring: 'rgba(139,124,255,0.40)'},
  { key: 'markup',  label: 'Markup & Tax',   icon: PercentCircle, cats: [],                         color: '#E8A830', bg: 'rgba(232,168,48,0.16)',   ring: 'rgba(232,168,48,0.40)' },
];

const CAT_COLORS = {
  Flights:    '#4AA3FF',
  Hotels:     '#27AE60',
  Sightseeing:'#F0B429',
  Transfers:  '#F0B429',
  'Visa Fees':'#8B7CFF',
  Misc:       '#a0b4d0',
  Package:    '#E8A830',
};

const EMPTY_FORM = {
  quote_type: 'International Tour',
  base_currency: 'INR',
  enquiry_id: null,
  client_id: null,
  client_name: '',
  phone: '',
  email: '',
  destination: '',
  travel_date: '',
  return_date: '',
  pax_adults: 2,
  pax_children: 0,
  pax_infant: 0,
  validity_date: '',
  notes: '',
  markup_type: 'percentage',
  markup_value: 18,
  gst_rate: 5,
  tcs_enabled: false,
  tcs_rate: 5,
  items: [],
  itinerary_id: null,
};

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ── Shared styles ─────────────────────────────────────────────────────────────
const QBI = 'h-9 text-sm px-3 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] focus:outline-none focus:border-[var(--qb-field-border-focus)] focus:ring-0 rounded-lg w-full transition-colors duration-150';
const QB_LABEL = 'text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--app-muted)] mb-1.5 block';
const QB_SEL = 'h-9 text-sm bg-[var(--qb-field)] text-[var(--app-fg)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] focus:border-[var(--qb-field-border-focus)] rounded-lg';

// ── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, label, accentColor, children, headerRight }) {
  return (
    <div
      className="relative rounded-[var(--r-card)] overflow-hidden"
      style={{
        backgroundColor: 'var(--qb-modal-2)',
        border: '1px solid var(--stroke-soft)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}
    >
      {/* 3px colored left strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accentColor }}
      />
      {/* Section header */}
      <div
        className="flex items-center justify-between pl-5 pr-4 py-3"
        style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, DM Sans, sans-serif' }}
          >
            {label}
          </p>
        </div>
        {headerRight && <div>{headerRight}</div>}
      </div>
      {/* Content */}
      <div className="pl-5 pr-4 py-4">{children}</div>
    </div>
  );
}

// ── Summary Panel ─────────────────────────────────────────────────────────────
function SummaryPanel({ totals, form }) {
  const { operatingCost, byCategory, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal } = totals;
  const catOrder = ['Flights','Hotels','Sightseeing','Transfers','Visa Fees','Misc','Package'];
  const activeCats = catOrder.filter(c => byCategory[c] > 0);
  const muLabel = form.markup_type === 'percentage'
    ? `Markup (${parseFloat(form.markup_value) || 0}%)`
    : 'Markup (Fixed)';

  return (
    <div className="flex flex-col h-full" data-testid="quote-summary-panel">
      {/* Summary header */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.15)' }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.3em] font-bold"
          style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}
        >
          Live Summary
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-1">
          {/* Category breakdown */}
          {activeCats.length > 0 && (
            <div className="mb-3">
              <p
                className="text-[9px] uppercase tracking-[0.3em] font-bold mb-2"
                style={{ color: 'rgba(160,180,208,0.55)' }}
              >
                By Category
              </p>
              {activeCats.map(cat => (
                <div
                  key={cat}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg mb-1"
                  style={{ backgroundColor: 'rgba(0,0,0,0.18)', border: '1px solid var(--qb-divider)' }}
                  data-testid="quote-summary-category-row"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CAT_COLORS[cat] || '#a0b4d0' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>
                      {cat}
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold font-mono"
                    style={{ color: 'var(--app-fg)' }}
                  >
                    {fmt(byCategory[cat])}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Line items */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--qb-divider)' }}
          >
            {[
              { label: 'Operating Cost', value: operatingCost, bold: true },
              { label: muLabel,           value: markupAmount,  accent: true },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: '1px solid var(--qb-divider)' }}
              >
                <span className="text-xs" style={{ color: row.bold ? 'var(--app-fg)' : 'var(--app-muted)', fontWeight: row.bold ? 600 : 400, fontFamily: 'Figtree, sans-serif' }}>
                  {row.label}
                </span>
                <span className="text-xs font-semibold font-mono" style={{ color: row.accent ? 'var(--cta)' : 'var(--app-fg)' }}>
                  {form.base_currency} {fmt(row.value)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>Sub-total</span>
              <span className="text-sm font-bold font-mono" style={{ color: 'var(--app-fg)' }}>{form.base_currency} {fmt(subtotal)}</span>
            </div>
          </div>

          {/* GST / TCS */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
                GST ({parseFloat(form.gst_rate) || 0}%)
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>
                {form.base_currency} {fmt(gstAmount)}
              </span>
            </div>
            {form.tcs_enabled && (
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
                  TCS ({parseFloat(form.tcs_rate) || 0}%)
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>
                  {form.base_currency} {fmt(tcsAmount)}
                </span>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Grand Total */}
      <div
        className="flex-shrink-0 mx-3 mb-3 rounded-[var(--r-card)] px-4 py-3.5"
        style={{
          background: 'linear-gradient(135deg, rgba(232,168,48,0.14) 0%, rgba(232,168,48,0.06) 100%)',
          border: '1px solid rgba(232,168,48,0.35)',
        }}
        data-testid="quote-grand-total-summary"
      >
        <p
          className="text-[9px] uppercase tracking-[0.35em] font-bold mb-1.5"
          style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}
        >
          Grand Total ({form.base_currency})
        </p>
        <p
          className="text-2xl font-bold font-mono"
          style={{ color: 'var(--app-fg)', fontVariantNumeric: 'tabular-nums' }}
          data-testid="quote-summary-grand-total"
        >
          {fmt(grandTotal)}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'rgba(160,180,208,0.6)' }}>
          {form.items.length} item{form.items.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ── Screenshots Pane ──────────────────────────────────────────────────────────
function ScreenshotsPane({ enquiryId }) {
  const [initialFiles, setInitialFiles] = useState(null);

  const load = useCallback(() => {
    if (!enquiryId) { setInitialFiles([]); return; }
    setInitialFiles(null);
    uploadsAPI.list('enquiries', enquiryId)
      .then(res => setInitialFiles(res.data || []))
      .catch(() => setInitialFiles([]));
  }, [enquiryId]);

  useEffect(() => { load(); }, [load]);

  if (!enquiryId) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: 'var(--qb-modal)' }}
      >
        <ImageIcon className="w-8 h-8 mb-3" style={{ color: 'var(--app-muted)', opacity: 0.3 }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--app-fg)' }}>No enquiry linked</p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--app-muted)' }}>Link an enquiry above to view screenshots here</p>
      </div>
    );
  }

  if (initialFiles === null) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--qb-modal)' }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--cta)', borderTopColor: 'transparent' }} />
          <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--qb-modal)' }}>
      <div
        className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--qb-divider)' }}
      >
        <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--app-fg)' }}>Reference Screenshots</p>
        <span className="text-[9px]" style={{ color: 'var(--app-muted)' }}>for this enquiry</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          <ScreenshotUpload module="enquiries" recordId={enquiryId} initialFiles={initialFiles} compact />
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Markup Tab ─────────────────────────────────────────────────────────────────
function MarkupTab({ form, setField, totals }) {
  const { operatingCost, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal } = totals;
  const bc = form.base_currency || 'INR';

  return (
    <div className="space-y-4">
      {/* Markup config */}
      <div
        className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor: 'var(--qb-modal-2)', border: '1px solid var(--stroke-soft)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: '#E8A830' }} />
        <div className="flex items-center gap-2 pl-5 pr-4 py-3" style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.12)' }}>
          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#E8A830' }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>Markup Configuration</p>
        </div>
        <div className="pl-5 pr-4 py-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={QB_LABEL}>Markup Type</p>
              <div className="flex gap-2">
                {[['percentage','% on OC'],['fixed','Fixed Amt']].map(([val, lbl]) => (
                  <button key={val} type="button"
                    onClick={() => setField('markup_type', val)}
                    data-testid={`markup-type-${val}`}
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
          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(232,168,48,0.08)', border: '1px solid rgba(232,168,48,0.25)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--app-muted)' }}>Operating Cost</span>
              <span className="font-semibold font-mono" style={{ color: 'var(--app-fg)' }}>{bc} {fmt(operatingCost)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--app-muted)' }}>{form.markup_type === 'percentage' ? `Markup (${parseFloat(form.markup_value)||0}%)` : 'Markup (Fixed)'}</span>
              <span className="font-semibold font-mono" style={{ color: '#E8A830' }}>{bc} {fmt(markupAmount)}</span>
            </div>
            <div className="h-px" style={{ backgroundColor: 'rgba(232,168,48,0.25)' }} />
            <div className="flex justify-between text-xs">
              <span className="font-bold" style={{ color: 'var(--app-fg)' }}>Sub-total</span>
              <span className="font-bold font-mono" style={{ color: 'var(--app-fg)' }}>{bc} {fmt(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* GST */}
      <div
        className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor: 'var(--qb-modal-2)', border: '1px solid var(--stroke-soft)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: '#27AE60' }} />
        <div className="flex items-center gap-2 pl-5 pr-4 py-3" style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.12)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>GST (on Sub-total)</p>
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
                style={{ backgroundColor: 'rgba(39,174,96,0.12)', border: '1px solid rgba(39,174,96,0.30)', color: '#27AE60' }}>
                {bc} {fmt(gstAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TCS */}
      <div
        className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor: 'var(--qb-modal-2)', border: '1px solid var(--stroke-soft)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: '#F0B429' }} />
        <div className="flex items-center justify-between pl-5 pr-4 py-3" style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.12)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>TCS (Tax Collected at Source)</p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--app-muted)' }}>{form.tcs_enabled ? 'Enabled' : 'Off'}</span>
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
                  style={{ backgroundColor: 'rgba(240,180,41,0.12)', border: '1px solid rgba(240,180,41,0.30)', color: '#F0B429' }}>
                  {bc} {fmt(tcsAmount)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(160,180,208,0.55)' }}>
              TCS applies on international packages above ₹7 lakhs (LRS limit).
            </p>
          )}
        </div>
      </div>

      {/* Final total preview */}
      <div
        className="rounded-[var(--r-card)] px-5 py-4"
        style={{
          background: 'linear-gradient(135deg, rgba(232,168,48,0.14) 0%, rgba(232,168,48,0.05) 100%)',
          border: '1.5px solid rgba(232,168,48,0.40)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.35em] font-bold" style={{ color: 'var(--cta)' }}>Grand Total ({bc})</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(160,180,208,0.55)' }}>
              OC + Markup + GST{form.tcs_enabled ? ' + TCS' : ''}
            </p>
          </div>
          <p className="text-3xl font-bold font-mono" style={{ color: 'var(--app-fg)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(grandTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function QuoteBuilderModal({ open, onClose, editQuote, onSaved, initFromLead }) {
  const [saving, setSaving] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  const [itineraries, setItineraries] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('flights');
  const [splitScreen, setSplitScreen] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  const [docFiles, setDocFiles] = useState([]);
  const [docFilesLoading, setDocFilesLoading] = useState(false);
  const [docPaneTab, setDocPaneTab] = useState('enquiry'); // 'enquiry' | 'client'
  const [stickyText, setStickyText] = useState('');
  const [pinnedChips, setPinnedChips] = useState([]);

  const [dividerSizes, setDividerSizes] = useState(() => {
    try {
      const saved = sessionStorage.getItem('quote_divider_sizes');
      return saved ? JSON.parse(saved) : [38, 62];
    } catch { return [38, 62]; }
  });

  const saveDivider = useCallback((sizes) => {
    setDividerSizes(sizes);
    try { sessionStorage.setItem('quote_divider_sizes', JSON.stringify(sizes)); } catch (e) { console.warn('[QuoteBuilder] Failed to persist divider sizes:', e); }
  }, []);

  // Stable loaders — defined BEFORE the useEffect that references them in deps
  const loadEnquiries = useCallback(async () => {
    try {
      const res = await enquiriesAPI.list();
      setEnquiries(res.data || []);
    } catch (e) { console.warn('[QuoteBuilder] Failed to load enquiries:', e); }
  }, []);

  const loadItineraries = useCallback(async () => {
    try {
      const res = await itineraryAPI.list();
      setItineraries(res.data || []);
    } catch (e) { console.warn('[QuoteBuilder] Failed to load itineraries:', e); }
  }, []);

  // Stable field setter — defined before the useEffect that uses it in deps
  const setField = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);

  useEffect(() => {
    if (!open) return;
    loadEnquiries();
    loadItineraries();
    setStickyText('');
    setPinnedChips([]);
    setSwapped(false);
    if (editQuote) {
      setForm({
        quote_type: editQuote.quote_type || 'International Tour',
        base_currency: editQuote.base_currency || 'INR',
        enquiry_id: editQuote.enquiry_id || null,
        client_id: editQuote.client_id || null,
        client_name: editQuote.client_name || '',
        phone: editQuote.phone || '',
        email: editQuote.email || '',
        destination: editQuote.destination || '',
        travel_date: editQuote.travel_date || '',
        return_date: editQuote.return_date || '',
        pax_adults: editQuote.pax_adults ?? 2,
        pax_children: editQuote.pax_children ?? 0,
        pax_infant: editQuote.pax_infant ?? 0,
        validity_date: editQuote.validity_date || '',
        notes: editQuote.notes || '',
        markup_type: editQuote.markup_type || 'percentage',
        markup_value: editQuote.markup_value ?? 18,
        gst_rate: editQuote.gst_rate ?? 5,
        tcs_enabled: editQuote.tcs_enabled || false,
        tcs_rate: editQuote.tcs_rate ?? 5,
        items: (editQuote.items || []).map(i => ({ ...i })),
        itinerary_id: editQuote.itinerary_id || null,
      });
    } else if (initFromLead) {
      setForm({
        ...EMPTY_FORM,
        enquiry_id: initFromLead.id || null,
        client_id: initFromLead.client_id || null,
        client_name: initFromLead.client_name || '',
        phone: initFromLead.phone || '',
        email: initFromLead.email || '',
        destination: initFromLead.destination || '',
        travel_date: initFromLead.travel_date || '',
        return_date: initFromLead.return_date || '',
        pax_adults: initFromLead.pax_adults ?? 2,
        pax_children: initFromLead.pax_children ?? 0,
        items: [],
      });
    } else {
      setForm({ ...EMPTY_FORM, items: [] });
    }
    setActiveTab('flights');
    setSplitScreen(false);
    setDocPaneTab('enquiry');
    setDocFiles([]);
  }, [open, editQuote, initFromLead, loadEnquiries, loadItineraries]);

  useEffect(() => {
    if (!splitScreen || !form.enquiry_id) { setDocFiles([]); return; }
    setDocFilesLoading(true);
    uploadsAPI.list('enquiries', form.enquiry_id)
      .then(res => setDocFiles(res.data || []))
      .catch(() => setDocFiles([]))
      .finally(() => setDocFilesLoading(false));
  }, [splitScreen, form.enquiry_id]);

  // Auto-populate client_id from linked enquiry when enquiries load
  useEffect(() => {
    if (!form.enquiry_id || form.client_id || enquiries.length === 0) return;
    const enq = enquiries.find(e => e.id === form.enquiry_id);
    if (enq?.client_id) {
      setField('client_id', enq.client_id);
    }
  }, [enquiries, form.enquiry_id, setField]);

  const handleCopyToField = useCallback((fieldKey, text) => {
    setForm(prev => {
      const current = prev[fieldKey] || '';
      const separator = current && !current.endsWith(' ') ? ' ' : '';
      return { ...prev, [fieldKey]: current + separator + text };
    });
    toast.success(`Copied to ${fieldKey.replace(/_/g, ' ')}`, { duration: 1800 });
  }, []);

  const handleStickySelect = useCallback((text) => { setStickyText(text || ''); }, []);

  const handlePinAdd = useCallback((text) => {
    if (!text) return;
    setPinnedChips(prev => prev.includes(text) ? prev : [...prev, text]);
  }, []);

  const makeStickyClick = useCallback((fieldKey) => (e) => {
    if (!stickyText || !splitScreen) return;
    e.stopPropagation();
    setForm(prev => {
      const current = prev[fieldKey] || '';
      const separator = current && !current.endsWith(' ') ? ' ' : '';
      return { ...prev, [fieldKey]: current + separator + stickyText };
    });
    toast.success(`Appended to ${fieldKey.replace(/_/g, ' ')}`, { duration: 1500 });
    setStickyText('');
  }, [stickyText, splitScreen]);

  const handleEnquirySelect = (id) => {
    if (!id || id === '__none__') { setField('enquiry_id', null); setField('client_id', null); return; }
    const enq = enquiries.find(e => e.id === id);
    if (enq) {
      setForm(prev => ({
        ...prev,
        enquiry_id: id,
        client_id: enq.client_id || prev.client_id,
        client_name: enq.client_name || prev.client_name,
        phone: enq.phone || prev.phone,
        email: enq.email || prev.email,
        destination: enq.destination || prev.destination,
        travel_date: enq.travel_date || prev.travel_date,
        return_date: enq.return_date || prev.return_date,
        pax_adults: enq.pax_adults ?? prev.pax_adults,
        pax_children: enq.pax_children ?? prev.pax_children,
      }));
    }
  };

  const addItem = (item) => setForm(prev => ({ ...prev, items: [...prev.items, item] }));
  const updateItem = (id, updatedItem) => setForm(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? updatedItem : i) }));
  const removeItem = (id) => setForm(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));

  const totals = useMemo(() => {
    const byCategory = {};
    let operatingCost = 0;
    form.items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const up = parseFloat(item.unit_price) || 0;
      const roe = parseFloat(item.roe_to_base) || 1;
      const amtBase = qty * up * roe;
      operatingCost += amtBase;
      const cat = item.category || 'Misc';
      byCategory[cat] = (byCategory[cat] || 0) + amtBase;
    });
    const markupType = form.markup_type || 'percentage';
    const markupValue = parseFloat(form.markup_value) || 0;
    const markupAmount = markupType === 'percentage' ? operatingCost * markupValue / 100 : markupValue;
    const subtotal = operatingCost + markupAmount;
    const gstRate = parseFloat(form.gst_rate) || 0;
    const gstAmount = subtotal * gstRate / 100;
    const tcsEnabled = form.tcs_enabled || false;
    const tcsRate = parseFloat(form.tcs_rate) || 0;
    const tcsAmount = tcsEnabled ? (subtotal + gstAmount) * tcsRate / 100 : 0;
    const grandTotal = subtotal + gstAmount + tcsAmount;
    return { operatingCost, byCategory, markupAmount, subtotal, gstAmount, tcsAmount, grandTotal };
  }, [form.items, form.markup_type, form.markup_value, form.gst_rate, form.tcs_enabled, form.tcs_rate]);

  const tabCount = (cats) => {
    if (!cats.length) return null;
    const c = form.items.filter(i => cats.includes(i.category)).length;
    return c > 0 ? c : null;
  };

  const handleSave = async () => {
    if (!form.quote_type || !form.base_currency) {
      toast.error('Quote Type and Base Currency are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        pax_adults: parseInt(form.pax_adults) || 1,
        pax_children: parseInt(form.pax_children) || 0,
        pax_infant: parseInt(form.pax_infant) || 0,
        markup_value: parseFloat(form.markup_value) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        tcs_rate: parseFloat(form.tcs_rate) || 0,
        items: form.items.map(item => ({
          ...item,
          qty: parseFloat(item.qty) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          roe_to_base: parseFloat(item.roe_to_base) || 1.0,
        })),
      };
      bulkSaveROE(payload.items, payload.base_currency);
      let result;
      if (editQuote) {
        result = await quotesAPI.update(editQuote.id, payload);
        toast.success('Quote updated successfully');
      } else {
        result = await quotesAPI.create(payload);
        toast.success(`Quote ${result.data.quote_no} created`);
      }
      onSaved(result.data);
      onClose();
    } catch (e) {
      toast.error(editQuote ? 'Failed to update quote' : 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  };

  const handlePackageSave = (packageItem) => {
    if (editingPackage) { updateItem(editingPackage.id, packageItem); }
    else { addItem(packageItem); }
    setShowPackageModal(false);
    setEditingPackage(null);
  };

  // Sticky-active ring: gold ring when sticky active
  const stickyRing = stickyText && splitScreen ? { boxShadow: '0 0 0 2px rgba(232,168,48,0.5)', cursor: 'copy' } : {};

  const renderEditorContent = () => (
    <>
      {/* ── Quote Configuration ─────────────────────────────── */}
      <SectionCard icon={Settings} label="Quote Configuration" accentColor="#E8A830">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className={QB_LABEL}>Quote Type *</p>
            <Select value={form.quote_type} onValueChange={v => setField('quote_type', v)}>
              <SelectTrigger className={QB_SEL} data-testid="quote-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={QB_LABEL}>Base Currency *</p>
            <Select value={form.base_currency} onValueChange={v => setField('base_currency', v)}>
              <SelectTrigger className={QB_SEL} data-testid="quote-base-currency-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={QB_LABEL}>Link to Lead (optional)</p>
            <Select value={form.enquiry_id || '__none__'} onValueChange={handleEnquirySelect}>
              <SelectTrigger className={QB_SEL} data-testid="quote-link-lead-select">
                <SelectValue placeholder="Select lead..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {enquiries.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.client_name} — {e.destination}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Itinerary link row */}
        <div className="mt-3">
          <p className={QB_LABEL}>Link Itinerary (optional)</p>
          <Select
            value={form.itinerary_id || '__none__'}
            onValueChange={v => setField('itinerary_id', v === '__none__' ? null : v)}
          >
            <SelectTrigger className={QB_SEL} data-testid="quote-link-itinerary-select">
              <SelectValue placeholder="Select itinerary..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {itineraries.map(it => (
                <SelectItem key={it.id} value={it.id}>
                  {it.name || it.title || 'Untitled'}{it.destination ? ` · ${it.destination}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* ── Client Details ──────────────────────────────────── */}
      <SectionCard icon={Users} label="Client Details" accentColor="#4AA3FF">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className={QB_LABEL}>Client Name</p>
            <input
              className={QBI} style={stickyRing}
              value={form.client_name} onChange={e => setField('client_name', e.target.value)}
              onClick={makeStickyClick('client_name')}
              title={stickyText && splitScreen ? `Click to append: "${stickyText}"` : undefined}
              placeholder="Full name" data-testid="quote-client-name"
            />
          </div>
          <div>
            <p className={QB_LABEL}>Phone</p>
            <input
              className={QBI} style={stickyRing}
              value={form.phone} onChange={e => setField('phone', e.target.value)}
              onClick={makeStickyClick('phone')}
              title={stickyText && splitScreen ? `Click to append: "${stickyText}"` : undefined}
              placeholder="+91 ..." data-testid="quote-client-phone"
            />
          </div>
          <div>
            <p className={QB_LABEL}>Email</p>
            <input
              className={QBI} style={stickyRing} type="email"
              value={form.email} onChange={e => setField('email', e.target.value)}
              onClick={makeStickyClick('email')}
              title={stickyText && splitScreen ? `Click to append: "${stickyText}"` : undefined}
              placeholder="email@example.com" data-testid="quote-client-email"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Travel Details ──────────────────────────────────── */}
      <SectionCard icon={Globe} label="Travel Details" accentColor="#27AE60">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <p className={QB_LABEL}>Destination</p>
              <input
                className={QBI} style={stickyRing}
                value={form.destination} onChange={e => setField('destination', e.target.value)}
                onClick={makeStickyClick('destination')}
                title={stickyText && splitScreen ? `Click to append: "${stickyText}"` : undefined}
                placeholder="e.g. Dubai, UAE" data-testid="quote-destination"
              />
            </div>
            <div>
              <p className={QB_LABEL}>Travel Date</p>
              <input
                className={QBI} type="date" value={form.travel_date}
                onChange={e => setField('travel_date', e.target.value)}
                data-testid="quote-travel-date"
              />
            </div>
            <div>
              <p className={QB_LABEL}>Return Date</p>
              <input
                className={QBI} type="date" value={form.return_date}
                onChange={e => setField('return_date', e.target.value)}
                data-testid="quote-return-date"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className={QB_LABEL}>Adults</p>
              <input
                className={`${QBI} text-center font-semibold`}
                type="number" min="1" value={form.pax_adults}
                onChange={e => setField('pax_adults', e.target.value)}
                data-testid="quote-pax-adults"
              />
            </div>
            <div>
              <p className={QB_LABEL}>Children (2-11)</p>
              <input
                className={`${QBI} text-center font-semibold`}
                type="number" min="0" value={form.pax_children}
                onChange={e => setField('pax_children', e.target.value)}
                data-testid="quote-pax-children"
              />
            </div>
            <div>
              <p className={QB_LABEL}>Infants (u2)</p>
              <input
                className={`${QBI} text-center font-semibold`}
                type="number" min="0" value={form.pax_infant}
                onChange={e => setField('pax_infant', e.target.value)}
                data-testid="quote-pax-infant"
              />
            </div>
            <div>
              <p className={QB_LABEL}>Valid Until</p>
              <input
                className={QBI} type="date" value={form.validity_date}
                onChange={e => setField('validity_date', e.target.value)}
                data-testid="quote-validity-date"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Package Items ───────────────────────────────────── */}
      <div
        className="relative rounded-[var(--r-card)] overflow-hidden"
        style={{ backgroundColor: 'var(--qb-modal-2)', border: '1px solid var(--stroke-soft)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: 'var(--cta)' }} />
        <div
          className="flex items-center justify-between pl-5 pr-4 py-3"
          style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.12)' }}
        >
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>Package Items</p>
          </div>
          <div className="flex items-center gap-2">
            {form.items.length > 0 && (
              <Badge
                className="h-5 px-2 text-[9px] font-bold rounded-full"
                style={{ backgroundColor: 'rgba(232,168,48,0.18)', color: 'var(--cta)', border: '1px solid rgba(232,168,48,0.35)' }}
              >
                {form.items.length} item{form.items.length !== 1 ? 's' : ''}
              </Badge>
            )}
            <button
              type="button" data-testid="add-package-cost-btn"
              onClick={() => { setEditingPackage(null); setShowPackageModal(true); }}
              className="h-7 px-3 text-[10px] rounded-lg border border-dashed font-semibold flex items-center gap-1 transition-colors duration-150"
              style={{
                borderColor: 'rgba(232,168,48,0.45)',
                color: 'var(--cta)',
                backgroundColor: 'rgba(232,168,48,0.06)',
              }}
            >
              <Package className="w-2.5 h-2.5" /> + Package Cost
            </button>
          </div>
        </div>

        <div className="pl-5 pr-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* ── Vivid color-coded tab bar ── */}
            <TabsList
              className="h-auto p-1.5 gap-1 w-full justify-start flex-wrap"
              style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--qb-divider)',
                borderRadius: '12px',
              }}
            >
              {CATEGORY_TABS.map(tab => {
                const count = tabCount(tab.cats);
                const isActive = activeTab === tab.key;
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-[9px] transition-all duration-150 focus-visible:ring-0"
                    style={isActive ? {
                      backgroundColor: tab.bg,
                      color: tab.color,
                      border: `1.5px solid ${tab.ring}`,
                      boxShadow: `0 0 18px ${tab.ring}`,
                    } : {
                      color: 'var(--app-muted)',
                      border: '1.5px solid transparent',
                    }}
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
                      >
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="mt-4">
              <TabsContent value="flights" className="mt-0">
                <FlightTab items={form.items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                  baseCurrency={form.base_currency} travelDate={form.travel_date}
                  hasLinkedEnquiry={!!form.enquiry_id}
                  paxAdults={parseInt(form.pax_adults)||1} paxChildren={parseInt(form.pax_children)||0} paxInfants={parseInt(form.pax_infant)||0} />
              </TabsContent>
              <TabsContent value="hotels" className="mt-0">
                <HotelTab items={form.items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                  baseCurrency={form.base_currency} quoteId={editQuote?.id || 'draft'} />
              </TabsContent>
              <TabsContent value="tours" className="mt-0">
                <TourTransferTab items={form.items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                  baseCurrency={form.base_currency} />
              </TabsContent>
              <TabsContent value="visa" className="mt-0">
                <VisaOtherTab items={form.items} onAdd={addItem} onUpdate={updateItem} onRemove={removeItem}
                  baseCurrency={form.base_currency} />
              </TabsContent>
              <TabsContent value="markup" className="mt-0">
                <MarkupTab form={form} setField={setField} totals={totals} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* ── Notes & Terms ───────────────────────────────────── */}
      <SectionCard icon={MessageSquare} label="Notes & Terms" accentColor="#a0b4d0">
        <Textarea
          data-testid="quote-notes"
          value={form.notes || ''}
          onChange={e => setField('notes', e.target.value)}
          onClick={makeStickyClick('notes')}
          title={stickyText && splitScreen ? `Click to append: "${stickyText}"` : undefined}
          style={{
            ...stickyRing,
            backgroundColor: 'var(--qb-field)',
            color: 'var(--app-fg)',
            borderColor: 'var(--qb-field-border)',
            resize: 'none',
          }}
          className="text-sm border rounded-lg focus-visible:ring-0 focus:outline-none"
          placeholder="Inclusions, exclusions, payment terms, cancellation policy..."
          rows={3}
        />
      </SectionCard>
    </>
  );

  // ── Right pane: editor + summary ──────────────────────────────────────────
  const renderRightPane = () => (
    <div className="overflow-hidden min-h-0 flex flex-col flex-1" style={{ backgroundColor: 'var(--qb-modal)' }}>
      {/* Pinned chips bar */}
      {pinnedChips.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 flex-wrap"
          style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(232,168,48,0.05)' }}
          data-testid="pinned-chips-bar"
        >
          <Pin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cta)' }} />
          <span className="text-[10px] font-semibold mr-0.5" style={{ color: 'var(--cta)' }}>Pinned:</span>
          {pinnedChips.map((chip, i) => (
            <div
              key={`chip-${chip.slice(0, 20)}-${i}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium group"
              style={{ backgroundColor: 'rgba(232,168,48,0.12)', border: '1px solid rgba(232,168,48,0.35)', color: 'var(--app-fg)' }}
              data-testid={`pinned-chip-${i}`}
            >
              <button onClick={() => setStickyText(chip)} title="Set as sticky"
                className="max-w-[120px] truncate hover:opacity-70 transition-opacity">
                {chip.length > 30 ? chip.slice(0, 30) + '…' : chip}
              </button>
              <button
                onClick={() => setPinnedChips(prev => prev.filter((_, idx) => idx !== i))}
                className="opacity-0 group-hover:opacity-100 ml-0.5 transition-opacity"
                style={{ color: 'var(--app-muted)' }}
                data-testid={`remove-chip-${i}`}
              >
                <XIcon className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sticky-paste active banner */}
      {stickyText && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2"
          style={{ backgroundColor: 'rgba(232,168,48,0.07)', borderBottom: '1px solid rgba(232,168,48,0.25)' }}
          data-testid="sticky-active-bar"
        >
          <Copy className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cta)' }} />
          <p className="text-[10px] flex-1 min-w-0" style={{ color: 'var(--app-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--cta)' }}>Sticky paste — </span>
            click a highlighted field:{' '}
            <span className="font-medium" style={{ color: 'var(--app-fg)' }}>
              "{stickyText.length > 60 ? stickyText.slice(0, 60) + '…' : stickyText}"
            </span>
          </p>
          <button
            onClick={() => setStickyText('')}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ color: 'var(--app-muted)' }}
            data-testid="clear-sticky-btn"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <ScrollArea className="flex-1" style={{ borderRight: '1px solid var(--qb-divider)' }}>
          <div className="p-5 space-y-4">{renderEditorContent()}</div>
        </ScrollArea>
        <div className="w-[270px] flex-shrink-0 flex flex-col" style={{ backgroundColor: 'var(--qb-modal)' }}>
          <SummaryPanel totals={totals} form={form} />
        </div>
      </div>
    </div>
  );

  const renderDocPane = () => (
    <div className="overflow-hidden min-h-0 h-full flex flex-col">
      {/* Doc pane tab switcher */}
      <div
        className="flex-shrink-0 flex items-center gap-1 px-3 py-2"
        style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.18)' }}
      >
        <button
          type="button"
          onClick={() => setDocPaneTab('enquiry')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150"
          style={{
            backgroundColor: docPaneTab === 'enquiry' ? 'rgba(232,168,48,0.15)' : 'transparent',
            color: docPaneTab === 'enquiry' ? 'var(--cta)' : 'var(--app-muted)',
            border: docPaneTab === 'enquiry' ? '1px solid rgba(232,168,48,0.30)' : '1px solid transparent',
          }}
          data-testid="doc-pane-tab-enquiry"
        >
          <ImageIcon className="w-3 h-3" />
          Enquiry Docs
        </button>
        <button
          type="button"
          onClick={() => setDocPaneTab('client')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors duration-150"
          style={{
            backgroundColor: docPaneTab === 'client' ? 'rgba(232,168,48,0.15)' : 'transparent',
            color: docPaneTab === 'client' ? 'var(--cta)' : 'var(--app-muted)',
            border: docPaneTab === 'client' ? '1px solid rgba(232,168,48,0.30)' : '1px solid transparent',
          }}
          data-testid="doc-pane-tab-client"
        >
          <FolderOpen className="w-3 h-3" />
          Client Docs
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {docPaneTab === 'enquiry' ? (
          <DocumentViewer
            enquiryId={form.enquiry_id}
            initialFiles={docFiles}
            onCopyToField={handleCopyToField}
            onStickySelect={handleStickySelect}
            onPinAdd={handlePinAdd}
          />
        ) : (
          <div className="h-full overflow-hidden bg-[#f7f8fb]">
            {form.client_id ? (
              <ClientDocumentsPanel clientId={form.client_id} compact={true} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <FolderOpen className="w-8 h-8 mb-3 text-[#5b6475]/20" />
                <p className="text-xs font-semibold text-[#5b6475]">No client linked</p>
                <p className="text-[10px] text-[#5b6475]/60 mt-1">
                  Link an enquiry with a client profile to view documents here
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[1380px] w-[97vw] h-[92vh] flex flex-col p-0 gap-0"
        style={{ backgroundColor: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)', borderRadius: 'var(--r-modal)' }}
        data-testid="quote-builder-modal"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.20)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(232,168,48,0.25), rgba(232,168,48,0.10))', border: '1px solid rgba(232,168,48,0.35)' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--cta)' }} />
            </div>
            <div className="flex-1">
              <h2
                className="text-base font-bold leading-tight"
                style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}
              >
                {editQuote ? `Edit Quote — ${editQuote.quote_no}` : 'New Quotation'}
              </h2>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>
                Quote Builder · BDV TravelOS
              </p>
            </div>

            {/* Split-screen toggle */}
            <button
              type="button" onClick={() => setSplitScreen(s => !s)}
              title={splitScreen ? 'Exit split-screen' : 'Open document panel'}
              data-testid="split-screen-toggle"
              className="h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors duration-150"
              style={{
                backgroundColor: splitScreen ? 'rgba(232,168,48,0.15)' : 'rgba(0,0,0,0.20)',
                border: splitScreen ? '1px solid rgba(232,168,48,0.40)' : '1px solid var(--qb-field-border)',
                color: splitScreen ? 'var(--cta)' : 'var(--app-muted)',
              }}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{splitScreen ? 'Exit Split' : 'Split View'}</span>
            </button>

            {splitScreen && (
              <button
                type="button" onClick={() => setSwapped(s => !s)}
                title="Swap document viewer and editor sides"
                data-testid="swap-sides-btn"
                className="h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors duration-150"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.20)',
                  border: '1px solid var(--qb-field-border)',
                  color: 'var(--app-muted)',
                }}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Swap</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {splitScreen ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden min-h-0" onLayout={saveDivider}>
              <ResizablePanel defaultSize={dividerSizes[0]} minSize={20} maxSize={60} className="overflow-hidden min-h-0">
                {swapped ? renderRightPane() : renderDocPane()}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={dividerSizes[1]} className="overflow-hidden min-h-0 flex">
                {swapped ? renderDocPane() : renderRightPane()}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="flex flex-1 overflow-hidden min-h-0">
              <ScrollArea className="flex-1" style={{ borderRight: '1px solid var(--qb-divider)' }}>
                <div className="p-5 space-y-4">{renderEditorContent()}</div>
              </ScrollArea>
              <div className="w-[270px] flex-shrink-0 flex flex-col" style={{ backgroundColor: 'var(--qb-modal)' }}>
                <SummaryPanel totals={totals} form={form} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          className="px-5 py-3.5 flex-shrink-0 flex items-center justify-end gap-3"
          style={{ borderTop: '1px solid var(--qb-divider)', backgroundColor: 'rgba(0,0,0,0.20)' }}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={saving}
            data-testid="quote-cancel-btn"
            className="h-9 text-sm rounded-xl"
            style={{ border: '1px solid var(--qb-field-border)', color: 'var(--app-muted)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="quote-save-btn"
            className="h-9 text-sm rounded-xl gap-1.5 font-semibold"
            style={{ backgroundColor: 'var(--cta)', color: '#0a1628' }}
          >
            {saving ? 'Saving...' : editQuote ? 'Save Changes' : 'Save as Draft'}
          </Button>
        </div>

        {showPackageModal && (
          <PackageCostModal
            open={showPackageModal}
            onClose={() => { setShowPackageModal(false); setEditingPackage(null); }}
            editItem={editingPackage}
            baseCurrency={form.base_currency}
            onSave={handlePackageSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
