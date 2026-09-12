import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ITEM_TYPES = ['Hotel', 'Flight', 'Transfer', 'Activity', 'Meal', 'Visa', 'Other'];
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const EMPTY_FORM = { name: '', package_price: '', show_itemised: false, items: [] };

export function PackageCostModal({ open, onClose, editPackage, onSave, baseCurrency = 'INR' }) {
  const [form, setForm] = useState(() => {
    if (editPackage) {
      return {
        name: editPackage.title || '',
        package_price: editPackage.unit_price || '',
        show_itemised: editPackage.show_itemised || false,
        items: editPackage.package_items || [],
      };
    }
    return EMPTY_FORM;
  });

  React.useEffect(() => {
    if (open) {
      setForm(editPackage ? {
        name: editPackage.title || '',
        package_price: editPackage.unit_price || '',
        show_itemised: editPackage.show_itemised || false,
        items: editPackage.package_items || [],
      } : EMPTY_FORM);
    }
  }, [open, editPackage]);

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { id: newId(), name: '', item_type: 'Hotel', internal_cost: 0 }]
  }));

  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));

  const updateItem = (id, field, value) => setForm(f => ({
    ...f,
    items: f.items.map(i => i.id === id ? { ...i, [field]: value } : i)
  }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Package name is required'); return; }
    const price = parseFloat(form.package_price);
    if (!price || price <= 0) { toast.error('Package price must be > 0'); return; }
    const internalTotal = form.items.reduce((s, i) => s + (parseFloat(i.internal_cost) || 0), 0);
    onSave({
      id: editPackage?.id || newId(),
      category: 'Package',
      title: form.name,
      description: form.items.map(i => i.name).filter(Boolean).join(' + '),
      qty: 1,
      unit_price: price,
      currency: baseCurrency,
      roe_to_base: 1.0,
      package_items: form.items,
      show_itemised: form.show_itemised,
      internal_total: internalTotal,
    });
    onClose();
  };

  const inp = 'h-7 text-xs px-2 py-1 bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border border-[var(--qb-field-border)] hover:border-[var(--qb-field-border-hover)] rounded-md focus:outline-none focus:ring-1 focus:ring-[rgba(232,168,48,0.5)] w-full transition-colors duration-150';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" data-testid="package-cost-modal">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-[#c9a84c]" /> Package Cost
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Package name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1.5 block">Package Name *</Label>
              <input className={`${inp} h-8 text-sm`} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 3N Dubai City Package"
                data-testid="package-name-input" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Package Items (Internal)</Label>
              <button type="button" onClick={addItem}
                className="h-6 px-2 text-xs rounded-md border flex items-center gap-1" style={{ borderColor: 'rgba(232,168,48,0.35)', color: 'var(--cta)', backgroundColor: 'rgba(232,168,48,0.08)' }}>
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            {form.items.length === 0 ? (
              <p className="text-xs text-center py-4 rounded-lg border border-dashed" style={{ color: 'var(--app-muted)', borderColor: 'rgba(232,168,48,0.25)' }}>No items added. Internal cost breakdown for staff only.</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-2 pr-2">
                  {form.items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        {idx === 0 && <Label className="text-[10px] text-[#5b6475] mb-1 block">Item Name</Label>}
                        <input className={inp} value={item.name}
                          onChange={e => updateItem(item.id, 'name', e.target.value)}
                          placeholder="e.g. JW Marriott 2 nights" />
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <Label className="text-[10px] text-[#5b6475] mb-1 block">Type</Label>}
                        <Select value={item.item_type} onValueChange={v => updateItem(item.id, 'item_type', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        {idx === 0 && <Label className="text-[10px] text-[#5b6475] mb-1 block">Internal Cost</Label>}
                        <input className={`${inp} text-right`} type="number" min="0"
                          value={item.internal_cost || 0}
                          onChange={e => updateItem(item.id, 'internal_cost', e.target.value)}
                          placeholder="0" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {idx === 0 && <div className="h-5 mb-1" />}
                        <button type="button" onClick={() => removeItem(item.id)}
                          className="w-6 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#5b6475] hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Package price + toggle */}
          <div className="rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/[0.05] p-3 space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Package Price ({baseCurrency}) — Shown to Client *</Label>
              <input className={`${inp} h-9 text-base text-right font-bold`} type="number" min="0" step="0.01"
                value={form.package_price}
                onChange={e => setForm(f => ({ ...f, package_price: e.target.value }))}
                placeholder="0.00"
                data-testid="package-price-input" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#0b1220]">Show itemised breakdown to client</p>
                <p className="text-[10px] text-[#5b6475]">Show individual items on client PDF/quote</p>
              </div>
              <Switch checked={form.show_itemised} onCheckedChange={v => setForm(f => ({ ...f, show_itemised: v }))}
                data-testid="package-show-itemised-toggle" />
            </div>
            {form.items.length > 0 && (
              <div className="flex justify-between text-xs border-t border-[#c9a84c]/20 pt-2">
                <span className="text-[#5b6475]">Internal total</span>
                <span className="font-semibold text-[#5b6475]">
                  {baseCurrency} {form.items.reduce((s, i) => s + (parseFloat(i.internal_cost) || 0), 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}
                </span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}
            data-testid="package-save-btn"
            style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
            {editPackage ? 'Save Changes' : 'Add Package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
