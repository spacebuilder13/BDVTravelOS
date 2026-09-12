import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, Navigation, Plus, FileText, Shield, ChevronRight, Command, Map, Globe, BookOpen, Settings, Plane } from 'lucide-react';

const NAV_COMMANDS = [
  { label: 'CRM & Leads',        path: '/app/crm',         icon: Navigation,  desc: 'Lead pipeline & client profiles' },
  { label: 'Quotations',         path: '/app/quotations',  icon: FileText,    desc: 'Build and manage quotes' },
  { label: 'Itinerary Designer', path: '/app/itinerary',   icon: Map,         desc: 'Day-wise trip builder' },
  { label: 'Visa & Docs',        path: '/app/visa',        icon: Shield,      desc: 'Visa applications & docs' },
  { label: 'Transport',          path: '/app/transport',   icon: Plane,       desc: 'Flights, trains & transfers' },
  { label: 'Compass AI',         path: '/app/ai',          icon: Compass,     desc: '480-destination intel assistant' },
  { label: 'Maps',               path: '/app/maps',        icon: Map,         desc: 'In-app Google Maps' },
  { label: 'Browser',            path: '/app/browser',     icon: Globe,       desc: 'Quick research browser' },
  { label: 'Training',           path: '/app/training',    icon: BookOpen,    desc: 'Agent training resources' },
  { label: 'Settings',           path: '/app/settings',    icon: Settings,    desc: 'Agency brand & preferences' },
];

const ACTION_COMMANDS = [
  { id: 'new_enquiry', label: 'New Enquiry',   icon: Plus,      desc: 'Create a new lead / enquiry' },
  { id: 'new_quote',   label: 'New Quote',     icon: FileText,  desc: 'Start a quotation' },
  { id: 'new_visa',    label: 'New Visa File', icon: Shield,    desc: 'Open visa module' },
];

