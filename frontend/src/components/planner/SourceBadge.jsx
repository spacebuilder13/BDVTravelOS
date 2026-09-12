import React, { useMemo, useState } from 'react';
import { ExternalLink, AlertTriangle, Clock, Trash2, Image as ImageIcon, X } from 'lucide-react';

function getDomainLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getDaysSince(isoDate) {
  if (!isoDate) return null;
  const captured = new Date(isoDate);
  const now = new Date();
  return Math.floor((now - captured) / (1000 * 60 * 60 * 24));
}

// ── Screenshot Lightbox ──────────────────────────────────────────────────────
function ScreenshotLightbox({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center"
      style={{ background: 'rgba(5,10,20,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      data-testid="screenshot-lightbox"
    >
      <div
        className="relative max-w-4xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <img
          src={src}
          alt="Captured screenshot"
          className="max-w-full max-h-[80vh] object-contain"
          data-testid="screenshot-lightbox-img"
        />
        <button
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={onClose}
          data-testid="screenshot-lightbox-close"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Screenshot Thumbnail ─────────────────────────────────────────────────────
function ScreenshotThumb({ src }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgLoaded, setImgLoaded]       = useState(false);
  const [imgError, setImgError]         = useState(false);

  // Always render the button when src is provided — show fallback icon if image fails
  if (!src) return null;

  return (
    <>
      <button
        data-testid="screenshot-thumb"
        onClick={() => setLightboxOpen(true)}
        className="flex-shrink-0 flex items-center justify-center rounded overflow-hidden transition-all hover:opacity-90"
        style={{
          width: '28px',
          height: '22px',
          border: '1px solid rgba(255,255,255,0.15)',
          background: imgLoaded && !imgError ? 'transparent' : 'rgba(0,229,255,0.08)',
          position: 'relative',
        }}
        title="View screenshot"
      >
        {!imgError ? (
          <img
            src={src}
            alt="screenshot"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imgLoaded ? 'block' : 'none',
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : null}
        {/* Show icon when not yet loaded or on error */}
        {(!imgLoaded || imgError) && (
          <ImageIcon className="w-3 h-3" style={{ color: 'var(--cta)', opacity: 0.7 }} />
        )}
      </button>
      {lightboxOpen && <ScreenshotLightbox src={src} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}

// ── SourceBadge ───────────────────────────────────────────────────────────────
/**
 * SourceBadge — compact badge showing a captured source.
 *
 * Props:
 *   source     — source object from DB
 *   onDelete   — optional callback(sourceId)
 */
export function SourceBadge({ source, onDelete }) {
  const daysSince = useMemo(() => getDaysSince(source?.captured_at), [source?.captured_at]);
  const isStale   = daysSince !== null && daysSince > 14;
  const domain    = getDomainLabel(source?.url || '');
  const ageColor  = isStale ? '#FFB300' : 'var(--j-green)';
  const AgIcon    = isStale ? AlertTriangle : Clock;

  return (
    <div
      data-testid={`source-badge-${source.id}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg group"
      style={{
        background: 'rgba(27,156,252,0.06)',
        border: '1px solid rgba(27,156,252,0.16)',
        fontSize: '11px',
      }}
    >
      {/* Domain link */}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`source-badge-link-${source.id}`}
        className="flex items-center gap-1 font-mono hover:underline truncate max-w-[130px]"
        style={{ color: 'var(--j-blue2)' }}
        title={source.url}
      >
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
        {domain}
      </a>

      {/* Price */}
      {source.captured_price != null && (
        <span
          data-testid={`source-badge-price-${source.id}`}
          className="font-semibold flex-shrink-0"
          style={{ color: 'var(--cta)' }}
        >
          {source.captured_currency || 'INR'} {Number(source.captured_price).toLocaleString()}
        </span>
      )}

      {/* Screenshot thumbnail */}
      {source.screenshot_url && (
        <ScreenshotThumb src={source.screenshot_url} />
      )}

      {/* Age stamp — AMBER if > 14 days */}
      <span
        data-testid={`source-badge-age-${source.id}`}
        className="flex items-center gap-0.5 flex-shrink-0"
        style={{ color: ageColor }}
        title={
          isStale
            ? `⚠ Source is ${daysSince} days old — consider re-checking`
            : `Captured ${daysSince} day(s) ago`
        }
      >
        <AgIcon className="w-3 h-3" />
        {daysSince === 0 ? 'today' : `${daysSince}d`}
      </span>

      {/* Delete */}
      {onDelete && (
        <button
          data-testid={`source-badge-delete-${source.id}`}
          onClick={(e) => { e.stopPropagation(); onDelete(source.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20 flex-shrink-0 ml-auto"
          style={{ color: 'var(--danger)' }}
          title="Remove source"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── SourceBadgeList ───────────────────────────────────────────────────────────
/**
 * SourceBadgeList — list of source badges for a component (leg/stay).
 */
export function SourceBadgeList({ sources = [], onDelete }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-col gap-1 mt-1.5" data-testid="source-badge-list">
      {sources.map(src => (
        <SourceBadge key={src.id} source={src} onDelete={onDelete} />
      ))}
    </div>
  );
}
