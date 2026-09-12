import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { RefreshCw, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { sourcesAPI } from '../../services/sourcesAPI';

const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'THB', 'MYR', 'LKR', 'NPR'];

const inputCls = [
  'h-9 text-sm rounded-[var(--radius-input)]',
  'bg-[var(--surface)] text-[var(--app-fg)]',
  'placeholder:text-[var(--app-muted)]',
  'border-[1.5px] border-[var(--stroke)]',
  'focus-visible:ring-0 focus-visible:border-[var(--cta)]',
  'transition-colors',
].join(' ');

/**
 * AttachSourceDialog — modal to capture a research source and attach it to
 * a component (leg/stay) or just a trip.
 *
 * Props:
 *   open           — boolean
 *   onClose        — () => void
 *   tripId         — string
 *   componentId    — string | null
 *   componentType  — "leg" | "stay" | null
 *   onSaved        — (newSource) => void
 */
export function AttachSourceDialog({ open, onClose, tripId, componentId, componentType, onSaved }) {
  const [form, setForm] = useState({
    url: '',
    captured_price: '',
    captured_currency: 'INR',
    screenshot_url: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ url: '', captured_price: '', captured_currency: 'INR', screenshot_url: '', notes: '' });
    }
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.url.trim()) { toast.error('URL is required'); return; }
    let url = form.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    setSaving(true);
    try {
      const payload = {
        trip_id:           tripId,
        component_id:      componentId || null,
        component_type:    componentType || null,
        url,
        captured_price:    form.captured_price !== '' ? Number(form.captured_price) : null,
        captured_currency: form.captured_currency,
        screenshot_url:    form.screenshot_url.trim() || null,
        notes:             form.notes.trim() || null,
      };
      const created = await sourcesAPI.create(payload);
      toast.success('Source saved');
      onSaved?.(created);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--stroke)',
          borderRadius: 'var(--radius-modal)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}
          >
            <Link2 className="w-4 h-4" />
            Attach Research Source
          </DialogTitle>
          <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {componentType ? `Linking to this ${componentType}` : 'Linking to trip'}
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* URL */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
              Source URL *
            </label>
            <Input
              data-testid="attach-source-url"
              placeholder="https://booking.com/hotel/..."
              value={form.url}
              onChange={e => set('url', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Price + Currency */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
                Price (optional)
              </label>
              <Input
                data-testid="attach-source-price"
                type="number"
                placeholder="e.g. 8500"
                value={form.captured_price}
                onChange={e => set('captured_price', e.target.value)}
                className={inputCls}
              />
            </div>
            <div style={{ width: '96px' }}>
              <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
                Currency
              </label>
              <select
                data-testid="attach-source-currency"
                value={form.captured_currency}
                onChange={e => set('captured_currency', e.target.value)}
                style={{
                  height: '36px',
                  width: '100%',
                  background: 'var(--surface)',
                  color: 'var(--app-fg)',
                  border: '1.5px solid var(--stroke)',
                  borderRadius: 'var(--radius-input)',
                  padding: '0 8px',
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
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
              Screenshot URL (optional)
            </label>
            <Input
              data-testid="attach-source-screenshot"
              placeholder="https://..."
              value={form.screenshot_url}
              onChange={e => set('screenshot_url', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted)' }}>
              Notes (optional)
            </label>
            <Textarea
              data-testid="attach-source-notes"
              placeholder="Price includes breakfast, checked on 25 Jun..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className={inputCls + ' h-auto py-2 resize-none'}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            data-testid="attach-source-cancel"
            className="rounded-full"
            style={{ color: 'var(--app-muted)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="attach-source-save"
            className="rounded-full"
            style={{ backgroundColor: 'var(--cta)', color: '#050A14', fontWeight: 600 }}
          >
            {saving
              ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              : <Link2 className="w-4 h-4 mr-2" />
            }
            Save Source
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
