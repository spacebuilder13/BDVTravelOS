import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TOPBAR } from '../constants/testIds';
import { ChevronDown, LogOut, Bell, Activity } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from './ui/dropdown-menu';
import { AlertsDrawer } from './alerts/AlertsDrawer';
import { alertsAPI } from '../services/api';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2" data-testid={TOPBAR.clock}>
      <span
        style={{
          fontFamily: 'Figtree, sans-serif',
          color: 'var(--cta)',
          fontSize: '13px',
          letterSpacing: '0.08em',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 8px var(--cta-45)',
        }}
      >
        {time.toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        })}
      </span>
      <span style={{ fontFamily: 'Figtree, sans-serif', color: 'var(--j-text-dim)', fontSize: '10px' }}>
        {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase()}
      </span>
    </div>
  );
}

function PulsingDot({ online, label, testId }) {
  return (
    <div className="flex items-center gap-1.5" data-testid={testId}>
      <span
        className="animate-pulse-dot"
        style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: online ? 'var(--success)' : 'var(--danger)',
          boxShadow: `0 0 6px ${online ? 'rgba(43,232,160,0.70)' : 'rgba(255,59,78,0.70)'}`,
        }}
      />
      <span
        className="text-[10px] hidden xl:block"
        style={{
          fontFamily: 'Figtree, sans-serif',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: online ? '#2BE8A0' : '#FF3B4E',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try { setUnreadCount((await alertsAPI.unreadCount()).data?.count || 0); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const t = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(t);
  }, [loadUnreadCount]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <header
        className="h-14 flex-shrink-0 flex items-center justify-between px-5 gap-4"
        style={{
          background: 'var(--panel-overlay)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--stroke)',
          boxShadow: '0 1px 0 var(--cta-8)',
        }}
      >
        {/* Left: brand */}
        <div className="flex items-center gap-3">
          {/* Round logo mark */}
          <div
            className="flex items-center justify-center rounded overflow-hidden flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.90)', padding: '2px', width: '32px', height: '32px' }}
          >
            <img
              src="/assets/bdv-logo-round.png"
              alt="BDV"
              style={{ width: '26px', height: '26px', objectFit: 'contain', display: 'block' }}
              draggable={false}
            />
          </div>
          <h2
            className="text-xs font-bold tracking-widest uppercase hidden sm:block"
            style={{
              fontFamily: 'Figtree, sans-serif',
              color: 'var(--app-fg)',
              letterSpacing: '0.12em',
              fontSize: '11px',
            }}
          >
            Blue Diamond Voyage
          </h2>
          <span
            className="text-[10px] hidden md:block"
            style={{
              fontFamily: 'Figtree, sans-serif',
              letterSpacing: '0.10em',
              color: 'var(--cta-45)',
              textTransform: 'uppercase',
            }}
          >
            | Travel OS
          </span>
        </div>

        {/* Center: clock */}
        <div className="flex items-center">
          <LiveClock />
        </div>

        {/* Right: status + alerts + user */}
        <div className="flex items-center gap-3">

          {/* Status dots */}
          <div className="flex items-center gap-3">
            <PulsingDot connected={isOnline} online={isOnline} label="Net" testId={TOPBAR.internetStatus} />
            <PulsingDot connected={false} online={false} label="WA" testId={TOPBAR.waStatus} />
          </div>

          {/* Hairline separator */}
          <div style={{ width: '1px', height: '20px', background: 'var(--stroke)' }} />

          {/* Alerts bell */}
          <button
            data-testid="topbar-bell-btn"
            onClick={() => { setAlertsOpen(true); loadUnreadCount(); }}
            className="relative w-8 h-8 flex items-center justify-center transition-all"
            style={{
              color: unreadCount > 0 ? '#FFB300' : 'var(--j-text-dim)',
              border: '1px solid var(--stroke-soft)',
              borderRadius: '4px',
              background: 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--cta-8)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                data-testid="alerts-unread-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1"
                style={{
                  backgroundColor: 'var(--danger)',
                  color: 'var(--app-fg)',
                  fontFamily: 'Figtree, sans-serif',
                  boxShadow: '0 0 6px rgba(255,59,78,0.60)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* BDVV badge */}
          <div
            data-testid={TOPBAR.brandSwitcher}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1"
            style={{
              background: 'var(--cta-5)',
              border: '1px solid var(--cta-20)',
              borderRadius: '4px',
              clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)',
            }}
          >
            <Activity
              className="w-3.5 h-3.5"
              style={{ color: 'var(--cta)', filter: 'drop-shadow(0 0 3px var(--cta-45))' }}
            />
            <span
              className="text-[11px] font-bold"
              style={{
                fontFamily: 'Figtree, sans-serif',
                color: 'var(--cta)',
                letterSpacing: '0.10em',
                textShadow: '0 0 6px var(--cta-45)',
              }}
            >
              BDVV
            </span>
          </div>

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid={TOPBAR.userMenu}
                  className="flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                  style={{ border: '1px solid var(--stroke-soft)', borderRadius: '4px', background: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--cta-8)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div
                    className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                    style={{
                      background: 'var(--cta-15)',
                      border: '1px solid var(--cta-45)',
                      borderRadius: '50%',
                      color: 'var(--cta)',
                      fontFamily: 'Figtree, sans-serif',
                      fontSize: '9px',
                    }}
                  >
                    {user.initials || user.name?.charAt(0)}
                  </div>
                  <ChevronDown className="w-3 h-3" style={{ color: 'var(--j-text-dim)' }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 animate-jarvis-enter"
                style={{
                  background: 'var(--panel-overlay)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--cta-20)',
                  borderRadius: '6px',
                  boxShadow: '0 0 16px var(--cta-15), 0 8px 32px rgba(0,0,0,0.50)',
                }}
              >
                <div className="px-2 py-1.5">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif', letterSpacing: '0.06em' }}
                  >
                    {user.name}
                  </p>
                  <p
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
                  >
                    {user.role}
                  </p>
                </div>
                <DropdownMenuSeparator style={{ background: 'var(--cta-15)' }} />
                <DropdownMenuItem
                  onClick={handleLogout}
                  data-testid={TOPBAR.logoutBtn}
                  className="text-xs cursor-pointer"
                  style={{ color: '#FF3B4E', fontFamily: 'Figtree, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <AlertsDrawer
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        onCountChange={setUnreadCount}
      />
    </>
  );
}
