import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Trash2, FileText, Package } from 'lucide-react';
import { getROE } from '../../utils/roeStorage';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function VisaOtherTab({ items, onAdd, onUpdate, onRemove, baseCurrency }) {
  const visaItems = items.filter(i => ['Visa Fees', 'Misc'].includes(i.category));
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
    });
  };

  const handleField = (item, field, value) => {
    const updated = { ...item, [field]: value };
    if (field === 'currency' && value === baseCurrency) updated.roe_to_base = 1.0;
    else if (field === 'currency' && value !== baseCurrency) updated.roe_to_base = getROE(value, baseCurrency);
    onUpdate(item.id, updated);
  };

  const totalInBase = (item) =>
    (parseFloat(item.unit_price) || 0) * (parseFloat(item.qty) || 1) * (parseFloat(item.roe_to_base) || 1);

  const inp = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(139,124,255,0.5)] w-full transition-colors duration-150';

  if (visaItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-[rgba(139,124,255,0.10)] border border-[rgba(139,124,255,0.30)] flex items-center justify-center mb-3">
          <FileText className="w-4 h-4 text-[#8B7CFF]" />
        </div>
        <p className="text-sm font-medium text-[var(--app-fg)]">No visa fees or misc items</p>
        <p className="text-xs text-[var(--app-muted)] mt-0.5">Add visa application fees, insurance, or other charges</p>
        <div className="flex gap-2 mt-3">
          <Button type="button" size="sm" onClick={() => addItem('Visa Fees')}
            className="gap-1.5 h-8 text-xs bg-violet-600 hover:bg-[rgba(139,124,255,0.12)] text-white transition-colors duration-150">
            <FileText className="w-3.5 h-3.5" /> Add Visa Fee
          </Button>
          <Button type="button" size="sm" onClick={() => addItem('Misc')}
            variant="outline" className="gap-1.5 h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700 transition-colors duration-150">
            <Package className="w-3.5 h-3.5" /> Add Misc
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visaItems.map((item, idx) => {
        const isVisa = item.category === 'Visa Fees';
        const headerBg = isVisa ? 'bg-[rgba(139,124,255,0.10)] border-[rgba(139,124,255,0.30)]' : 'bg-slate-50 border-slate-100';
        const iconColor = isVisa ? 'text-[#8B7CFF]' : 'text-slate-500';
        const titleColor = isVisa ? 'text-[#8B7CFF]' : 'text-slate-700';
        const subtitleColor = isVisa ? 'text-[#8B7CFF]/70' : 'text-slate-500';
        const badgeCls = isVisa
          ? 'bg-[rgba(139,124,255,0.10)] text-[#8B7CFF] border border-[rgba(139,124,255,0.30)]'
          : 'bg-slate-100 text-slate-600 border border-slate-200';
        const cardBorder = isVisa ? 'border-[rgba(139,124,255,0.30)]' : 'border-slate-100';
        const amtLabelCls = isVisa ? 'text-[#8B7CFF]' : 'text-slate-500';

        return (
          <div key={item.id} className={`rounded-xl border ${cardBorder} overflow-hidden shadow-sm`}
            data-testid={`visa-item-${idx}`}>
            {/* Card Header */}
            <div className={`flex items-center justify-between px-3 py-2 ${headerBg} border-b`}>
              <div className="flex items-center gap-2">
                {isVisa
                  ? <FileText className={`w-3.5 h-3.5 ${iconColor}`} />
                  : <Package className={`w-3.5 h-3.5 ${iconColor}`} />}
                <span className={`text-xs font-semibold ${titleColor}`}>
                  {isVisa ? 'Visa Fee' : 'Misc'} {idx + 1}
                  {item.title && <span className={`ml-1.5 ${subtitleColor} font-normal`}>— {item.title}</span>}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeCls}`}>
                  {item.category}
                </span>
              </div>
              <button type="button" onClick={() => onRemove(item.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[var(--app-muted)] hover:text-red-500 transition-colors duration-150"
                data-testid={`visa-remove-${idx}`}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Card Body */}
            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-6 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Title</Label>
                  <input className={inp} value={item.title || ''}
                    onChange={e => handleField(item, 'title', e.target.value)}
                    placeholder={isVisa ? 'e.g. UAE Visa (2Y)' : 'e.g. Travel Insurance'} />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Description</Label>
                  <input className={inp} value={item.description || ''}
                    onChange={e => handleField(item, 'description', e.target.value)} placeholder="Optional notes" />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Qty</Label>
                  <input className={`${inp} text-center`} type="number" min="1" value={item.qty || 1}
                    onChange={e => handleField(item, 'qty', e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Unit Price</Label>
                  <input className={`${inp} text-right`} type="number" min="0" step="0.01" value={item.unit_price || 0}
                    onChange={e => handleField(item, 'unit_price', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 items-end pt-1 border-t border-[#f2f4f8]">
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Currency</Label>
                  <Select value={item.currency || baseCurrency} onValueChange={v => handleField(item, 'currency', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>ROE → {baseCurrency}</Label>
                  <input className={`${inp} text-right ${item.currency === baseCurrency ? 'bg-[#f2f4f8] text-[var(--app-muted)] cursor-not-allowed' : ''}`}
                    type="number" min="0" step="0.0001" value={item.roe_to_base || 1}
                    disabled={item.currency === baseCurrency}
                    onChange={e => handleField(item, 'roe_to_base', e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block" style={{ color: 'var(--app-muted)' }}>Total ({item.currency || baseCurrency})</Label>
                  <div className={`h-7 flex items-center px-2 rounded-md text-xs font-semibold justify-end [font-variant-numeric:tabular-nums] ${
                    isVisa ? 'bg-[rgba(139,124,255,0.10)] border border-[rgba(139,124,255,0.30)] text-[#8B7CFF]' : 'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}>
                    {fmt((parseFloat(item.unit_price) || 0) * (parseFloat(item.qty) || 1))}
                  </div>
                </div>
                <div>
                  <Label className={`text-[10px] mb-1 block font-semibold ${amtLabelCls}`}>Amt ({baseCurrency})</Label>
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
        <Button type="button" size="sm" onClick={() => addItem('Visa Fees')} variant="outline"
          className="flex-1 gap-1.5 h-8 text-xs border-dashed border-2 border-[rgba(139,124,255,0.30)] bg-transparent text-[#8B7CFF] hover:bg-[rgba(139,124,255,0.10)] hover:text-[#8B7CFF] hover:border-violet-300 transition-colors duration-150"
          data-testid="add-visa-btn">
          <FileText className="w-3.5 h-3.5" /> Add Visa Fee
        </Button>
        <Button type="button" size="sm" onClick={() => addItem('Misc')} variant="outline"
          className="flex-1 gap-1.5 h-8 text-xs border-dashed border-2 border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 transition-colors duration-150"
          data-testid="add-misc-btn">
          <Package className="w-3.5 h-3.5" /> Add Misc
        </Button>
      </div>
    </div>
  );
}
