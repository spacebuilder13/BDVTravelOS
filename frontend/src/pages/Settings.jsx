import React, { useState, useEffect, useRef, useCallback } from 'react';
import { settingsAPI, staffManagementAPI } from '../services/api';
import { toast } from 'sonner';
import {
  Building2, MapPin, Phone, FileText,
  Upload, Save, RefreshCw, Camera, X, CheckCircle2,
  Users, Plus, Trash2, Shield, Pencil, KeyRound, Eye, EyeOff,
  Percent, BookOpen, Loader2,
} from 'lucide-react';
import {
  listTaxProfiles, createTaxProfile, updateTaxProfile, deleteTaxProfile,
  getQuoteTerms, updateQuoteTerms,
} from '../services/plannerAPI';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const PROTECTED_NAMES = new Set(['yash doshi', 'dolly doshi', 'isha doshi', 'neel doshi']);

const ROLE_LABELS = {
  admin: 'Admin',
  sales: 'Sales',
  operations: 'Operations',
  accounts: 'Accounts',
  tour_guide: 'Tour Guide',
};

const ROLE_COLORS = {
  admin:      { bg: 'rgba(232,168,48,0.15)',  text: '#e8a830' },
  sales:      { bg: 'rgba(74,163,255,0.13)',  text: '#4aa3ff' },
  operations: { bg: 'rgba(39,174,96,0.13)',   text: '#27ae60' },
  accounts:   { bg: 'rgba(155,89,182,0.13)',  text: '#9b59b6' },
  tour_guide: { bg: 'rgba(26,188,156,0.13)',  text: '#1abc9c' },
};

const inputClass = 'rounded-[var(--radius-input)] bg-[var(--surface-2)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[1.5px] border-[var(--stroke)] focus-visible:ring-0 focus-visible:border-[var(--cta)] focus-visible:shadow-[var(--ring)] transition-colors h-9 text-sm';

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div
      className="rounded-[var(--radius-card)] p-5"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--stroke-soft)',
        boxShadow: 'var(--shadow-elev-1)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(232,168,48,0.12)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--app-muted)' }}>
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.22em] mb-1.5 block font-semibold" style={{ color: 'var(--app-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_BRAND = {
  company_name: '', tagline: '', address_line1: '', address_line2: '',
  city: '', state: '', pincode: '', country: 'India',
  phone: '', email: '', website: '', gstin: '', pan: '', iata_code: '', logo_base64: null,
};

