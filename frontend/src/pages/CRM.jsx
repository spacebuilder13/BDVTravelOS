import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { LeadsTable } from '../components/crm/LeadsTable';
import { LeadDetailPanel } from '../components/crm/LeadDetailPanel';
import { LeadIntakeForm } from '../components/crm/LeadIntakeForm';
import { ClientList } from '../components/crm/ClientList';
import { enquiriesAPI, clientsAPI } from '../services/api';
import { toast } from 'sonner';

export default function CRM() {
  const [enquiries, setEnquiries] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showIntake, setShowIntake] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('leads');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [enqRes, clientRes] = await Promise.all([
        enquiriesAPI.list(),
        clientsAPI.list()
      ]);
      setEnquiries(enqRes.data);
      setClients(clientRes.data);
    } catch (e) {
      if (!silent) toast.error('Failed to load CRM data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLeadCreated = (lead) => {
    setEnquiries(prev => [lead, ...prev]);
    setSelectedLead(lead);
    setShowIntake(false);
    toast.success('Lead created');
  };

  const handleLeadUpdated = (lead) => {
    setEnquiries(prev => prev.map(e => e.id === lead.id ? lead : e));
    setSelectedLead(lead);
  };

  const handleLeadSelect = (lead) => {
    setSelectedLead(prev => prev?.id === lead.id ? null : lead);
  };

  return (
    <div data-testid="crm-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#0b1220]">CRM &amp; Leads</h1>
          <p className="text-xs text-[#5b6475] mt-0.5">
            {enquiries.length} leads &middot; {clients.length} clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-[#5b6475] disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Button
            size="sm"
            onClick={() => setShowIntake(true)}
            className="gap-1.5 font-semibold"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)' }}
            data-testid="crm-new-lead-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="leads" className="text-xs gap-1.5" data-testid="crm-tab-leads">
            Leads
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}
            >
              {enquiries.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-xs gap-1.5" data-testid="crm-tab-clients">
            Clients
            <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[9px] font-bold">
              {clients.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="mt-0">
          <div className="relative">
            <LeadsTable
              enquiries={enquiries}
              loading={loading}
              selectedId={selectedLead?.id}
              onSelect={handleLeadSelect}
              onRefresh={() => load(true)}
            />
          </div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="mt-0">
          <ClientList
            clients={clients}
            loading={loading}
            onRefresh={() => load(true)}
          />
        </TabsContent>
      </Tabs>

      {/* Lead Detail Panel (Sheet from right) */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          clients={clients}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdated}
          onRefreshClients={() => load(true)}
        />
      )}

      {/* Lead Intake Modal */}
      {showIntake && (
        <LeadIntakeForm
          open={showIntake}
          onClose={() => setShowIntake(false)}
          onCreated={handleLeadCreated}
        />
      )}
    </div>
  );
}
