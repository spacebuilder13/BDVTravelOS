import React, { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { LEAD_STAGES, STAGE_MAP } from '../../constants/stages';
import { LostLeadModal } from './LostLeadModal';
import { enquiriesAPI, staffAPI, quotesAPI, itineraryAPI } from '../../services/api';
import { toast } from 'sonner';
import { format, parseISO, isValid, isPast } from 'date-fns';
import { X, MapPin, Users, Wallet, Phone, Clock, AlertTriangle,
  UserCheck, Link2, MessageSquare, Send, UserPlus,
  FileText, PlusCircle, ChevronRight, ExternalLink, FolderOpen, ChevronDown, Map
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QuoteBuilderModal } from '../quotes/QuoteBuilderModal';
import { ClientDocumentsPanel } from './ClientDocumentsPanel';

function StagePill({ stage, current, onClick }) {
  const color = STAGE_MAP[stage];
  const isActive = stage === current;
  return (
    <button
      type="button"
      onClick={() => onClick(stage)}
      className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2"
      style={isActive
        ? { backgroundColor: color?.badge, color: 'white', boxShadow: `0 1px 4px ${color?.badge}60` }
        : { backgroundColor: color?.header, color: color?.text, border: `1px solid ${color?.border}`, opacity: 0.7 }
      }
      data-testid={`crm-stage-pill-${stage.toLowerCase().replace(/[^a-z]/g, '-')}`}
    >
      {stage}
    </button>
  );
}

const QUOTE_STATUS_COLORS = {
  Draft:    { bg: '#f2f4f8', text: '#5b6475' },
  Sent:     { bg: '#dbeafe', text: '#1d4ed8' },
  Accepted: { bg: '#dcfce7', text: '#16a34a' },
  Rejected: { bg: '#fee2e2', text: '#dc2626' },
  Expired:  { bg: '#fef9c3', text: '#ca8a04' },
};
function QuoteStatusBadge({ status }) {
  const c = QUOTE_STATUS_COLORS[status] || QUOTE_STATUS_COLORS.Draft;
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {status}
    </span>
  );
}


