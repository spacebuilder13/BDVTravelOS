import React, { useState, useRef, useCallback } from 'react';
import { uploadsAPI } from '../../services/api';
import { toast } from 'sonner';
import { Upload, X, Image, FileText, Maximize2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function getFileUrl(file) {
  if (file._local) return file._localUrl;
  return `${BACKEND_URL}${file.file_url}`;
}

function isImage(file) {
  return file.file_type?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(file.file_name || file.original_name || '');
}

/**
 * ScreenshotUpload component
 * Props:
 *   module: string (e.g. 'quotes', 'enquiries', 'visa')
 *   recordId: string | null (null = local state only until parent records it)
 *   onUploaded: (file) => void  — called after each successful upload
 *   onRemoved: (fileId) => void
 *   initialFiles: array (already-uploaded files to display)
 *   showNotes: boolean (show note field per file)
 */
export function ScreenshotUpload({
  module = 'general',
  recordId = 'temp',
  onUploaded,
  onRemoved,
  initialFiles = [],
  showNotes = false,
  compact = false,
}) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    const accepted = Array.from(fileList).filter(f => {
      const ok = ['image/png','image/jpeg','image/jpg','image/webp','application/pdf'].includes(f.type);
      if (!ok) toast.error(`${f.name}: unsupported type`);
      return ok;
    });
    if (!accepted.length) return;
    setUploading(true);
    for (const f of accepted) {
      try {
        const res = await uploadsAPI.upload(module, recordId, f);
        const uploaded = res.data;
        setFiles(prev => [uploaded, ...prev]);
        onUploaded?.(uploaded);
      } catch {
        toast.error(`Failed to upload ${f.name}`);
      }
    }
    setUploading(false);
  }, [module, recordId, onUploaded]);

  const handleRemove = async (file) => {
    try {
      if (!file._local) await uploadsAPI.delete(module, file.record_id || recordId, file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      onRemoved?.(file.id);
      toast.success('Removed');
    } catch { toast.error('Failed to remove file'); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors duration-150 ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-[#e6e9f0] bg-[#f7f8fb] hover:border-[#0a1628] hover:bg-white'
        } ${compact ? 'py-4' : 'py-8'}`}
        data-testid="screenshot-dropzone"
      >
        <input ref={inputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#0a1628', borderTopColor: 'transparent' }} />
            <p className="text-xs text-[#5b6475]">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-[#5b6475] mb-2`} />
            <p className="text-xs font-medium text-[#0b1220]">{dragging ? 'Drop files here' : 'Drag & drop or click to browse'}</p>
            <p className="text-[10px] text-[#5b6475] mt-0.5">PNG, JPG, WEBP, PDF</p>
          </>
        )}
      </div>

      {/* File grid */}
      {files.length > 0 && (
        <div className={`grid gap-3 ${compact ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {files.map(file => (
            <div key={file.id} className="relative group rounded-lg border border-[#e6e9f0] overflow-hidden bg-white"
              data-testid={`screenshot-file-${file.id}`}>
              {/* Thumbnail */}
              {isImage(file) ? (
                <div className="aspect-video bg-[#f2f4f8] overflow-hidden cursor-pointer"
                  onClick={() => setLightbox(file)}>
                  <img src={getFileUrl(file)} alt={file.original_name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-video bg-[#f2f4f8] flex items-center justify-center">
                  <FileText className="w-8 h-8 text-[#5b6475]" />
                </div>
              )}
              {/* Info bar */}
              <div className="px-2 py-1.5 flex items-center justify-between">
                <p className="text-[10px] text-[#5b6475] truncate flex-1">{file.original_name || file.file_name}</p>
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  {isImage(file) && (
                    <button type="button" onClick={() => setLightbox(file)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475]">
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  )}
                  <button type="button" onClick={() => handleRemove(file)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-[#5b6475] hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {showNotes && (
                <div className="px-2 pb-1.5">
                  <input className="w-full text-[10px] px-1.5 py-1 border border-[#e6e9f0] rounded"
                    placeholder="Add note..."
                    defaultValue={file.note || ''}
                    onBlur={e => uploadsAPI.updateNote(module, file.record_id || recordId, file.id, e.target.value).catch(() => {})}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center">
            <img src={getFileUrl(lightbox)} alt="preview"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
              onClick={e => e.stopPropagation()} />
            <button type="button"
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={() => setLightbox(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
