import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { enquiriesAPI } from '../../services/api';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';

const INITIAL = {
  client_name: '', phone: '', email: '', destination: '',
  travel_date: '', return_date: '', pax_adults: 1, pax_children: 0,
  budget: '', travel_type: 'Leisure', service_type: 'Tour',
  source: 'Walk-in', pipeline_stage: 'New', notes: '', company: 'BDVV'
};

export function LeadIntakeForm({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.phone || !form.destination) return;
    setLoading(true);
    try {
      const res = await enquiriesAPI.create(form);
      onCreated(res.data);
      setForm(INITIAL);
    } catch (err) {
      toast.error('Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: 'var(--brand-accent)' }} />
            New Lead
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new lead by entering client and trip details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Required Section */}
          <div className="bg-[#f7f8fb] rounded-xl p-4 space-y-3 border border-gray-100">
            <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold">
              Essential Info
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Client Name *</label>
                <Input
                  placeholder="Full name"
                  value={form.client_name}
                  onChange={e => set('client_name', e.target.value)}
                  required
                  className="h-9 text-sm"
                  data-testid="intake-client-name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Phone *</label>
                <Input
                  placeholder="Mobile number"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  required
                  className="h-9 text-sm"
                  data-testid="intake-phone"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Destination *</label>
              <Input
                placeholder="e.g. Dubai, Thailand, Europe..."
                value={form.destination}
                onChange={e => set('destination', e.target.value)}
                required
                className="h-9 text-sm"
                data-testid="intake-destination"
              />
            </div>
          </div>

          {/* Trip Details */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold">
              Trip Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Email</label>
                <Input
                  type="email" placeholder="Email address"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Travel Date</label>
                <Input
                  type="date" value={form.travel_date}
                  onChange={e => set('travel_date', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Adults</label>
                <Input type="number" min="1" max="30" value={form.pax_adults}
                  onChange={e => set('pax_adults', parseInt(e.target.value) || 1)}
                  className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Children</label>
                <Input type="number" min="0" max="20" value={form.pax_children}
                  onChange={e => set('pax_children', parseInt(e.target.value) || 0)}
                  className="h-9 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Budget (&#8377;)</label>
                <Input placeholder="e.g. 1,50,000" value={form.budget}
                  onChange={e => set('budget', e.target.value)}
                  className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Service</label>
                <Select value={form.service_type} onValueChange={v => set('service_type', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Tour', 'Flight', 'Visa', 'Passport', 'Insurance'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Source</label>
                <Select value={form.source} onValueChange={v => set('source', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['WhatsApp', 'Walk-in', 'Referral', 'Online', 'Trade Show', 'Other'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Travel Type</label>
                <Select value={form.travel_type} onValueChange={v => set('travel_type', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Honeymoon', 'Family', 'Group', 'Corporate', 'Pilgrimage', 'Adventure', 'Leisure'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Notes</label>
            <Textarea
              placeholder="Additional requirements, special requests..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !form.client_name || !form.phone || !form.destination}
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
              data-testid="intake-submit"
            >
              {loading && (
                <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2"
                  style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
              )}
              Create Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LeadIntakeForm;
