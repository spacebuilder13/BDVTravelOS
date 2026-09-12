import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, MapPin, Car } from 'lucide-react';
import { getROE } from '../../utils/roeStorage';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];
const RATE_TYPES = ['Per Person', 'Per Vehicle', 'Per Group', 'Per Day', 'Lump Sum'];
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function TourTransferTab({ items, onAdd, onUpdate, onRemove, baseCurrency }) {
  const tourItems = items.filter(i => ['Sightseeing', 'Transfers'].includes(i.category));
  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const addItem = (cat) => {
    onAdd({
      id: newId(),
      category: cat,
      title: '',
      description: '',
      qty: 1,
      unit_price: 0,
      currency: baseCurrency,
      roe_to_base: 1.0,
      rate_type: 'Per Person',
      service_count: 1,
    });
  };

  const handleField = (item, field, value) => {
    const updated = { ...item, [field]: value };
    if (['service_count', 'unit_price'].includes(field)) {
      updated.qty = parseFloat(field === 'service_count' ? value : updated.service_count) || 1;
      updated.unit_price = parseFloat(field === 'unit_price' ? value : updated.unit_price) || 0;
    }
    if (field === 'currency' && value === baseCurrency) updated.roe_to_base = 1.0;
    else if (field === 'currency' && value !== baseCurrency) updated.roe_to_base = getROE(value, baseCurrency);
    onUpdate(item.id, updated);
  };

  const totalInBase = (item) =>
    (parseFloat(item.unit_price) || 0) * (parseFloat(item.qty) || 1) * (parseFloat(item.roe_to_base) || 1);

  const inp = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(240,180,41,0.5)] w-full transition-colors duration-150';

  if (tourItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-[rgba(240,180,41,0.10)] border border-[rgba(240,180,41,0.30)] flex items-center justify-center mb-3">
          <MapPin className="w-4 h-4 text-[#F0B429]" />
        </div>
        <p className="text-sm font-medium text-[var(--app-fg)]">No tours or transfers added</p>
        <p className="text-xs text-[var(--app-muted)] mt-0.5">Add sightseeing tours and transfers</p>
        <div className="flex gap-2 mt-3">
          <Button type="button" size="sm" onClick={() => addItem('Sightseeing')}
            className="gap-1.5 h-8 text-xs bg-[rgba(240,180,41,0.10)]0 hover:bg-[rgba(240,180,41,0.12)] text-white transition-colors duration-150">
            <MapPin className="w-3.5 h-3.5" /> Add Tour
          </Button>
          <Button type="button" size="sm" onClick={() => addItem('Transfers')}
            variant="outline" className="gap-1.5 h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-150">
            <Car className="w-3.5 h-3.5" /> Add Transfer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tourItems.map((item, idx) => {
        const isTour = item.category === 'Sightseeing';
        const headerBg = isTour ? 'bg-[rgba(240,180,41,0.10)] border-[rgba(240,180,41,0.30)]' : 'bg-orange-50 border-orange-100';
        const iconColor = isTour ? 'text-[#F0B429]' : 'text-orange-500';
        const titleColor = isTour ? 'text-[#F0B429]' : 'text-orange-900';
        const subtitleColor = isTour ? 'text-[#F0B429]/70' : 'text-orange-700/70';
        const badgeCls = isTour
          ? 'bg-[rgba(240,180,41,0.10)] text-[#F0B429] border border-[rgba(240,180,41,0.30)]'
          : 'bg-orange-100 text-orange-700 border border-orange-200';
        const removeCls = isTour
          ? 'text-[#F0B429]/60 hover:text-red-500 hover:bg-red-50'
          : 'text-orange-500/60 hover:text-red-500 hover:bg-red-50';
        const cardBorder = isTour ? 'border-[rgba(240,180,41,0.30)]' : 'border-orange-100';
        const focusRing = isTour ? 'focus:ring-amber-400' : 'focus:ring-orange-400';
        const rowInp = `h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 ${focusRing} w-full transition-colors duration-150`;

        return (
          <div key={item.id} className={`rounded-xl border ${cardBorder} overflow-hidden shadow-sm`}
            data-testid={`tour-item-${idx}`}>
            {/* Card Header */}
            <div className={`flex items-center justify-between px-3 py-2 ${headerBg} border-b`}>
              <div className="flex items-center gap-2">
                {isTour
                  ? <MapPin className={`w-3.5 h-3.5 ${iconColor}`} />
                  : <Car className={`w-3.5 h-3.5 ${iconColor}`} />}
                <span className={`text-xs font-semibold ${titleColor}`}>
                  {isTour ? 'Tour / Sightseeing' : 'Transfer'} {idx + 1}
                  {item.title && <span className={`ml-1.5 ${subtitleColor} font-normal`}>— {item.title}</span>}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeCls}`}>
                  {item.category}
                </span>
              </div>
              <button type="button" onClick={() => onRemove(item.id)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors duration-150 ${removeCls}`}
                data-testid={`tour-remove-${idx}`}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Card Body */}
            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Title / Description</Label>
                  <input className={rowInp} value={item.title || ''}
                    onChange={e => handleField(item, 'title', e.target.value)}
                    placeholder={isTour ? 'e.g. Desert Safari' : 'e.g. Airport Transfer'} />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Date</Label>
                  <input className={rowInp} type="date" value={item.flight_date || ''}
                    onChange={e => handleField(item, 'flight_date', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 items-end">
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Rate Type</Label>
                  <Select value={item.rate_type || 'Per Person'} onValueChange={v => handleField(item, 'rate_type', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{RATE_TYPES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Count</Label>
                  <input className={`${rowInp} text-center`} type="number" min="1" value={item.service_count || 1}
                    onChange={e => handleField(item, 'service_count', e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Unit Cost</Label>
                  <input className={`${rowInp} text-right`} type="number" min="0" step="0.01" value={item.unit_price || 0}
                    onChange={e => handleField(item, 'unit_price', e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Currency</Label>
                  <Select value={item.currency || baseCurrency} onValueChange={v => handleField(item, 'currency', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 items-end pt-1 border-t border-[#f2f4f8]">
                <div className="col-span-2">
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Notes (optional)</Label>
                  <input className={rowInp} value={item.description || ''}
                    onChange={e => handleField(item, 'description', e.target.value)} placeholder="Additional details..." />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>ROE → {baseCurrency}</Label>
                  <input className={`${rowInp} text-right ${item.currency === baseCurrency ? 'bg-[#f2f4f8] text-[var(--app-muted)] cursor-not-allowed' : ''}`}
                    type="number" min="0" step="0.0001" value={item.roe_to_base || 1}
                    disabled={item.currency === baseCurrency}
                    onChange={e => handleField(item, 'roe_to_base', e.target.value)} />
                </div>
                <div>
                  <Label className={`text-[10px] mb-1 block font-semibold ${isTour ? 'text-[#F0B429]' : 'text-orange-500'}`}>Amt ({baseCurrency})</Label>
                  <div className="h-7 flex items-center px-2 rounded-md text-xs font-bold justify-end"
                    style={{ background: 'linear-gradient(135deg, rgba(232,168,48,0.18), rgba(232,168,48,0.08))', border: '1px solid rgba(232,168,48,0.35)', color: 'var(--cta)' }}>
                    {fmt(totalInBase(item))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => addItem('Sightseeing')} variant="outline"
          className="flex-1 gap-1.5 h-8 text-xs border-dashed border-2 border-[rgba(240,180,41,0.30)] bg-transparent text-[#F0B429] hover:bg-[rgba(240,180,41,0.10)] hover:text-[#F0B429] hover:border-amber-300 transition-colors duration-150"
          data-testid="add-tour-btn">
          <MapPin className="w-3.5 h-3.5" /> Add Tour
        </Button>
        <Button type="button" size="sm" onClick={() => addItem('Transfers')} variant="outline"
          className="flex-1 gap-1.5 h-8 text-xs border-dashed border-2 border-orange-200 bg-transparent text-orange-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors duration-150"
          data-testid="add-transfer-btn">
          <Car className="w-3.5 h-3.5" /> Add Transfer
        </Button>
      </div>
    </div>
  );
}
