import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { clientDocumentsAPI } from '../../services/api';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '../ui/dialog';
import {
  CreditCard, DollarSign, FileText, ClipboardList,
  Plane, Camera, Upload, Trash2, Download, Eye,
  FileImage, Loader2, X, FolderOpen
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export const DOC_CATEGORIES = [
  {
    key: 'passport_identity',
    label: 'Passport & Identity',
    shortLabel: 'Passport',
    icon: CreditCard,
    color: '#4AA3FF',
    bg: 'rgba(74,163,255,0.10)',
    description: 'Passport copies, national IDs, Aadhar, PAN card',
  },
  {
    key: 'financial',
    label: 'Financial Documents',
    shortLabel: 'Financial',
    icon: DollarSign,
    color: '#27AE60',
    bg: 'rgba(39,174,96,0.10)',
    description: 'Bank statements, salary slips, income proof, ITR',
  },
  {
    key: 'cover_letter',
    label: 'Cover Letters',
    shortLabel: 'Cover Letter',
    icon: FileText,
    color: '#F0B429',
    bg: 'rgba(240,180,41,0.10)',
    description: 'Visa cover letters, invitation letters, sponsorship letters',
  },
  {
    key: 'visa_application',
    label: 'Visa Application Forms',
    shortLabel: 'Visa Forms',
    icon: ClipboardList,
    color: '#8B7CFF',
    bg: 'rgba(139,124,255,0.10)',
    description: 'Completed visa application forms, DS-160, etc.',
  },
  {
    key: 'travel_proof',
    label: 'Travel Proof & Bookings',
    shortLabel: 'Travel Proof',
    icon: Plane,
    color: '#E8A830',
    bg: 'rgba(232,168,48,0.10)',
    description: 'Flight bookings, hotel reservations, itinerary documents',
  },
  {
    key: 'photographs',
    label: 'Photographs',
    shortLabel: 'Photos',
    icon: Camera,
    color: '#b76e79',
    bg: 'rgba(183,110,121,0.10)',
    description: 'Passport photos, biometric photographs, visa photos',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFileUrl(file) {
  return `${BACKEND_URL}${file.file_url}`;
}

function isImage(file) {
  const mime = file.file_type || '';
  return mime.startsWith('image/');
}

function isPdf(file) {
  return file.file_type === 'application/pdf';
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = parseISO(isoStr);
    return isValid(d) ? format(d, 'dd MMM yyyy') : '';
  } catch { return ''; }
}

// ── File Card ─────────────────────────────────────────────────────────────────

function FileCard({ file, onDelete, onView, compact }) {
  const [deleting, setDeleting] = useState(false);
  const url = getFileUrl(file);
  const img = isImage(file);
  const pdf = isPdf(file);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(file.id);
    setDeleting(false);
  };

  return (
    <div
      className="group relative bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all duration-150"
      data-testid={`client-doc-card-${file.id}`}
    >
      {/* Thumbnail / Icon */}
      <div className="relative">
        {img ? (
          <button
            type="button"
            onClick={() => onView(file)}
            className="w-full h-20 overflow-hidden block bg-gray-50"
          >
            <img
              src={url}
              alt={file.original_name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          </button>
        ) : pdf ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-20 flex items-center justify-center bg-red-50 hover:bg-red-100 transition-colors duration-150 block"
          >
            <div className="text-center">
              <FileText className="w-6 h-6 text-red-400 mx-auto mb-1" />
              <p className="text-[8px] text-red-400 font-semibold uppercase">PDF</p>
            </div>
          </a>
        ) : (
          <div className="w-full h-20 flex items-center justify-center bg-gray-50">
            <FileImage className="w-6 h-6 text-gray-300" />
          </div>
        )}

        {/* Action overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-150 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
          {img && (
            <button
              type="button"
              onClick={() => onView(file)}
              className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white shadow-sm"
              title="View"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
          <a
            href={url}
            download={file.original_name}
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white shadow-sm"
            title="Download"
          >
            <Download className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-red-500 hover:bg-red-50 shadow-sm disabled:opacity-50"
            title="Delete"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-2.5 py-2">
        <p className="text-[10px] font-semibold text-[#0b1220] truncate" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="text-[9px] text-[#5b6475] mt-0.5">
          {formatSize(file.size)} · {formatDate(file.uploaded_at)}
        </p>
      </div>
    </div>
  );
}

// ── Upload Drop Zone ──────────────────────────────────────────────────────────

function UploadZone({ category, onUploadClick, uploading }) {
  return (
    <button
      type="button"
      onClick={onUploadClick}
      disabled={uploading}
      className="w-full flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed transition-all duration-150 disabled:opacity-50"
      style={{
        borderColor: `${category.color}55`,
        backgroundColor: category.bg,
      }}
      data-testid={`upload-zone-${category.key}`}
    >
      {uploading ? (
        <Loader2 className="w-5 h-5 animate-spin mb-2" style={{ color: category.color }} />
      ) : (
        <Upload className="w-5 h-5 mb-2" style={{ color: category.color }} />
      )}
      <p className="text-xs font-semibold" style={{ color: category.color }}>
        {uploading ? 'Uploading...' : `Upload ${category.label}`}
      </p>
      <p className="text-[10px] text-[#5b6475] mt-1">{category.description}</p>
      <p className="text-[9px] text-[#5b6475]/70 mt-0.5">PDF, JPG, PNG, WEBP · Max 10MB</p>
    </button>
  );
}

// ── Image Preview Modal ───────────────────────────────────────────────────────

function ImagePreviewModal({ file, onClose }) {
  if (!file) return null;
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black">
        <DialogHeader className="px-4 pt-3 pb-2" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-white truncate">
              {file.original_name}
            </DialogTitle>
            <a
              href={getFileUrl(file)}
              download={file.original_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#c9a84c] hover:bg-white/10 transition-colors"
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          </div>
        </DialogHeader>
        <div className="flex items-center justify-center max-h-[75vh] overflow-auto bg-black/90 p-4">
          <img
            src={getFileUrl(file)}
            alt={file.original_name}
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * ClientDocumentsPanel
 * Props:
 *   clientId: string — required
 *   compact: boolean — smaller layout for side panels
 */
export function ClientDocumentsPanel({ clientId, compact = false }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('passport_identity');
  const [uploading, setUploading] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const uploadRef = useRef(null);

  const loadFiles = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await clientDocumentsAPI.list(clientId);
      setFiles(res.data || []);
    } catch {
      toast.error('Failed to load client documents');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUploadClick = () => {
    uploadRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF or images (JPG, PNG, WEBP) are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB allowed.');
      return;
    }

    setUploading(true);
    try {
      const res = await clientDocumentsAPI.upload(clientId, file, activeCategory);
      setFiles(prev => [res.data, ...prev]);
      toast.success(`${file.name} uploaded successfully`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await clientDocumentsAPI.delete(clientId, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('Document removed');
    } catch {
      toast.error('Failed to remove document');
    }
  };

  // Group files by category
  const grouped = useMemo(() => {
    return DOC_CATEGORIES.reduce((acc, cat) => {
      acc[cat.key] = files.filter(f => f.category === cat.key);
      return acc;
    }, {});
  }, [files]);

  const activeCat = DOC_CATEGORIES.find(c => c.key === activeCategory);
  const activeFiles = grouped[activeCategory] || [];

  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <FolderOpen className="w-8 h-8 text-gray-200" />
        <p className="text-sm text-[#5b6475]">No client linked</p>
        <p className="text-xs text-gray-400">Link a client profile to view documents</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="client-documents-panel">
      {/* Category Tab Bar */}
      <div className="flex-shrink-0 border-b border-[var(--border,#e6e9f0)] bg-white overflow-x-auto">
        <div className="flex min-w-max">
          {DOC_CATEGORIES.map(cat => {
            const count = grouped[cat.key]?.length || 0;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap flex-shrink-0"
                style={{
                  color: isActive ? cat.color : '#5b6475',
                  borderBottom: isActive ? `2px solid ${cat.color}` : '2px solid transparent',
                  backgroundColor: isActive ? cat.bg : 'transparent',
                }}
                data-testid={`doc-cat-tab-${cat.key}`}
              >
                <cat.icon className="w-3 h-3 flex-shrink-0" />
                <span>{compact ? cat.shortLabel : cat.label}</span>
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                    style={{
                      backgroundColor: isActive ? cat.color : 'rgba(0,0,0,0.08)',
                      color: isActive ? 'white' : '#5b6475',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <Skeleton className="h-20 w-full" />
                <div className="p-2 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Upload button at top */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUploadClick}
              disabled={uploading}
              className="gap-1.5 h-8 text-xs border-dashed w-full"
              style={{
                borderColor: `${activeCat?.color}66`,
                color: activeCat?.color,
                backgroundColor: activeCat?.bg,
              }}
              data-testid={`upload-btn-${activeCategory}`}
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? 'Uploading...' : `Upload to ${activeCat?.label}`}
            </Button>

            {/* Files grid */}
            {activeFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <activeCat.icon className="w-7 h-7" style={{ color: `${activeCat.color}44` }} />
                <p className="text-sm text-[#5b6475] font-medium">No {activeCat.label} yet</p>
                <p className="text-xs text-gray-400 max-w-[200px]">{activeCat.description}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {activeFiles.map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onDelete={handleDelete}
                    onView={setViewFile}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        data-testid="client-doc-file-input"
      />

      {/* Image preview */}
      {viewFile && (
        <ImagePreviewModal file={viewFile} onClose={() => setViewFile(null)} />
      )}
    </div>
  );
}

export default ClientDocumentsPanel;
