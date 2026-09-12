import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Map, Shield, Plane,
  Globe, BookOpen, Compass, Settings,
  ChevronLeft, ChevronRight, MapPin, Sun, Moon, Route
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { SIDEBAR } from '../constants/testIds';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const NAV_SECTIONS = [
  {
    label: 'Command',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, path: '/app/dashboard',  roles: ['all'] },
      { id: 'crm',          label: 'CRM & Leads',  icon: Users,           path: '/app/crm',        roles: ['admin','sales','operations'] },
      { id: 'planner',      label: 'Trip Planner', icon: Route,           path: '/app/planner',    roles: ['admin','sales'] },
      { id: 'itinerary',    label: 'Itinerary',    icon: Map,             path: '/app/itinerary',  roles: ['admin','sales'] },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'visa',      label: 'Visa & Docs',     icon: Shield,  path: '/app/visa',      roles: ['admin','operations','sales'] },
      { id: 'transport', label: 'Transport',        icon: Plane,   path: '/app/transport', roles: ['admin','operations'] },
      { id: 'maps',      label: 'Maps',             icon: MapPin,  path: '/app/maps',      roles: ['admin','sales','operations'] },
      { id: 'browser',   label: 'Browser',          icon: Globe,   path: '/app/browser',   roles: ['admin','sales','operations'] },
    ]
  },
  {
    label: 'Intel',
    items: [
      { id: 'training', label: 'Training',     icon: BookOpen, path: '/app/training', roles: ['all'] },
      { id: 'ai',       label: 'Compass AI',   icon: Compass,  path: '/app/ai',       roles: ['all'] },
      { id: 'settings', label: 'Settings',     icon: Settings, path: '/app/settings', roles: ['admin'] },
    ]
  }
];

function NavItem({ item, collapsed, userRole }) {
  const hasAccess = item.roles.includes('all') || item.roles.includes(userRole);
  if (!hasAccess) return null;
  const Icon = item.icon;

  const linkContent = (
    <NavLink
      to={item.path}
      data-testid={SIDEBAR.navItem(item.id)}
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="text-xs"
          style={{
            background: 'var(--panel-overlay)',
            border: '1px solid var(--cta-30)',
            color: 'var(--app-fg)',
            fontFamily: 'Figtree, sans-serif',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return linkContent;
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const userRole = user?.role || 'sales';
  const isDark = theme === 'dark';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-testid={SIDEBAR.root}
        style={{
          width: collapsed ? '64px' : '230px',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          transition: 'width 240ms cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
        }}
        className="flex flex-col h-full flex-shrink-0 overflow-hidden"
      >
        {/* Subtle cyan edge line (decorative) */}
        <div
          style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: '1px',
            background: 'linear-gradient(to bottom, transparent 0%, var(--cta-45) 30%, var(--cta-45) 70%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* ─── Logo + Toggle ──────────────────────────────────────── */}
        <div
          className="flex items-center h-14 px-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {/* BDV Horizontal Logo */}
              <div
                className="flex items-center justify-center flex-shrink-0 rounded"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  padding: '3px 6px',
                  maxWidth: '126px',
                  height: '36px',
                }}
              >
                <img
                  src="/assets/bdv-logo-horizontal.png"
                  alt="Blue Diamond Voyage"
                  style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block' }}
                  draggable={false}
                />
              </div>
            </div>
          )}

          {collapsed && (
            <div
              className="flex items-center justify-center rounded overflow-hidden mx-auto"
              style={{
                background: 'rgba(255,255,255,0.92)',
                padding: '3px',
                width: '38px',
                height: '38px',
              }}
            >
              <img
                src="/assets/bdv-logo-round.png"
                alt="BDV"
                style={{ width: '30px', height: '30px', objectFit: 'contain', display: 'block' }}
                draggable={false}
              />
            </div>
          )}

          <button
            data-testid={SIDEBAR.toggle}
            onClick={onToggle}
            className="w-7 h-7 flex items-center justify-center hover:bg-white/8 transition-colors flex-shrink-0 ml-auto"
            style={{
              color: 'var(--j-text-dim)',
              borderRadius: '4px',
              border: '1px solid var(--cta-15)',
            }}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft  className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ─── Navigation ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-hide">
          {NAV_SECTIONS.map(section => {
            const visible = section.items.filter(
              item => item.roles.includes('all') || item.roles.includes(userRole)
            );
            if (visible.length === 0) return null;
            return (
              <div key={section.label}>
                {!collapsed && (
                  <p
                    className="px-3 mb-1.5"
                    style={{
                      fontSize: '9px',
                      fontFamily: 'Figtree, sans-serif',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--cta-45)',
                    }}
                  >
                    {`¬ ${section.label} ¬`}
                  </p>
                )}
                {collapsed && (
                  <div
                    style={{
                      height: '1px',
                      background: 'var(--cta-12)',
                      margin: '4px 8px',
                    }}
                  />
                )}
                <div className="space-y-0.5">
                  {visible.map(item => (
                    <NavItem key={item.id} item={item} collapsed={collapsed} userRole={userRole} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Theme Toggle ────────────────────────────────────── */}
        <div
          className="px-2 pb-1 flex-shrink-0"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          {!collapsed ? (
            <button
              data-testid="theme-toggle-btn"
              onClick={toggleTheme}
              className="theme-toggle-btn mt-1"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark
                ? <Sun  className="w-4 h-4 flex-shrink-0" style={{ color: '#FFB300' }} />
                : <Moon className="w-4 h-4 flex-shrink-0" style={{ color: '#4FC3F7' }} />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="theme-toggle-btn"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-center p-2 mt-1 rounded transition-colors"
                  style={{ color: 'var(--j-text-dim)' }}
                >
                  {isDark
                    ? <Sun  className="w-4 h-4" style={{ color: '#FFB300' }} />
                    : <Moon className="w-4 h-4" style={{ color: '#4FC3F7' }} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ─── User info ──────────────────────────────────────── */}
        {user && (
          <div
            className="p-3 flex-shrink-0"
            style={{
              borderTop: '1px solid var(--sidebar-border)',
              background: 'var(--cta-5)',
            }}
          >
            <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
              {/* Avatar with ring animation */}
              <div
                className="w-8 h-8 flex items-center justify-center text-xs font-bold flex-shrink-0 animate-jarvis-ring"
                style={{
                  background: 'var(--cta-15)',
                  border: '1px solid var(--cta-45)',
                  color: 'var(--cta)',
                  borderRadius: '50%',
                  fontFamily: 'Figtree, sans-serif',
                  fontSize: '10px',
                  fontWeight: '800',
                }}
              >
                {user.initials || user.name?.charAt(0)}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{
                      color: 'var(--app-fg)',
                      fontFamily: 'Figtree, sans-serif',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {user.name}
                  </p>
                  <p
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
                  >
                    {user.role}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
