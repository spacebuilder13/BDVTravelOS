import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import DOMPurify from 'dompurify';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { uploadsAPI } from '../../services/api';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Pin, FileText, ImageIcon, FileSpreadsheet,
  RotateCcw, Upload, X, Copy, Loader2, AlertCircle,
  RefreshCw, File
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/** Fields that can receive copied text via context menu */
const COPY_FIELDS = [
  { key: 'client_name', label: 'Client Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'destination', label: 'Destination' },
  { key: 'notes', label: 'Notes' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFileUrl(file) {
  if (!file) return '';
  return `${BACKEND_URL}${file.file_url}`;
}

function getFileType(file) {
  if (!file) return 'unknown';
  const mime = file.file_type || '';
  const name = (file.original_name || file.file_name || '').toLowerCase();
  const ext = name.split('.').pop();

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['doc', 'docx', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].some(v => mime === v || ext === v)) return 'docx';
  if (['xls', 'xlsx', 'csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].some(v => mime === v || ext === v)) return 'xlsx';
  return 'unknown';
}

function getDisplayName(file) {
  return file?.original_name || file?.file_name || 'Untitled';
}

function FileIcon({ type, className = 'w-3.5 h-3.5' }) {
  if (type === 'pdf') return <FileText className={className} />;
  if (type === 'image') return <ImageIcon className={className} />;
  if (type === 'xlsx') return <FileSpreadsheet className={className} />;
  if (type === 'docx') return <FileText className={className} />;
  return <File className={className} />;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenu({ x, y, selectedText, onCopyToField, onPin, onClose }) {
  const menuRef = useRef(null);
  const displayText = selectedText.length > 45
    ? selectedText.slice(0, 45) + '…'
    : selectedText;

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    // slight delay so the same click that opened menu doesn't close it
    const t = setTimeout(() => document.addEventListener('mousedown', close), 80);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', close); };
  }, [onClose]);

  // Clamp to viewport
  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      setPos({
        top: rect.bottom > vh ? Math.max(0, y - rect.height) : y,
        left: rect.right > vw ? Math.max(0, x - rect.width) : x,
      });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-2xl border border-[#e6e9f0] py-1 min-w-[220px] overflow-hidden"
      data-testid="doc-context-menu"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header: selected text preview */}
      <div className="px-3 py-2 border-b border-[#e6e9f0] bg-[#f7f8fb]">
        <p className="text-[10px] text-[#5b6475] font-semibold uppercase tracking-wider mb-0.5">Copy to Field</p>
        <p className="text-xs text-[#0b1220] font-medium leading-snug">
          "{displayText}"
        </p>
      </div>

      {/* Field targets */}
      {COPY_FIELDS.map(field => (
        <button
          key={field.key}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
          onClick={() => { onCopyToField(field.key, selectedText); onClose(); }}
          className="w-full text-left px-3 py-2 text-xs text-[#0b1220] hover:bg-[#f2f4f8] flex items-center gap-2.5 transition-colors duration-100"
          data-testid={`copy-to-${field.key}`}
        >
          <Copy className="w-3 h-3 text-[#5b6475] flex-shrink-0" />
          <span>{field.label}</span>
        </button>
      ))}

      <div className="h-px bg-[#e6e9f0] mx-2 my-1" />

      {/* Pin */}
      <button
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
        onClick={() => { onPin(selectedText); onClose(); }}
        className="w-full text-left px-3 py-2 text-xs font-semibold text-[#c9a84c] hover:bg-[#c9a84c]/10 flex items-center gap-2.5 transition-colors duration-100"
        data-testid="pin-selection-ctx"
      >
        <Pin className="w-3 h-3 flex-shrink-0" />
        Pin Selection
      </button>
    </div>
  );
}

// ── PDF Renderer ──────────────────────────────────────────────────────────────

function PDFRenderer({ fileUrl, zoom, currentPage, onTotalPages, onSelectText, onRenderDone }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = useState({ width: 600, height: 800 });

  // Load the PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl, withCredentials: false });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = doc;
        onTotalPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error', err);
          setError('Failed to load PDF.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl]); // eslint-disable-line

  // Render current page
  useEffect(() => {
    if (!pdfRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const pdfjsLib = await import('pdfjs-dist');
        const page = await pdfRef.current.getPage(currentPage);
        if (cancelled) return;

        const scale = zoom * 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setPageSize({ width: viewport.width, height: viewport.height });

        const ctx = canvas.getContext('2d');
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;

        if (cancelled) return;

        // Text layer — use replaceChildren() to avoid direct innerHTML assignment
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.replaceChildren(); // safer alternative to innerHTML = ''
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;

          try {
            const textContent = await page.getTextContent();
            if (cancelled) return;

            const renderTask = pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
              textDivs: [],
            });
            await renderTask.promise;
          } catch (textErr) {
            // text layer failure is non-critical
            console.warn('Text layer error:', textErr);
          }
        }

        if (!cancelled && onRenderDone) onRenderDone();
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('PDF render error', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfRef.current, currentPage, zoom]); // eslint-disable-line

  const handleMouseUp = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel) onSelectText(sel);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#c9a84c]" />
        <p className="text-xs text-[#5b6475]">Loading PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <AlertCircle className="w-7 h-7 text-red-400" />
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="relative inline-block"
      onMouseUp={handleMouseUp}
      data-testid="pdf-canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="block shadow-lg rounded"
        data-testid="pdf-canvas"
      />
      {/* Transparent text layer for selection */}
      <div
        ref={textLayerRef}
        className="absolute inset-0 overflow-hidden pdf-text-layer"
        style={{
          userSelect: 'text',
          WebkitUserSelect: 'text',
          MozUserSelect: 'text',
          pointerEvents: 'all',
          cursor: 'text',
        }}
        data-testid="pdf-text-layer"
      />
    </div>
  );
}

