import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Search, Plus, Phone, Mail, CreditCard, ChevronRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NewClientModal from './NewClientModal';
import { differenceInDays, parseISO } from 'date-fns';

export function ClientList({ clients, loading, onRefresh }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.passport_no?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5b6475]" />
          <Input
            placeholder="Search by name, phone, passport..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="crm-clients-search"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewModal(true)}
          className="gap-1.5 h-9 font-semibold"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
          data-testid="crm-new-client-btn"
        >
          <Plus className="w-3.5 h-3.5" />
          New Client
        </Button>
      </div>

      <p className="text-xs text-[#5b6475] mb-3">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</p>

      {/* Client list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-[#5b6475]">
            {search ? 'No clients match your search' : 'No clients yet'}
          </p>
          {!search && (
            <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add First Client
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const passportDays = c.passport_expiry
              ? (() => { try { return differenceInDays(parseISO(c.passport_expiry), new Date()); } catch { return null; } })()
              : null;
            const passportWarning = passportDays !== null && passportDays < 180;
            const passportExpired = passportDays !== null && passportDays < 0;
            return (
              <div
                key={c.id}
                className="bg-white border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between hover:shadow-sm transition-all duration-200 cursor-pointer group"
                onClick={() => navigate(`/app/crm/client/${c.id}`)}
                data-testid={`crm-client-row-${c.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {c.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0b1220]">{c.full_name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-[10px] text-[#5b6475]">
                          <Phone className="w-2.5 h-2.5" />{c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 text-[10px] text-[#5b6475] truncate max-w-[160px]">
                          <Mail className="w-2.5 h-2.5 flex-shrink-0" />{c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.passport_no && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-medium ${
                      passportExpired ? 'bg-red-100 text-red-600' :
                      passportWarning ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-[#5b6475]'
                    }`}>
                      <CreditCard className="w-3 h-3" />
                      {passportExpired ? 'Expired' :
                       passportWarning ? `${passportDays}d` :
                       c.passport_no}
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--brand-accent)] transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewClientModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

export default ClientList;