export function LeadDetailPanel({ lead, clients, onClose, onUpdate, onRefreshClients }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [localLead, setLocalLead] = useState(lead);
  const [linkMode, setLinkMode] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  // Quotes integration
  const [linkedQuotes, setLinkedQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showClientDocs, setShowClientDocs] = useState(false);
  // Itineraries
  const [linkedItineraries, setLinkedItineraries] = useState([]);

  useEffect(() => {
    setLocalLead(lead);
    setLinkMode(false);
    loadNotes(lead.id);
    loadLinkedQuotes(lead.id);
    loadLinkedItineraries(lead.id);
  }, [lead.id]);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadNotes = async (id) => {
    try {
      const res = await enquiriesAPI.getNotes(id);
      setNotes(res.data);
    } catch (e) { /* silent */ }
  };

  const loadLinkedQuotes = async (id) => {
    setLoadingQuotes(true);
    try {
      const res = await quotesAPI.list({ enquiry_id: id });
      setLinkedQuotes(res.data || []);
    } catch { /* silent */ } finally {
      setLoadingQuotes(false);
    }
  };

  const loadLinkedItineraries = async (id) => {
    try {
      const res = await itineraryAPI.list({ enquiry_id: id });
      setLinkedItineraries(res.data || []);
    } catch { /* silent */ }
  };

  const loadStaff = async () => {
    try {
      const res = await staffAPI.list();
      setStaffList(res.data);
    } catch (e) { /* silent */ }
  };

  const handleStageChange = async (stage) => {
    if (stage === 'Lost') {
      setShowLostModal(true);
      return;
    }
    try {
      const res = await enquiriesAPI.updateStage(localLead.id, stage);
      setLocalLead(res.data);
      onUpdate(res.data);
      toast.success(`Stage → ${stage}`);
    } catch (e) {
      toast.error('Failed to update stage');
    }
  };

  const handleFollowupChange = async (val) => {
    try {
      const isoVal = val ? new Date(val).toISOString() : null;
      const res = await enquiriesAPI.updateFollowup(localLead.id, isoVal);
      setLocalLead(res.data);
      onUpdate(res.data);
      toast.success(val ? 'Follow-up scheduled' : 'Follow-up cleared');
    } catch (e) {
      toast.error('Failed to update follow-up');
    }
  };

  const handleAssign = async (staffId, staffName) => {
    try {
      const res = await enquiriesAPI.assign(localLead.id, staffId || null, staffName || null);
      setLocalLead(res.data);
      onUpdate(res.data);
      toast.success(staffName ? `Assigned to ${staffName}` : 'Unassigned');
    } catch (e) {
      toast.error('Failed to assign');
    }
  };

  const handleLinkClient = async (clientId) => {
    try {
      const res = await enquiriesAPI.linkClient(localLead.id, clientId);
      setLocalLead(res.data);
      onUpdate(res.data);
      setLinkMode(false);
      setClientSearch('');
      toast.success(clientId ? 'Client linked' : 'Client unlinked');
    } catch (e) {
      toast.error('Failed to update client link');
    }
  };

  const handleMarkLost = async (reason, lostNotes) => {
    try {
      const res = await enquiriesAPI.markLost(localLead.id, reason, lostNotes);
      setLocalLead(res.data);
      onUpdate(res.data);
      setShowLostModal(false);
      toast.success('Lead marked as Lost');
    } catch (e) {
      toast.error('Failed to mark as lost');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await enquiriesAPI.addNote(localLead.id, newNote.trim());
      setNewNote('');
      await loadNotes(localLead.id);
      toast.success('Note added');
    } catch (e) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const linkedClient = clients.find(c => c.id === localLead?.client_id);
  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    return c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const isFollowupOverdue = localLead?.followup_at &&
    !['Converted', 'Lost'].includes(localLead?.pipeline_stage) &&
    (() => { try { return isPast(parseISO(localLead.followup_at)); } catch { return false; } })();

  const followupInputVal = localLead?.followup_at
    ? (() => { try { return parseISO(localLead.followup_at).toISOString().slice(0, 16); } catch { return ''; } })()
    : '';

  return (
    <>
      <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-[480px] max-w-full p-0 flex flex-col border-l border-[var(--border)]"
          data-testid="crm-lead-detail-panel"
        >
          {/* Header */}
          <SheetHeader className="px-5 py-4 border-b border-[var(--border)] flex-shrink-0 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-bold text-[#0b1220] truncate">
                  {localLead?.client_name}
                </SheetTitle>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} />
                  <span className="text-xs text-[#5b6475]">{localLead?.destination}</span>
                  {localLead?.travel_date && (
                    <span className="text-xs text-[#5b6475]">
                      · {(() => {
                        try {
                          const d = parseISO(localLead.travel_date);
                          return isValid(d) ? format(d, 'dd MMM yyyy') : localLead.travel_date;
                        } catch { return localLead.travel_date; }
                      })()}
                    </span>
                  )}
                </div>
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
            <div className="p-5 space-y-5">

              {/* Quick Info */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Phone, label: 'Phone', value: localLead?.phone || '—' },
                  { icon: Users, label: 'Pax', value: `${localLead?.pax_adults || 1}A${localLead?.pax_children > 0 ? `+${localLead.pax_children}C` : ''}` },
                  { icon: Wallet, label: 'Budget', value: localLead?.budget ? `\u20B9${localLead.budget}` : '—' },
                ].map(info => (
                  <div key={info.label} className="bg-[#f7f8fb] rounded-xl p-3 border border-gray-100">
                    <info.icon className="w-3 h-3 text-[#5b6475] mb-1.5" />
                    <p className="text-[9px] text-[#5b6475] uppercase tracking-wide">{info.label}</p>
                    <p className="text-xs font-semibold text-[#0b1220] truncate mt-0.5">{info.value}</p>
                  </div>
                ))}
              </div>

              {/* WhatsApp Quick-Action */}
              {localLead?.phone && (() => {
                const normalized = localLead.phone.replace(/[\s\-\(\)\+]/g, '');
                const waNum = normalized.startsWith('0') ? '91' + normalized.slice(1) : normalized;
                return (
                  <a
                    href={`https://wa.me/${waNum}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors duration-150 w-full text-xs font-medium"
                    style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}
                    data-testid="lead-whatsapp-btn"
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Send on WhatsApp</span>
                    <span className="ml-auto text-[10px] opacity-70">{localLead.phone}</span>
                  </a>
                );
              })()}

              {/* Stage Control */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2">Pipeline Stage</p>
                <div className="flex flex-wrap gap-1.5" data-testid="crm-stage-control">
                  {LEAD_STAGES.map(s => (
                    <StagePill
                      key={s.id}
                      stage={s.id}
                      current={localLead?.pipeline_stage}
                      onClick={handleStageChange}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Follow-up Scheduler */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Follow-up
                    {isFollowupOverdue && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-bold uppercase tracking-wide">
                        Overdue
                      </span>
                    )}
                  </p>
                  {localLead?.followup_at && (
                    <button
                      onClick={() => handleFollowupChange('')}
                      className="text-[10px] text-[#5b6475] hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <Input
                  type="datetime-local"
                  value={followupInputVal}
                  onChange={e => handleFollowupChange(e.target.value)}
                  className={`h-9 text-xs ${isFollowupOverdue ? 'border-red-200 bg-red-50 text-red-700' : ''}`}
                  data-testid="crm-followup-input"
                />
              </div>

              <Separator />

              {/* Assign Staff */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Assigned To
                </p>
                <Select
                  value={localLead?.assigned_to_staff_id || 'unassigned'}
                  onValueChange={(val) => {
                    if (val === 'unassigned') {
                      handleAssign(null, null);
                    } else {
                      const staff = staffList.find(s => s.id === val);
                      if (staff) handleAssign(staff.id, staff.name);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs" data-testid="crm-assign-select">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Link to Client */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Client Profile
                </p>
                {linkedClient ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-green-800">{linkedClient.full_name}</p>
                      <p className="text-[10px] text-green-600 mt-0.5">{linkedClient.phone || linkedClient.email || 'No contact'}</p>
                    </div>
                    <button
                      onClick={() => handleLinkClient(null)}
                      className="text-[10px] text-green-600 hover:text-red-500 transition-colors ml-2"
                    >
                      Unlink
                    </button>
                  </div>
                ) : (
                  <div>
                    {linkMode ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Search clients by name or phone..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-gray-50">
                          {filteredClients.slice(0, 8).map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleLinkClient(c.id)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <p className="text-xs font-medium text-[#0b1220]">{c.full_name}</p>
                              <p className="text-[10px] text-[#5b6475]">{c.phone || '—'}</p>
                            </button>
                          ))}
                          {filteredClients.length === 0 && (
                            <p className="text-[10px] text-[#5b6475] text-center py-3">No clients found</p>
                          )}
                        </div>
                        <button
                          onClick={() => { setLinkMode(false); setClientSearch(''); }}
                          className="text-[10px] text-[#5b6475] hover:text-[#0b1220] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkMode(true)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-[10px] text-[#5b6475] hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] transition-all duration-150"
                        data-testid="crm-link-client-btn"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Link to existing client profile
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Notes Timeline */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Notes ({notes.length})
                </p>

                {/* Add Note Input */}
                <div className="flex gap-2 mb-4">
                  <Textarea
                    placeholder="Add a note... (Ctrl+Enter to submit)"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                    rows={2}
                    className="text-xs resize-none flex-1"
                    data-testid="crm-note-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={savingNote || !newNote.trim()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center self-start mt-0.5 disabled:opacity-40 transition-all"
                    style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
                    data-testid="crm-note-submit"
                  >
                    {savingNote
                      ? <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
                      : <Send className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>

                {/* Notes List */}
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-[10px] text-[#5b6475] text-center py-3">No notes yet. Add the first note above.</p>
                  ) : (
                    notes.map(n => (
                      <div key={n.id} className="bg-[#f7f8fb] rounded-xl px-3 py-2.5 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-[#0b1220]">{n.author_name}</span>
                          <span className="text-[9px] text-[#5b6475]">
                            {(() => {
                              try {
                                const d = parseISO(n.created_at);
                                return isValid(d) ? format(d, 'dd MMM, h:mm a') : '';
                              } catch { return ''; }
                            })()}
                          </span>
                        </div>
                        <p className="text-xs text-[#0b1220] leading-relaxed whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Linked Quotes ──────────────────────────────────────── */}
              <Separator />
              <div data-testid="crm-linked-quotes-section">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-[#5b6475]" />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[#5b6475]">
                      Linked Quotes
                    </p>
                    {linkedQuotes.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#0a1628] text-[#c9a84c]">
                        {linkedQuotes.length}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowQuoteModal(true)}
                    className="gap-1 h-7 text-[10px] px-2.5 rounded-lg"
                    style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                    data-testid="crm-create-quote-btn"
                  >
                    <PlusCircle className="w-3 h-3" /> New Quote
                  </Button>
                </div>

                {loadingQuotes ? (
                  <div className="py-3 text-center text-xs text-[#5b6475]">Loading quotes...</div>
                ) : linkedQuotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#e6e9f0] py-4 px-3 text-center">
                    <FileText className="w-5 h-5 text-[#e6e9f0] mx-auto mb-1.5" />
                    <p className="text-xs text-[#5b6475]">No quotes yet</p>
                    <p className="text-[10px] text-[#5b6475]/60 mt-0.5">Click &ldquo;New Quote&rdquo; to create one from this lead</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedQuotes.map(qt => (
                      <div
                        key={qt.id}
                        className="flex items-center justify-between rounded-xl border border-[#e6e9f0] bg-white px-3 py-2.5 hover:border-[#c9a84c]/40 transition-colors duration-150"
                        data-testid={`crm-quote-card-${qt.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-[#0b1220]">{qt.quote_no}</span>
                            <QuoteStatusBadge status={qt.status} />
                          </div>
                          <p className="text-[10px] text-[#5b6475] truncate">
                            {qt.destination || '—'} &nbsp;·&nbsp;
                            <span className="font-medium text-[#0b1220]">
                              {qt.base_currency} {(parseFloat(qt.grand_total_base) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#5b6475] flex-shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Linked Itineraries ───────────────────────────────────────── */}
              <Separator />
              <div data-testid="crm-linked-itineraries-section">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Map className="w-3 h-3 text-[#5b6475]" />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[#5b6475]">
                      Linked Itineraries
                    </p>
                    {linkedItineraries.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#0a1628] text-[#c9a84c]">
                        {linkedItineraries.length}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate('/app/itinerary', {
                      state: { newFromEnquiry: { id: localLead.id, destination: localLead.destination } }
                    })}
                    className="gap-1 h-7 text-[10px] px-2.5 rounded-lg"
                    style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                    data-testid="crm-create-itinerary-btn"
                  >
                    <PlusCircle className="w-3 h-3" /> New Itinerary
                  </Button>
                </div>
                {linkedItineraries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#e6e9f0] py-4 px-3 text-center">
                    <Map className="w-5 h-5 text-[#e6e9f0] mx-auto mb-1.5" />
                    <p className="text-xs text-[#5b6475]">No itineraries yet</p>
                    <p className="text-[10px] text-[#5b6475]/60 mt-0.5">Create a day-wise travel plan for this lead</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedItineraries.map(itin => {
                      const statusColors = { draft: '#e8a830', final: '#27ae60', shared: '#4aa3ff' };
                      const sc = statusColors[itin.status] || '#e8a830';
                      return (
                        <div
                          key={itin.id}
                          className="flex items-center justify-between rounded-xl border border-[#e6e9f0] bg-white px-3 py-2.5 cursor-pointer hover:border-[#c9a84c]/40 transition-colors"
                          onClick={() => navigate('/app/itinerary', { state: { openItineraryId: itin.id } })}
                          data-testid={`crm-itin-card-${itin.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-semibold text-[#0b1220] truncate">{itin.title}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase"
                                style={{ background: `${sc}18`, color: sc }}>{itin.status || 'draft'}</span>
                            </div>
                            <p className="text-[10px] text-[#5b6475] truncate">
                              {itin.destination || 'No destination'} &nbsp;·&nbsp; {(itin.days || []).length} days
                            </p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#5b6475] flex-shrink-0 ml-2" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Client Documents ──────────────────────────────────── */}
              {linkedClient && (
                <>
                  <Separator />
                  <div data-testid="crm-client-docs-section">
                    <button
                      type="button"
                      onClick={() => setShowClientDocs(prev => !prev)}
                      className="w-full flex items-center justify-between mb-2 group"
                    >
                      <div className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-[#5b6475]" />
                        <p className="text-[10px] uppercase tracking-widest font-semibold text-[#5b6475] group-hover:text-[#0b1220] transition-colors">
                          Client Documents
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#f7f8fb] text-[#5b6475]">
                          {linkedClient.full_name}
                        </span>
                      </div>
                      <ChevronDown
                        className="w-3.5 h-3.5 text-[#5b6475] transition-transform duration-200"
                        style={{ transform: showClientDocs ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </button>
                    {showClientDocs && (
                      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white" style={{ minHeight: 280 }}>
                        <ClientDocumentsPanel clientId={linkedClient.id} compact={true} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Mark as Lost / Lost info */}
              {localLead?.pipeline_stage !== 'Lost' ? (
                <>
                  <Separator />
                  <div className="pb-2">
                    <button
                      onClick={() => setShowLostModal(true)}
                      className="w-full py-2 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                      data-testid="crm-mark-lost-btn"
                    >
                      Mark as Lost
                    </button>
                  </div>
                </>
              ) : (
                localLead?.lost_reason && (
                  <>
                    <Separator />
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 pb-2">
                      <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Lost Reason</p>
                      <p className="text-xs text-red-600 mt-1">{localLead.lost_reason}</p>
                      {localLead.lost_notes && (
                        <p className="text-[10px] text-red-500 mt-1">{localLead.lost_notes}</p>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {showLostModal && (
        <LostLeadModal
          open={showLostModal}
          lead={localLead}
          onClose={() => setShowLostModal(false)}
          onConfirm={handleMarkLost}
        />
      )}

      {/* Quote Builder — launched from CRM panel */}
      <QuoteBuilderModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        editQuote={null}
        initFromLead={localLead}
        onSaved={(savedQuote) => {
          setLinkedQuotes(prev => [savedQuote, ...prev]);
          toast.success(`Quote ${savedQuote.quote_no} created`);
        }}
      />
    </>
  );
}

export default LeadDetailPanel;
