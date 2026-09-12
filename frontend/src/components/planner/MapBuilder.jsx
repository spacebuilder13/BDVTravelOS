import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Loader2, Search, Hotel, Utensils, Landmark, Train, MapPin, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { addStop, deleteStop, createPin, deletePin, getTripFull } from '../../services/tripAPI';

// ── Fix Leaflet default icons (CRA issue) ─────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Overpass + Nominatim helpers ──────────────────────────────────────────────
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function bboxKey(s, w, n, e) {
  return `overpass_${Math.round(s*10)/10}_${Math.round(w*10)/10}_${Math.round(n*10)/10}_${Math.round(e*10)/10}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
}

async function fetchOverpass(south, west, north, east) {
  const key = bboxKey(south, west, north, east);
  const cached = readCache(key);
  if (cached) return cached;

  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:25];(
node["tourism"="hotel"](${bbox});
node["amenity"="hotel"](${bbox});
node["amenity"="restaurant"](${bbox});
node["tourism"="attraction"](${bbox});
node["tourism"="museum"](${bbox});
node["tourism"="viewpoint"](${bbox});
node["highway"="bus_stop"](${bbox});
node["railway"="station"](${bbox});
node["aeroway"="aerodrome"](${bbox});
);out body;`;

  const resp = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) throw new Error('Overpass API error');
  const json = await resp.json();
  const elements = (json.elements || []).filter(e => e.lat && e.lon);
  writeCache(key, elements);
  return elements;
}

