import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { toast } from 'sonner';
import {
  MapPin, Navigation, Search, Bookmark, X,
  RotateCcw, ExternalLink, Plane, Building2,
  ChevronRight, ChevronLeft, Clock, Star,
  Route, Layers, ZoomIn, Trash2, Map, Globe
} from 'lucide-react';

// ── Saved-places storage (localStorage) ──────────────────────────────────────
const STORAGE_KEY = 'bdv_maps_saved_places';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveSaved(places) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(places)); } catch (e) { console.warn('[Maps] Failed to persist saved places:', e); }
}

// ── URL builder ───────────────────────────────────────────────────────────────

/**
 * Builds the Google Maps embed URL.
 * Routing: saddr/daddr format
 * Search: q parameter
 */
function buildMapUrl({ mode, query = '', from = '', to = '' }) {
  const base = 'https://maps.google.com/maps';
  const p = new URLSearchParams();

  if (mode === 'route' && from.trim() && to.trim()) {
    p.set('saddr', from.trim());
    p.set('daddr', to.trim());
    p.set('dirflg', 'd');
  } else {
    p.set('q', query.trim() || 'India');
  }

  p.set('t', 'm');
  p.set('z', mode === 'route' ? '5' : '6');
  p.set('ie', 'UTF8');
  p.set('iwloc', '');
  p.set('output', 'embed');

  return `${base}?${p.toString()}`;
}

// ── Quick-destination presets (travel-agency oriented) ────────────────────────

const QUICK_PLACES = [
  { label: 'Dubai, UAE', icon: '🇦🇪', query: 'Dubai, UAE' },
  { label: 'Bangkok, TH', icon: '🇹🇭', query: 'Bangkok, Thailand' },
  { label: 'Singapore', icon: '🇸🇬', query: 'Singapore' },
  { label: 'Maldives', icon: '🌊', query: 'Maldives' },
  { label: 'Paris, FR', icon: '🇫🇷', query: 'Paris, France' },
  { label: 'London, UK', icon: '🇬🇧', query: 'London, UK' },
  { label: 'New York', icon: '🇺🇸', query: 'New York City, USA' },
  { label: 'Bali, ID', icon: '🇮🇩', query: 'Bali, Indonesia' },
  { label: 'Istanbul, TR', icon: '🇹🇷', query: 'Istanbul, Turkey' },
  { label: 'Tokyo, JP', icon: '🇯🇵', query: 'Tokyo, Japan' },
  { label: 'Mumbai, IN', icon: '🇮🇳', query: 'Mumbai, India' },
  { label: 'Delhi, IN', icon: '🇮🇳', query: 'New Delhi, India' },
];

// ── Map Mode Tabs ─────────────────────────────────────────────────────────────

const MODES = [
  { key: 'browse', label: 'Browse', icon: Map },
  { key: 'route', label: 'Route', icon: Route },
  { key: 'search', label: 'Search', icon: Search },
];

// ── History item ──────────────────────────────────────────────────────────────

