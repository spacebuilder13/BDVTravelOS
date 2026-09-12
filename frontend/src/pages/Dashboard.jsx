import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { enquiriesAPI, dashboardAPI, uploadsAPI } from '../services/api';
import AlertsPanel from '../components/dashboard/AlertsPanel';
import StatsPanel from '../components/dashboard/StatsPanel';
import WorldClockWidget from '../components/dashboard/WorldClockWidget';
import CurrencyConverterWidget from '../components/dashboard/CurrencyConverterWidget';
import NewEnquiryModal from '../components/dashboard/NewEnquiryModal';
import { QuoteBuilderModal } from '../components/quotes/QuoteBuilderModal';
import { CompassCommandBar } from '../components/dashboard/CompassCommandBar';
import { LEAD_STAGES } from '../constants/stages';
import {
  RefreshCw, Plus, FileText, Shield, BookmarkPlus, Upload,
  Users, ChevronRight, ChevronDown, Settings2, Eye, EyeOff, Plane,
  TrendingUp, CheckCircle, Briefcase, Activity, Clock, DollarSign
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { DASHBOARD } from '../constants/testIds';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const DEFAULT_SHORTCUTS = [
  { id: 'new_enquiry', label: 'New Enquiry',  icon: 'Plus',         enabled: true },
  { id: 'new_quote',   label: 'New Quote',    icon: 'FileText',     enabled: true },
  { id: 'new_visa',    label: 'Visa File',    icon: 'Shield',       enabled: true },
  { id: 'new_booking', label: 'New Booking',  icon: 'BookmarkPlus', enabled: true },
  { id: 'upload_ss',   label: 'Upload Docs',  icon: 'Upload',       enabled: true },
];

const ICON_MAP = { Plus, FileText, Shield, BookmarkPlus, Upload, Users };

const STAGE_PILLS = [
  { id: 'New',       color: '#4aa3ff', bg: 'rgba(74,163,255,0.14)'  },
  { id: 'Qualified', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  { id: 'Quoted',    color: '#e8a830', bg: 'rgba(232,168,48,0.14)'  },
  { id: 'Follow-up', color: '#fb923c', bg: 'rgba(251,146,60,0.14)'  },
  { id: 'Converted', color: '#4ade80', bg: 'rgba(74,222,128,0.14)'  },
  { id: 'Lost',      color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
];

const KPI_STRIP = [
  { key: 'total_leads_month', label: 'Leads This Month', icon: Users,        color: 'var(--j-blue2)', accent: 'rgba(79,195,247,0.12)' },
  { key: 'conversions',       label: 'Converted',         icon: CheckCircle,  color: 'var(--j-green)', accent: 'rgba(43,232,160,0.12)' },
  { key: 'active_bookings',   label: 'Active Bookings',   icon: Briefcase,    color: 'var(--j-teal)',  accent: 'rgba(0,255,209,0.10)'  },
  { key: 'revenue',           label: 'Revenue',           icon: TrendingUp,   color: 'var(--j-amber)', accent: 'rgba(255,179,0,0.10)',  prefix: '\u20B9' },
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function getStageStyle(stage) {
  return STAGE_PILLS.find(s => s.id === stage) || { color: '#a0b4d0', bg: 'rgba(160,180,208,0.14)' };
}

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return null; }
}

/* ─── Boarding Pass Card ────────────────────────────────────────────────────── */
function BoardingPassCard({ enq, onClick }) {
  const dateStr = formatDate(enq.travel_date);
  const dest    = enq.destination || 'Unknown';
  const { color, bg } = getStageStyle(enq.pipeline_stage);

  return (
    <div
      className="boarding-pass cursor-pointer"
      onClick={onClick}
      data-testid={`boarding-pass-${enq.id}`}
    >
      <div className="notch-left" />
      <div className="notch-right" />
      <div className="p-5">
        {/* Route row */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--app-muted)' }}>FROM</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--app-fg)' }}>HQ</p>
          </div>
          <div className="flex flex-col items-center gap-0.5 flex-1 mx-3">
            <div className="flex items-center gap-1 w-full">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--stroke)' }} />
              <Plane className="w-3.5 h-3.5 rotate-90" style={{ color: 'var(--cta)' }} />
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--stroke)' }} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--app-muted)' }}>TO</p>
            <p className="text-2xl font-bold truncate max-w-[100px]" style={{ color: 'var(--cta)' }}>
              {dest.split(',')[0]}
            </p>
          </div>
        </div>
        <div className="border-t border-dashed my-3" style={{ borderColor: 'var(--stroke)' }} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>PASSENGER</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--app-fg)' }}>{enq.client_name}</p>
          </div>
          {dateStr && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--app-muted)' }}>DATE</p>
              <p className="text-xs font-mono font-semibold mt-0.5" style={{ color: 'var(--app-fg)' }}>{dateStr}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          {(enq.pax_adults || enq.pax_children) && (
            <p className="text-[10px] font-mono" style={{ color: 'var(--app-muted)' }}>
              {enq.pax_adults || 0}A {enq.pax_children || 0}C
            </p>
          )}
          <div className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: bg, color }}>
            {enq.pipeline_stage}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────────────────────────── */
