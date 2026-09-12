/**
 * PlannerMap.jsx — Dynamic Itinerary Routing Map (Pass 2+)
 *
 * Renders a Leaflet map that:
 *  • Shows every trip component with a location as a numbered, type-coloured
 *    pin marker (sorted by sort_order)
 *  • Draws dashed routing polylines between consecutive markers
 *  • Places directional arrow icons at each segment's midpoint
 *  • Auto-fits the viewport to the full route on load and whenever
 *    the component list changes
 *  • Shows an unlocated-components count badge at bottom-left
 *  • Dark CartoDB tiles match the application's dark theme
 *
 * Props:
 *   components  – array of trip_component objects (each may have
 *                 latitude / longitude fields)
 *   trip        – trip record (used for fallback centre / title)
 */

import React, { useEffect, useMemo } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation2 } from 'lucide-react';

// ─── Fix Leaflet default icon path (Webpack asset hashing) ─────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Type meta (colour + route-line colour) ─────────────────────────────────
const TYPE_META = {
  flight:     { color: '#4AA3FF' },
  train:      { color: '#06b6d4' },
  bus:        { color: '#06b6d4' },
  ferry:      { color: '#22d3ee' },
  cruise:     { color: '#22d3ee' },
  transfer:   { color: '#2aaf69' },
  self_drive: { color: '#2aaf69' },
  stay:       { color: '#E8A830' },
  activity:   { color: '#a78bfa' },
  attraction: { color: '#a78bfa' },
  meal:       { color: '#f97316' },
  visa:       { color: '#94a3b8' },
  insurance:  { color: '#94a3b8' },
  misc:       { color: '#94a3b8' },
};

const DEFAULT_COLOR = '#8FBEC7';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Great-circle bearing from (lat1,lng1) → (lat2,lng2) in degrees 0-360 */
function calcBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const φ1   = lat1 * (Math.PI / 180);
  const φ2   = lat2 * (Math.PI / 180);
  const y    = Math.sin(dLng) * Math.cos(φ2);
  const x    = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360;
}

/** Numbered pin drop icon, coloured by component type */
function makePinIcon(seq, color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:32px;height:42px;">
        <div style="
          position:absolute;top:0;left:0;
          width:30px;height:30px;
          background:${color};
          border:2.5px solid rgba(255,255,255,0.90);
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 3px 10px rgba(0,0,0,0.50);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="
            transform:rotate(45deg);
            color:#fff;font-size:11px;font-weight:800;
            font-family:ui-monospace,monospace;line-height:1;
          ">${seq}</span>
        </div>
      </div>
    `,
    iconSize:    [32, 42],
    iconAnchor:  [15, 42],
    popupAnchor: [0, -44],
  });
}

/** Tiny directional arrow icon placed at segment midpoint */
function makeArrowIcon(bearing, color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:0;height:0;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-bottom:14px solid ${color};
        transform:rotate(${bearing}deg);
        transform-origin:50% 50%;
        opacity:0.90;
        filter:drop-shadow(0 1px 3px rgba(0,0,0,0.50));
      "></div>
    `,
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });
}