function BrandProfileTab({ isAdmin }) {
  const [form, setForm] = useState(EMPTY_BRAND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    settingsAPI.getBrand()
      .then(res => { setForm({ ...EMPTY_BRAND, ...res.data }); if (res.data.logo_base64) setLogoPreview(res.data.logo_base64); })
      .catch(() => toast.error('Failed to load brand settings'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('Logo must be under 500KB'); return; }
    const reader = new FileReader();
    reader.onload = ev => { setLogoPreview(ev.target.result); set('logo_base64', ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.brand; delete payload.updated_at; delete payload.updated_by;
      await settingsAPI.updateBrand(payload);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
      toast.success('Brand profile saved');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`brand-sk-${i}`} className="h-40 rounded-[var(--radius-card)]" style={{ backgroundColor: 'var(--surface-2)' }} />)}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        {saved && <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--success)' }}><CheckCircle2 className="w-4 h-4" /> Saved</div>}
        {isAdmin ? (
          <Button onClick={handleSave} disabled={saving} data-testid="settings-save-btn"
            className="rounded-full flex items-center gap-2" style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </Button>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(192,57,43,0.14)', color: '#fca5a5' }}>View Only</span>
        )}
      </div>

      {/* Brand Identity */}
      <Section title="Brand Identity" icon={Building2}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer relative group"
              style={{ backgroundColor: 'var(--surface-3)', border: '2px dashed var(--stroke)' }}
              onClick={() => isAdmin && fileRef.current?.click()} data-testid="settings-logo-area">
              {logoPreview
                ? <img src={logoPreview} alt="Brand logo" className="w-full h-full object-contain p-2" />
                : <div className="flex flex-col items-center gap-1"><Camera className="w-6 h-6" style={{ color: 'var(--app-muted)' }} /><span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Logo</span></div>}
              {isAdmin && <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-5 h-5 text-white" /></div>}
            </div>
            {logoPreview && isAdmin && (
              <button data-testid="settings-logo-remove" onClick={() => { setLogoPreview(null); set('logo_base64', null); }}
                className="text-[10px] flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: '#fca5a5' }}>
                <X className="w-3 h-3" /> Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <p className="text-[9px] text-center" style={{ color: 'var(--app-muted)' }}>Max 500KB</p>
          </div>
          <div className="flex-1 min-w-60 grid grid-cols-1 gap-3">
            <Field label="Company Name"><Input data-testid="settings-company-name" placeholder="Blue Diamond Voyage & Vision" value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            <Field label="Tagline"><Input data-testid="settings-tagline" placeholder="Your Complete Travel Operations Platform" value={form.tagline || ''} onChange={e => set('tagline', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            <Field label="IATA Code"><Input data-testid="settings-iata" placeholder="e.g. 14347782" value={form.iata_code || ''} onChange={e => set('iata_code', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Address" icon={MapPin}>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Address Line 1"><Input data-testid="settings-address1" placeholder="Street / Building" value={form.address_line1 || ''} onChange={e => set('address_line1', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            <Field label="Address Line 2"><Input data-testid="settings-address2" placeholder="Area / Landmark" value={form.address_line2 || ''} onChange={e => set('address_line2', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input data-testid="settings-city" placeholder="Mumbai" value={form.city || ''} onChange={e => set('city', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
              <Field label="State"><Input data-testid="settings-state" placeholder="Maharashtra" value={form.state || ''} onChange={e => set('state', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pincode"><Input data-testid="settings-pincode" placeholder="400001" value={form.pincode || ''} onChange={e => set('pincode', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
              <Field label="Country"><Input data-testid="settings-country" placeholder="India" value={form.country || ''} onChange={e => set('country', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            </div>
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Contact Details" icon={Phone}>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Phone"><Input data-testid="settings-phone" placeholder="+91 98765 43210" value={form.phone || ''} onChange={e => set('phone', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
              <Field label="Email"><Input data-testid="settings-email" type="email" placeholder="info@bdvv.in" value={form.email || ''} onChange={e => set('email', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
              <Field label="Website"><Input data-testid="settings-website" placeholder="https://bdvv.in" value={form.website || ''} onChange={e => set('website', e.target.value)} disabled={!isAdmin} className={inputClass} /></Field>
            </div>
          </Section>
          <Section title="Tax & Compliance" icon={FileText}>
            <div className="grid grid-cols-1 gap-3">
              <Field label="GSTIN"><Input data-testid="settings-gstin" placeholder="27AAAAA0000A1Z5" value={form.gstin || ''} onChange={e => set('gstin', e.target.value.toUpperCase())} disabled={!isAdmin} className={`${inputClass} font-mono`} /></Field>
              <Field label="PAN"><Input data-testid="settings-pan" placeholder="AAAAA0000A" value={form.pan || ''} onChange={e => set('pan', e.target.value.toUpperCase())} disabled={!isAdmin} className={`${inputClass} font-mono`} /></Field>
            </div>
          </Section>
        </div>
      </div>

      {(form.company_name || form.address_line1 || form.gstin) && (
        <div className="rounded-[var(--radius-card)] p-5" style={{ background: 'linear-gradient(135deg, rgba(232,168,48,0.06), rgba(26,42,74,0) 60%)', border: '1px solid rgba(232,168,48,0.2)' }} data-testid="settings-preview">
          <p className="text-[10px] uppercase tracking-[0.28em] mb-3" style={{ color: 'var(--app-muted)' }}>Invoice Header Preview</p>
          <div className="flex items-start gap-4">
            {logoPreview && <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded-lg flex-shrink-0" />}
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}>{form.company_name || 'Blue Diamond Voyage & Vision'}</p>
              {form.tagline && <p className="text-xs mb-1" style={{ color: 'var(--app-muted)' }}>{form.tagline}</p>}
              {(form.address_line1 || form.city) && <p className="text-xs" style={{ color: 'var(--app-fg)', opacity: 0.8 }}>{[form.address_line1, form.address_line2, form.city, form.state, form.pincode].filter(Boolean).join(', ')}</p>}
              <div className="flex gap-4 mt-1 flex-wrap">
                {form.phone && <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>T: {form.phone}</span>}
                {form.email && <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>E: {form.email}</span>}
                {form.gstin && <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>GST: {form.gstin}</span>}
                {form.iata_code && <span className="text-xs font-mono" style={{ color: 'var(--app-muted)' }}>IATA: {form.iata_code}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} data-testid="settings-save-bottom-btn"
            className="rounded-full flex items-center gap-2" style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Brand Profile
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN INPUT (4-digit code entry)
// ─────────────────────────────────────────────────────────────────────────────
function PinInput({ value, onChange, testId }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        data-testid={testId}
        type={show ? 'text' : 'password'}
        inputMode="numeric"
        maxLength={4}
        placeholder="4-digit PIN"
        value={value}
        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); onChange(v); }}
        className={`${inputClass} font-mono tracking-[0.5em] pr-9`}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD USER DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function AddUserDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', role: 'sales', pin: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ name: '', role: 'sales', pin: '' }); }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.pin.length !== 4) { toast.error('PIN must be exactly 4 digits'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create user');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-modal)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}>Add Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Field label="Full Name *">
            <Input data-testid="add-user-name" placeholder="e.g. Ravi Sharma" value={form.name}
              onChange={e => set('name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Role *">
            <Select value={form.role} onValueChange={v => set('role', v)}>
              <SelectTrigger data-testid="add-user-role" className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="4-Digit PIN *">
            <PinInput testId="add-user-pin" value={form.pin} onChange={v => set('pin', v)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="rounded-full" style={{ color: 'var(--app-muted)' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="add-user-save"
            className="rounded-full" style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />} Add Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT USER DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function EditUserDialog({ open, onClose, staff, onSave, onResetPin }) {
  const [form, setForm] = useState({ name: '', role: 'sales' });
  const [newPin, setNewPin] = useState('');
  const [showPinReset, setShowPinReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isProtected = PROTECTED_NAMES.has(staff?.name?.toLowerCase() || '');

  useEffect(() => {
    if (open && staff) {
      setForm({ name: staff.name, role: staff.role });
      setNewPin('');
      setShowPinReset(false);
    }
  }, [open, staff]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(staff.id, form); onClose(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const handlePinReset = async () => {
    if (newPin.length !== 4) { toast.error('Enter a 4-digit PIN'); return; }
    setResetting(true);
    try { await onResetPin(staff.id, newPin); setShowPinReset(false); setNewPin(''); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to reset PIN'); }
    finally { setResetting(false); }
  };

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-modal)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}>Edit Profile</DialogTitle>
        </DialogHeader>

        {isProtected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: 'rgba(232,168,48,0.10)', border: '1px solid rgba(232,168,48,0.25)' }}>
            <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--cta)' }} />
            <span style={{ color: 'var(--app-muted)' }}>Protected admin — role is locked to Admin</span>
          </div>
        )}

        <div className="space-y-3 mt-2">
          <Field label="Full Name">
            <Input data-testid="edit-user-name" value={form.name}
              onChange={e => set('name', e.target.value)} className={inputClass}
              disabled={isProtected} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={v => set('role', v)} disabled={isProtected}>
              <SelectTrigger data-testid="edit-user-role" className={inputClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* PIN Reset section */}
        <div className="mt-3">
          {!showPinReset ? (
            <button data-testid="edit-user-pin-toggle" onClick={() => setShowPinReset(true)}
              className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity" style={{ color: 'var(--app-muted)' }}>
              <KeyRound className="w-3.5 h-3.5" /> Reset PIN
            </button>
          ) : (
            <div className="space-y-2">
              <Field label="New 4-Digit PIN">
                <PinInput testId="edit-user-new-pin" value={newPin} onChange={setNewPin} />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={handlePinReset} disabled={resetting} data-testid="edit-user-pin-save"
                  className="rounded-full text-xs flex-1" style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}>
                  {resetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Set PIN'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowPinReset(false); setNewPin(''); }}
                  className="rounded-full text-xs" style={{ color: 'var(--app-muted)' }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} className="rounded-full" style={{ color: 'var(--app-muted)' }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || isProtected} data-testid="edit-user-save"
            className="rounded-full" style={{ backgroundColor: isProtected ? 'var(--surface-3)' : 'var(--cta)', color: isProtected ? 'var(--app-muted)' : '#1a2a4a', fontWeight: 600 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF CARD
// ─────────────────────────────────────────────────────────────────────────────
function StaffCard({ member, onEdit, onDelete, currentUserId }) {
  const isProtected = member.is_protected || PROTECTED_NAMES.has(member.name?.toLowerCase());
  const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.sales;
  const isSelf = member.id === currentUserId;

  return (
    <div
      data-testid={`staff-card-${member.id}`}
      className="relative rounded-[var(--radius-card)] p-4 flex items-center gap-3 group"
      style={{
        backgroundColor: 'var(--surface)',
        border: isProtected ? '1px solid rgba(232,168,48,0.25)' : '1px solid var(--stroke-soft)',
        boxShadow: 'var(--shadow-elev-1)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: member.avatar_color || 'var(--cta)', color: '#1a2a4a' }}
      >
        {member.initials || member.name?.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)' }}>{member.name}</p>
          {isProtected && <Shield className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cta)' }} />}
          {isSelf && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(232,168,48,0.15)', color: 'var(--cta)' }}>You</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}>
            {ROLE_LABELS[member.role] || member.role}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          data-testid={`staff-edit-${member.id}`}
          onClick={() => onEdit(member)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/8 transition-colors"
          style={{ color: 'var(--app-muted)' }}
          title="Edit profile"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {!isProtected && !isSelf && (
          <button
            data-testid={`staff-delete-${member.id}`}
            onClick={() => onDelete(member)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/10 transition-colors"
            style={{ color: '#fca5a5' }}
            title="Delete user"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM TAB
// ─────────────────────────────────────────────────────────────────────────────
function TeamTab({ isAdmin, currentUserId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffManagementAPI.list();
      setStaff(res.data);
    } catch (e) { console.error('[Settings] Failed to load team:', e); toast.error('Failed to load team'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (data) => {
    const res = await staffManagementAPI.create(data);
    setStaff(s => [...s, res.data].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(`${res.data.name} added to the team`);
  };

  const handleEdit = (member) => setEditTarget(member);

  const handleSaveEdit = async (id, data) => {
    const res = await staffManagementAPI.update(id, data);
    setStaff(s => s.map(m => m.id === id ? res.data : m).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Profile updated');
    setEditTarget(null);
  };

  const handleResetPin = async (id, new_pin) => {
    await staffManagementAPI.resetPin(id, new_pin);
    toast.success('PIN reset successfully');
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Delete ${member.name}? This cannot be undone.`)) return;
    try {
      await staffManagementAPI.delete(member.id);
      setStaff(s => s.filter(m => m.id !== member.id));
      toast.success(`${member.name} removed`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete'); }
  };

  // Split: protected admins first, then others
  const admins = staff.filter(s => s.is_protected || PROTECTED_NAMES.has(s.name?.toLowerCase()));
  const others = staff.filter(s => !s.is_protected && !PROTECTED_NAMES.has(s.name?.toLowerCase()));

  return (
    <div className="space-y-5" data-testid="team-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--app-muted)' }}>{staff.length} team members</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)} data-testid="add-user-btn"
            className="rounded-full flex items-center gap-1.5" style={{ backgroundColor: 'var(--cta)', color: '#1a2a4a', fontWeight: 600 }}>
            <Plus className="w-4 h-4" /> Add Member
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={`team-sk-${i}`} className="h-20 rounded-[var(--radius-card)]" style={{ backgroundColor: 'var(--surface-2)' }} />)}
        </div>
      ) : (
        <>
          {/* Protected Admins */}
          {admins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
                <p className="text-[11px] uppercase tracking-[0.28em] font-semibold" style={{ color: 'var(--app-muted)' }}>Protected Admins</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {admins.map(m => (
                  <StaffCard key={m.id} member={m} onEdit={handleEdit} onDelete={handleDelete} currentUserId={currentUserId} />
                ))}
              </div>
            </div>
          )}

          {/* Other staff */}
          {others.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
                <p className="text-[11px] uppercase tracking-[0.28em] font-semibold" style={{ color: 'var(--app-muted)' }}>Team Members</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {others.map(m => (
                  <StaffCard key={m.id} member={m} onEdit={handleEdit} onDelete={handleDelete} currentUserId={currentUserId} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {staff.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 rounded-[var(--radius-card)] text-center"
              style={{ border: '1px dashed var(--stroke)' }} data-testid="team-empty">
              <Users className="w-10 h-10 mb-3" style={{ color: 'var(--app-muted)', opacity: 0.4 }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }}>No team members yet</p>
            </div>
          )}
        </>
      )}

      {/* Note about default PIN */}
      {isAdmin && (
        <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(74,163,255,0.08)', border: '1px solid rgba(74,163,255,0.2)' }}>
          <KeyRound className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#4aa3ff' }} />
          <span style={{ color: 'var(--app-muted)' }}>New members get the PIN you set. You can reset any PIN by clicking the edit icon. Protected admins default PIN is 0000.</span>
        </div>
      )}

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAdd} />
      <EditUserDialog open={!!editTarget} onClose={() => setEditTarget(null)} staff={editTarget} onSave={handleSaveEdit} onResetPin={handleResetPin} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Tax Profiles Tab
// ─────────────────────────────────────────────────────────────────────────────
const APPLIES_TO_OPTIONS = ['all', 'transport', 'stay', 'activity', 'visa', 'insurance'];

function TaxProfilesTab() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editId,  setEditId]    = useState(null);
  const [form, setForm]         = useState({ label: '', rate: '', applies_to: 'all', is_enabled: true });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await listTaxProfiles(); setProfiles(d || []); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditId(null); setForm({ label: '', rate: '', applies_to: 'all', is_enabled: true }); };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({ label: p.label, rate: String(p.rate || ''), applies_to: p.applies_to || 'all', is_enabled: p.is_enabled !== false });
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.rate) { toast.error('Label and rate are required'); return; }
    setSaving(true);
    try {
      const body = { label: form.label.trim(), rate: parseFloat(form.rate), applies_to: form.applies_to, is_enabled: form.is_enabled };
      if (editId) {
        const updated = await updateTaxProfile(editId, body);
        setProfiles(prev => prev.map(p => p.id === editId ? updated : p));
        toast.success('Tax profile updated');
      } else {
        const created = await createTaxProfile(body);
        setProfiles(prev => [...prev, created]);
        toast.success('Tax profile created');
      }
      reset();
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this tax profile?')) return;
    try {
      await deleteTaxProfile(id);
      setProfiles(prev => prev.filter(p => p.id !== id));
      toast.success('Deleted');
    } catch (e) { toast.error('Delete failed: ' + e.message); }
  };

  const inpCls = 'h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[var(--qb-field-border)] focus:outline-none focus:border-[var(--cta)] transition-colors';

  return (
    <div className="space-y-5">
      {/* Add / Edit form */}
      <Section title={editId ? 'Edit Tax Profile' : 'Add Tax Profile'} icon={Percent}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Label *</p>
            <input value={form.label} onChange={e => setForm(f=>({...f,label:e.target.value}))} placeholder="e.g. GST, TCS" className={inpCls} data-testid="tax-label-input" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Rate % *</p>
            <input type="number" step="0.01" min="0" max="100" value={form.rate} onChange={e => setForm(f=>({...f,rate:e.target.value}))} placeholder="5.00" className={inpCls} data-testid="tax-rate-input" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Applies To</p>
            <select value={form.applies_to} onChange={e => setForm(f=>({...f,applies_to:e.target.value}))} className={inpCls}>
              {APPLIES_TO_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f=>({...f,is_enabled:e.target.checked}))} className="w-4 h-4 accent-[var(--cta)]" />
              <span className="text-sm" style={{ color: 'var(--app-fg)' }}>Enabled</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving} className="h-9 px-4 text-sm gap-2" style={{ background: 'var(--cta)', color: 'var(--app-bg)' }} data-testid="tax-save-btn">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {editId ? 'Update Profile' : 'Add Profile'}
          </Button>
          {editId && <Button variant="ghost" onClick={reset} className="h-9 px-4 text-sm" style={{ color: 'var(--app-muted)' }}>Cancel</Button>}
        </div>
      </Section>

      {/* List */}
      <Section title="Tax Profiles" icon={Percent}>
        {loading ? (
          <div className="flex items-center gap-2" style={{ color: 'var(--app-muted)' }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--cta)' }} /><span className="text-sm">Loading…</span></div>
        ) : profiles.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--app-muted)' }}>No tax profiles yet. Add one above.</p>
        ) : (
          <div className="space-y-2" data-testid="tax-profiles-list">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }} data-testid={`tax-profile-${p.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }}>{p.label}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.10)', color: 'var(--cta)' }}>{p.rate}%</span>
                    {!p.is_enabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(192,57,43,0.15)', color: '#C0392B' }}>DISABLED</span>}
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--app-muted)' }}>Applies to: {p.applies_to}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => startEdit(p)} className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/10" style={{ color: 'var(--app-muted)' }}><Pencil className="w-3 h-3" /></button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-red-500/10" style={{ color: '#fca5a5' }}><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote Terms Tab
// ─────────────────────────────────────────────────────────────────────────────
function QuoteTermsTab() {
  const [terms, setTerms]   = useState('');
  const [title, setTitle]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getQuoteTerms();
        if (data) {
          setTerms(data.terms_and_conditions || '');
          setTitle(data.title || 'Standard Terms & Conditions');
        }
      } catch (e) { console.error('getQuoteTerms', e); }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateQuoteTerms({ title: title.trim() || 'Standard Terms & Conditions', terms_and_conditions: terms });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Quote terms template saved');
    } catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const inpCls = 'h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[var(--qb-field-border)] focus:outline-none focus:border-[var(--cta)] transition-colors';

  return (
    <Section title="Quote Terms Template" icon={BookOpen}>
      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--app-muted)' }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--cta)' }} /><span className="text-sm">Loading…</span></div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Template Title</p>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Standard Terms & Conditions" className={inpCls} data-testid="terms-title-input" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1.5" style={{ color: 'var(--app-muted)' }}>Terms & Conditions Text</p>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={14}
              placeholder="Enter default T&C text for quotes…"
              className="w-full text-sm px-3 py-2.5 rounded-lg resize-none"
              style={{ background: 'var(--qb-field)', border: '1px solid var(--qb-field-border)', color: 'var(--app-fg)', outline: 'none', lineHeight: 1.6 }}
              data-testid="terms-content-textarea"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="h-9 px-4 text-sm gap-2" style={{ background: 'var(--cta)', color: 'var(--app-bg)' }} data-testid="terms-save-btn">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? 'Saved!' : 'Save Template'}
            </Button>
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>This template pre-fills the T&C section in the Quote Builder.</p>
          </div>
        </div>
      )}
    </Section>
  );
}


export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-5 max-w-5xl" data-testid="settings-page">
      {/* Page Header */}
      <div>
        <h1
          className="text-[22px] font-bold tracking-wide"
          style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif' }}
          data-testid="settings-page-title"
        >
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted)' }}>
          Blue Diamond Voyage &amp; Vision — BDVV
        </p>
      </div>

      <Tabs defaultValue="brand" className="w-full">
        <TabsList
          className="h-9 p-1 mb-5 w-auto"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--stroke-soft)' }}
          data-testid="settings-tabs"
        >
          <TabsTrigger
            value="brand"
            data-testid="settings-tab-brand"
            className="rounded-full text-xs px-4 data-[state=active]:bg-[var(--cta)] data-[state=active]:text-[#1a2a4a] data-[state=active]:font-semibold"
            style={{ color: 'var(--app-muted)' }}
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Brand Profile
          </TabsTrigger>
          <TabsTrigger
            value="team"
            data-testid="settings-tab-team"
            className="rounded-full text-xs px-4 data-[state=active]:bg-[var(--cta)] data-[state=active]:text-[#1a2a4a] data-[state=active]:font-semibold"
            style={{ color: 'var(--app-muted)' }}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Team Profiles
          </TabsTrigger>
          <TabsTrigger
            value="taxes"
            data-testid="settings-tab-taxes"
            className="rounded-full text-xs px-4 data-[state=active]:bg-[var(--cta)] data-[state=active]:text-[#1a2a4a] data-[state=active]:font-semibold"
            style={{ color: 'var(--app-muted)' }}
          >
            <Percent className="w-3.5 h-3.5 mr-1.5" />
            Tax Profiles
          </TabsTrigger>
          <TabsTrigger
            value="quote_terms"
            data-testid="settings-tab-quote-terms"
            className="rounded-full text-xs px-4 data-[state=active]:bg-[var(--cta)] data-[state=active]:text-[#1a2a4a] data-[state=active]:font-semibold"
            style={{ color: 'var(--app-muted)' }}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Quote Terms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandProfileTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="team">
          <TeamTab isAdmin={isAdmin} currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="taxes">
          <TaxProfilesTab />
        </TabsContent>

        <TabsContent value="quote_terms">
          <QuoteTermsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