// ── Image Renderer ────────────────────────────────────────────────────────────

function ImageRenderer({ fileUrl, zoom, onSelectText }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative inline-block overflow-visible"
      style={{ transformOrigin: 'top center', transform: `scale(${zoom})` }}
      onMouseUp={() => {
        const sel = window.getSelection()?.toString().trim();
        if (sel) onSelectText(sel);
      }}
    >
      {!loaded && (
        <Skeleton className="w-[520px] h-[380px] rounded-lg" />
      )}
      <img
        src={fileUrl}
        alt="Document"
        className={`max-w-full rounded-lg shadow-lg block transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0 absolute'}`}
        onLoad={() => setLoaded(true)}
        draggable={false}
        data-testid="image-renderer"
      />
    </div>
  );
}

// ── DOCX Renderer ─────────────────────────────────────────────────────────────

function DocxRenderer({ fileUrl, zoom, onSelectText }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [mammothMod, response] = await Promise.all([
          import('mammoth'),
          fetch(fileUrl),
        ]);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const result = await mammothMod.default.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        setHtml(result.value || '<p>Empty document</p>');
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('DOCX render error', err);
          setError('Failed to render Word document.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-[#c9a84c]" />
      <p className="text-xs text-[#5b6475]">Rendering Word document…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <AlertCircle className="w-7 h-7 text-red-400" />
      <p className="text-xs text-red-500">{error}</p>
    </div>
  );

  return (
    <div
      className="docx-viewer bg-white rounded-lg shadow-md p-6 min-w-[480px]"
      style={{ zoom, userSelect: 'text', WebkitUserSelect: 'text' }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) }}
      onMouseUp={() => {
        const sel = window.getSelection()?.toString().trim();
        if (sel) onSelectText(sel);
      }}
      data-testid="docx-renderer"
    />
  );
}

// ── XLSX Renderer ─────────────────────────────────────────────────────────────