// ─── Inner component that auto-fits the map to the route ────────────────────
function BoundsFitter({ pointsKey, points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 10, { animate: true });
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11, animate: true });
    }
  }, [pointsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Popup helper ────────────────────────────────────────────────────────────
function ComponentPopup({ comp, seq, color }) {
  const d = comp.start_datetime;
  const dateStr = d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  return (
    <div style={{ minWidth: 170, fontFamily: 'sans-serif', padding: '2px 0' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: 1.2, color, marginBottom: 4,
      }}>
        #{seq} · {comp.type?.replace('_', ' ')}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2640', marginBottom: 2 }}>
        {comp.title}
      </div>
      {comp.supplier_name && (
        <div style={{ fontSize: 11, color: '#555' }}>{comp.supplier_name}</div>
      )}
      {dateStr && (
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{dateStr}</div>
      )}
      {comp.sell_price != null && (
        <div style={{
          fontSize: 11, fontWeight: 700, color,
          marginTop: 4, paddingTop: 4, borderTop: '1px solid #e5e7eb',
        }}>
          {comp.sell_currency || 'INR'} {Number(comp.sell_price).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── Empty state overlay ─────────────────────────────────────────────────────
function EmptyOverlay({ hasComponents }) {
  return (
    <div style={{
      position:       'absolute',
      inset:          0,
      zIndex:         1000,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      pointerEvents:  'none',
    }}>
      <div style={{
        background:     'rgba(10,22,40,0.75)',
        border:         '1px solid rgba(143,179,199,0.20)',
        borderRadius:   16,
        padding:        '18px 28px',
        backdropFilter: 'blur(12px)',
        textAlign:      'center',
        maxWidth:       260,
      }}>
        <Navigation2 size={28} style={{ color: '#8FBEC7', marginBottom: 10 }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#c5d8e8', marginBottom: 4 }}>
          {hasComponents ? 'No Locations Set' : 'Route Map'}
        </p>
        <p style={{ fontSize: 11, color: '#607080', lineHeight: 1.55 }}>
          {hasComponents
            ? 'Add a location to your components — the route will appear here automatically.'
            : 'Add components to this trip and set their locations. The itinerary route will appear here.'}
        </p>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function PlannerMap({ components = [], trip }) {
  // Only components that have coordinates, sorted by sort_order
  const located = useMemo(
    () =>
      [...components]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .filter(c => c.latitude != null && c.longitude != null),
    [components],
  );

  const unlocated = components.length - located.length;

  // Route segments between consecutive located markers
  const segments = useMemo(() => {
    const segs = [];
    for (let i = 0; i < located.length - 1; i++) {
      const from  = located[i];
      const to    = located[i + 1];
      const color = (TYPE_META[from.type] || {}).color || DEFAULT_COLOR;
      const lat1  = from.latitude, lng1 = from.longitude;
      const lat2  = to.latitude,   lng2 = to.longitude;
      const mid   = [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
      const bear  = calcBearing(lat1, lng1, lat2, lng2);
      segs.push({
        id:     `${from.id}→${to.id}`,
        points: [[lat1, lng1], [lat2, lng2]],
        mid, bear, color,
      });
    }
    return segs;
  }, [located]);

  // Stable string key for the bounds fitter
  const pointsKey = located.map(c => `${c.latitude},${c.longitude}`).join('|');
  const boundPts  = located.map(c => [c.latitude, c.longitude]);

  const showEmpty = located.length === 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={4}
        style={{ width: '100%', height: '100%' }}
        zoomControl
        scrollWheelZoom
        data-testid="planner-map"
      >
        {/* Dark CartoDB tiles — matches the app's dark theme */}
        <TileLayer
          url={`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.REACT_APP_CARTO_API_KEY}`}
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* Auto-fit to route */}
        {!showEmpty && (
          <BoundsFitter points={boundPts} pointsKey={pointsKey} />
        )}

        {/* Route polylines */}
        {segments.map(seg => (
          <Polyline
            key={`${seg.id}-line`}
            positions={seg.points}
            pathOptions={{
              color:     seg.color,
              weight:    2.5,
              opacity:   0.75,
              dashArray: '10 6',
            }}
          />
        ))}

        {/* Directional arrow at each segment midpoint */}
        {segments.map(seg => (
          <Marker
            key={`${seg.id}-arrow`}
            position={seg.mid}
            icon={makeArrowIcon(seg.bear, seg.color)}
            interactive={false}
            zIndexOffset={-100}
          />
        ))}

        {/* Component pin markers */}
        {located.map((comp, idx) => {
          const color = (TYPE_META[comp.type] || {}).color || DEFAULT_COLOR;
          const seq   = idx + 1;
          return (
            <Marker
              key={comp.id}
              position={[comp.latitude, comp.longitude]}
              icon={makePinIcon(seq, color)}
            >
              <Popup minWidth={180}>
                <ComponentPopup comp={comp} seq={seq} color={color} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Empty state overlay */}
      {showEmpty && <EmptyOverlay hasComponents={components.length > 0} />}

      {/* Unlocated badge */}
      {!showEmpty && unlocated > 0 && (
        <div
          style={{
            position:       'absolute',
            bottom:         12,
            left:           12,
            zIndex:         9000,
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            background:     'rgba(10,22,40,0.82)',
            border:         '1px solid rgba(232,168,48,0.30)',
            borderRadius:   10,
            padding:        '5px 11px',
            fontSize:       11,
            color:          '#E8A830',
            backdropFilter: 'blur(8px)',
          }}
          data-testid="planner-map-unlocated-badge"
        >
          <MapPin size={12} />
          {unlocated} component{unlocated > 1 ? 's need' : ' needs'} a location
        </div>
      )}

      {/* Legend */}
      {!showEmpty && (
        <div
          style={{
            position:       'absolute',
            top:            52,
            right:          10,
            zIndex:         9000,
            background:     'rgba(10,22,40,0.82)',
            border:         '1px solid rgba(143,179,199,0.18)',
            borderRadius:   12,
            padding:        '8px 12px',
            backdropFilter: 'blur(8px)',
            fontSize:       10,
            color:          '#7A8CA5',
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: 1.2, color: '#8FBEC7', marginBottom: 6,
          }}>
            Route Legend
          </div>
          {[
            { color: '#4AA3FF', label: 'Flight' },
            { color: '#06b6d4', label: 'Rail / Bus / Ferry' },
            { color: '#2aaf69', label: 'Transfer' },
            { color: '#E8A830', label: 'Hotel / Stay' },
            { color: '#a78bfa', label: 'Activity' },
            { color: '#f97316', label: 'Dining' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 9, height: 9, background: color, borderRadius: '50%', flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
