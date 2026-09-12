import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, RefreshCw, TrendingUp } from 'lucide-react';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',          flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',               flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',      flag: '🇬🇧' },
  { code: 'INR', name: 'Indian Rupee',       flag: '🇮🇳' },
  { code: 'AED', name: 'UAE Dirham',         flag: '🇦🇪' },
  { code: 'JPY', name: 'Japanese Yen',       flag: '🇯🇵' },
  { code: 'SGD', name: 'Singapore Dollar',   flag: '🇸🇬' },
  { code: 'CHF', name: 'Swiss Franc',        flag: '🇨🇭' },
  { code: 'MXN', name: 'Mexican Peso',       flag: '🇲🇽' },
  { code: 'AUD', name: 'Australian Dollar',  flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',    flag: '🇨🇦' },
  { code: 'THB', name: 'Thai Baht',          flag: '🇹🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah',  flag: '🇮🇩' },
  { code: 'VND', name: 'Vietnamese Dong',    flag: '🇻🇳' },
  { code: 'COP', name: 'Colombian Peso',     flag: '🇨🇴' },
  { code: 'BRL', name: 'Brazilian Real',     flag: '🇧🇷' },
  { code: 'HKD', name: 'Hong Kong Dollar',   flag: '🇭🇰' },
];

const QUICK_PAIRS = [
  ['USD', 'INR'], ['EUR', 'INR'], ['GBP', 'INR'],
  ['USD', 'AED'], ['EUR', 'CHF'], ['USD', 'SGD'],
];

const LARGE_UNIT_CURRENCIES = new Set(['JPY', 'IDR', 'VND', 'COP']);

function formatAmount(value, toCurr) {
  if (!isFinite(value)) return '—';
  if (LARGE_UNIT_CURRENCIES.has(toCurr)) {
    return Math.round(value).toLocaleString();
  }
  return value.toFixed(2);
}

export default function CurrencyConverterWidget() {
  const [rates,      setRates]     = useState({});
  const [loading,    setLoading]   = useState(true);
  const [fromCurr,   setFromCurr]  = useState('USD');
  const [toCurr,     setToCurr]    = useState('INR');
  const [amount,     setAmount]    = useState('1');
  const [updatedAt,  setUpdatedAt] = useState(null);
  const [apiError,   setApiError]  = useState(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    try {
      const res = await fetch('https://open.exchangerate-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (data.result === 'success' && data.conversion_rates) {
        setRates(data.conversion_rates);
        setUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        throw new Error('bad response');
      }
    } catch {
      setApiError(true);
      // Reasonable fallback rates (approximate)
      setRates({
        USD:1, EUR:0.92, GBP:0.79, INR:83.5, AED:3.67, JPY:154.5,
        SGD:1.35, CHF:0.90, MXN:17.1, AUD:1.54, CAD:1.37, THB:36.5,
        IDR:15800, VND:24500, COP:3950, BRL:5.05, HKD:7.82,
      });
      setUpdatedAt('Estimated');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const convert = (from, to, amt) => {
    const n = parseFloat(amt);
    if (!n || !rates[from] || !rates[to]) return '—';
    return formatAmount((n / rates[from]) * rates[to], to);
  };

  const swapCurrencies = () => {
    setFromCurr(toCurr);
    setToCurr(fromCurr);
  };

  const converted = convert(fromCurr, toCurr, amount);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-1), var(--inner-glow)' }}
      data-testid="currency-converter-widget"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--stroke-soft)' }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--cta)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--app-fg)' }}>
            Currency Converter
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[9px]" style={{ color: apiError ? 'var(--app-muted)' : 'var(--success)' }}>
              {apiError ? 'Estimated' : `Updated ${updatedAt}`}
            </span>
          )}
          <button
            onClick={fetchRates}
            disabled={loading}
            className="p-1 rounded-full transition-colors"
            style={{ color: 'var(--app-muted)' }}
            data-testid="currency-refresh-btn"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Converter row */}
        <div className="flex items-end gap-2">
          {/* From */}
          <div className="flex-1 space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--app-muted)' }}>From</label>
            <Select value={fromCurr} onValueChange={setFromCurr}>
              <SelectTrigger
                className="h-9 text-xs"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)', color: 'var(--app-fg)' }}
                data-testid="from-currency-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)', maxHeight: 240 }}>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code} style={{ color: 'var(--app-fg)' }}>
                    {c.flag} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="h-9 text-sm font-mono"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)', color: 'var(--app-fg)' }}
              placeholder="Amount"
              data-testid="currency-amount-input"
            />
          </div>

          {/* Swap */}
          <button
            onClick={swapCurrencies}
            className="mb-0.5 p-2 rounded-full border transition-transform duration-150 hover:scale-110 flex-shrink-0"
            style={{ borderColor: 'var(--cta)', color: 'var(--cta)', background: 'rgba(232,168,48,0.08)' }}
            data-testid="currency-swap-btn"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* To */}
          <div className="flex-1 space-y-1">
            <label className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--app-muted)' }}>To</label>
            <Select value={toCurr} onValueChange={setToCurr}>
              <SelectTrigger
                className="h-9 text-xs"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)', color: 'var(--app-fg)' }}
                data-testid="to-currency-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)', maxHeight: 240 }}>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code} style={{ color: 'var(--app-fg)' }}>
                    {c.flag} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Result box */}
            <div
              className="h-9 flex items-center px-3 rounded-md border font-mono text-sm font-bold"
              style={{
                background: 'rgba(232,168,48,0.08)',
                borderColor: 'rgba(232,168,48,0.30)',
                color: 'var(--cta)',
              }}
              data-testid="currency-result"
            >
              {loading ? '…' : converted}
            </div>
          </div>
        </div>

        {/* Rate label */}
        {!loading && rates[fromCurr] && rates[toCurr] && (
          <p className="text-[10px] text-center" style={{ color: 'var(--app-muted)' }}>
            1 {fromCurr} ={' '}
            <span style={{ color: 'var(--cta)', fontWeight: 600 }}>
              {convert(fromCurr, toCurr, '1')} {toCurr}
            </span>
          </p>
        )}

        {/* Quick reference pairs */}
        <div>
          <p
            className="text-[9px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'var(--app-muted)' }}
          >
            Quick Reference
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_PAIRS.map(([from, to]) => (
              <button
                key={`${from}-${to}`}
                onClick={() => { setFromCurr(from); setToCurr(to); }}
                className="flex flex-col items-center p-2 rounded-lg border transition-colors"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cta)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--stroke-soft)')}
                data-testid={`quick-pair-${from}-${to}`}
              >
                <span className="text-[9px] font-semibold" style={{ color: 'var(--app-muted)' }}>
                  {from}/{to}
                </span>
                <span className="text-[10px] font-mono font-bold mt-0.5" style={{ color: 'var(--cta)' }}>
                  {loading ? '…' : convert(from, to, '1')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
