import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { clientsAPI } from '../../services/api';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

export default function NewClientModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name) return;
    setLoading(true);
    try {
      const res = await clientsAPI.create(form);
      toast.success(`Client "${res.data.full_name}" created`);
      onCreated(res.data);
      setForm({ full_name: '', phone: '', email: '' });
    } catch (err) {
      toast.error('Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" style={{ color: 'var(--brand-accent)' }} />
            New Client
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new client profile with basic contact information.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Full Name *</label>
            <Input
              placeholder="Client full name"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              required
              className="h-9 text-sm"
              data-testid="new-client-name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Phone</label>
            <Input
              placeholder="Mobile number"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className="h-9 text-sm"
              data-testid="new-client-phone"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Email</label>
            <Input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !form.full_name}
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
              data-testid="new-client-submit"
            >
              {loading && (
                <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2"
                  style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
              )}
              Create Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