async function nominatimSearch(q) {
  if (!q || q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BDV-TravelOS/1.0' } });
    const data = await res.json();
    return data.map(r => ({
      label: r.display_name,
      name: r.name || r.display_name.split(',')[0].trim(),
      country: r.address?.country || '',
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch { return []; }
}

// ── Custom divIcons ───────────────────────────────────────────────────────────
function stopIcon(num, color = '#00E5FF') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 22 14 22S28 24 28 14C28 6.3 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="8" fill="#050A14"/><text x="14" y="18" text-anchor="middle" font-size="9" font-weight="700" fill="${color}" font-family="Figtree,sans-serif">${num}</text></svg>`;
  return L.divIcon({ html: svg, iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36], className: '' });
}

function originIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 22 14 22S28 24 28 14C28 6.3 21.7 0 14 0z" fill="#FFB300"/><circle cx="14" cy="14" r="8" fill="#050A14"/><text x="14" y="17.5" text-anchor="middle" font-size="8" fill="#FFB300" font-family="Figtree,sans-serif">✦</text></svg>`;
  return L.divIcon({ html: svg, iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36], className: '' });
}

function pinIcon(color = '#4FC3F7') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="26"><path d="M10 0C4.5 0 0 4.5 0 10c0 7 10 16 10 16S20 17 20 10C20 4.5 15.5 0 10 0z" fill="${color}" opacity="0.9"/><circle cx="10" cy="10" r="4" fill="white"/></svg>`;
  return L.divIcon({ html: svg, iconSize: [20, 26], iconAnchor: [10, 26], popupAnchor: [0, -26], className: '' });
}

const POI_COLORS = {
  hotel:      '#1B9CFC',
  restaurant: '#FFB300',
  attraction: '#2F9E6F',
  transport:  '#9B59B6',
};

function poiType(tags) {
  if (tags.tourism === 'hotel' || tags.amenity === 'hotel') return 'hotel';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (['attraction','museum','viewpoint','theme_park','zoo'].includes(tags.tourism)) return 'attraction';
  if (tags.highway === 'bus_stop' || tags.railway === 'station' || tags.aeroway === 'aerodrome') return 'transport';
  return null;
}

// ── Route bearing utility ─────────────────────────────────────────────────────
function getBearing(lat1, lng1, lat2, lng2) {
  const dL = (lng2 - lng1) * Math.PI / 180;
  const r1 = lat1 * Math.PI / 180;
  const r2 = lat2 * Math.PI / 180;
  const y = Math.sin(dL) * Math.cos(r2);
  const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(dL);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ── Route arrows layer (polyline + arrowhead markers) ─────────────────────────
function RouteArrows({ tripObj, stops }) {
  const orderedStops = [...stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // Build ordered point list: origin → stops → origin (roundtrip)
  const pts = [];
  if (tripObj.origin_lat && tripObj.origin_lng) {
    pts.push([tripObj.origin_lat, tripObj.origin_lng, tripObj.origin_name, 'origin']);
  }
  orderedStops.forEach(s => {
    if (s.lat && s.lng) pts.push([s.lat, s.lng, s.place_name, s.id]);
  });
  if (pts.length > 1 && tripObj.origin_lat && tripObj.origin_lng) {
    pts.push([tripObj.origin_lat, tripObj.origin_lng, tripObj.origin_name, 'return']);
  }

  if (pts.length < 2) return null;

  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [lat1, lng1] = pts[i];
    const [lat2, lng2] = pts[i + 1];
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lat1 < lat2 ? 0.42 : 0.58) * (lat2 - lat1) + lat1; // slight offset
    const midLatTrue = (lat1 + lat2) / 2;
    const midLngTrue = (lng1 + lng2) / 2;
    const angle = getBearing(lat1, lng1, lat2, lng2);
    // colour: gold for first/last (to/from origin), cyan for middle segments
    const isOriginLeg = i === 0 || i === pts.length - 2;
    const color = isOriginLeg ? '#FFB300' : '#00E5FF';
    segments.push({ from: [lat1, lng1], to: [lat2, lng2], mid: [midLatTrue, midLngTrue], angle, color });
  }

  const arrowIcon = (angle, color) => L.divIcon({
    html: `<div style="transform:rotate(${angle}deg);color:${color};font-size:13px;line-height:1;filter:drop-shadow(0 0 3px ${color}88);">▶</div>`,
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
    className: '',
  });

  return (
    <>
      {segments.map((seg) => (
        <React.Fragment key={`${seg.from[0]},${seg.from[1]}-${seg.to[0]},${seg.to[1]}`}>
          <Polyline
            positions={[seg.from, seg.to]}
            pathOptions={{
              color: seg.color,
              weight: 2,
              opacity: 0.65,
              dashArray: '7 5',
            }}
          />
          <Marker position={seg.mid} icon={arrowIcon(seg.angle, seg.color)} interactive={false} />
        </React.Fragment>
      ))}
    </>
  );
}

// ── Map event handler component ───────────────────────────────────────────────
function MapEvents({ onBoundsChange, onMapClick }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds(), map.getZoom()),
    zoomend: () => onBoundsChange(map.getBounds(), map.getZoom()),
    click:   (e) => onMapClick(e.latlng),
  });
  return null;
}

// ── Fly-to helper ─────────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 12, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// ── Layer toggles ─────────────────────────────────────────────────────────────
function LayerToggle({ label, icon: Icon, color, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all duration-150"
      style={{
        background: active ? `${color}18` : 'var(--surface-2)',
        border: `1px solid ${active ? color : 'var(--stroke-soft)'}`,
        color: active ? color : 'var(--app-muted)',
        fontFamily: 'Figtree, sans-serif',
      }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ── Add Stop panel ────────────────────────────────────────────────────────────
function AddStopPanel({ tripId, sequence, onAdded, onClose }) {
  const [q, setQ]           = useState('');
  const [results, setRes]   = useState([]);
  const [nights, setNights] = useState(2);
  const [selected, setSel]  = useState(null);
  const [loading, setLoad]  = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef         = useRef(null);

  const search = (val) => {
    clearTimeout(debounceRef.current);
    if (!val || val.length < 2) { setRes([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoad(true);
      setRes(await nominatimSearch(val));
      setLoad(false);
    }, 350);
  };

  const save = async () => {
    if (!selected) { toast.error('Select a location first'); return; }
    setSaving(true);
    try {
      const stop = await addStop(tripId, {
        trip_id: tripId,
        sequence,
        place_name: selected.name,
        country:    selected.country,
        lat:        selected.lat,
        lng:        selected.lng,
        nights,
        accommodation_needed: true,
        transport_needed:     true,
      });
      toast.success(`Stop added: ${selected.name}`);
      onAdded(stop);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-3 rounded-lg"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--stroke)', minWidth: 260 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>Add Stop</span>
        <button onClick={onClose} style={{ color: 'var(--app-muted)' }}><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin" style={{ color: 'var(--cta)' }} />
          : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--app-muted)' }} />
        }
        <Input
          data-testid="add-stop-search"
          placeholder="City, landmark…"
          value={q}
          onChange={e => { setQ(e.target.value); setSel(null); search(e.target.value); }}
          className="pl-8 h-8 text-xs"
          style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
        />
      </div>
      {results.length > 0 && (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--stroke-soft)', background: 'var(--surface)' }}>
          {results.map((r) => (
            <button
              key={`${r.name}-${r.lat ?? ''}-${r.lon ?? ''}`}
              onClick={() => { setSel(r); setQ(r.name); setRes([]); }}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-medium">{r.name}</span>
              <span className="ml-1" style={{ color: 'var(--app-muted)' }}>{r.country}</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="text-[10px]" style={{ color: 'var(--j-green)' }}>
          ✓ {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label className="text-[11px]" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Nights:</label>
        <Input
          data-testid="stop-nights-input"
          type="number" min="1" max="30"
          value={nights}
          onChange={e => setNights(Number(e.target.value))}
          className="w-16 h-7 text-xs"
          style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)', color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}
        />
      </div>
      <Button
        data-testid="confirm-add-stop-btn"
        onClick={save}
        disabled={saving || !selected}
        size="sm"
        className="h-8 w-full text-xs font-semibold"
        style={{ background: selected ? 'var(--cta)' : 'var(--surface)', color: selected ? 'var(--app-bg)' : 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
        Add to Route
      </Button>
    </div>
  );
}

// ── Main MapBuilder ───────────────────────────────────────────────────────────
export function MapBuilder({ trip, onUpdate }) {
  const [pois, setPois]         = useState([]);
  const [loadingPois, setLoadingPois] = useState(false);
  const [flyTo, setFlyTo]       = useState(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [globalPins, setGlobalPins]   = useState([]);
  const [addPinAt, setAddPinAt] = useState(null);
  const [pinName, setPinName]   = useState('');
  const [pinType, setPinType]   = useState('hotel');
  const [savingPin, setSavingPin] = useState(false);
  const [layers, setLayers]     = useState({ hotel: true, restaurant: true, attraction: true, transport: true });
  const fetchTimeout            = useRef(null);
  const lastBbox                = useRef(null);

  const stops   = trip?.stops   ?? [];
  const tripObj = trip;

  // Initial load: fly to origin
  useEffect(() => {
    if (tripObj?.origin_lat && tripObj?.origin_lng) {
      setFlyTo({ lat: tripObj.origin_lat, lng: tripObj.origin_lng });
    }
    // Load global pins
    import('../../services/tripAPI').then(({ listPins }) => {
      listPins().then(p => setGlobalPins(p)).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripObj?.id]);

  const handleBoundsChange = useCallback((bounds, zoom) => {
    if (zoom < 9) return; // Don't fetch at low zoom
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const key = bboxKey(sw.lat, sw.lng, ne.lat, ne.lng);
    if (key === lastBbox.current) return;
    lastBbox.current = key;
    clearTimeout(fetchTimeout.current);
    fetchTimeout.current = setTimeout(async () => {
      setLoadingPois(true);
      try {
        const data = await fetchOverpass(sw.lat, sw.lng, ne.lat, ne.lng);
        setPois(data);
      } catch (err) {
        console.warn('Overpass API (silent):', err.message);
      } finally {
        setLoadingPois(false);
      }
    }, 600);
  }, []);

  const handleMapClick = useCallback((latlng) => {
    setAddPinAt(latlng);
    setPinName('');
  }, []);

  const handleAddPinSave = async () => {
    if (!pinName.trim()) { toast.error('Enter a pin name'); return; }
    setSavingPin(true);
    try {
      const { createPin: cp } = await import('../../services/tripAPI');
      const pin = await cp({ pin_type: pinType, name: pinName, lat: addPinAt.lat, lng: addPinAt.lng });
      setGlobalPins(prev => [...prev, pin]);
      setAddPinAt(null);
      toast.success('Pin saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPin(false);
    }
  };

  const handleDeleteStop = async (stopId) => {
    if (!window.confirm('Remove this stop?')) return;
    try {
      await deleteStop(tripObj.id, stopId);
      const updated = await getTripFull(tripObj.id);
      onUpdate(updated);
      toast.success('Stop removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStopAdded = async () => {
    setShowAddStop(false);
    const updated = await getTripFull(tripObj.id).catch(() => null);
    if (updated) onUpdate(updated);
  };

  if (!tripObj) return null;

  const center = stops.length > 0
    ? [stops[0].lat, stops[0].lng]
    : [tripObj.origin_lat || 20, tripObj.origin_lng || 77];

  const filteredPois = pois.filter(p => {
    const t = poiType(p.tags || {});
    return t && layers[t];
  });

  return (
    <div className="flex h-full" data-testid="map-builder">
      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 overflow-y-auto"
        style={{ width: 260, background: 'var(--surface)', borderRight: '1px solid var(--stroke-soft)' }}
      >
        {/* Trip info */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--stroke-soft)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--cta)', fontFamily: 'Figtree, sans-serif' }}>Route</p>
          <p className="text-xs font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>{tripObj.client_name}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--app-muted)' }}>{tripObj.start_date} → {tripObj.end_date}</p>
        </div>

        {/* Layer toggles */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--stroke-soft)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>
            POI Layers {loadingPois && <Loader2 className="inline w-2.5 h-2.5 animate-spin ml-1" />}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <LayerToggle label="Hotels"      icon={Hotel}      color={POI_COLORS.hotel}      active={layers.hotel}      onToggle={() => setLayers(l => ({ ...l, hotel: !l.hotel }))} />
            <LayerToggle label="Restaurants" icon={Utensils}    color={POI_COLORS.restaurant} active={layers.restaurant} onToggle={() => setLayers(l => ({ ...l, restaurant: !l.restaurant }))} />
            <LayerToggle label="Attractions" icon={Landmark}    color={POI_COLORS.attraction} active={layers.attraction} onToggle={() => setLayers(l => ({ ...l, attraction: !l.attraction }))} />
            <LayerToggle label="Transport"   icon={Train}       color={POI_COLORS.transport}  active={layers.transport}  onToggle={() => setLayers(l => ({ ...l, transport: !l.transport }))} />
          </div>
          <p className="text-[9px] mt-2" style={{ color: 'var(--app-dim)' }}>
            Zoom in (level 9+) to load POIs. Data: © OpenStreetMap
          </p>
        </div>

        {/* Stops list */}
        <div className="flex-1 px-3 py-3">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}>Stops</p>

          {/* Origin */}
          <div
            className="flex items-center gap-2 py-2 px-2 rounded mb-1"
            style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)' }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: '#FFB300', color: '#050A14' }}>✦</div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>{tripObj.origin_name}</p>
              <p className="text-[9px]" style={{ color: 'var(--app-muted)' }}>Origin</p>
            </div>
            <button
              onClick={() => tripObj.origin_lat && setFlyTo({ lat: tripObj.origin_lat, lng: tripObj.origin_lng })}
              className="ml-auto" style={{ color: 'var(--app-muted)' }}
              title="Fly to"
            >
              <MapPin className="w-3 h-3" />
            </button>
          </div>

          {stops.map((stop, i) => (
            <div
              key={stop.id}
              className="flex items-center gap-2 py-2 px-2 rounded mb-1 group"
              style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)' }}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: 'var(--cta)', color: 'var(--app-bg)' }}>{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>{stop.place_name}</p>
                <p className="text-[9px]" style={{ color: 'var(--app-muted)' }}>{stop.nights}N · {stop.country}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setFlyTo({ lat: stop.lat, lng: stop.lng })}
                  style={{ color: 'var(--cta)' }}
                  title="Fly to"
                >
                  <MapPin className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteStop(stop.id)}
                  style={{ color: 'var(--danger)' }}
                  title="Remove stop"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Add stop */}
          {showAddStop ? (
            <AddStopPanel
              tripId={tripObj.id}
              sequence={stops.length}
              onAdded={handleStopAdded}
              onClose={() => setShowAddStop(false)}
            />
          ) : (
            <button
              data-testid="add-stop-btn"
              onClick={() => setShowAddStop(true)}
              className="flex items-center gap-1.5 w-full px-3 py-2 rounded text-xs transition-colors mt-2"
              style={{ border: '1px dashed var(--stroke)', color: 'var(--app-muted)', fontFamily: 'Figtree, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cta)'; e.currentTarget.style.color = 'var(--cta)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; e.currentTarget.style.color = 'var(--app-muted)'; }}
            >
              <Plus className="w-3 h-3" /> Add Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <MapContainer
          key={tripObj.id}
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%', background: '#050A14' }}
          data-testid="leaflet-map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          <MapEvents onBoundsChange={handleBoundsChange} onMapClick={handleMapClick} />
          {flyTo && <FlyTo target={flyTo} />}

          {/* Route polyline with arrows between stops */}
          <RouteArrows tripObj={tripObj} stops={stops} />

          {/* Origin marker */}
          {tripObj.origin_lat && tripObj.origin_lng && (
            <Marker position={[tripObj.origin_lat, tripObj.origin_lng]} icon={originIcon()}>
              <Popup>
                <div style={{ fontFamily: 'Figtree, sans-serif', fontSize: '12px' }}>
                  <strong>✦ {tripObj.origin_name}</strong><br />
                  <span style={{ color: '#888' }}>Origin / Departure</span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Stop markers */}
          {stops.map((stop, i) => (
            <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={stopIcon(i + 1)}>
              <Popup>
                <div style={{ fontFamily: 'Figtree, sans-serif', fontSize: '12px' }}>
                  <strong>Stop {i + 1}: {stop.place_name}</strong><br />
                  <span style={{ color: '#888' }}>{stop.nights} nights · {stop.country}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Global pins */}
          {globalPins.map(pin => (
            <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={pinIcon(POI_COLORS[pin.pin_type] || '#4FC3F7')}>
              <Popup>
                <div style={{ fontFamily: 'Figtree, sans-serif', fontSize: '12px' }}>
                  <strong>{pin.name}</strong><br />
                  <span style={{ color: '#888' }}>{pin.pin_type} · {pin.country}</span>
                  {pin.notes && <><br /><span>{pin.notes}</span></>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Overpass POI circles */}
          {filteredPois.map((poi, i) => {
            const t = poiType(poi.tags || {});
            const col = POI_COLORS[t] || '#888';
            return (
              <CircleMarker
                key={`poi-${i}`}
                center={[poi.lat, poi.lon]}
                radius={4}
                pathOptions={{ color: col, fillColor: col, fillOpacity: 0.7, weight: 1 }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Figtree, sans-serif', fontSize: '11px' }}>
                    <strong>{poi.tags?.name || poi.tags?.amenity || poi.tags?.tourism || 'POI'}</strong><br />
                    <span style={{ color: '#888', textTransform: 'capitalize' }}>{t}</span>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Click-to-add pin marker */}
          {addPinAt && (
            <Marker position={[addPinAt.lat, addPinAt.lng]} icon={pinIcon('#FFB300')}>
              <Popup autoClose={false} closeOnClick={false}>
                <div style={{ fontFamily: 'Figtree, sans-serif', minWidth: 200 }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>Save Pin</p>
                  <input
                    type="text"
                    placeholder="Pin name…"
                    value={pinName}
                    onChange={e => setPinName(e.target.value)}
                    style={{ width: '100%', marginBottom: 4, padding: '3px 6px', fontSize: '11px', borderRadius: 4, border: '1px solid #ccc' }}
                  />
                  <select
                    value={pinType}
                    onChange={e => setPinType(e.target.value)}
                    style={{ width: '100%', marginBottom: 6, padding: '3px 6px', fontSize: '11px', borderRadius: 4, border: '1px solid #ccc' }}
                  >
                    <option value="hotel">Hotel</option>
                    <option value="attraction">Attraction</option>
                    <option value="transport">Transport</option>
                    <option value="other">Other</option>
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleAddPinSave}
                      disabled={savingPin}
                      style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#00E5FF', color: '#050A14', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                    >
                      {savingPin ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setAddPinAt(null)}
                      style={{ flex: 1, padding: '4px', fontSize: '11px', background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Map hint */}
        <div
          className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded text-[10px] pointer-events-none"
          style={{ background: 'rgba(5,10,20,0.82)', color: 'var(--app-muted)', border: '1px solid var(--stroke-soft)', fontFamily: 'Figtree, sans-serif' }}
        >
          Click map to save a pin · Zoom 9+ for POIs
        </div>
      </div>
    </div>
  );
}
