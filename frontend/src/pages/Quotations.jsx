import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { QuoteList } from '../components/quotes/QuoteList';
import { QuoteBuilderModal } from '../components/quotes/QuoteBuilderModal';
import { QuoteDetailSheet } from '../components/quotes/QuoteDetailSheet';
import { quotesAPI } from '../services/api';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export default function Quotations() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editQuote, setEditQuote] = useState(null);

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const res = await quotesAPI.list();
      setQuotes(res.data || []);
    } catch (e) {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuote = () => {
    setEditQuote(null);
    setShowBuilder(true);
  };

  const handleEditQuote = (quote) => {
    setEditQuote(quote);
    setShowBuilder(true);
    setSelectedQuote(null);
  };

  const handleQuoteSaved = (savedQuote) => {
    setQuotes(prev => {
      const idx = prev.findIndex(q => q.id === savedQuote.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedQuote;
        return updated;
      }
      return [savedQuote, ...prev];
    });
    setSelectedQuote(savedQuote);
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm('Delete this quote? This action cannot be undone.')) return;
    try {
      await quotesAPI.delete(quoteId);
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
      if (selectedQuote?.id === quoteId) setSelectedQuote(null);
      toast.success('Quote deleted');
    } catch (e) {
      toast.error('Failed to delete quote');
    }
  };

  const handleQuoteUpdated = (updated) => {
    setQuotes(prev => prev.map(q => q.id === updated.id ? updated : q));
    setSelectedQuote(updated);
  };

  const countByStatus = (status) => quotes.filter(q => q.status === status).length;

  return (
    <div className="h-full flex flex-col" data-testid="quotations-page">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#0b1220]">Quotations</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[#5b6475]">
              {quotes.length} total
            </span>
            {countByStatus('Draft') > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f2f4f8] text-[#5b6475]">
                {countByStatus('Draft')} Draft
              </span>
            )}
            {countByStatus('Sent') > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                {countByStatus('Sent')} Sent
              </span>
            )}
            {countByStatus('Accepted') > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">
                {countByStatus('Accepted')} Accepted
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={handleNewQuote}
          data-testid="new-quote-btn"
          className="gap-2 h-9"
          style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
        >
          <Plus className="w-4 h-4" />
          New Quote
        </Button>
      </div>

      {/* Quote List */}
      <div className="flex-1 overflow-hidden">
        <QuoteList
          quotes={quotes}
          loading={loading}
          onSelect={setSelectedQuote}
          onEdit={handleEditQuote}
          onDelete={handleDeleteQuote}
          onRefresh={loadQuotes}
        />
      </div>

      {/* Builder Modal */}
      <QuoteBuilderModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        editQuote={editQuote}
        onSaved={handleQuoteSaved}
      />

      {/* Detail Sheet */}
      {selectedQuote && (
        <QuoteDetailSheet
          quote={selectedQuote}
          open={!!selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onUpdate={handleQuoteUpdated}
          onEdit={handleEditQuote}
          onDelete={(id) => {
            setQuotes(prev => prev.filter(q => q.id !== id));
            setSelectedQuote(null);
          }}
        />
      )}
    </div>
  );
}
