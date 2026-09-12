import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Search, Star, Plus, Loader2, X, Heart } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { listPlaces, createPlace, updatePlace } from '../../services/plannerAPI';

const CATEGORIES = ['all', 'hotel', 'restaurant', 'attraction', 'activity', 'beach', 'museum', 'airport', 'other'];

const CATEGORY_COLORS = {
  hotel:      '#2F9E6F',
  restaurant: '#FFB300',
  attraction: '#4FC3F7',
  activity:   '#4FC3F7',
  beach:      '#00D6C2',
  museum:     '#FFB300',
  airport:    '#8FB3C7',
  other:      '#8FB3C7',
};

export function PlacesLibrary({ open, onClose, tripId, onAddToTrip }) {
  const [places, setPlaces]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', country: '', city: '', category: 'attraction', is_favourite: false });
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlaces();
      setPlaces(data || []);
    } catch (e) { console.error('listPlaces', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const filtered = places.filter(p => {
    const matchCat = catFilter === 'all' || p.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q) || (p.country || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handleAddPlace = async () => {
    if (!addForm.name.trim()) { toast.error('Place name required'); return; }
    setAddSaving(true);
    try {
      const newPlace = await createPlace(addForm);
      setPlaces(prev => [newPlace, ...prev]);
      setShowAdd(false);
      setAddForm({ name: '', country: '', city: '', category: 'attraction', is_favourite: false });
      toast.success('Place saved to library');
    } catch (e) { toast.error('Failed: ' + e.message); }
    finally { setAddSaving(false); }
  };

  const toggleFavourite = async (place) => {
    try {
      const updated = await updatePlace(place.id, { is_favourite: !place.is_favourite });
      setPlaces(prev => prev.map(p => p.id === place.id ? updated : p));
    } catch (e) { toast.error('Failed to update favourite'); }
  };

  const inpClass = 'h-9 text-sm px-3 w-full rounded-lg border bg-[var(--qb-field)] text-[var(--app-fg)] placeholder:text-[var(--app-muted)] border-[var(--qb-field-border)] focus:outline-none focus:border-[var(--cta)] transition-colors';

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="left"
        className="w-[380px] flex flex-col p-0"
        style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)' }}
        data-testid="places-library-sheet"
      >
        <SheetHeader className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--qb-divider)' }}>
          <SheetTitle style={{ color: 'var(--cta)', fontFamily: 'Georgia, serif', fontSize: '16px' }}>
            Places Library
          </SheetTitle>
          <p className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {places.length} saved places
          </p>
        </SheetHeader>

        {/* Search */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--app-muted)' }} />
            <Input
              placeholder="Search places…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              style={{ background: 'var(--qb-field)', border: '1px solid var(--qb-field-border)', color: 'var(--app-fg)' }}
              data-testid="places-search"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-4 pb-2 flex-shrink-0 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className="flex-shrink-0 h-6 px-2.5 rounded-full text-[10px] font-semibold transition-all duration-150"
              style={{
                background: catFilter === cat ? 'var(--cta)' : 'var(--surface-2)',
                color: catFilter === cat ? 'var(--app-bg)' : 'var(--app-muted)',
                border: `1px solid ${catFilter === cat ? 'var(--cta)' : 'var(--stroke-soft)'}`,
              }}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Add new place toggle */}
        <div className="px-4 pb-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(0,229,255,0.08)', color: 'var(--cta)', border: '1px solid rgba(0,229,255,0.20)' }}
            data-testid="add-place-toggle"
          >
            {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showAdd ? 'Cancel' : 'Add Place'}
          </button>

          {showAdd && (
            <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke-soft)' }}>
              <input value={addForm.name} onChange={e => setAddForm(f => ({...f, name: e.target.value}))} placeholder="Place name *" className={inpClass} />
              <div className="grid grid-cols-2 gap-2">
                <input value={addForm.city} onChange={e => setAddForm(f => ({...f, city: e.target.value}))} placeholder="City" className={inpClass} />
                <input value={addForm.country} onChange={e => setAddForm(f => ({...f, country: e.target.value}))} placeholder="Country" className={inpClass} />
              </div>
              <select
                value={addForm.category}
                onChange={e => setAddForm(f => ({...f, category: e.target.value}))}
                className={inpClass}
              >
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <Button
                onClick={handleAddPlace}
                disabled={addSaving}
                className="w-full h-8 text-xs"
                style={{ background: 'var(--cta)', color: 'var(--app-bg)' }}
                data-testid="save-place-btn"
              >
                {addSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                Save Place
              </Button>
            </div>
          )}
        </div>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2" style={{ color: 'var(--app-muted)' }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--cta)' }} />
              <span className="text-xs">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: 'var(--app-muted)' }}>
              <MapPin className="w-8 h-8 opacity-20" />
              <p className="text-xs">No places found.</p>
            </div>
          ) : (
            filtered.map(place => {
              const catColor = CATEGORY_COLORS[place.category] || '#8FB3C7';
              return (
                <div
                  key={place.id}
                  className="rounded-lg p-3 group"
                  style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)' }}
                  data-testid={`place-card-${place.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${catColor}18` }}>
                      <MapPin className="w-3.5 h-3.5" style={{ color: catColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)' }}>{place.name}</p>
                      {(place.city || place.country) && (
                        <p className="text-[10px] truncate" style={{ color: 'var(--app-muted)' }}>
                          {[place.city, place.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFavourite(place)}
                        className="p-1 rounded transition-colors hover:bg-white/10"
                        style={{ color: place.is_favourite ? '#FFB300' : 'var(--app-muted)' }}
                        title={place.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <Heart className="w-3 h-3" fill={place.is_favourite ? '#FFB300' : 'none'} />
                      </button>
                    </div>
                  </div>
                  {onAddToTrip && (
                    <button
                      type="button"
                      onClick={() => onAddToTrip(place)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 h-7 rounded-lg text-xs font-semibold transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: 'rgba(0,229,255,0.08)', color: 'var(--cta)', border: '1px solid rgba(0,229,255,0.20)' }}
                      data-testid={`add-place-to-trip-${place.id}`}
                    >
                      <Plus className="w-3 h-3" /> Add to Trip
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
