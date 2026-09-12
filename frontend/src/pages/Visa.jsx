import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { visaAPI, uploadsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  Shield, Plus, ChevronDown, ChevronRight, Trash2, User,
  Upload, CheckCircle2, Clock, Eye, Globe, RefreshCw, FileCheck
} from 'lucide-react';

const VISA_TYPES = ['Tourist', 'Business', 'Student', 'Work', 'Transit', 'Schengen', 'E-Visa', 'On Arrival', 'Other'];
const VISA_STATUSES = ['In Progress', 'Submitted', 'Approved', 'Rejected', 'Cancelled'];
const STATUS_COLORS = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'Submitted': 'bg-amber-100 text-amber-700',
  'Approved': 'bg-emerald-100 text-emerald-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Cancelled': 'bg-gray-100 text-gray-500',
};
const DOC_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-500', Icon: Clock },
  uploaded: { label: 'Uploaded', color: 'bg-blue-100 text-blue-600', Icon: Upload },
  verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-600', Icon: CheckCircle2 },
};
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── New Visa Application Modal ──────────────────────────────────────────────
function NewVisaModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    client_name: '', country: '', visa_type: 'Tourist',
    appointment_date: '', submission_date: '', notes: '', status: 'In Progress'
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = 'h-8 text-sm px-2.5 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c] bg-white w-full';

  const handleCreate = async () => {
    if (!form.client_name || !form.country) { toast.error('Client name and country are required'); return; }
    setSaving(true);
    try {
      const res = await visaAPI.create(form);
      toast.success('Visa application created');
      onCreated(res.data);
      onClose();
      setForm({ client_name: '', country: '', visa_type: 'Tourist', appointment_date: '', submission_date: '', notes: '', status: 'In Progress' });
    } catch { toast.error('Failed to create visa application'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" /> New Visa Application
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1.5 block">Client Name *</Label>
            <input className={inp} value={form.client_name} onChange={e => set('client_name', e.target.value)}
              placeholder="e.g. Rahul Sharma" data-testid="visa-client-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Country *</Label>
              <input className={inp} value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="UK, UAE, USA" data-testid="visa-country" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Visa Type</Label>
              <Select value={form.visa_type} onValueChange={v => set('visa_type', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{VISA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Appointment Date</Label>
              <input type="date" className={inp} value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Submission Date</Label>
              <input type="date" className={inp} value={form.submission_date} onChange={e => set('submission_date', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Notes</Label>
            <textarea className="w-full h-16 text-xs px-2.5 py-2 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c] resize-none"
              value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving || !form.client_name || !form.country}
            data-testid="visa-create-btn" style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
            {saving ? 'Creating...' : 'Create Application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Checklist Item ──────────────────────────────────────────────────────────────────
function ChecklistItem({ item, applicantId, appId, onUpdated }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const cfg = DOC_STATUS_CONFIG[item.status] || DOC_STATUS_CONFIG.pending;
  const { Icon } = cfg;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadsAPI.upload('visa', applicantId, file);
      const uploaded = res.data;
      await visaAPI.updateChecklistItem(appId, applicantId, item.id, {
        status: 'uploaded',
        file_id: uploaded.id,
        file_url: uploaded.file_url,
        file_name: uploaded.original_name,
      });
      onUpdated({ ...item, status: 'uploaded', file_id: uploaded.id, file_url: uploaded.file_url, file_name: uploaded.original_name });
      toast.success(`${item.doc_name} uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleVerify = async () => {
    try {
      await visaAPI.updateChecklistItem(appId, applicantId, item.id, { status: 'verified' });
      onUpdated({ ...item, status: 'verified' });
      toast.success('Document verified');
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f2f4f8] last:border-0 group hover:bg-[#f7f8fb] transition-colors"
      data-testid={`checklist-item-${item.id}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        item.status === 'verified' ? 'bg-emerald-100' : item.status === 'uploaded' ? 'bg-blue-100' : 'bg-gray-100'
      }`}>
        <Icon className={`w-3 h-3 ${
          item.status === 'verified' ? 'text-emerald-600' : item.status === 'uploaded' ? 'text-blue-600' : 'text-gray-400'
        }`} />
      </div>
      <p className="text-xs text-[#0b1220] flex-1">{item.doc_name}</p>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === 'uploaded' && (
          <>
            {item.file_url && (
              <button type="button" onClick={() => window.open(`${BACKEND_URL}${item.file_url}`, '_blank')}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475]" title="View">
                <Eye className="w-3 h-3" />
              </button>
            )}
            <button type="button" onClick={handleVerify}
              className="h-5 px-1.5 rounded text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold">
              Verify
            </button>
          </>
        )}
        {item.status === 'verified' && item.file_url && (
          <button type="button" onClick={() => window.open(`${BACKEND_URL}${item.file_url}`, '_blank')}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475]" title="View">
            <Eye className="w-3 h-3" />
          </button>
        )}
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-[#5b6475] hover:text-blue-600 transition-colors"
          title={item.status === 'pending' ? 'Upload document' : 'Replace file'}>
          {uploading
            ? <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin border-blue-500" />
            : <Upload className="w-3 h-3" />}
        </button>
        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

// ── Applicant Card ────────────────────────────────────────────────────────────────────
function ApplicantCard({ applicant, appId, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState(applicant.checklist || []);
  const uploadedCount = checklist.filter(d => d.status !== 'pending').length;
  const verifiedCount = checklist.filter(d => d.status === 'verified').length;
  const total = checklist.length;
  const progress = total > 0 ? Math.round((uploadedCount / total) * 100) : 0;

  const handleItemUpdated = (updatedItem) => {
    const newChecklist = checklist.map(d => d.id === updatedItem.id ? updatedItem : d);
    setChecklist(newChecklist);
    onUpdate({ ...applicant, checklist: newChecklist });
  };

  return (
    <div className="border border-[#e6e9f0] rounded-lg overflow-hidden" data-testid={`applicant-card-${applicant.id}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#f7f8fb] cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#0b1220]">{applicant.name || 'Unnamed Applicant'}</p>
          <p className="text-[10px] text-[#5b6475]">{applicant.passport_no ? `Passport: ${applicant.passport_no}` : 'No passport no.'}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <p className="text-[9px] text-[#5b6475]">{uploadedCount}/{total} docs · {verifiedCount} verified</p>
          <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: verifiedCount === total && total > 0 ? '#059669' : '#2563eb' }} />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(applicant.id); }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#5b6475] hover:text-red-500">
            <Trash2 className="w-3 h-3" />
          </button>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#5b6475]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#5b6475]" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-[#e6e9f0]">
          {checklist.map(item => (
            <ChecklistItem key={item.id} item={item} applicantId={applicant.id} appId={appId} onUpdated={handleItemUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Application Card ───────────────────────────────────────────────────────────────────
function ApplicationCard({ app, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [applicants, setApplicants] = useState(app.applicants || []);
  const [addingApplicant, setAddingApplicant] = useState(false);
  const [newApplicant, setNewApplicant] = useState({ name: '', passport_no: '', dob: '' });
  const [saving, setSaving] = useState(false);
  const statusCfg = STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600';
  const inp = 'h-7 text-xs px-2 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white w-full';

  const handleAddApplicant = async () => {
    if (!newApplicant.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await visaAPI.addApplicant(app.id, newApplicant);
      setApplicants(prev => [...prev, res.data]);
      setAddingApplicant(false);
      setNewApplicant({ name: '', passport_no: '', dob: '' });
      toast.success('Applicant added');
    } catch { toast.error('Failed to add applicant'); }
    finally { setSaving(false); }
  };

  const handleApplicantUpdate = (updated) => {
    setApplicants(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleApplicantDelete = async (applicantId) => {
    try {
      await visaAPI.deleteApplicant(app.id, applicantId);
      setApplicants(prev => prev.filter(a => a.id !== applicantId));
      toast.success('Applicant removed');
    } catch { toast.error('Failed to remove applicant'); }
  };

  const handleStatusChange = async (status) => {
    try {
      await visaAPI.update(app.id, { status });
      onUpdate({ ...app, status, applicants });
    } catch { toast.error('Failed to update status'); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

  return (
    <div className="bg-white rounded-xl border border-[#e6e9f0] overflow-hidden" data-testid={`visa-app-${app.id}`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f7f8fb] transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Globe className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#0b1220]">{app.country}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">{app.visa_type}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusCfg}`}>{app.status}</span>
          </div>
          <p className="text-xs text-[#5b6475]">
            {app.client_name}
            {fmtDate(app.appointment_date) && <span className="ml-1.5">· Appt: {fmtDate(app.appointment_date)}</span>}
            <span className="ml-1.5">· {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Select value={app.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-7 text-xs w-28" onClick={e => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent onClick={e => e.stopPropagation()}>
              {VISA_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(app.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#5b6475] hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-[#5b6475]" /> : <ChevronRight className="w-4 h-4 text-[#5b6475]" />}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[#e6e9f0] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#0b1220]">Applicants</p>
            <Button type="button" size="sm" variant="outline" className="h-6 text-xs gap-1 px-2"
              onClick={() => setAddingApplicant(v => !v)}>
              <Plus className="w-3 h-3" /> Add Applicant
            </Button>
          </div>

          {/* Add applicant inline form */}
          {addingApplicant && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-violet-700">New Applicant</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-violet-700 mb-1 block">Full Name *</label>
                  <input className={inp} value={newApplicant.name}
                    onChange={e => setNewApplicant(a => ({ ...a, name: e.target.value }))}
                    placeholder="e.g. Rahul Sharma" data-testid="applicant-name-input" />
                </div>
                <div>
                  <label className="text-[10px] text-violet-700 mb-1 block">Passport No</label>
                  <input className={inp} value={newApplicant.passport_no}
                    onChange={e => setNewApplicant(a => ({ ...a, passport_no: e.target.value }))}
                    placeholder="A1234567" />
                </div>
                <div>
                  <label className="text-[10px] text-violet-700 mb-1 block">Date of Birth</label>
                  <input type="date" className={inp} value={newApplicant.dob}
                    onChange={e => setNewApplicant(a => ({ ...a, dob: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAddingApplicant(false)}
                  className="h-6 px-2 text-xs rounded border border-[#e6e9f0] text-[#5b6475] hover:bg-[#f2f4f8]">Cancel</button>
                <button type="button" onClick={handleAddApplicant} disabled={saving || !newApplicant.name}
                  className="h-6 px-3 text-xs rounded text-white disabled:opacity-50" style={{ backgroundColor: '#0a1628' }}
                  data-testid="add-applicant-btn">
                  {saving ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {applicants.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center border border-dashed border-[#e6e9f0] rounded-lg">
              <User className="w-6 h-6 text-[#5b6475]/30 mb-2" />
              <p className="text-xs text-[#5b6475]">No applicants yet. Click “Add Applicant” to begin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {applicants.map(applicant => (
                <ApplicantCard
                  key={applicant.id}
                  applicant={applicant}
                  appId={app.id}
                  onUpdate={handleApplicantUpdate}
                  onDelete={handleApplicantDelete}
                />
              ))}
            </div>
          )}

          {app.notes && (
            <div className="px-3 py-2 rounded-lg bg-[#f7f8fb] border border-[#e6e9f0]">
              <p className="text-[10px] uppercase tracking-widest text-[#5b6475] font-semibold mb-1">Notes</p>
              <p className="text-xs text-[#0b1220]">{app.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Visa Page ─────────────────────────────────────────────────────────────────────
export default function Visa() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await visaAPI.list();
      setApps(res.data || []);
    } catch (e) { console.error('[Visa] Failed to load applications:', e); toast.error('Failed to load visa applications'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleCreated = (app) => setApps(prev => [app, ...prev]);
  const handleUpdate = (updated) => setApps(prev => prev.map(a => a.id === updated.id ? { ...updated, applicants: updated.applicants || a.applicants } : a));
  const handleDelete = async (id) => {
    try {
      await visaAPI.delete(id);
      setApps(prev => prev.filter(a => a.id !== id));
      toast.success('Application deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = filterStatus === 'All' ? apps : apps.filter(a => a.status === filterStatus);

  return (
    <div className="space-y-4 pb-6" data-testid="visa-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0b1220]">Visa & Passport</h1>
          <p className="text-sm text-[#5b6475]">{apps.length} application{apps.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadApps}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#5b6475] transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button size="sm" onClick={() => setShowNew(true)}
            data-testid="new-visa-btn"
            className="gap-1.5 h-8 text-xs font-semibold" style={{ backgroundColor: '#c9a84c', color: '#0a1628' }}>
            <Plus className="w-3.5 h-3.5" /> New Application
          </Button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All', ...VISA_STATUSES].map(status => (
          <button key={status} onClick={() => setFilterStatus(status)}
            className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors duration-150 ${
              filterStatus === status
                ? 'border-[#0a1628] bg-[#0a1628] text-[#c9a84c]'
                : 'border-[#e6e9f0] bg-white text-[#5b6475] hover:border-[#0a1628] hover:text-[#0b1220]'
            }`}>
            {status}
            {status !== 'All' && (
              <span className="ml-1 opacity-60">({apps.filter(a => a.status === status).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Application list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[#e6e9f0] p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded w-40" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center bg-white rounded-xl border border-[#e6e9f0]">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-violet-500" />
          </div>
          <p className="text-sm font-medium text-[#0b1220]">No visa applications</p>
          <p className="text-xs text-[#5b6475] mt-1 mb-4">
            {filterStatus === 'All' ? 'Create your first visa application to get started' : `No ${filterStatus} applications`}
          </p>
          {filterStatus === 'All' && (
            <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Application
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ApplicationCard key={app.id} app={app} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <NewVisaModal open={showNew} onClose={() => setShowNew(false)} onCreated={handleCreated} />
    </div>
  );
}