export function CompassCommandBar({ enquiries = [], onAction }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const buildSuggestions = useCallback(() => {
    const q = query.toLowerCase().trim();
    const results = [];

    // Quick actions
    const matchingActions = ACTION_COMMANDS.filter(a =>
      !q || a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    );
    if (matchingActions.length > 0) {
      results.push({ type: 'header', label: 'Quick Actions' });
      matchingActions.forEach(a => results.push({ type: 'action', ...a }));
    }

    // Navigation
    const matchingNav = NAV_COMMANDS.filter(n =>
      !q || n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)
    );
    if (matchingNav.length > 0) {
      results.push({ type: 'header', label: 'Navigate' });
      matchingNav.slice(0, 6).forEach(n => results.push({ type: 'nav', ...n }));
    }

    // Lead search
    if (q.length >= 2) {
      const matchingLeads = enquiries
        .filter(e =>
          e.client_name?.toLowerCase().includes(q) ||
          e.destination?.toLowerCase().includes(q)
        )
        .slice(0, 4);
      if (matchingLeads.length > 0) {
        results.push({ type: 'header', label: 'Leads' });
        matchingLeads.forEach(e => results.push({
          type: 'lead',
          id: e.id,
          label: e.client_name,
          sublabel: e.destination,
          stage: e.pipeline_stage,
          icon: Navigation,
          desc: e.destination,
        }));
      }
    }

    // Compass AI catch-all
    if (q.length > 0) {
      results.push({ type: 'header', label: 'Compass AI' });
      results.push({ type: 'compass', label: `Ask Compass AI: "${query}"`, query, icon: Compass, desc: 'Open AI assistant with this query' });
    }

    return results;
  }, [query, enquiries]);

  const items = buildSuggestions();
  const selectableItems = items.filter(i => i.type !== 'header');

  // Global keyboard shortcut Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const executeItem = (item) => {
    setOpen(false);
    setQuery('');
    if (item.type === 'action') {
      onAction?.(item.id);
    } else if (item.type === 'nav') {
      navigate(item.path);
    } else if (item.type === 'lead') {
      navigate('/app/crm');
    } else if (item.type === 'compass') {
      navigate('/app/ai', { state: { initialQuery: item.query } });
    }
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectableItems[selectedIdx]) {
        executeItem(selectableItems[selectedIdx]);
      } else if (query.trim()) {
        navigate('/app/ai', { state: { initialQuery: query } });
        setOpen(false); setQuery('');
      }
    }
  };

  const STAGE_COLORS = {
    New: '#4aa3ff', Qualified: '#a78bfa', Quoted: '#e8a830',
    'Follow-up': '#fb923c', Converted: '#4ade80', Lost: '#f87171',
  };

  return (
    <div ref={containerRef} className="relative w-full" data-testid="compass-command-bar">
      {/* Search Input */}
      <div
        className="flex items-center gap-3 px-4 h-12 rounded-lg border transition-all duration-200"
        style={{
          backgroundColor: open ? 'var(--j-elevated)' : 'var(--j-surface)',
          borderColor: open ? 'var(--cta)' : 'var(--stroke)',
          boxShadow: open ? 'var(--glow-cyan)' : 'none',
        }}
      >
        <Compass
          className="w-4 h-4 flex-shrink-0 transition-colors duration-150"
          style={{ color: open ? 'var(--cta)' : 'var(--app-muted)' }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelectedIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search leads, navigate pages, or ask Compass AI..."
          data-testid="compass-search-input"
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--app-fg)', caretColor: 'var(--cta)' }}
        />
        <kbd
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium flex-shrink-0"
          style={{
            background: 'var(--surface-3)',
            color: 'var(--app-muted)',
            border: '1px solid var(--stroke)',
            fontFamily: 'Figtree, sans-serif',
          }}
        >
          <Command className="w-3 h-3" />K
        </kbd>
      </div>

      {/* Dropdown */}
      {open && items.length > 0 && (
        <div
          className="absolute top-14 left-0 right-0 z-50 rounded-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--j-elevated)',
            borderColor: 'var(--stroke)',
            boxShadow: 'var(--shadow-2)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            maxHeight: '420px',
            overflowY: 'auto',
          }}
        >
          {(() => {
            let selectableCount = 0;
            return items.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <div
                    key={`h-${idx}`}
                    className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
                    style={{ color: 'var(--app-muted)' }}
                  >
                    {item.label}
                  </div>
                );
              }
              const sIdx = selectableCount++;
              const isSelected = sIdx === selectedIdx;
              const Icon = item.icon || ChevronRight;
              return (
                <button
                  key={`s-${idx}`}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                  style={{
                    backgroundColor: isSelected ? 'var(--cta-8)' : 'transparent',
                    color: isSelected ? 'var(--cta)' : 'var(--app-fg)',
                    borderLeft: isSelected ? '2px solid var(--cta)' : '2px solid transparent',
                  }}
                  onMouseEnter={() => setSelectedIdx(sIdx)}
                  onClick={() => executeItem(item)}
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: isSelected ? 'var(--cta)' : 'var(--app-muted)' }}
                  />
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  {item.stage && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{
                        color: STAGE_COLORS[item.stage] || '#a0b4d0',
                        background: `${STAGE_COLORS[item.stage] || '#a0b4d0'}22`,
                      }}
                    >
                      {item.stage}
                    </span>
                  )}
                  {item.sublabel && !item.stage && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--app-muted)' }}>
                      {item.sublabel}
                    </span>
                  )}
                  {item.desc && !item.sublabel && !item.stage && (
                    <span className="text-xs flex-shrink-0 hidden md:block" style={{ color: 'var(--app-muted)' }}>
                      {item.desc}
                    </span>
                  )}
                </button>
              );
            });
          })()}
          <div
            className="px-4 py-2 flex items-center gap-3 border-t text-[10px]"
            style={{ borderColor: 'var(--stroke-soft)', color: 'var(--app-muted)' }}
          >
            <span><kbd style={{ fontFamily: 'Figtree, sans-serif' }}>↑↓</kbd> navigate</span>
            <span style={{ color: 'var(--stroke)' }}>·</span>
            <span><kbd style={{ fontFamily: 'Figtree, sans-serif' }}>↵</kbd> select</span>
            <span style={{ color: 'var(--stroke)' }}>·</span>
            <span><kbd style={{ fontFamily: 'Figtree, sans-serif' }}>Esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  );
}
