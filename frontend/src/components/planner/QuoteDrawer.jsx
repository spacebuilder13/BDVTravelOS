import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, X, Loader2, Save, Wand2, Plus, Trash2,
  ChevronDown, RefreshCw, Copy, CheckCircle2, Percent
} from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { listTaxProfiles, getQuoteTerms, updateQuoteTerms } from '../../services/plannerAPI';
import { updateTrip } from '../../services/tripAPI';

const TYPE_LABELS = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry', cruise: 'Cruise',
  transfer: 'Transfer', self_drive: 'Self Drive', stay: 'Stay',
  activity: 'Activity', attraction: 'Attraction', meal: 'Meal',
  visa: 'Visa', insurance: 'Insurance', misc: 'Misc',
};

const TYPE_COLORS = {
  flight: '#4FC3F7', train: '#4FC3F7', bus: '#4FC3F7', ferry: '#4FC3F7',
  cruise: '#4FC3F7', transfer: '#8FB3C7', self_drive: '#8FB3C7',
  stay: '#2F9E6F', activity: '#FFB300', attraction: '#FFB300', meal: '#FFB300',
  visa: '#8FB3C7', insurance: '#8FB3C7', misc: '#8FB3C7',
};

const fmtCurrency = (amount, currency = 'INR') => {
  if (amount == null || isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency}${Math.round(amount)}`;
  }
};

// ── Quote Line Item ───────────────────────────────────────────────────────────
function QuoteLineItem({ item, currency, onPriceChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const color = TYPE_COLORS[item.type] || '#8FB3C7';

  const startEdit = () => { setVal(String(item.sell_price || 0)); setEditing(true); };
  const commitEdit = () => {
    const n = parseFloat(val);
    if (!isNaN(n)) onPriceChange(item.id, n);
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 group"
      style={{ borderBottom: '1px solid var(--qb-divider)' }}
      data-testid={`quote-line-${item.id}`}
    >
      <div className="flex-shrink-0 w-1.5 h-6 rounded-full" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)' }}>{item.title}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--app-muted)' }}>
          {TYPE_LABELS[item.type] || item.type}{item.supplier_name ? ` · ${item.supplier_name}` : ''}
          {item.nights > 0 ? ` · ${item.nights}N` : ''}
        </p>
      </div>
      {/* Sell price cell */}
      <div className="flex-shrink-0 text-right min-w-[100px]">
        {editing ? (
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && commitEdit()}
            type="number"
            step="0.01"
            className="w-24 h-7 text-sm text-right px-2 rounded border font-mono"
            style={{ background: 'var(--qb-field)', border: '1px solid var(--cta)', color: 'var(--cta)' }}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="text-sm font-bold font-mono transition-colors hover:opacity-80"
            style={{ color: 'var(--cta)' }}
            data-testid={`quote-price-${item.id}`}
          >
            {fmtCurrency(item.sell_price, currency)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main QuoteDrawer ──────────────────────────────────────────────────────────
export function QuoteDrawer({ open, onClose, trip, components }) {
  const [taxProfiles, setTaxProfiles]   = useState([]);
  const [termsTemplate, setTermsTemplate] = useState(null);
  const [lineItems, setLineItems]       = useState([]);
  const [discount, setDiscount]         = useState(0);
  const [terms, setTerms]               = useState('');
  const [version, setVersion]           = useState(1);
  const [loadingTax, setLoadingTax]     = useState(false);
  const [savingTerms, setSavingTerms]   = useState(false);
  const [saved, setSaved]               = useState(false);

  // Init line items from trip components
  useEffect(() => {
    if (open && components) {
      setLineItems(components.map(c => ({ ...c })));
      setVersion(trip?.quote_version || 1);
    }
  }, [open, components, trip?.quote_version]);

  // Load tax profiles & terms
  useEffect(() => {
    if (!open) return;
    setLoadingTax(true);
    Promise.all([listTaxProfiles(), getQuoteTerms()])
      .then(([taxes, termsData]) => {
        setTaxProfiles(taxes.filter(t => t.is_enabled));
        if (termsData) {
          setTermsTemplate(termsData);
          setTerms(termsData.terms_and_conditions || '');
        }
      })
      .catch(e => console.error('QuoteDrawer load', e))
      .finally(() => setLoadingTax(false));
  }, [open]);

  const currency = trip?.currency || 'INR';

  const totals = useMemo(() => {
    const subtotal  = lineItems.reduce((s, c) => s + (c.sell_price || 0), 0);
    const taxTotal  = taxProfiles.reduce((s, t) => s + (subtotal * t.rate / 100), 0);
    const grand     = subtotal + taxTotal - (discount || 0);
    return { subtotal: Math.round(subtotal), taxTotal: Math.round(taxTotal), grand: Math.round(grand) };
  }, [lineItems, taxProfiles, discount]);

  const handlePriceChange = useCallback((id, price) => {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, sell_price: price } : item));
  }, []);

  const handleSmartFill = () => {
    setLineItems(components.map(c => ({ ...c })));
    toast.success('Smart filled from trip components');
  };

  const handleNewVersion = async () => {
    const newVer = version + 1;
    try {
      await updateTrip(trip.id, { quote_version: newVer });
      setVersion(newVer);
      toast.success(`Version v${newVer} created — line items copied from v${version}`);
    } catch (e) { toast.error('Version bump failed: ' + e.message); }
  };

  const handleSaveTerms = async () => {
    setSavingTerms(true);
    try {
      await updateQuoteTerms({ terms_and_conditions: terms });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Terms saved as template');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSavingTerms(false); }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[520px] flex flex-col p-0 overflow-hidden"
        style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
        data-testid="quote-drawer"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--qb-divider)' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--cta)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>Quote Builder</p>
              {/* Version badge */}
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,229,255,0.12)', color: 'var(--cta)', border: '1px solid rgba(0,229,255,0.25)' }}
                data-testid="quote-version-badge"
              >
                v{version}
              </span>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--app-muted)' }}>
              {trip?.client_name}{trip?.quote_no ? ` · #${trip.quote_no}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSmartFill}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
              style={{ background: 'rgba(255,179,0,0.10)', color: '#FFB300', border: '1px solid rgba(255,179,0,0.25)' }}
              title="Smart fill from trip components"
              data-testid="smart-fill-btn"
            >
              <Wand2 className="w-3 h-3" /> Smart Fill
            </button>
            <button
              type="button"
              onClick={handleNewVersion}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
              style={{ background: 'rgba(47,158,111,0.10)', color: '#2F9E6F', border: '1px solid rgba(47,158,111,0.25)' }}
              title="Create new quote version"
              data-testid="new-version-btn"
            >
              <Copy className="w-3 h-3" /> v{version + 1}
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Line items */}
          <div className="py-2">
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{ borderBottom: '1px solid var(--qb-divider)' }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold flex-1" style={{ color: 'var(--app-muted)' }}>Component</p>
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--app-muted)' }}>Sell Price</p>
            </div>

            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--app-muted)' }}>
                <FileText className="w-8 h-8 opacity-20" />
                <p className="text-sm">No components on this trip.</p>
                <p className="text-xs opacity-60">Add components via the Trip Rail first.</p>
              </div>
            ) : (
              lineItems.map(item => (
                <QuoteLineItem
                  key={item.id}
                  item={item}
                  currency={currency}
                  onPriceChange={handlePriceChange}
                />
              ))
            )}
          </div>

          {/* Tax rows */}
          {!loadingTax && taxProfiles.length > 0 && (
            <div style={{ borderTop: '1px solid var(--qb-divider)' }}>
              <div className="px-4 py-2">
                <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--app-muted)' }}>Taxes & Levies</p>
              </div>
              {taxProfiles.map(tp => (
                <div
                  key={tp.id}
                  className="flex items-center justify-between px-4 py-2"
                  style={{ borderBottom: '1px solid var(--qb-divider)' }}
                  data-testid={`tax-row-${tp.id}`}
                >
                  <div>
                    <p className="text-sm" style={{ color: 'var(--app-fg)' }}>{tp.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>{tp.rate}% · {tp.applies_to}</p>
                  </div>
                  <p className="text-sm font-bold font-mono" style={{ color: 'var(--app-fg)' }}>
                    {fmtCurrency(totals.subtotal * tp.rate / 100, currency)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Discount row */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--qb-divider)' }}
          >
            <p className="text-sm" style={{ color: 'var(--app-muted)' }}>Discount</p>
            <div className="flex items-center gap-1">
              <span style={{ color: 'var(--app-muted)', fontSize: '12px' }}>-</span>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                step="100"
                min="0"
                className="w-24 h-7 text-sm text-right px-2 rounded border font-mono"
                style={{ background: 'var(--qb-field)', border: '1px solid var(--qb-field-border)', color: '#fca5a5' }}
                data-testid="discount-input"
              />
            </div>
          </div>

          {/* Grand total */}
          <div
            className="flex items-center justify-between px-4 py-4"
            style={{
              background: 'rgba(0,229,255,0.04)',
              borderTop: '2px solid rgba(0,229,255,0.20)',
            }}
          >
            <p className="text-sm font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>Grand Total</p>
            <p
              className="text-xl font-bold font-mono"
              style={{ color: 'var(--cta)' }}
              data-testid="quote-grand-total"
            >
              {fmtCurrency(totals.grand, currency)}
            </p>
          </div>

          {/* Breakdown chips */}
          <div className="flex items-center gap-3 px-4 pb-4 flex-wrap">
            <span className="text-[10px] font-mono" style={{ color: 'var(--app-muted)' }}>Subtotal: {fmtCurrency(totals.subtotal, currency)}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--app-muted)' }}>Tax: +{fmtCurrency(totals.taxTotal, currency)}</span>
            {discount > 0 && <span className="text-[10px] font-mono" style={{ color: '#fca5a5' }}>Disc: -{fmtCurrency(discount, currency)}</span>}
          </div>

          {/* T&C section */}
          <div
            className="mx-4 mb-4 rounded-xl p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--app-muted)' }}>Terms & Conditions</p>
              <div className="flex items-center gap-2">
                {saved && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#2F9E6F' }} />}
                <button
                  type="button"
                  onClick={handleSaveTerms}
                  disabled={savingTerms}
                  className="flex items-center gap-1 h-6 px-2 rounded text-[10px] transition-all"
                  style={{ background: 'rgba(0,229,255,0.08)', color: 'var(--cta)', border: '1px solid rgba(0,229,255,0.20)' }}
                  data-testid="save-terms-btn"
                >
                  {savingTerms ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                  Save Template
                </button>
              </div>
            </div>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={6}
              placeholder="Enter terms and conditions for this quote..."
              className="w-full text-xs rounded-lg p-3 resize-none"
              style={{
                background: 'var(--qb-field)',
                border: '1px solid var(--qb-field-border)',
                color: 'var(--app-fg)',
                outline: 'none',
              }}
              data-testid="terms-textarea"
            />
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--qb-divider)', background: 'rgba(0,0,0,0.20)' }}
        >
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} · {fmtCurrency(totals.grand, currency)}
          </p>
          <Button
            onClick={onClose}
            className="h-8 px-4 text-xs"
            style={{ background: 'var(--cta)', color: 'var(--app-bg)' }}
            data-testid="quote-close-btn"
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
