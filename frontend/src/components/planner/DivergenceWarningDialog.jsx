// ── DivergenceWarningDialog.jsx — Pass 3 Divergence Rule ──────────────────────
// Shown when a price-sensitive field is edited after an itinerary has been
// generated. Forces the agent to either discard the edit or create a revised
// quote (which flags the divergence on the trip record).
import React from 'react';
import { AlertTriangle, FileEdit, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';

/**
 * Props:
 *  open              {bool}    – dialog visibility
 *  onClose           {fn}      – called when user cancels / dismisses
 *  onCreateRevised   {fn}      – called when user confirms "Create Revised Quote"
 *  fieldName         {string}  – e.g. "net_cost" or "sell_price"
 *  componentTitle    {string}  – name of the component being edited
 */
export function DivergenceWarningDialog({
  open,
  onClose,
  onCreateRevised,
  fieldName = 'price',
  componentTitle = 'this component',
}) {
  const fieldLabel =
    fieldName === 'net_cost' ? 'Net Cost'
    : fieldName === 'sell_price' ? 'Sell Price'
    : fieldName;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          background: 'var(--qb-modal, #0f1a33)',
          border: '1px solid rgba(232,168,48,0.35)',
          boxShadow: '0 0 0 1px rgba(232,168,48,0.12), 0 24px 48px rgba(0,0,0,0.6)',
        }}
        data-testid="divergence-warning-dialog"
      >
        <DialogHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* Warning icon */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
              style={{ background: 'rgba(232,168,48,0.15)', border: '1px solid rgba(232,168,48,0.30)' }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: '#E8A830' }} />
            </div>
            <div>
              <DialogTitle
                className="text-base leading-snug mb-1"
                style={{ color: 'var(--app-fg)', fontFamily: 'Georgia, serif' }}
                data-testid="divergence-dialog-title"
              >
                Itinerary Locked — Price Change Detected
              </DialogTitle>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                This trip already has a generated itinerary. Editing{' '}
                <span className="font-semibold" style={{ color: '#E8A830' }}>{fieldLabel}</span>{' '}
                on <span className="font-semibold" style={{ color: 'var(--app-dim)' }}>"{componentTitle}"</span>{' '}
                will create a financial divergence between the confirmed quote and the current components.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Info box */}
        <div
          className="rounded-xl px-4 py-3 mb-4 text-xs leading-relaxed"
          style={{
            background: 'rgba(232,168,48,0.07)',
            border: '1px solid rgba(232,168,48,0.20)',
            color: 'var(--app-dim)',
          }}
        >
          To maintain financial integrity, you must create a{' '}
          <strong style={{ color: '#E8A830' }}>revised quote</strong> for this change.
          The system will save your edit, flag the divergence, and open the Quote Builder
          so you can issue a revised quotation to the client.
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ color: 'var(--app-muted)', borderColor: 'var(--stroke-soft)' }}
            data-testid="divergence-cancel-btn"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Discard Change
          </Button>
          <Button
            onClick={onCreateRevised}
            style={{ background: '#E8A830', color: '#0a1628', fontWeight: 600 }}
            data-testid="divergence-create-revised-btn"
          >
            <FileEdit className="w-3.5 h-3.5 mr-1.5" />
            Create Revised Quote
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