function KPICard({ item, value }) {
  const Icon = item.icon;
  const displayValue = value === undefined || value === null ? '–'
    : typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <div
      className="hud-panel hud-clip p-4 relative overflow-hidden"
      data-testid={DASHBOARD.kpi?.(item.key)}
    >
      {/* Accent bar at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: item.color, opacity: 0.65 }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium mb-1 uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>
            {item.label}
          </p>
          <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: item.color }}>
            {item.prefix || ''}{displayValue}
          </p>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded flex-shrink-0 mt-0.5" style={{ background: item.accent }}>
          <Icon className="w-4 h-4" style={{ color: item.color }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Collapsible Section ───────────────────────────────────────────────────── */
function CollapsibleSection({ title, icon: Icon, defaultOpen = true, badge, children, testId }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div data-testid={testId}>
      {/* Toggle Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg mb-2 transition-colors"
        style={{
          backgroundColor: 'var(--j-surface)',
          border: '1px solid var(--stroke)',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = open ? 'var(--cta)' : 'var(--stroke-soft)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" style={{ color: open ? 'var(--cta)' : 'var(--app-muted)' }} />}
          <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: open ? 'var(--app-fg)' : 'var(--app-muted)' }}>
            {title}
          </span>
          {badge !== undefined && (
            <span
              className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ backgroundColor: 'var(--cta-15)', color: 'var(--cta)', border: '1px solid var(--cta-30)' }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>{open ? 'collapse' : 'expand'}</span>
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200"
            style={{
              color: 'var(--app-muted)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [enquiries, setEnquiries] = useState([]);
  const [stats,     setStats    ] = useState(null);
  const [alerts,    setAlerts   ] = useState(null);
  const [loading,   setLoading  ] = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [showNewEnquiry, setShowNewEnquiry] = useState(false);
  const [showNewQuote,   setShowNewQuote  ] = useState(false);
  const [activeStage, setActiveStage] = useState('All');
  const [shortcutsConfig, setShortcutsConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bdv_shortcuts_config') || 'null') || DEFAULT_SHORTCUTS; }
    catch { return DEFAULT_SHORTCUTS; }
  });
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const shortcutsMenuRef = useRef(null);

  const enabledShortcuts = useMemo(() => shortcutsConfig.filter(s => s.enabled), [shortcutsConfig]);

  /* ── Data loading ── */
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [enqRes, statsRes, alertsRes] = await Promise.all([
        enquiriesAPI.list(),
        dashboardAPI.stats(),
        dashboardAPI.alerts(),
      ]);
      setEnquiries(enqRes.data);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
    } catch {
      if (!silent) toast.error('Failed to load dashboard data');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = (e) => {
      if (shortcutsMenuRef.current && !shortcutsMenuRef.current.contains(e.target))
        setShowShortcutsMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Handlers ── */
  const handleNewEnquiry = async (data) => {
    const { _screenshots, ...enquiryData } = data;
    try {
      const res = await enquiriesAPI.create(enquiryData);
      const enquiryId = res.data?.id;
      if (enquiryId && _screenshots?.length > 0) {
        for (const file of _screenshots) {
          try { await uploadsAPI.upload('enquiries', enquiryId, file); } catch (e) { console.warn('[Dashboard] Screenshot upload skipped:', e); }
        }
      }
      toast.success('Enquiry created!');
      setShowNewEnquiry(false);
      loadData(true);
    } catch { toast.error('Failed to create enquiry'); }
  };

  const toggleShortcut = (id) => {
    const updated = shortcutsConfig.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setShortcutsConfig(updated);
    localStorage.setItem('bdv_shortcuts_config', JSON.stringify(updated));
  };

  const handleShortcut = (id) => {
    if      (id === 'new_enquiry') setShowNewEnquiry(true);
    else if (id === 'new_quote')   setShowNewQuote(true);
    else if (id === 'new_visa')    navigate('/app/visa');
    else if (id === 'new_booking') toast.info('Booking module coming soon!');
    else if (id === 'upload_ss')   toast.info('Use the Upload button inside a Quote or Enquiry');
  };

  /* ── Derived data ── */
  const stages = LEAD_STAGES?.map(s => s.id) || ['New','Qualified','Quoted','Follow-up','Converted','Lost'];
  const stageCounts = stages.reduce((acc, s) => ({ ...acc, [s]: enquiries.filter(e => e.pipeline_stage === s).length }), {});
  const totalCount  = enquiries.length;

  const filteredEnquiries = activeStage === 'All'
    ? enquiries
    : enquiries.filter(e => e.pipeline_stage === activeStage);

  const upcoming = enquiries
    .filter(e => e.travel_date)
    .sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date))
    .slice(0, 10);

  const greeting = new Date().getHours() < 12 ? 'Good morning'
    : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--cta)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--app-muted)' }}>Loading mission data…</p>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <TooltipProvider>
      <div className="space-y-5 pb-8" data-testid="dashboard-root">

        {/* ══════ ROW 1: Header ══════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cta)' }}>
              {greeting}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded border transition-colors disabled:opacity-40"
              style={{ color: 'var(--app-muted)', border: '1px solid var(--stroke)', borderRadius: '4px' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cta-5)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowNewEnquiry(true)}
              data-testid={DASHBOARD.newEnquiryBtn}
              className="hud-btn hud-btn-primary flex items-center gap-2 h-9 px-4"
            >
              <Plus className="w-4 h-4" /> New Enquiry
            </button>
          </div>
        </div>

        {/* ══════ ROW 2: Compass AI Command Bar ════════════════════════════════ */}
        <CompassCommandBar
          enquiries={enquiries}
          onAction={(id) => {
            if      (id === 'new_enquiry') setShowNewEnquiry(true);
            else if (id === 'new_quote')   setShowNewQuote(true);
            else if (id === 'new_visa')    navigate('/app/visa');
          }}
        />

        {/* ══════ ROW 3: KPI Cards ════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_STRIP.map(item => (
            <KPICard key={item.key} item={item} value={stats?.[item.key]} />
          ))}
        </div>

        {/* ══════ ROW 3: Main Two-Column Grid ════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-5">

          {/* ── Left: Pipeline + Lead List ────────────────────────────────── */}
          <div className="col-span-12 xl:col-span-8 space-y-4">

            {/* Pipeline + Lead List — Collapsible */}
            <CollapsibleSection
              title="Lead Pipeline"
              icon={Users}
              badge={totalCount}
              defaultOpen={true}
              testId="leads-collapsible"
            >
              <div className="hud-panel overflow-hidden">
              {/* Pipeline pills */}
              <div className="p-4" style={{ borderBottom: '1px solid var(--stroke-soft)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* All pill */}
                  <button
                    data-testid="stage-pill-all"
                    onClick={() => setActiveStage('All')}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-medium border transition-colors duration-150"
                    style={{
                      borderColor:     activeStage === 'All' ? 'var(--cta)' : 'var(--stroke)',
                      backgroundColor: activeStage === 'All' ? 'var(--cta-10)' : 'transparent',
                      color:           activeStage === 'All' ? 'var(--cta)' : 'var(--app-muted)',
                    }}
                  >
                    All
                    <span
                      className="min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{
                        backgroundColor: activeStage === 'All' ? 'var(--cta)' : 'var(--surface-3)',
                        color:           activeStage === 'All' ? 'var(--app-bg)'   : 'var(--app-muted)',
                      }}
                    >
                      {totalCount}
                    </span>
                  </button>

                  {stages.map(stage => {
                    const sp = STAGE_PILLS.find(s => s.id === stage) || { color: '#a0b4d0', bg: 'rgba(160,180,208,0.12)' };
                    const isActive = activeStage === stage;
                    return (
                      <button
                        key={stage}
                        data-testid={`stage-pill-${stage.toLowerCase()}`}
                        onClick={() => setActiveStage(s => s === stage ? 'All' : stage)}
                        className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-medium border transition-colors duration-150"
                        style={{
                          borderColor:     isActive ? sp.color : 'var(--stroke)',
                          backgroundColor: isActive ? sp.bg    : 'transparent',
                          color:           isActive ? sp.color : 'var(--app-muted)',
                        }}
                      >
                        {stage}
                        <span
                          className="min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                          style={{
                            backgroundColor: isActive ? sp.bg : 'var(--surface-3)',
                            color:           isActive ? sp.color : 'var(--app-muted)',
                          }}
                        >
                          {stageCounts[stage] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lead list */}
              <div>
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid var(--stroke-soft)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-fg)' }}>
                    {activeStage === 'All' ? 'All Leads' : `${activeStage} Leads`}
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--app-muted)' }}>
                      ({filteredEnquiries.length})
                    </span>
                  </p>
                  <button
                    onClick={() => navigate('/app/crm')}
                    className="text-xs flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--app-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--cta)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--app-muted)'}
                  >
                    View in CRM <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {filteredEnquiries.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Users className="w-7 h-7 mb-2" style={{ color: 'var(--app-muted)', opacity: 0.35 }} />
                    <p className="text-sm" style={{ color: 'var(--app-muted)' }}>
                      No leads {activeStage === 'All' ? 'in pipeline' : `in ${activeStage} stage`}
                    </p>
                  </div>
                ) : (
                  <div>
                    {filteredEnquiries.slice(0, 10).map(enq => {
                      const sp = getStageStyle(enq.pipeline_stage);
                      return (
                        <div
                          key={enq.id}
                          className="flex items-center px-4 py-3 cursor-pointer"
                          style={{ borderBottom: '1px solid var(--stroke-soft)', transition: 'background-color 100ms ease, box-shadow 100ms ease' }}
                          onClick={() => navigate('/app/crm')}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cta-5)'; e.currentTarget.style.boxShadow = 'inset 3px 0 0 var(--cta)'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent';           e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)' }}>
                                {enq.client_name}
                              </p>
                              <span
                                className="text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                                style={{ backgroundColor: sp.bg, color: sp.color }}
                              >
                                {enq.pipeline_stage}
                              </span>
                            </div>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--app-muted)' }}>
                              {enq.destination}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                            {enq.travel_date && (
                              <p className="text-xs font-mono hidden sm:block" style={{ color: 'var(--app-muted)' }}>
                                {formatDate(enq.travel_date)}
                              </p>
                            )}
                            {(enq.pax_adults || enq.pax_children) && (
                              <p className="text-xs font-mono hidden md:block" style={{ color: 'var(--app-muted)' }}>
                                {enq.pax_adults || 0}A {enq.pax_children || 0}C
                              </p>
                            )}
                            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
                          </div>
                        </div>
                      );
                    })}
                    {filteredEnquiries.length > 10 && (
                      <div className="px-4 py-3 flex justify-center">
                        <button
                          onClick={() => navigate('/app/crm')}
                          className="text-xs flex items-center gap-1 transition-colors"
                          style={{ color: 'var(--app-muted)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--cta)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--app-muted)'}
                        >
                          View {filteredEnquiries.length - 10} more in CRM <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* ── Right: Quick Actions + Alerts ─────────────────────────────── */}
          <div className="col-span-12 xl:col-span-4 space-y-4">

            {/* Quick Actions */}
            <div className="hud-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--app-muted)' }}>
                  Quick Actions
                </p>
                <div className="relative flex-shrink-0" ref={shortcutsMenuRef}>
                  <button
                    onClick={() => setShowShortcutsMenu(v => !v)}
                    data-testid="shortcuts-gear-btn"
                    className="w-7 h-7 flex items-center justify-center rounded border transition-colors"
                    style={{ color: 'var(--app-muted)', border: '1px solid var(--stroke)', borderRadius: '4px' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cta-5)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Customize shortcuts"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {showShortcutsMenu && (
                    <div
                      className="absolute right-0 top-9 z-50 w-52 rounded-lg border p-2"
                      style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--stroke)', boxShadow: 'var(--shadow-2)' }}
                    >
                      <p className="text-[9px] uppercase tracking-[0.26em] font-semibold px-2 mb-1.5" style={{ color: 'var(--app-muted)' }}>
                        Show / Hide
                      </p>
                      {shortcutsConfig.map(s => (
                        <button
                          key={s.id}
                          onClick={() => toggleShortcut(s.id)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors"
                          style={{ color: 'var(--app-fg)' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>{s.label}</span>
                          {s.enabled
                            ? <Eye     className="w-3.5 h-3.5" style={{ color: 'var(--cta)' }} />
                            : <EyeOff  className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {enabledShortcuts.map(s => {
                  const Icon = ICON_MAP[s.icon] || Plus;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleShortcut(s.id)}
                      data-testid={`shortcut-${s.id}`}
                      className="flex items-center gap-2 px-3 py-2.5 rounded text-xs font-medium transition-colors duration-150 border"
                      style={{
                        borderColor:     'var(--stroke)',
                        backgroundColor: 'var(--surface-2)',
                        color:           'var(--app-dim)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor     = 'var(--cta)';
                        e.currentTarget.style.color           = 'var(--cta)';
                        e.currentTarget.style.backgroundColor = 'var(--cta-5)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor     = 'var(--stroke)';
                        e.currentTarget.style.color           = 'var(--app-dim)';
                        e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                      }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alerts Panel */}
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

        {/* ══════ ROW 4: Boarding Passes ══════════════════════════════════════ */}
        {upcoming.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--app-muted)' }}>
                Upcoming Departures
              </p>
              <button
                onClick={() => navigate('/app/crm')}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--cta)' }}
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-stretch gap-4 overflow-x-auto scrollbar-hide pb-2" data-testid="boarding-pass-strip">
              {upcoming.map(enq => (
                <BoardingPassCard key={enq.id} enq={enq} onClick={() => navigate('/app/crm')} />
              ))}
            </div>
          </div>
        )}

        {/* ══════ ROW 5: World Clock (collapsible) ════════════════════════════ */}
        <CollapsibleSection title="World Clock" icon={Clock} defaultOpen={false} testId="worldclock-collapsible">
          <WorldClockWidget />
        </CollapsibleSection>

        {/* ══════ ROW 6: Currency + Stats (collapsible) ═══════════════════════ */}
        <CollapsibleSection title="Currency Converter" icon={DollarSign} defaultOpen={false} testId="currency-collapsible">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <CurrencyConverterWidget />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <StatsPanel stats={stats} />
            </div>
          </div>
        </CollapsibleSection>

        {/* Modals */}
        <NewEnquiryModal
          open={showNewEnquiry}
          onClose={() => setShowNewEnquiry(false)}
          onSubmit={handleNewEnquiry}
        />
        <QuoteBuilderModal
          open={showNewQuote}
          onClose={() => setShowNewQuote(false)}
          onSaved={() => { toast.success('Quote created'); setShowNewQuote(false); }}
        />
      </div>
    </TooltipProvider>
  );
}
