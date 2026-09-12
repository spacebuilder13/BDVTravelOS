import React, { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '../ui/sheet';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { quotesAPI, itineraryAPI } from '../../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  X, FileText, FileSpreadsheet, Edit2, Trash2, Send,
  CheckCircle, XCircle, MapPin, Users, Calendar, Phone, Mail,
  Route, ExternalLink
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const STATUS_CFG = {
  Draft: { color: '#5b6475', bg: '#f2f4f8' },
  Sent: { color: '#2563eb', bg: '#eff6ff' },
  Accepted: { color: '#1f9d55', bg: '#f0fdf4' },
  Rejected: { color: '#d64545', bg: '#fff1f1' },
};

const CAT_EMOJI = {
  Hotels: '🏨', Flights: '✈️', 'Visa Fees': '📋',
  Transfers: '🚗', Sightseeing: '🗺️', Misc: '📦',
};

const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    const p = parseISO(d);
    return isValid(p) ? format(p, 'dd MMM yyyy') : d;
  } catch { return d; }
};

export function QuoteDetailSheet({ quote, open, onClose, onUpdate, onEdit, onDelete }) {
  const [exporting, setExporting] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [linkedItinerary, setLinkedItinerary] = useState(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch linked itinerary details whenever it changes
  useEffect(() => {
    if (!open || !quote?.itinerary_id) {
      setLinkedItinerary(null);
      return;
    }
    setItineraryLoading(true);
    itineraryAPI.get(quote.itinerary_id)
      .then(res => setLinkedItinerary(res.data))
      .catch(() => setLinkedItinerary(null))
      .finally(() => setItineraryLoading(false));
  }, [open, quote?.itinerary_id]);

  if (!quote) return null;

  const sc = STATUS_CFG[quote.status] || STATUS_CFG.Draft;

  const handleStatusChange = async (newStatus) => {
    setChangingStatus(true);
    try {
      const res = await quotesAPI.updateStatus(quote.id, newStatus);
      onUpdate(res.data);
      toast.success(`Status updated to ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const res = await quotesAPI.exportPdf(quote.id);
      downloadFile(res.data, `${quote.quote_no}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const res = await quotesAPI.exportExcel(quote.id);
      downloadFile(res.data, `${quote.quote_no}.xlsx`);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error('Failed to generate Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${quote.quote_no}? This cannot be undone.`)) return;
    try {
      await quotesAPI.delete(quote.id);
      onDelete(quote.id);
      onClose();
      toast.success(`${quote.quote_no} deleted`);
    } catch (e) {
      toast.error('Failed to delete quote');
    }
  };

  // Group items by category
  const grouped = {};
  (quote.items || []).forEach(item => {
    const cat = item.category || 'Misc';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[520px] max-w-full p-0 flex flex-col border-l border-[var(--border)]"
        data-testid="quote-detail-sheet"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-[var(--border)] flex-shrink-0 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-bold text-[#0b1220] font-mono">
                  {quote.quote_no}
                </SheetTitle>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ color: sc.color, backgroundColor: sc.bg }}
                  data-testid="quote-detail-status-badge"
                >
                  {quote.status}
                </span>
              </div>
              <p className="text-xs text-[#5b6475] mt-0.5">
                {quote.quote_type} · {fmtDate(quote.created_at)}
                {quote.created_by_name ? ` · by ${quote.created_by_name}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-[#5b6475]" />
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">

            {/* Client + Travel cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f7f8fb] rounded-xl p-3 border border-[#e6e9f0]">
                <p className="text-[9px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2">Client</p>
                <p className="text-sm font-semibold text-[#0b1220]">{quote.client_name || '—'}</p>
                {quote.phone && (
                  <p className="text-xs text-[#5b6475] mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {quote.phone}
                  </p>
                )}
                {quote.email && (
                  <p className="text-xs text-[#5b6475] mt-0.5 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{quote.email}</span>
                  </p>
                )}
              </div>
              <div className="bg-[#f7f8fb] rounded-xl p-3 border border-[#e6e9f0]">
                <p className="text-[9px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2">Travel</p>
                <p className="text-sm font-semibold text-[#0b1220] flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#c9a84c' }} />
                  {quote.destination || '—'}
                </p>
                <p className="text-xs text-[#5b6475] mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {fmtDate(quote.travel_date)}
                  {quote.return_date ? ` → ${fmtDate(quote.return_date)}` : ''}
                </p>
                <p className="text-xs text-[#5b6475] mt-0.5 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {quote.pax_adults}A{quote.pax_children > 0 ? ` + ${quote.pax_children}C` : ''}
                </p>
              </div>
            </div>

            {/* Linked Itinerary */}
            {(quote.itinerary_id || itineraryLoading) && (
              <div
                className="rounded-xl border p-3 flex items-center justify-between gap-3"
                style={{ backgroundColor: 'rgba(232,168,48,0.06)', borderColor: 'rgba(232,168,48,0.30)' }}
                data-testid="quote-linked-itinerary-card"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(232,168,48,0.18)', border: '1px solid rgba(232,168,48,0.35)' }}
                  >
                    <Route className="w-3.5 h-3.5" style={{ color: '#c9a84c' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#c9a84c' }}>
                      Linked Itinerary
                    </p>
                    {itineraryLoading ? (
                      <p className="text-xs text-[#5b6475]">Loading…</p>
                    ) : linkedItinerary ? (
                      <p className="text-xs font-semibold text-[#0b1220] truncate">
                        {linkedItinerary.name || linkedItinerary.title || 'Untitled'}
                        {linkedItinerary.destination ? (
                          <span className="font-normal text-[#5b6475]"> · {linkedItinerary.destination}</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-xs text-[#5b6475]">Itinerary not found</p>
                    )}
                  </div>
                </div>
                {linkedItinerary && (
                  <button
                    onClick={() => { onClose(); navigate('/app/itinerary', { state: { openItineraryId: quote.itinerary_id } }); }}
                    data-testid="quote-open-itinerary-btn"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-colors duration-150 hover:bg-[rgba(232,168,48,0.15)]"
                    style={{ color: '#c9a84c', border: '1px solid rgba(232,168,48,0.35)' }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </button>
                )}
              </div>
            )}

            {/* Items by Category */}
            {Object.keys(grouped).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2">Package Items</p>
                <div className="space-y-3">
                  {Object.entries(grouped).map(([cat, catItems]) => (
                    <div key={cat} className="rounded-xl border border-[#e6e9f0] overflow-hidden">
                      <div className="px-3 py-2 bg-[#f2f4f8] flex items-center gap-2">
                        <span className="text-sm">{CAT_EMOJI[cat] || '📦'}</span>
                        <span className="text-xs font-semibold text-[#0b1220]">{cat}</span>
                        <span className="ml-auto text-xs text-[#5b6475]">
                          {catItems.length} item{catItems.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="divide-y divide-[#f2f4f8]">
                        {catItems.map((item, i) => (
                          <div key={item.id || i} className="px-3 py-2.5 bg-white">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#0b1220]">{item.title}</p>
                                {item.description && (
                                  <p className="text-[10px] text-[#5b6475] mt-0.5">{item.description}</p>
                                )}
                                <p className="text-[10px] text-[#5b6475] mt-0.5">
                                  Qty: {item.qty} × {item.currency} {fmt(item.unit_price)}
                                  {item.currency !== quote.base_currency
                                    ? ` (ROE: ${parseFloat(item.roe_to_base).toFixed(4)})`
                                    : ''}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[11px] text-[#5b6475]">
                                  {item.currency} {fmt(item.amount)}
                                </p>
                                <p className="text-xs font-semibold text-[#0b1220]">
                                  {quote.base_currency} {fmt(item.amount_base)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!quote.items || quote.items.length === 0) && (
              <div className="text-center py-6 text-xs text-[#5b6475] bg-[#f7f8fb] rounded-xl border border-dashed border-[#e6e9f0]">
                No items added to this quote.
              </div>
            )}

            {/* Cost Breakdown + Grand Total */}
            {quote.operating_cost !== undefined && quote.operating_cost !== null ? (
              <div className="rounded-xl border border-[#e6e9f0] overflow-hidden">
                <div className="px-3 py-2 bg-[#f2f4f8] border-b border-[#e6e9f0]">
                  <p className="text-[9px] uppercase tracking-widest text-[#5b6475] font-semibold">Cost Breakdown</p>
                </div>
                <div className="divide-y divide-[#f2f4f8] bg-white">
                  {[
                    { label: 'Operating Cost (OC)', value: quote.operating_cost, bold: false },
                    {
                      label: quote.markup_type === 'percentage'
                        ? `Markup (${parseFloat(quote.markup_value || 0).toFixed(1)}% on OC)`
                        : 'Markup (Fixed Amount)',
                      value: quote.markup_amount, bold: false
                    },
                    { label: 'Sub-total', value: quote.subtotal, bold: true },
                    { label: `GST (${parseFloat(quote.gst_rate || 0).toFixed(1)}%)`, value: quote.gst_amount, bold: false },
                    ...(quote.tcs_enabled ? [{ label: `TCS (${parseFloat(quote.tcs_rate || 0).toFixed(1)}%)`, value: quote.tcs_amount, bold: false }] : []),
                  ].map(({ label, value, bold }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <span className={`text-xs ${bold ? 'font-semibold text-[#0b1220]' : 'text-[#5b6475]'}`}>{label}</span>
                      <span className={`text-xs [font-variant-numeric:tabular-nums] ${bold ? 'font-bold text-[#0b1220]' : 'font-medium text-[#5b6475]'}`}>
                        {quote.base_currency} {fmt(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="rounded-b-xl px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: '#0a1628' }}
                  data-testid="quote-detail-grand-total"
                >
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#c9a84c' }}>Grand Total</p>
                    <p className="text-[10px] text-white/50">{quote.base_currency}</p>
                  </div>
                  <p className="text-xl font-bold text-white [font-variant-numeric:tabular-nums]">
                    {fmt(quote.grand_total_base)}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl px-5 py-4"
                style={{ backgroundColor: '#0a1628' }}
                data-testid="quote-detail-grand-total"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#c9a84c' }}>
                      Grand Total
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">Base: {quote.base_currency}</p>
                  </div>
                  <p className="text-2xl font-bold text-white [font-variant-numeric:tabular-nums]">
                    {fmt(quote.grand_total_base)}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div className="bg-[#fffbeb] rounded-xl border border-[#e7d7a3] p-3">
                <p className="text-[10px] uppercase tracking-widest text-[#b7791f] font-semibold mb-1">Notes / Terms</p>
                <p className="text-xs text-[#0b1220]">{quote.notes}</p>
              </div>
            )}

            {quote.validity_date && (
              <p className="text-xs text-[#5b6475] text-center">
                Valid until: <span className="font-medium text-[#0b1220]">{fmtDate(quote.validity_date)}</span>
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Action Bar */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex-shrink-0 bg-white space-y-2.5">
          {/* Status workflow buttons */}
          {quote.status === 'Draft' && (
            <Button
              size="sm" variant="outline"
              onClick={() => handleStatusChange('Sent')}
              disabled={changingStatus}
              className="w-full text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
              data-testid="quote-mark-sent-btn"
            >
              <Send className="w-3 h-3" /> Mark as Sent
            </Button>
          )}
          {quote.status === 'Sent' && (
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline"
                onClick={() => handleStatusChange('Accepted')}
                disabled={changingStatus}
                className="flex-1 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50"
                data-testid="quote-mark-accepted-btn"
              >
                <CheckCircle className="w-3 h-3" /> Accepted
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => handleStatusChange('Rejected')}
                disabled={changingStatus}
                className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                data-testid="quote-mark-rejected-btn"
              >
                <XCircle className="w-3 h-3" /> Rejected
              </Button>
            </div>
          )}
          {(quote.status === 'Accepted' || quote.status === 'Rejected') && (
            <Button
              size="sm" variant="outline"
              onClick={() => handleStatusChange('Draft')}
              disabled={changingStatus}
              className="w-full text-xs gap-1 text-[#5b6475] hover:bg-[#f2f4f8]"
              data-testid="quote-revert-draft-btn"
            >
              Revert to Draft
            </Button>
          )}

          {/* Export + Edit + Delete */}
          <div className="grid grid-cols-4 gap-2">
            <Button
              size="sm" variant="outline"
              onClick={handleExportPdf}
              disabled={!!exporting}
              className="text-xs gap-1"
              data-testid="quote-export-pdf-btn"
            >
              <FileText className="w-3 h-3" />
              {exporting === 'pdf' ? '...' : 'PDF'}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={handleExportExcel}
              disabled={!!exporting}
              className="text-xs gap-1"
              data-testid="quote-export-excel-btn"
            >
              <FileSpreadsheet className="w-3 h-3" />
              {exporting === 'excel' ? '...' : 'Excel'}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => onEdit(quote)}
              className="text-xs gap-1"
              data-testid="quote-edit-btn"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={handleDelete}
              className="text-xs gap-1 border-red-100 text-red-600 hover:bg-red-50"
              data-testid="quote-delete-btn"
            >
              <Trash2 className="w-3 h-3" /> Del
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
