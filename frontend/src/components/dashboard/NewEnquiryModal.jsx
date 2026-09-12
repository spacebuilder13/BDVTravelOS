import React, { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Image, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_TYPES = ['Tour', 'Flight', 'Visa', 'Passport', 'Insurance', 'Transfer', 'Cruise', 'Other'];
const TRAVEL_TYPES = ['Honeymoon', 'Family', 'Corporate', 'Group Tour', 'Solo', 'Adventure', 'Pilgrimage', 'Other'];
const SOURCES = ['Online', 'Walk-in', 'Referral', 'Social Media', 'Agent', 'Other'];
const STAGES = ['New', 'Qualified', 'Quoted', 'Follow-up', 'Converted', 'Lost'];

// ── Local Screenshot Drop Zone (no server upload until enquiry is created) ───────────────────────
function LocalScreenshotDropZone({ files, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const newFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (newFiles.length > 0) onFiles(prev => [...prev, ...newFiles]);
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) onFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl py-8 flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-[#e6e9f0] bg-[#f7f8fb] hover:border-[#0a1628] hover:bg-white'
        }`}
        data-testid="screenshot-drop-zone">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className="w-7 h-7 text-[#5b6475] mb-2" />
        <p className="text-xs font-medium text-[#0b1220]">
          {dragging ? 'Drop files here' : 'Drag & drop or click to browse'}
        </p>
        <p className="text-[10px] text-[#5b6475] mt-1">PNG, JPG, WEBP, PDF · Uploaded after enquiry is created</p>
      </div>

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid="screenshot-preview-grid">
          {files.map((f, i) => (
            <div key={i} className="relative group rounded-lg border border-[#e6e9f0] overflow-hidden bg-white">
              <div className="aspect-video bg-[#f2f4f8] flex items-center justify-center overflow-hidden">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-6 h-6 text-[#5b6475]" />
                )}
              </div>
              <div className="px-2 py-1 flex items-center justify-between gap-1">
                <p className="text-[10px] text-[#5b6475] truncate flex-1">{f.name}</p>
                <button
                  type="button"
                  onClick={() => onFiles(prev => prev.filter((_, j) => j !== i))}
                  className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded hover:bg-red-50 text-[#5b6475] hover:text-red-500"
                  data-testid={`remove-screenshot-${i}`}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-[#5b6475]">No screenshots added yet</p>
          <p className="text-[10px] text-[#5b6475]/60 mt-0.5">These will be attached to the enquiry when created</p>
        </div>
      )}
    </div>
  );
}

// ── Main NewEnquiryModal ──────────────────────────────────────────────────────────────────
export default function NewEnquiryModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    client_name: '', phone: '', email: '', destination: '',
    travel_date: '', return_date: '',
    pax_adults: 2, pax_children: 0,
    service_type: 'Tour', travel_type: 'Family',
    source: 'Online', pipeline_stage: 'New',
    budget: '', notes: '',
  });
  const [pendingScreenshots, setPendingScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = 'h-8 text-sm px-2 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c] bg-white w-full';

  const handleSubmit = async () => {
    if (!form.client_name || !form.phone) {
      toast.error('Client name and phone are required');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ ...form, _screenshots: pendingScreenshots });
    } catch {
      // parent handles error toast
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      client_name: '', phone: '', email: '', destination: '',
      travel_date: '', return_date: '',
      pax_adults: 2, pax_children: 0,
      service_type: 'Tour', travel_type: 'Family',
      source: 'Online', pipeline_stage: 'New',
      budget: '', notes: '',
    });
    setPendingScreenshots([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl w-[96vw] flex flex-col p-0 gap-0 max-h-[90vh]" data-testid="new-enquiry-modal">
        <DialogHeader className="px-5 py-3 border-b border-[#e6e9f0] flex-shrink-0 bg-white">
          <DialogTitle className="text-sm font-bold text-[#0b1220]">New Enquiry</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 flex-shrink-0 border-b border-[#e6e9f0]">
            <TabsList className="h-8 bg-[#f2f4f8] rounded-lg p-0.5 gap-0.5">
              <TabsTrigger value="details" className="text-xs px-3 h-7 rounded-md">Details</TabsTrigger>
              <TabsTrigger value="pax" className="text-xs px-3 h-7 rounded-md">Pax & Travel</TabsTrigger>
              <TabsTrigger value="screenshots" className="text-xs px-3 h-7 rounded-md flex items-center gap-1">
                Screenshots
                {pendingScreenshots.length > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-[16px] px-1 text-[9px] font-bold rounded-full"
                    style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
                    {pendingScreenshots.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Tab: Details */}
            <TabsContent value="details" className="m-0 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Client Name *</Label>
                  <input className={inp} value={form.client_name}
                    onChange={e => set('client_name', e.target.value)}
                    placeholder="Full Name" data-testid="enquiry-client-name" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Phone *</Label>
                  <input className={inp} value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+91 xxxxxxxxxx" data-testid="enquiry-phone" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Email</Label>
                  <input className={inp} type="email" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="email@example.com" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Destination</Label>
                  <input className={inp} value={form.destination}
                    onChange={e => set('destination', e.target.value)}
                    placeholder="e.g. Dubai, UAE" data-testid="enquiry-destination" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Service Type</Label>
                  <Select value={form.service_type} onValueChange={v => set('service_type', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Source</Label>
                  <Select value={form.source} onValueChange={v => set('source', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Pipeline Stage</Label>
                  <Select value={form.pipeline_stage} onValueChange={v => set('pipeline_stage', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Budget</Label>
                  <input className={inp} value={form.budget}
                    onChange={e => set('budget', e.target.value)}
                    placeholder="e.g. 1,50,000" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1.5 block">Notes</Label>
                  <textarea
                    className="w-full h-16 text-sm px-2 py-1.5 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c] resize-none"
                    value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Any additional notes..." />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Pax & Travel */}
            <TabsContent value="pax" className="m-0 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Travel Date</Label>
                  <input type="date" className={inp} value={form.travel_date}
                    onChange={e => set('travel_date', e.target.value)}
                    data-testid="enquiry-travel-date" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Return Date</Label>
                  <input type="date" className={inp} value={form.return_date}
                    onChange={e => set('return_date', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Adults</Label>
                  <input type="number" min="1" className={`${inp} text-center`}
                    value={form.pax_adults} onChange={e => set('pax_adults', parseInt(e.target.value) || 1)}
                    data-testid="enquiry-pax-adults" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Children (2-11)</Label>
                  <input type="number" min="0" className={`${inp} text-center`}
                    value={form.pax_children} onChange={e => set('pax_children', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Travel Type</Label>
                  <Select value={form.travel_type} onValueChange={v => set('travel_type', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TRAVEL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Screenshots */}
            <TabsContent value="screenshots" className="m-0 p-5">
              <div className="mb-3">
                <p className="text-xs font-semibold text-[#0b1220] mb-0.5">Reference Screenshots</p>
                <p className="text-[10px] text-[#5b6475]">Upload client screenshots, WhatsApp chats, or reference images. These will be attached to the enquiry when it’s created.</p>
              </div>
              <LocalScreenshotDropZone files={pendingScreenshots} onFiles={setPendingScreenshots} />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-5 py-3 border-t border-[#e6e9f0] flex-shrink-0 bg-white">
          {pendingScreenshots.length > 0 && (
            <span className="text-[10px] text-[#5b6475] mr-auto flex items-center gap-1">
              <Image className="w-3 h-3" />
              {pendingScreenshots.length} screenshot{pendingScreenshots.length !== 1 ? 's' : ''} will be attached
            </span>
          )}
          <Button variant="outline" onClick={handleClose} disabled={loading}
            data-testid="new-enquiry-cancel-btn" className="h-8 text-sm">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.client_name || !form.phone}
            data-testid="new-enquiry-submit-btn"
            className="h-8 text-sm"
            style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
            {loading ? 'Creating...' : 'Create Enquiry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
