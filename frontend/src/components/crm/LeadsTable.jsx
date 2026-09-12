import React, { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { LEAD_STAGES, STAGE_MAP } from '../../constants/stages';
import { format, parseISO, isValid, isPast } from 'date-fns';
import { Search, Clock, AlertCircle, MapPin, Users } from 'lucide-react';

const SOURCES = ['All', 'WhatsApp', 'Walk-in', 'Referral', 'Online', 'Trade Show', 'Other', 'Manual'];

export function StageBadge({ stage }) {
  const color = STAGE_MAP[stage];
  if (!color) return <span className="text-xs text-gray-400">{stage || '—'}</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: color.header,
        color: color.text,
        border: `1px solid ${color.border}`
      }}
    >
      {stage}
    </span>
  );
}

function FollowupCell({ followup_at, stage }) {
  if (!followup_at) return <span className="text-[10px] text-gray-300">—</span>;
  try {
    const d = parseISO(followup_at);
    if (!isValid(d)) return <span className="text-[10px] text-gray-400">—</span>;
    const overdue = isPast(d) && !['Converted', 'Lost'].includes(stage);
    return (
      <div className="flex items-center gap-1">
        {overdue
          ? <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
          : <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
        }
        <span className={`text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-[#5b6475]'}`}>
          {format(d, 'dd MMM')}
        </span>
      </div>
    );
  } catch { return null; }
}

export function LeadsTable({ enquiries, loading, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('All');

  const filtered = useMemo(() => {
    return enquiries.filter(e => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        e.client_name?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.destination?.toLowerCase().includes(q);
      const matchesStage = stageFilter === 'all' || e.pipeline_stage === stageFilter;
      const matchesSource = sourceFilter === 'All' || e.source === sourceFilter;
      return matchesSearch && matchesStage && matchesSource;
    });
  }, [enquiries, search, stageFilter, sourceFilter]);

  if (loading) {
    return (
      <div className="px-6 space-y-2">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`leads-sk-${i}`} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col px-6">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#5b6475]" />
          <Input
            placeholder="Search name, phone, destination..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="crm-leads-search"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 text-xs w-32" data-testid="crm-stage-filter">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {LEAD_STAGES.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-[#5b6475]">{filtered.length} leads</span>
      </div>

      {/* Table */}
      <div
        className="overflow-auto border border-[var(--border)] rounded-xl"
        style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '300px' }}
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f7f8fb] border-b border-[var(--border)] sticky top-0 z-10">
              {['Client', 'Destination', 'Travel Date', 'Pax', 'Stage', 'Source', 'Follow-up', 'Assigned'].map(col => (
                <th key={col} className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide text-[#5b6475] whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-sm text-[#5b6475]">No leads found</p>
                    <p className="text-xs text-gray-400">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(e => {
                const isOverdue = e.followup_at &&
                  !['Converted', 'Lost'].includes(e.pipeline_stage) &&
                  (() => { try { return isPast(parseISO(e.followup_at)); } catch { return false; } })();
                const isSelected = selectedId === e.id;
                return (
                  <tr
                    key={e.id}
                    onClick={() => onSelect(e)}
                    data-testid={`crm-lead-row-${e.id}`}
                    className={`border-b border-gray-50 cursor-pointer transition-colors duration-100 ${
                      isSelected
                        ? 'bg-amber-50'
                        : isOverdue
                          ? 'bg-red-50/50 hover:bg-red-50'
                          : 'hover:bg-gray-50/80'
                    }`}
                    style={isSelected ? { borderLeft: '3px solid var(--brand-accent)' } : {}}
                  >
                    <td className="px-3 py-2.5">
                      <div>
                        <p className="font-semibold text-[#0b1220] text-xs">{e.client_name}</p>
                        {e.phone && <p className="text-[10px] text-[#5b6475]">{e.phone}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} />
                        <span className="font-medium text-[#0b1220]">{e.destination}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#5b6475]">
                      {e.travel_date ? (() => {
                        try {
                          const d = parseISO(e.travel_date);
                          return isValid(d) ? format(d, 'dd MMM yy') : e.travel_date;
                        } catch { return e.travel_date; }
                      })() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#5b6475] whitespace-nowrap">
                      {e.pax_adults}A{e.pax_children > 0 ? `+${e.pax_children}C` : ''}
                    </td>
                    <td className="px-3 py-2.5">
                      <StageBadge stage={e.pipeline_stage} />
                    </td>
                    <td className="px-3 py-2.5 text-[#5b6475]">
                      {e.source || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <FollowupCell followup_at={e.followup_at} stage={e.pipeline_stage} />
                    </td>
                    <td className="px-3 py-2.5">
                      {e.assigned_to_name ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          >
                            {e.assigned_to_name.charAt(0)}
                          </div>
                          <span className="text-[10px] text-[#5b6475]">
                            {e.assigned_to_name.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeadsTable;
