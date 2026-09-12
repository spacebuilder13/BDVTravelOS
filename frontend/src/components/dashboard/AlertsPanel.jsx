import React from 'react';
import { DASHBOARD } from '../../constants/testIds';
import {
  Plane, CreditCard, Shield, MessageSquare, ShieldCheck, Clock, AlertTriangle
} from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, 'dd MMM yyyy');
  } catch { return dateStr; }
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return null;
    return differenceInDays(d, new Date());
  } catch { return null; }
};

const AlertRow = ({ icon: Icon, iconColor, iconBg, title, subtitle, urgency, overdue }) => (
  <div
    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-gray-50/50 transition-colors ${
      overdue ? 'bg-red-50/30' : ''
    }`}
    data-testid={DASHBOARD.alertsPanel}
  >
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ backgroundColor: iconBg }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-[#0b1220] truncate">{title}</p>
      <p className="text-[10px] text-[#5b6475] truncate">{subtitle}</p>
    </div>
    {urgency !== null && urgency !== undefined && (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
        overdue ? 'bg-red-100 text-red-600' :
        urgency <= 0 ? 'bg-red-100 text-red-600' :
        urgency <= 1 ? 'bg-red-100 text-red-600' :
        urgency <= 3 ? 'bg-orange-100 text-orange-600' :
        'bg-yellow-100 text-yellow-600'
      }`}>
        {overdue ? 'Overdue' : urgency === 0 ? 'Today' : `${urgency}d`}
      </span>
    )}
  </div>
);

export default function AlertsPanel({ alerts }) {
  if (!alerts) {
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] h-full" data-testid={DASHBOARD.alertsPanel}>
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[#0b1220]">Today's Alerts</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--brand-accent)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  const allAlerts = [];

  // Overdue follow-ups (highest priority)
  (alerts.followups_overdue || []).forEach(f => {
    const days = daysUntil(f.followup_at);
    allAlerts.push({
      id: `overdue-${f.id}`,
      icon: AlertTriangle, iconColor: '#dc2626', iconBg: '#FEF2F2',
      title: `Overdue: ${f.client_name}`,
      subtitle: `${f.destination} · Follow-up was ${formatDate(f.followup_at)}`,
      urgency: days, overdue: true, priority: 0
    });
  });

  // Follow-ups due today
  (alerts.followups_due_today || []).forEach(f => {
    allAlerts.push({
      id: `due-${f.id}`,
      icon: Clock, iconColor: '#d97706', iconBg: '#FFFBEB',
      title: `Follow-up: ${f.client_name}`,
      subtitle: `${f.destination} · Due today`,
      urgency: 0, overdue: false, priority: 1
    });
  });

  // Departures
  (alerts.departures || []).forEach(d => {
    const days = daysUntil(d.travel_date);
    allAlerts.push({
      id: `dep-${d.id}`,
      icon: Plane, iconColor: '#2563eb', iconBg: '#EFF6FF',
      title: `${d.client_name} departs`,
      subtitle: `${d.destination} · ${formatDate(d.travel_date)}`,
      urgency: days, overdue: false, priority: 2
    });
  });

  // Passport expiries
  (alerts.passport_expiries || []).forEach(p => {
    const days = daysUntil(p.passport_expiry);
    allAlerts.push({
      id: `pass-${p.id}`,
      icon: CreditCard, iconColor: '#b7791f', iconBg: '#FFFBEB',
      title: `Passport expiring`,
      subtitle: `${p.full_name || p.name || ''} · ${formatDate(p.passport_expiry)}`,
      urgency: days, overdue: false, priority: 3
    });
  });

  // Visa appointments
  (alerts.visa_appointments || []).forEach(v => {
    const days = daysUntil(v.appointment_date);
    allAlerts.push({
      id: `visa-${v.id}`,
      icon: Shield, iconColor: '#7c3aed', iconBg: '#F5F3FF',
      title: `Visa appointment`,
      subtitle: `${v.country || ''} · ${formatDate(v.appointment_date)}`,
      urgency: days, overdue: false, priority: 4
    });
  });

  // WhatsApp unread
  if ((alerts.wa_unread || 0) > 0) {
    allAlerts.push({
      id: 'wa-unread',
      icon: MessageSquare, iconColor: '#16a34a', iconBg: '#F0FDF4',
      title: `${alerts.wa_unread} unread WhatsApp messages`,
      subtitle: 'Check Operations > WhatsApp',
      urgency: 0, overdue: false, priority: 5
    });
  }

  // Sort by priority then urgency
  allAlerts.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.urgency ?? 999) - (b.urgency ?? 999);
  });

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] h-full flex flex-col" data-testid={DASHBOARD.alertsPanel}>
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#0b1220]">Today's Alerts</h3>
        {allAlerts.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
            {allAlerts.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {allAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-50">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-xs text-[#5b6475] text-center">All clear &mdash; no urgent alerts</p>
          </div>
        ) : (
          allAlerts.map(alert => <AlertRow key={alert.id} {...alert} />)
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-[#5b6475]" />
          <p className="text-[10px] text-[#5b6475]">
            Insurance renewals will appear here when data is added.
          </p>
        </div>
      </div>
    </div>
  );
}
