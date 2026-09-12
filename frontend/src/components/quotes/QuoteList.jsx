import React, { useState } from 'react';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Search, RefreshCw, Eye, Edit2, Trash2, FileText } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const STATUS_STYLES = {
  Draft: 'text-[#5b6475] bg-[#f2f4f8]',
  Sent: 'text-blue-700 bg-blue-50',
  Accepted: 'text-green-700 bg-green-50',
  Rejected: 'text-red-600 bg-red-50',
};

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    const p = parseISO(d);
    return isValid(p) ? format(p, 'dd MMM yy') : d;
  } catch { return d; }
};

const fmtNum = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function QuoteList({ quotes, loading, onSelect, onEdit, onDelete, onRefresh }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = quotes.filter(q => {
    const matchSearch = !search ||
      [q.quote_no, q.client_name, q.destination]
        .some(f => (f || '').toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col h-full" data-testid="quote-list">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5b6475]" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search quote no, client or destination..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="quote-search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="quote-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Accepted">Accepted</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost" size="icon"
          onClick={onRefresh}
          className="h-9 w-9"
          data-testid="quote-refresh-btn"
        >
          <RefreshCw className="w-4 h-4 text-[#5b6475]" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-12 h-12 bg-[#f2f4f8] rounded-2xl flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-[#5b6475]" />
          </div>
          <p className="text-sm font-medium text-[#0b1220]">No quotes found</p>
          <p className="text-xs text-[#5b6475] mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create your first quotation using the "New Quote" button.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm" data-testid="quotes-table">
            <thead>
              <tr className="bg-[#f2f4f8] border-b border-[var(--border)]">
                {['Quote No', 'Client', 'Destination', 'Type', 'Status', 'Total', 'Date', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-[#5b6475] uppercase tracking-widest whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => (
                <tr
                  key={q.id}
                  className={`border-b border-[#f2f4f8] hover:bg-[#f7f8fb] cursor-pointer transition-colors duration-100 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                  }`}
                  onClick={() => onSelect(q)}
                  data-testid={`quote-row-${q.id}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm font-mono text-[#0b1220]">{q.quote_no}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#0b1220] truncate max-w-[160px]">
                      {q.client_name || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[#5b6475] truncate max-w-[130px]">
                      {q.destination || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[#5b6475] truncate max-w-[160px]">{q.quote_type}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        STATUS_STYLES[q.status] || STATUS_STYLES.Draft
                      }`}
                      data-testid={`quote-status-${q.id}`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-[#0b1220] [font-variant-numeric:tabular-nums] whitespace-nowrap">
                      {q.base_currency} {fmtNum(q.grand_total_base)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[#5b6475] whitespace-nowrap">{fmtDate(q.created_at)}</p>
                    {q.created_by_name && (
                      <p className="text-[10px] text-[#5b6475]/60 mt-0.5">{q.created_by_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f2f4f8] text-[#5b6475] hover:text-[#0b1220] transition-colors"
                        onClick={e => { e.stopPropagation(); onSelect(q); }}
                        data-testid={`quote-view-btn-${q.id}`}
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f2f4f8] text-[#5b6475] hover:text-[#0b1220] transition-colors"
                        onClick={e => { e.stopPropagation(); onEdit(q); }}
                        data-testid={`quote-edit-row-btn-${q.id}`}
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#5b6475] hover:text-red-500 transition-colors"
                        onClick={e => { e.stopPropagation(); onDelete(q.id); }}
                        data-testid={`quote-delete-row-btn-${q.id}`}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
