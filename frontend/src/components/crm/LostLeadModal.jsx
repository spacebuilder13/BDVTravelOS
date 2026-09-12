import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { AlertTriangle } from 'lucide-react';

const LOST_REASONS = [
  'Price too high',
  'Competitor offer',
  'No response from client',
  'Client postponed trip',
  'Budget constraint',
  'Travel plans cancelled',
  'Found another agent',
  'Other'
];

export function LostLeadModal({ open, lead, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await onConfirm(reason, notes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Mark Lead as Lost
          </DialogTitle>
          <DialogDescription className="sr-only">Mark this lead as lost by selecting a reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-[#5b6475]">
            Marking{' '}
            <strong className="text-[#0b1220]">{lead?.client_name}</strong>&apos;s lead
            {lead?.destination ? ` (${lead.destination})` : ''} as Lost.
          </p>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Reason *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-sm" data-testid="lost-reason-select">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">
              Notes <span className="text-[#5b6475] font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Add any context about why this lead was lost..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              data-testid="lost-notes-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={loading || !reason}
            onClick={handleConfirm}
            data-testid="lost-confirm-btn"
          >
            {loading && (
              <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2 border-white" />
            )}
            Confirm Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LostLeadModal;
