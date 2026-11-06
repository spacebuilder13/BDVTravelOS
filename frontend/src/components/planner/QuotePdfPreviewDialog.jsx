import React, { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';

/**
 * Preview of the generated internal trip summary PDF.
 * The blob URL is created when a blob is supplied and revoked when the dialog
 * closes (blob -> null) or unmounts.
 */
export function QuotePdfPreviewDialog({ blob, filename, onClose }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) { setUrl(null); return undefined; }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={!!blob} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-4xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4"
        style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
        data-testid="quote-pdf-preview"
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--app-fg)' }}>Internal Trip Summary - Preview</DialogTitle>
          <DialogDescription style={{ color: 'var(--app-muted)' }}>
            Internal use only. Reflects the quote as it was when you clicked Download PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-white">
          {url && (
            <iframe
              title="Internal trip summary preview"
              src={url}
              className="w-full h-full border-0"
              data-testid="quote-pdf-iframe"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs mr-auto"
              style={{ color: 'var(--app-muted)' }}
            >
              <ExternalLink className="w-3 h-3" /> Open in new tab
            </a>
          )}
          <Button type="button" variant="outline" onClick={onClose} className="h-8 px-4 text-xs" data-testid="quote-pdf-close-btn">
            Close
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!url}
            className="h-8 px-4 text-xs"
            style={{ background: 'var(--cta)', color: 'var(--app-bg)' }}
            data-testid="quote-pdf-download-btn"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
