import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { sitesAPI } from '../../services/api';
import { DASHBOARD } from '../../constants/testIds';
import { ExternalLink, Plus, Hotel, Plane, Globe, Shield, Train, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';

const CATEGORY_ICONS = {
  Hotels: Hotel,
  Tours: Globe,
  Flights: Plane,
  Visa: Shield,
  Other: Train
};

const CATEGORY_COLORS = {
  Hotels: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  Tours: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  Flights: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  Visa: { bg: '#FDF4FF', text: '#7E22CE', dot: '#A855F7' },
  Other: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' }
};

export default function QuickShortcuts() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState({ label: '', url: '', category: 'Hotels' });
  const [activeCategory, setActiveCategory] = useState('All');

  const loadSites = async () => {
    try {
      const res = await sitesAPI.list();
      setSites(res.data);
    } catch (e) {
      toast.error('Failed to load shortcuts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  const categories = ['All', ...Object.keys(CATEGORY_ICONS)];
  const filtered = activeCategory === 'All' ? sites : sites.filter(s => s.category === activeCategory);

  const handleAddSite = async () => {
    if (!newSite.label || !newSite.url) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await sitesAPI.add(newSite);
      toast.success('Shortcut added');
      setShowAdd(false);
      setNewSite({ label: '', url: '', category: 'Hotels' });
      loadSites();
    } catch (e) {
      toast.error('Failed to add shortcut');
    }
  };

  const handleDeleteSite = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await sitesAPI.delete(id);
      setSites(prev => prev.filter(s => s.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-[var(--border)] h-full flex flex-col"
      data-testid={DASHBOARD.shortcutsPanel}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-[#0b1220]">Quick Shortcuts</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Category Filter */}
      <div className="px-3 py-2 flex gap-1 overflow-x-auto flex-shrink-0 border-b border-[var(--border)]">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
              activeCategory === cat
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={activeCategory === cat ? {backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)'} : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sites list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-xs text-[#5b6475]">No shortcuts in this category</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((site) => {
              const Icon = CATEGORY_ICONS[site.category] || Globe;
              const color = CATEGORY_COLORS[site.category] || CATEGORY_COLORS.Other;
              return (
                <div
                  key={site.id}
                  className="group relative"
                  data-testid={DASHBOARD.shortcutItem(site.label)}
                >
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color.bg }}
                    >
                      <Icon className="w-3 h-3" style={{ color: color.text }} />
                    </div>
                    <span className="text-xs text-[#0b1220] font-medium flex-1 truncate">{site.label}</span>
                    <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                  </a>
                  <button
                    onClick={(e) => handleDeleteSite(site.id, e)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp/Gmail shortcuts */}
      <div className="px-3 py-2 border-t border-[var(--border)] flex-shrink-0">
        <p className="text-[10px] text-[#5b6475] uppercase tracking-wide mb-2">Communication</p>
        <div className="grid grid-cols-2 gap-1.5">
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-medium text-green-700">WhatsApp</span>
          </a>
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-medium text-red-700">Gmail</span>
          </a>
        </div>
      </div>

      {/* Add Site Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Shortcut</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Label</label>
              <Input
                placeholder="e.g. Booking.com"
                value={newSite.label}
                onChange={e => setNewSite(p => ({...p, label: e.target.value}))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">URL</label>
              <Input
                placeholder="https://..."
                value={newSite.url}
                onChange={e => setNewSite(p => ({...p, url: e.target.value}))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Category</label>
              <Select value={newSite.category} onValueChange={v => setNewSite(p => ({...p, category: v}))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_ICONS).map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddSite} style={{backgroundColor: 'var(--brand-accent)', color: 'var(--brand-primary)'}}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
