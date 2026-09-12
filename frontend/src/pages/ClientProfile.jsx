import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsAPI, itineraryAPI } from '../services/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, CreditCard,
  Plane, Hotel, ChefHat, Edit3, Plus, Trash2, FileImage,
  MessageSquare, Send, Users, Award, AlertTriangle, Upload,
  FolderOpen, Map, ExternalLink
} from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { ClientDocumentsPanel } from '../components/crm/ClientDocumentsPanel';

const DOC_TYPES = [
  'Passport', 'Visa', 'Aadhar Card', 'PAN Card',
  'Driving License', 'Itinerary Screenshot', 'Booking Confirmation',
  'Travel Insurance', 'Hotel Voucher', 'Flight Ticket', 'Other'
];

const SEAT_PREFS = ['Window', 'Aisle', 'Middle', 'No preference'];
const MEAL_PREFS = ['Veg', 'Non-Veg', 'Jain', 'Vegan', 'No preference'];
const HOTEL_RATINGS = ['2 Star', '3 Star', '4 Star', '5 Star', 'Any'];

function InfoRow({ icon: Icon, label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[#5b6475]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#5b6475] uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-orange-600' : 'text-[#0b1220]'}`}>{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[#0b1220]">{title}</h3>
        {action}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

function AddDocumentModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', doc_type: 'Passport', notes: '', image_data: '' });
  const [loading, setLoading] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only PNG or JPG images are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Max 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('image_data', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.doc_type) return;
    setLoading(true);
    try {
      await onAdd(form);
      setForm({ title: '', doc_type: 'Passport', notes: '', image_data: '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-4 h-4" style={{ color: 'var(--brand-accent)' }} />
            Add Document
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Document Title *</label>
            <Input
              placeholder="e.g. Passport copy, Visa scan"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Document Type *</label>
            <Select value={form.doc_type} onValueChange={v => set('doc_type', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">
              Upload Image (PNG/JPG)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/5 transition-colors text-xs text-[#5b6475]">
                <Upload className="w-3.5 h-3.5" />
                Choose Image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              {form.image_data && (
                <img src={form.image_data} alt="Preview" className="w-10 h-10 object-cover rounded-lg border" />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Notes</label>
            <Textarea
              placeholder="Any notes about this document..."
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
              disabled={loading || !form.title}
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            >
              Add Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditClientModal({ open, client, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        full_name: client.full_name || '',
        phone: client.phone || '',
        email: client.email || '',
        dob: client.dob || '',
        address: client.address || '',
        passport_no: client.passport_no || '',
        passport_expiry: client.passport_expiry || '',
        nationality: client.nationality || 'Indian',
        seat_preference: client.seat_preference || '',
        meal_preference: client.meal_preference || '',
        hotel_rating: client.hotel_rating || '',
        notes: client.notes || ''
      });
    }
  }, [client]);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name) return;
    setLoading(true);
    try {
      const res = await clientsAPI.update(client.id, form);
      toast.success('Client updated');
      onSaved(res.data);
    } catch (err) {
      toast.error('Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Full Name *</label>
              <Input value={form.full_name || ''} onChange={e => set('full_name', e.target.value)} required className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Phone</label>
              <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Email</label>
              <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Date of Birth</label>
              <Input type="date" value={form.dob || ''} onChange={e => set('dob', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Nationality</label>
              <Input value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Address</label>
              <Input value={form.address || ''} onChange={e => set('address', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-[#0b1220]">Passport Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Passport Number</label>
              <Input value={form.passport_no || ''} onChange={e => set('passport_no', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Passport Expiry</label>
              <Input type="date" value={form.passport_expiry || ''} onChange={e => set('passport_expiry', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-[#0b1220]">Travel Preferences</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Seat</label>
              <Select value={form.seat_preference || ''} onValueChange={v => set('seat_preference', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{SEAT_PREFS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Meal</label>
              <Select value={form.meal_preference || ''} onValueChange={v => set('meal_preference', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{MEAL_PREFS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Hotel</label>
              <Select value={form.hotel_rating || ''} onValueChange={v => set('hotel_rating', v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{HOTEL_RATINGS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#0b1220] mb-1.5 block">Internal Notes</label>
            <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className="text-sm resize-none" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              type="submit" size="sm" disabled={loading || !form.full_name}
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            >
              {loading && <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [notes, setNotes] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, notesRes, enqRes, itinRes] = await Promise.all([
        clientsAPI.get(clientId),
        clientsAPI.getNotes(clientId),
        clientsAPI.getEnquiries(clientId),
        itineraryAPI.list({ client_id: clientId }),
      ]);
      setClient(clientRes.data);
      setNotes(notesRes.data);
      setEnquiries(enqRes.data);
      setItineraries(itinRes.data || []);
    } catch (e) {
      toast.error('Failed to load client profile');
      navigate('/app/crm');
    } finally {
      setLoading(false);
    }
  }, [clientId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await clientsAPI.addNote(clientId, newNote.trim());
      setNewNote('');
      const notesRes = await clientsAPI.getNotes(clientId);
      setNotes(notesRes.data);
      toast.success('Note added');
    } catch (e) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) return null;

  const passportDays = client.passport_expiry
    ? (() => { try { return differenceInDays(parseISO(client.passport_expiry), new Date()); } catch { return null; } })()
    : null;
  const passportExpired = passportDays !== null && passportDays < 0;
  const passportWarning = passportDays !== null && passportDays < 180 && !passportExpired;

  return (
    <div className="space-y-5 pb-8" data-testid="client-profile-page">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/crm')}
          className="gap-1.5 text-[#5b6475] hover:text-[#0b1220] -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to CRM
        </Button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-xl border border-[var(--border)] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {client.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0b1220]">{client.full_name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {client.phone && (
                  <span className="flex items-center gap-1 text-sm text-[#5b6475]">
                    <Phone className="w-3.5 h-3.5" />{client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1 text-sm text-[#5b6475]">
                    <Mail className="w-3.5 h-3.5" />{client.email}
                  </span>
                )}
                {client.nationality && (
                  <span className="text-xs text-[#5b6475] bg-gray-100 px-2 py-0.5 rounded-full">
                    {client.nationality}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="gap-1.5"
            data-testid="client-edit-btn"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </Button>
        </div>

        {/* Passport Alert */}
        {(passportExpired || passportWarning) && (
          <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg ${
            passportExpired ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'
          }`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${passportExpired ? 'text-red-500' : 'text-orange-500'}`} />
            <p className={`text-xs font-medium ${passportExpired ? 'text-red-700' : 'text-orange-700'}`}>
              {passportExpired
                ? `Passport expired ${Math.abs(passportDays)} days ago`
                : `Passport expires in ${passportDays} days (${format(parseISO(client.passport_expiry), 'dd MMM yyyy')})`
              }
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Basic Info */}
        <Section title="Personal Information">
          <InfoRow icon={Phone} label="Phone" value={client.phone} />
          <InfoRow icon={Mail} label="Email" value={client.email} />
          <InfoRow icon={Calendar} label="Date of Birth" value={client.dob ? (() => { try { const d = parseISO(client.dob); return isValid(d) ? format(d, 'dd MMMM yyyy') : client.dob; } catch { return client.dob; } })() : null} />
          <InfoRow icon={MapPin} label="Address" value={client.address} />
          <InfoRow icon={Users} label="Nationality" value={client.nationality} />
          {client.notes && <InfoRow icon={MessageSquare} label="Internal Notes" value={client.notes} />}
        </Section>

        {/* Passport */}
        <Section title="Passport & Travel Documents">
          <InfoRow icon={CreditCard} label="Passport Number" value={client.passport_no} />
          <InfoRow
            icon={Calendar}
            label="Passport Expiry"
            value={client.passport_expiry ? (() => { try { const d = parseISO(client.passport_expiry); return isValid(d) ? format(d, 'dd MMMM yyyy') : client.passport_expiry; } catch { return client.passport_expiry; } })() : null}
            highlight={passportExpired || passportWarning}
          />
          <InfoRow icon={Users} label="Nationality" value={client.nationality} />
        </Section>

        {/* Preferences */}
        <Section title="Travel Preferences">
          <InfoRow icon={Plane} label="Seat Preference" value={client.seat_preference} />
          <InfoRow icon={ChefHat} label="Meal Preference" value={client.meal_preference} />
          <InfoRow icon={Hotel} label="Hotel Rating" value={client.hotel_rating} />
        </Section>

        {/* Linked Enquiries */}
        <Section
          title={`Linked Leads (${enquiries.length})`}
          action={
            <Badge variant="secondary" className="text-[10px]">
              {enquiries.filter(e => e.pipeline_stage !== 'Lost').length} active
            </Badge>
          }
        >
          {enquiries.length === 0 ? (
            <p className="text-xs text-[#5b6475] py-2">No linked leads yet</p>
          ) : (
            <div className="space-y-2">
              {enquiries.slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-xs font-medium text-[#0b1220]">{e.destination}</p>
                    <p className="text-[10px] text-[#5b6475]">
                      {e.travel_date ? (() => { try { const d = parseISO(e.travel_date); return isValid(d) ? format(d, 'MMM yyyy') : e.travel_date; } catch { return e.travel_date; } })() : 'No date'}
                      {' · '}{e.pax_adults}A{e.pax_children > 0 ? `+${e.pax_children}C` : ''}
                    </p>
                  </div>
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: e.pipeline_stage === 'Converted' ? '#F0FDF4' :
                                       e.pipeline_stage === 'Lost' ? '#F9FAFB' : '#EFF6FF',
                      color: e.pipeline_stage === 'Converted' ? '#15803D' :
                             e.pipeline_stage === 'Lost' ? '#4B5563' : '#1E40AF'
                    }}
                  >
                    {e.pipeline_stage}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Client Documents — Categorized Upload Vault */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden" data-testid="client-documents-section">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#5b6475]" />
            <h3 className="text-sm font-semibold text-[#0b1220]">Client Documents</h3>
          </div>
          <p className="text-xs text-[#5b6475]">Passport, financial, visa forms, travel proof & more</p>
        </div>
        <div style={{ minHeight: 320 }}>
          <ClientDocumentsPanel clientId={client.id} />
        </div>
      </div>

      {/* Linked Itineraries */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        data-testid="client-itineraries-section"
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4" style={{ color: 'var(--app-muted)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }}>
              Linked Itineraries
            </h3>
            {itineraries.length > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(232,168,48,0.15)', color: 'var(--cta)' }}
              >
                {itineraries.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/app/itinerary', { state: { newFromClient: { id: client.id, name: client.full_name } } })}
            className="h-7 text-[10px] px-2.5 gap-1"
            style={{ backgroundColor: 'var(--cta)', color: 'var(--brand-primary,#1a2a4a)' }}
            data-testid="new-itinerary-for-client-btn"
          >
            <Plus className="w-3 h-3" /> New Itinerary
          </Button>
        </div>

        <div className="p-4">
          {itineraries.length === 0 ? (
            <div className="text-center py-6">
              <Map className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--stroke)' }} />
              <p className="text-xs" style={{ color: 'var(--app-muted)' }}>No itineraries linked to this client yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itineraries.map(itin => {
                const statusColors = { draft: 'var(--cta)', final: 'var(--success)', shared: 'var(--info)' };
                const sc = statusColors[itin.status] || 'var(--cta)';
                return (
                  <div
                    key={itin.id}
                    className="rounded-lg border p-3 cursor-pointer transition-all duration-150"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cta)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--stroke-soft)')}
                    onClick={() => navigate('/app/itinerary', { state: { openItineraryId: itin.id } })}
                    data-testid={`client-itin-${itin.id}`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <p className="text-xs font-semibold leading-tight pr-2" style={{ color: 'var(--app-fg)', fontFamily: 'Georgia,serif' }}>
                        {itin.title}
                      </p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase"
                        style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}44` }}
                      >
                        {itin.status || 'draft'}
                      </span>
                    </div>
                    {itin.destination && (
                      <p className="text-[10px] mb-1" style={{ color: 'var(--app-muted)' }}>
                        {itin.destination}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>
                        {(itin.days || []).length} days · {(itin.days || []).reduce((s, d) => s + (d.blocks || []).length, 0)} activities
                      </span>
                      <ExternalLink className="w-3 h-3" style={{ color: 'var(--app-muted)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <Section title={`Notes (${notes.length})`}>
        <div className="flex gap-2 mb-4">
          <Textarea
            placeholder="Add a note about this client..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
            rows={2}
            className="flex-1 text-sm resize-none"
            data-testid="client-note-input"
          />
          <button
            onClick={handleAddNote}
            disabled={savingNote || !newNote.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center self-start mt-0.5 disabled:opacity-40 transition-all"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            data-testid="client-note-submit"
          >
            {savingNote
              ? <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
              : <Send className="w-3.5 h-3.5" />
            }
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-[#5b6475] text-center py-3">No notes yet</p>
        ) : (
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="bg-[#f7f8fb] rounded-xl px-4 py-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-[#0b1220]">{n.author_name}</span>
                  <span className="text-[9px] text-[#5b6475]">
                    {(() => { try { const d = parseISO(n.created_at); return isValid(d) ? format(d, 'dd MMM, h:mm a') : ''; } catch { return ''; } })()}
                  </span>
                </div>
                <p className="text-sm text-[#0b1220] leading-relaxed">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Edit Modal */}
      {showEditModal && (
        <EditClientModal
          open={showEditModal}
          client={client}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setClient(updated);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