function HistoryItem({ item, onLoad, onDelete }) {
  return (
    <div
      className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f2f4f8] cursor-pointer transition-colors duration-100"
      onClick={() => onLoad(item)}
      data-testid={`maps-history-item-${item.id}`}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#e6e9f0]">
        {item.type === 'route' ? <Route className="w-3.5 h-3.5 text-[#5b6475]" /> : <MapPin className="w-3.5 h-3.5 text-[#5b6475]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#0b1220] truncate">{item.label}</p>
        {item.sublabel && <p className="text-[10px] text-[#5b6475] truncate">{item.sublabel}</p>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(item.id); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-500 text-[#5b6475] transition-all duration-100 flex-shrink-0"
        data-testid={`maps-delete-history-${item.id}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main Maps Page ─────────────────────────────────────────────────────────────

export default function Maps() {
  const [mode, setMode] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [iframeSrc, setIframeSrc] = useState(() =>
    buildMapUrl({ mode: 'browse', query: 'India' })
  );
  const [savedPlaces, setSavedPlaces] = useState(loadSaved);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchRef = useRef(null);
  const fromRef = useRef(null);

  // Persist saved places (saveSaved is a stable module-level function)
  useEffect(() => { saveSaved(savedPlaces); }, [savedPlaces]);

  // Apply map
  const applyMap = useCallback((opts) => {
    const url = buildMapUrl(opts);
    setIframeSrc(url);
    setIsLoading(true);
    setIframeError(false);
  }, []);

  const handleSearch = useCallback((e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    applyMap({ mode: 'search', query: searchQuery });

    // Add to history
    setSavedPlaces(prev => {
      const existing = prev.filter(p => p.label !== searchQuery.trim());
      const item = {
        id: Date.now().toString(),
        type: 'search',
        label: searchQuery.trim(),
        query: searchQuery.trim(),
        timestamp: new Date().toISOString(),
      };
      return [item, ...existing].slice(0, 20);
    });
  }, [searchQuery, applyMap]);

  const handleRoute = useCallback((e) => {
    e?.preventDefault();
    if (!routeFrom.trim() || !routeTo.trim()) {
      toast.error('Please enter both origin and destination');
      return;
    }
    applyMap({ mode: 'route', from: routeFrom, to: routeTo });

    // Add to history
    setSavedPlaces(prev => {
      const label = `${routeFrom} → ${routeTo}`;
      const existing = prev.filter(p => p.label !== label);
      const item = {
        id: Date.now().toString(),
        type: 'route',
        label,
        sublabel: 'Route',
        routeFrom,
        routeTo,
        timestamp: new Date().toISOString(),
      };
      return [item, ...existing].slice(0, 20);
    });
  }, [routeFrom, routeTo, applyMap]);

  const handleQuickPlace = useCallback((place) => {
    setSearchQuery(place.query);
    applyMap({ mode: 'search', query: place.query });
  }, [applyMap]);

  const handleLoadHistory = useCallback((item) => {
    if (item.type === 'route') {
      setMode('route');
      setRouteFrom(item.routeFrom);
      setRouteTo(item.routeTo);
      applyMap({ mode: 'route', from: item.routeFrom, to: item.routeTo });
    } else {
      setMode('search');
      setSearchQuery(item.query || item.label);
      applyMap({ mode: 'search', query: item.query || item.label });
    }
  }, [applyMap]);

  const handleDeleteHistory = useCallback((id) => {
    setSavedPlaces(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setSavedPlaces([]);
    toast.success('History cleared');
  }, []);

  const openInGoogleMaps = () => {
    let url;
    if (mode === 'route' && routeFrom && routeTo) {
      url = `https://www.google.com/maps/dir/${encodeURIComponent(routeFrom)}/${encodeURIComponent(routeTo)}`;
    } else if (searchQuery) {
      url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    } else {
      url = 'https://www.google.com/maps';
    }
    window.open(url, '_blank', 'noopener noreferrer');
  };

  const resetMap = () => {
    setSearchQuery('');
    setRouteFrom('');
    setRouteTo('');
    applyMap({ mode: 'browse', query: 'India' });
    setMode('browse');
  };

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-full bg-[#f7f8fb] overflow-hidden"
        data-testid="maps-page"
      >
        {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b border-[#e6e9f0]"
          data-testid="maps-toolbar"
        >
          {/* Icon + Title */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#0a1628' }}
            >
              <MapPin className="w-4 h-4" style={{ color: '#c9a84c' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0b1220] leading-tight">Maps</p>
              <p className="text-[10px] text-[#5b6475] leading-tight">Google Maps · Route Planner</p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-0.5 bg-[#f2f4f8] rounded-lg p-0.5 flex-shrink-0">
            {MODES.map(m => {
              const Icon = m.icon;
              const isActive = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  data-testid={`maps-mode-${m.key}`}
                  className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-md transition-colors duration-150 ${
                    isActive
                      ? 'bg-white text-[#0b1220] shadow-sm'
                      : 'text-[#5b6475] hover:text-[#0b1220]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Mode-specific Input Area */}
          <div className="flex-1 min-w-0">
            {/* Browse mode: quick search bar */}
            {mode === 'browse' && (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5b6475]" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search a place…"
                    className="h-8 w-full pl-8 pr-3 text-sm border border-[#e6e9f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a84c] bg-white transition-colors duration-150"
                    data-testid="maps-search-input"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                  data-testid="maps-search-btn"
                >
                  Go
                </Button>
              </form>
            )}

            {/* Search mode: dedicated search */}
            {mode === 'search' && (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5b6475]" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search for airports, hotels, attractions, destinations…"
                    className="h-8 w-full pl-8 pr-3 text-sm border border-[#e6e9f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a84c] bg-white transition-colors duration-150"
                    data-testid="maps-search-input-search"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                  data-testid="maps-search-submit"
                >
                  Search
                </Button>
              </form>
            )}

            {/* Route mode: from / to */}
            {mode === 'route' && (
              <form onSubmit={handleRoute} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Navigation className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                  <input
                    ref={fromRef}
                    value={routeFrom}
                    onChange={e => setRouteFrom(e.target.value)}
                    placeholder="Origin (city, airport, address…)"
                    className="h-8 w-full pl-8 pr-3 text-sm border border-[#e6e9f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white transition-colors duration-150"
                    data-testid="maps-route-from"
                  />
                </div>
                <ChevronRight className="w-4 h-4 text-[#5b6475] flex-shrink-0" />
                <div className="relative flex-1">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400" />
                  <input
                    value={routeTo}
                    onChange={e => setRouteTo(e.target.value)}
                    placeholder="Destination (city, airport, address…)"
                    className="h-8 w-full pl-8 pr-3 text-sm border border-[#e6e9f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#c9a84c] bg-white transition-colors duration-150"
                    data-testid="maps-route-to"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                  data-testid="maps-route-btn"
                >
                  <Route className="w-3 h-3" />
                  Get Route
                </Button>
              </form>
            )}
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openInGoogleMaps}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#e6e9f0] hover:border-[#0a1628] text-[#5b6475] hover:text-[#0b1220] transition-colors duration-150"
                  data-testid="maps-open-external"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Open in Google Maps</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={resetMap}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#e6e9f0] hover:border-[#0a1628] text-[#5b6475] hover:text-[#0b1220] transition-colors duration-150"
                  data-testid="maps-reset"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Reset map</TooltipContent>
            </Tooltip>

            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-[#e6e9f0] hover:border-[#0a1628] text-xs font-medium text-[#5b6475] hover:text-[#0b1220] transition-colors duration-150"
              data-testid="maps-sidebar-toggle"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden md:inline">History</span>
              {savedPlaces.length > 0 && (
                <Badge
                  className="h-4 min-w-[16px] px-1 text-[9px] font-bold rounded-full"
                  style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                >
                  {savedPlaces.length}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* ── Quick Destinations Strip ──────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2 bg-white border-b border-[#e6e9f0] overflow-x-auto scrollbar-hide"
          data-testid="maps-quick-destinations"
        >
          <span className="text-[10px] font-semibold text-[#5b6475] uppercase tracking-wider flex-shrink-0 mr-1">
            Quick Jump:
          </span>
          {QUICK_PLACES.map(place => (
            <button
              key={place.query}
              onClick={() => handleQuickPlace(place)}
              title={place.query}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#f2f4f8] text-[#5b6475] hover:bg-[#0a1628] hover:text-[#c9a84c] transition-colors duration-150 flex-shrink-0 whitespace-nowrap"
              data-testid={`maps-quick-${place.label.toLowerCase().replace(/[,\s]+/g, '-')}`}
            >
              <span>{place.icon}</span>
              {place.label}
            </button>
          ))}
        </div>

        {/* ── Main Content: Map + Sidebar ───────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ── Map Frame ── */}
          <div className="flex-1 relative overflow-hidden min-w-0" data-testid="maps-frame-container">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f7f8fb] z-10">
                <div className="w-8 h-8 border-2 rounded-full animate-spin mb-3"
                  style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
                <p className="text-xs text-[#5b6475]">Loading Google Maps…</p>
              </div>
            )}

            {iframeError ? (
              /* Blocked / error fallback */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f7f8fb] gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
                  style={{ backgroundColor: '#0a1628' }}>
                  <Globe className="w-8 h-8" style={{ color: '#c9a84c' }} />
                </div>
                <h3 className="text-base font-bold text-[#0b1220]">Google Maps blocked in iframe</h3>
                <p className="text-sm text-[#5b6475] text-center max-w-md">
                  Google Maps cannot be embedded directly here due to their security policy.
                  You can still use full routing &amp; planning by opening in a new tab.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={openInGoogleMaps}
                    className="gap-2"
                    style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                    data-testid="maps-open-full-btn"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Google Maps
                  </Button>
                </div>
                <p className="text-[10px] text-[#5b6475] mt-2">
                  Tip: Use Route mode above to pre-fill origin &amp; destination before opening
                </p>
              </div>
            ) : (
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                title="Google Maps"
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setIsLoading(false)}
                onError={() => { setIsLoading(false); setIframeError(true); }}
                data-testid="maps-iframe"
                style={{ display: 'block' }}
              />
            )}
          </div>

          {/* ── History Sidebar ── */}
          {sidebarOpen && (
            <div
              className="w-[272px] flex-shrink-0 flex flex-col bg-white border-l border-[#e6e9f0]"
              data-testid="maps-history-sidebar"
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e6e9f0] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#5b6475]" />
                  <p className="text-xs font-semibold text-[#0b1220]">Recent & Saved</p>
                </div>
                <div className="flex items-center gap-1">
                  {savedPlaces.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[10px] text-[#5b6475] hover:text-red-500 transition-colors duration-100 px-1.5 py-0.5 rounded"
                      data-testid="maps-clear-history"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] transition-colors duration-100"
                    data-testid="maps-sidebar-close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="py-2 px-2">
                  {savedPlaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <MapPin className="w-8 h-8 text-[#5b6475]/20 mb-2" />
                      <p className="text-xs font-medium text-[#5b6475]">No history yet</p>
                      <p className="text-[10px] text-[#5b6475]/60 mt-1">
                        Your searches and routes will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {savedPlaces.map(item => (
                        <HistoryItem
                          key={item.id}
                          item={item}
                          onLoad={handleLoadHistory}
                          onDelete={handleDeleteHistory}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Bottom: Travel Tools */}
              <div className="flex-shrink-0 p-3 border-t border-[#e6e9f0] bg-[#fafbfc]">
                <p className="text-[10px] font-semibold text-[#5b6475] uppercase tracking-wider mb-2">
                  Travel Tools
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Airports', icon: Plane, query: 'international airports near me' },
                    { label: 'Hotels', icon: Building2, query: 'hotels' },
                    { label: 'Attractions', icon: Star, query: 'top attractions tourist spots' },
                    { label: 'Embassies', icon: Globe, query: 'embassy consulate' },
                  ].map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        onClick={() => {
                          setMode('search');
                          setSearchQuery(tool.query);
                          applyMap({ mode: 'search', query: tool.query });
                        }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#f2f4f8] hover:bg-[#0a1628] hover:text-[#c9a84c] text-[#5b6475] text-[10px] font-medium transition-colors duration-150"
                        data-testid={`maps-tool-${tool.label.toLowerCase()}`}
                      >
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Status Bar ─────────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-1.5 bg-[#0a1628] border-t border-[#c9a84c]/20"
          data-testid="maps-status-bar"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-white/60">Google Maps Embedded</span>
            </div>
            {mode === 'route' && routeFrom && routeTo && (
              <Badge className="text-[9px] h-4 px-1.5" style={{ backgroundColor: '#c9a84c', color: '#0a1628' }}>
                Route: {routeFrom} → {routeTo}
              </Badge>
            )}
            {(mode === 'search' || mode === 'browse') && searchQuery && (
              <Badge className="text-[9px] h-4 px-1.5" style={{ backgroundColor: '#c9a84c', color: '#0a1628' }}>
                {searchQuery}
              </Badge>
            )}
          </div>
          <button
            onClick={openInGoogleMaps}
            className="flex items-center gap-1 text-[10px] text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors duration-150"
            data-testid="maps-statusbar-open"
          >
            <ExternalLink className="w-3 h-3" />
            Full Google Maps
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