function XlsxRenderer({ fileUrl, zoom, onSelectText }) {
  const [sheetData, setSheetData] = useState([]);   // array of { name, html }
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [XLSXMod, response] = await Promise.all([
          import('xlsx'),
          fetch(fileUrl),
        ]);
        const XLSX = XLSXMod.default || XLSXMod;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheets = workbook.SheetNames.map(name => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name]),
        }));
        if (cancelled) return;
        setSheetData(sheets);
        setActiveSheet(0);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('XLSX render error', err);
          setError('Failed to render spreadsheet.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-[#c9a84c]" />
      <p className="text-xs text-[#5b6475]">Rendering spreadsheet…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <AlertCircle className="w-7 h-7 text-red-400" />
      <p className="text-xs text-red-500">{error}</p>
    </div>
  );

  if (!sheetData.length) return (
    <p className="text-xs text-[#5b6475] text-center py-8">Empty spreadsheet</p>
  );

  return (
    <div
      className="xlsx-viewer bg-white rounded-lg shadow-md overflow-hidden min-w-[480px]"
      style={{ zoom }}
      data-testid="xlsx-renderer"
    >
      {/* Sheet tabs */}
      {sheetData.length > 1 && (
        <div className="flex gap-1 px-3 pt-2 pb-0 border-b border-[#e6e9f0] bg-[#f7f8fb] flex-wrap">
          {sheetData.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1.5 text-[10px] font-medium rounded-t-md border transition-colors duration-100 ${
                i === activeSheet
                  ? 'bg-white border-[#e6e9f0] border-b-white text-[#0b1220] -mb-px'
                  : 'border-transparent text-[#5b6475] hover:text-[#0b1220]'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div
        className="p-4 overflow-x-auto"
        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        onMouseUp={() => {
          const sel = window.getSelection()?.toString().trim();
          if (sel) onSelectText(sel);
        }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sheetData[activeSheet]?.html || '', { USE_PROFILES: { html: true } }) }}
      />
    </div>
  );
}

// ── Unknown / Unsupported ─────────────────────────────────────────────────────

function UnknownRenderer({ file }) {
  const url = getFileUrl(file);
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <File className="w-12 h-12 text-[#5b6475]/30" />
      <p className="text-sm font-medium text-[#0b1220]">{getDisplayName(file)}</p>
      <p className="text-xs text-[#5b6475]">Preview not available for this file type</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 text-xs text-[#c9a84c] underline underline-offset-2 hover:text-[#b8912a] transition-colors duration-150"
      >
        Open in new tab
      </a>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ enquiryId, onUploadStart }) {
  const inputRef = useRef(null);

  if (!enquiryId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <ImageIcon className="w-10 h-10 text-[#5b6475]/20 mb-3" />
        <p className="text-xs font-semibold text-[#5b6475]">No enquiry linked</p>
        <p className="text-[10px] text-[#5b6475]/60 mt-1">Link an enquiry to view uploaded documents</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <FileText className="w-10 h-10 text-[#5b6475]/20 mb-3" />
      <p className="text-xs font-semibold text-[#5b6475]">No documents uploaded</p>
      <p className="text-[10px] text-[#5b6475]/60 mt-1.5 mb-4">
        Upload PDF, images, Word, or Excel files for this enquiry
      </p>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#c9a84c] text-xs font-medium text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors duration-150"
        data-testid="doc-viewer-upload-btn"
      >
        <Upload className="w-3 h-3" />
        Upload document
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
        onChange={e => { if (e.target.files[0]) onUploadStart(e.target.files[0]); }}
      />
    </div>
  );
}

// ── Main DocumentViewer Component ─────────────────────────────────────────────

/**
 * DocumentViewer
 * Props:
 *   enquiryId: string | null
 *   initialFiles: array of file objects
 *   onCopyToField(fieldKey, text): callback for context menu "Copy to Field"
 *   onStickySelect(text): callback when user selects text (for sticky paste)
 *   onPinAdd(text): callback when user pins a selection
 */
export function DocumentViewer({
  enquiryId,
  initialFiles = [],
  onCopyToField,
  onStickySelect,
  onPinAdd,
}) {
  const [files, setFiles] = useState(initialFiles);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, text }
  const [selectedText, setSelectedText] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef(null);
  const viewerRef = useRef(null);
  const scrollRef = useRef(null);

  // Sync files when prop changes
  useEffect(() => {
    setFiles(initialFiles);
    setActiveIdx(0);
    setCurrentPage(1);
    setZoom(1.0);
  }, [initialFiles]);

  const activeFile = files[activeIdx] || null;
  const fileType = useMemo(() => getFileType(activeFile), [activeFile]);

  // Zoom helpers
  const zoomIn = () => setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))));
  const zoomOut = () => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))));
  const resetZoom = () => setZoom(1.0);

  // Page helpers
  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  // Reset page when file changes
  useEffect(() => {
    setCurrentPage(1);
    setZoom(1.0);
    setTotalPages(1);
    setSelectedText('');
    setContextMenu(null);
  }, [activeIdx]);

  // Handle text selection from child renderers
  const handleSelectText = useCallback((text) => {
    if (!text) return;
    setSelectedText(text);
    if (onStickySelect) onStickySelect(text);
  }, [onStickySelect]);

  // Context menu on right-click
  const handleContextMenu = useCallback((e) => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, text: sel });
  }, []);

  // Pin the current selection
  const handlePin = useCallback((text) => {
    if (!text || !onPinAdd) return;
    onPinAdd(text);
    toast.success('Selection pinned!', { duration: 1800 });
  }, [onPinAdd]);

  // Pin via toolbar button
  const handlePinButton = () => {
    if (!selectedText) {
      toast.info('Select text in the document first', { duration: 2000 });
      return;
    }
    handlePin(selectedText);
  };

  // Upload a new file
  const handleUpload = useCallback(async (file) => {
    if (!enquiryId) {
      toast.error('Link an enquiry first to upload documents');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadsAPI.upload('enquiries', enquiryId, file);
      const newFile = res.data;
      setFiles(prev => [...prev, newFile]);
      setActiveIdx(prev => files.length); // switch to newly uploaded file
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }, [enquiryId, files.length]);

  // Reload from server
  const handleReload = useCallback(async () => {
    if (!enquiryId) return;
    try {
      const res = await uploadsAPI.list('enquiries', enquiryId);
      setFiles(res.data || []);
    } catch (e) { console.warn('[DocumentViewer] Failed to reload files:', e); }
  }, [enquiryId]);

  return (
    <div
      className="h-full flex flex-col bg-[#f7f8fb] overflow-hidden"
      onContextMenu={handleContextMenu}
      data-testid="document-viewer"
    >
      {/* ── File Tab Bar ── */}
      {files.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-0 border-b border-[#e6e9f0] bg-white overflow-x-auto scrollbar-hide"
          style={{ minHeight: 36 }}
          data-testid="doc-tab-bar"
        >
          {files.map((file, i) => {
            const ft = getFileType(file);
            const name = getDisplayName(file);
            const isActive = i === activeIdx;
            return (
              <button
                key={file.id ? `file-${file.id}` : `file-idx-${i}`}
                onClick={() => setActiveIdx(i)}
                title={name}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium border-r border-[#e6e9f0] flex-shrink-0 max-w-[130px] transition-colors duration-100 ${
                  isActive
                    ? 'bg-[#f7f8fb] text-[#0b1220] border-b-2 border-b-[#c9a84c]'
                    : 'bg-white text-[#5b6475] hover:bg-[#f7f8fb] hover:text-[#0b1220]'
                }`}
                data-testid={`doc-tab-${i}`}
              >
                <FileIcon type={ft} className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{name}</span>
              </button>
            );
          })}
          {/* Upload button in tab bar */}
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            title="Upload document"
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 text-[10px] text-[#5b6475] hover:text-[#c9a84c] hover:bg-[#c9a84c]/5 transition-colors duration-100 ml-auto"
            data-testid="doc-tab-upload-btn"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      {files.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[#e6e9f0] bg-white"
          data-testid="doc-toolbar"
        >
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mr-1">
            <button
              onClick={zoomOut}
              title="Zoom out"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] hover:text-[#0b1220] transition-colors duration-100"
              data-testid="doc-zoom-out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetZoom}
              title="Reset zoom"
              className="px-2 h-6 text-[10px] font-semibold text-[#5b6475] hover:bg-[#f2f4f8] rounded transition-colors duration-100 min-w-[40px] text-center"
              data-testid="doc-zoom-label"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              title="Zoom in"
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] hover:text-[#0b1220] transition-colors duration-100"
              data-testid="doc-zoom-in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-[#e6e9f0] mx-1" />

          {/* Page navigation — only for PDF */}
          {fileType === 'pdf' && totalPages > 1 && (
            <>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevPage}
                  disabled={currentPage <= 1}
                  title="Previous page"
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] disabled:opacity-30 transition-colors duration-100"
                  data-testid="doc-prev-page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-medium text-[#5b6475] min-w-[52px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  title="Next page"
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] disabled:opacity-30 transition-colors duration-100"
                  data-testid="doc-next-page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-px h-4 bg-[#e6e9f0] mx-1" />
            </>
          )}

          {/* Pin selected text */}
          <button
            onClick={handlePinButton}
            title={selectedText ? `Pin: "${selectedText.slice(0, 30)}…"` : 'Select text to pin'}
            className={`flex items-center gap-1 px-2 h-6 text-[10px] font-medium rounded transition-colors duration-100 ${
              selectedText
                ? 'text-[#c9a84c] hover:bg-[#c9a84c]/10 border border-[#c9a84c]/30'
                : 'text-[#5b6475]/50 cursor-default'
            }`}
            data-testid="doc-pin-btn"
          >
            <Pin className="w-3 h-3" />
            {selectedText ? 'Pin' : 'Pin Selection'}
          </button>

          {/* Current selection badge */}
          {selectedText && (
            <div className="flex items-center gap-1 ml-1">
              <Badge
                className="text-[9px] h-5 px-2 font-medium max-w-[120px] truncate"
                style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                title={selectedText}
                data-testid="doc-selected-text-badge"
              >
                "{selectedText.length > 18 ? selectedText.slice(0, 18) + '…' : selectedText}"
              </Badge>
              <button
                onClick={() => { setSelectedText(''); if (onStickySelect) onStickySelect(''); }}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#e6e9f0] text-[#5b6475] transition-colors duration-100"
                data-testid="doc-clear-selection"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Reload */}
          <button
            onClick={handleReload}
            title="Reload files"
            className="ml-auto w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] hover:text-[#0b1220] transition-colors duration-100"
            data-testid="doc-reload-btn"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Sticky text hint banner ── */}
      {selectedText && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#0a1628]/[0.04] border-b border-[#e6e9f0]"
          data-testid="sticky-hint-bar"
        >
          <Copy className="w-3 h-3 text-[#c9a84c] flex-shrink-0" />
          <p className="text-[10px] text-[#5b6475] flex-1 min-w-0">
            <span className="font-semibold text-[#c9a84c]">Sticky: </span>
            Click any target field to append "{selectedText.length > 50 ? selectedText.slice(0, 50) + '…' : selectedText}"
          </p>
          <button
            onClick={e => { e.stopPropagation(); setSelectedText(''); if (onStickySelect) onStickySelect(''); }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#e6e9f0] text-[#5b6475]"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* ── Document Content ── */}
      {files.length === 0 ? (
        <EmptyState enquiryId={enquiryId} onUploadStart={handleUpload} />
      ) : (
        <div
          ref={viewerRef}
          className="flex-1 overflow-auto p-4 flex justify-center"
          data-testid="doc-content-area"
        >
          {fileType === 'pdf' && (
            <PDFRenderer
              fileUrl={getFileUrl(activeFile)}
              zoom={zoom}
              currentPage={currentPage}
              onTotalPages={setTotalPages}
              onSelectText={handleSelectText}
            />
          )}
          {fileType === 'image' && (
            <ImageRenderer
              fileUrl={getFileUrl(activeFile)}
              zoom={zoom}
              onSelectText={handleSelectText}
            />
          )}
          {fileType === 'docx' && (
            <DocxRenderer
              fileUrl={getFileUrl(activeFile)}
              zoom={zoom}
              onSelectText={handleSelectText}
            />
          )}
          {fileType === 'xlsx' && (
            <XlsxRenderer
              fileUrl={getFileUrl(activeFile)}
              zoom={zoom}
              onSelectText={handleSelectText}
            />
          )}
          {fileType === 'unknown' && (
            <UnknownRenderer file={activeFile} />
          )}
        </div>
      )}

      {/* ── Hidden file upload input ── */}
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
        onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); }}
      />

      {/* ── Context Menu ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          onCopyToField={onCopyToField}
          onPin={handlePin}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
