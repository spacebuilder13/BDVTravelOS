import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DASHBOARD } from '../../constants/testIds';
import { TrendingUp, Users, CheckCircle, Briefcase } from 'lucide-react';

const KPI_ITEMS = [
  {
    key: 'total_leads_month',
    label: 'Leads this Month',
    icon: Users,
    color: '#2563EB',
    bg: '#EFF6FF',
    suffix: ''
  },
  {
    key: 'conversions',
    label: 'Confirmed',
    icon: CheckCircle,
    color: '#16A34A',
    bg: '#F0FDF4',
    suffix: ''
  },
  {
    key: 'active_bookings',
    label: 'Active Bookings',
    icon: Briefcase,
    color: '#7C3AED',
    bg: '#F5F3FF',
    suffix: ''
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    color: '#B45309',
    bg: '#FFFBEB',
    prefix: '₹',
    suffix: ''
  }
];

const SERVICE_COLORS = {
  Tour: '#2563EB',
  Flight: '#EA580C',
  Visa: '#7C3AED',
  Passport: '#DC2626',
  Insurance: '#16A34A'
};

export default function StatsPanel({ stats }) {
  if (!stats) {
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] h-full" data-testid={DASHBOARD.statsPanel}>
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[#0b1220]">Stats Overview</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor: 'var(--brand-accent)', borderTopColor: 'transparent'}} />
        </div>
      </div>
    );
  }

  const serviceData = Object.entries(stats.service_breakdown || {}).map(([name, value]) => ({
    name,
    value,
    color: SERVICE_COLORS[name] || '#94A3B8'
  })).filter(d => d.value > 0);

  const pipelineData = Object.entries(stats.pipeline_breakdown || {}).map(([name, value]) => ({
    name: name === 'New Enquiry' ? 'New' : name === 'Follow Up' ? 'F/Up' : name,
    value
  }));

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] h-full flex flex-col" data-testid={DASHBOARD.statsPanel}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#0b1220]">Stats Overview</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {KPI_ITEMS.map(item => {
            const Icon = item.icon;
            const value = stats[item.key] ?? 0;
            return (
              <div
                key={item.key}
                className="stat-card rounded-xl p-3 border border-[var(--border)]"
                data-testid={DASHBOARD.kpi(item.key)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: item.bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                </div>
                <p
                  className="text-2xl font-bold [font-variant-numeric:tabular-nums] leading-tight"
                  style={{ color: item.color }}
                >
                  {item.prefix || ''}{value.toLocaleString('en-IN')}{item.suffix}
                </p>
                <p className="text-[10px] text-[#5b6475] mt-0.5">{item.label}</p>
              </div>
            );
          })}
        </div>

        {/* Service Breakdown */}
        {serviceData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#0b1220] mb-3">By Service Type</p>
            <div className="h-28" data-testid="dashboard-service-breakdown-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5b6475' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#5b6475' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e6e9f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {serviceData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Pipeline breakdown mini */}
        {pipelineData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#0b1220] mb-2">Pipeline Distribution</p>
            <div className="space-y-1.5">
              {pipelineData.map(stage => {
                const total = pipelineData.reduce((s, d) => s + d.value, 0) || 1;
                const pct = Math.round((stage.value / total) * 100);
                return (
                  <div key={stage.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#5b6475] w-14 truncate">{stage.name}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--brand-accent)' }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[#0b1220] w-5 text-right">{stage.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
