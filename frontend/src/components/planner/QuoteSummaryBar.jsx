import React, { useMemo } from 'react';
import { FileText, TrendingUp, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

const fmtCurrency = (amount, currency = 'INR') => {
  if (amount == null || isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency}${Math.round(amount)}`;
  }
};

export function QuoteSummaryBar({ components, trip, onOpenQuote }) {
  const currency = trip?.currency || 'INR';

  const totals = useMemo(() => {
    if (!components || components.length === 0) return { net: 0, sell: 0, margin: 0, count: 0 };
    let net = 0;
    let sell = 0;
    let count = 0;
    for (const c of components) {
      if (c.net_cost != null)  net  += (c.net_cost  * (c.fx_rate || 1));
      if (c.sell_price != null) { sell += c.sell_price; count++; }
    }
    const margin = sell > 0 ? ((sell - net) / sell * 100) : 0;
    return { net: Math.round(net), sell: Math.round(sell), margin: Math.round(margin * 10) / 10, count };
  }, [components]);

  return (
    <div
      className="flex-shrink-0 flex items-center gap-4 px-4 h-12"
      style={{
        background: 'rgba(5,10,20,0.92)',
        borderTop: '1px solid var(--stroke-soft)',
        backdropFilter: 'blur(12px)',
      }}
      data-testid="quote-summary-bar"
    >
      {/* Component count */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>Components</span>
        <span className="text-xs font-bold font-mono" style={{ color: 'var(--app-fg)' }}>{components?.length || 0}</span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--stroke-soft)' }} />

      {/* Net cost */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>Net</span>
        <span className="text-xs font-bold font-mono" style={{ color: 'var(--app-muted)' }}>{fmtCurrency(totals.net, currency)}</span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--stroke-soft)' }} />

      {/* Sell price */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--app-muted)' }}>Sell</span>
        <span className="text-xs font-bold font-mono" style={{ color: 'var(--cta)' }}>{fmtCurrency(totals.sell, currency)}</span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--stroke-soft)' }} />

      {/* Margin */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" style={{ color: totals.margin > 0 ? '#2F9E6F' : '#8FB3C7' }} />
        <span
          className="text-xs font-bold font-mono"
          style={{ color: totals.margin > 0 ? '#2F9E6F' : '#8FB3C7' }}
        >
          {totals.margin}%
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Build Quote button */}
      <Button
        onClick={onOpenQuote}
        className="h-8 px-4 gap-2 text-xs font-semibold"
        style={{ background: 'var(--cta)', color: 'var(--app-bg)', fontFamily: 'Figtree, sans-serif' }}
        data-testid="build-quote-btn"
      >
        <FileText className="w-3.5 h-3.5" />
        Build Quote
        <ChevronRight className="w-3 h-3" />
      </Button>
    </div>
  );
}
