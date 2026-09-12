// ─────────────────────────────────────────────────────────────────────────────
// ItineraryDesigner.jsx — Blue Diamond Voyage TravelOS
// Day-wise timeline itinerary builder with 10 structured block types
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  PlaneTakeoff, Plane, Car, Ship, Navigation, Building2,
  UtensilsCrossed, Compass, Star, AlertCircle, Info,
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Save,
  ArrowLeft, MapPin, Phone, Calendar, Users, Clock,
  Loader2, Lightbulb, AlertTriangle, Coffee, Ticket,
  FileText, BookOpen, Globe, CheckCircle2, XCircle,
  Navigation2, Route, Map, FileDown, ImagePlus, X as XIcon,
  Sparkles, Upload, Type,
} from 'lucide-react';
import { itineraryAPI, clientsAPI, uploadsAPI } from '../services/api';
import { aiGenerateItinerary } from '../services/plannerAPI';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T_BLUE   = '#4AA3FF';
const T_GOLD   = '#E8A830';
const T_CORAL  = '#E8825A';
const T_GREEN  = '#27AE60';
const T_VIOLET = '#8B7CFF';

// ── Block type definitions (10 blocks from BDV standard format) ───────────────
const BLOCK_DEFS = [
  { key: 'DEPARTURE', label: 'Departure',                  Icon: PlaneTakeoff,   color: T_BLUE,   category: 'transport' },
  { key: 'FLIGHT',    label: 'Flight',                     Icon: Plane,          color: T_BLUE,   category: 'transport' },
  { key: 'TRANSFER',  label: 'Transfer',                   Icon: Car,            color: T_BLUE,   category: 'transport' },
  { key: 'FERRY',     label: 'Ferry',                      Icon: Ship,           color: T_BLUE,   category: 'transport' },
  { key: 'WALK',      label: 'Walk / Drive Route',         Icon: Route,          color: T_BLUE,   category: 'transport' },
  { key: 'HOTEL',     label: 'Hotel',                      Icon: Building2,      color: T_GOLD,   category: 'hotel' },
  { key: 'EATERIES',  label: 'Eateries',                   Icon: UtensilsCrossed,color: T_CORAL,  category: 'food' },
  { key: 'EXCURSION', label: 'Excursion',                  Icon: Compass,        color: T_GREEN,  category: 'experience' },
  { key: 'MUST_TRY',  label: 'Must Try / Buy / Remember',  Icon: Star,           color: T_VIOLET, category: 'tips' },
  { key: 'INFO',      label: 'Info / Note / Alert',        Icon: AlertCircle,    color: T_VIOLET, category: 'tips' },
];
const BLOCK_MAP = Object.fromEntries(BLOCK_DEFS.map(b => [b.key, b]));

// ── Status definitions ────────────────────────────────────────────────────────
const STATUS_DEFS = {
  booked:    { label: 'Booked',    color: T_GREEN,  bg: 'rgba(39,174,96,0.15)' },
  included:  { label: 'Included',  color: T_BLUE,   bg: 'rgba(74,163,255,0.15)' },
  suggested: { label: 'Suggested', color: T_GOLD,   bg: 'rgba(232,168,48,0.15)' },
  optional:  { label: 'Optional',  color: '#8a8a8a', bg: 'rgba(160,160,160,0.10)' },
};

const MEAL_PLAN_LABELS = { RO:'Room Only', BB:'Bed & Breakfast', HB:'Half Board', FB:'Full Board', AI:'All Inclusive' };

// ── Block field definitions per type ─────────────────────────────────────────
const BLOCK_FIELDS = {
  DEPARTURE: [
    { n:'from_city',   l:'Departing City / Airport',      t:'input',    ph:'e.g., Ahmedabad International Airport', span:2 },
    { n:'terminal',    l:'Terminal',                       t:'input',    ph:'e.g., Terminal 1' },
    { n:'report_time', l:'Report / Check-in Time',         t:'input',    ph:'e.g., 03:00' },
    { n:'carrier',     l:'Carrier / Airline',              t:'input',    ph:'e.g., Etihad Airways' },
    { n:'address',     l:'Airport Address (for Maps)',     t:'input',    ph:'Full airport address for Google Maps', span:2 },
    { n:'notes',       l:'Notes',                          t:'textarea', span:2 },
  ],
  FLIGHT: [
    { n:'airline',      l:'Airline',                      t:'input',  ph:'e.g., Etihad Airways' },
    { n:'flight_no',    l:'Flight No.',                   t:'input',  ph:'e.g., EY 247' },
    { n:'from_airport', l:'From Airport',                 t:'input',  ph:'e.g., AMD – Ahmedabad' },
    { n:'to_airport',   l:'To Airport',                   t:'input',  ph:'e.g., AUH – Abu Dhabi' },
    { n:'dep_time',     l:'Departs (Time)',               t:'input',  ph:'e.g., 05:40' },
    { n:'arr_time',     l:'Arrives (Time)',               t:'input',  ph:'e.g., 07:10' },
    { n:'dep_date',     l:'Depart Date',                  t:'input',  ph:'e.g., 17 June 2026' },
    { n:'arr_date',     l:'Arrive Date (if different)',   t:'input',  ph:'e.g., 18 June 2026' },
    { n:'pnr',          l:'PNR / Booking Ref',            t:'input',  ph:'e.g., 83ZNG6' },
    { n:'flight_class', l:'Class',                        t:'select', options:['Economy','Premium Economy','Business','First'] },
    { n:'baggage',      l:'Baggage Allowance',            t:'input',  ph:'e.g., 30kg/person' },
    { n:'meal_pref',    l:'Meal Preference',              t:'input',  ph:'e.g., Vegetarian Hindu' },
    { n:'terminal_dep', l:'Dep. Terminal',                t:'input',  ph:'e.g., Terminal 1' },
    { n:'terminal_arr', l:'Arr. Terminal',                t:'input',  ph:'e.g., Terminal 2' },
    { n:'duration',     l:'Flight Duration',              t:'input',  ph:'e.g., 2h 50m' },
    { n:'stopover',     l:'Stopover / Layover Info',      t:'input',  ph:'e.g., Abu Dhabi ~7h 20m' },
    { n:'notes',        l:'Notes',                        t:'textarea', span:2 },
  ],
  TRANSFER: [
    { n:'vehicle',       l:'Vehicle / Transfer Type',     t:'input',  ph:'e.g., 13-Seater Van, Toyota Vellfire', span:2 },
    { n:'from_location', l:'From',                        t:'input',  ph:'e.g., Munich Airport' },
    { n:'to_location',   l:'To',                          t:'input',  ph:'e.g., Innsbruck Hotel' },
    { n:'from_address',  l:'From Address (for Maps)',     t:'input',  ph:'Full pickup address' },
    { n:'to_address',    l:'To Address (for Maps)',       t:'input',  ph:'Full drop address' },
    { n:'dep_time',      l:'Departure Time',              t:'input',  ph:'e.g., 10:00' },
    { n:'duration',      l:'Duration',                    t:'input',  ph:'e.g., ~1 hr 40 min' },
    { n:'driver_name',   l:'Driver Name',                 t:'input',  ph:'e.g., Raj Kumar' },
    { n:'driver_phone',  l:'Driver Phone',                t:'input',  ph:'e.g., +49 171 234 5678' },
    { n:'conf_no',       l:'Confirmation / Voucher No.',  t:'input',  ph:'Booking reference' },
    { n:'notes',         l:'Notes',                       t:'textarea', span:2 },
  ],
  FERRY: [
    { n:'operator',      l:'Ferry Operator',              t:'input',  ph:'e.g., BRT Ferry', span:2 },
    { n:'from_terminal', l:'From Terminal',               t:'input',  ph:'e.g., Tanah Merah Ferry Terminal, Singapore' },
    { n:'to_terminal',   l:'To Terminal',                 t:'input',  ph:'e.g., Bandar Bentan Telani, Bintan' },
    { n:'dep_time',      l:'Departs',                     t:'input',  ph:'e.g., 09:00' },
    { n:'arr_time',      l:'Arrives',                     t:'input',  ph:'e.g., 10:30' },
    { n:'duration',      l:'Duration',                    t:'input',  ph:'e.g., ~1 hr 30 min' },
    { n:'ticket_ref',    l:'Ticket / Booking Ref',        t:'input',  ph:'Booking reference number' },
    { n:'phone',         l:'Contact Phone',               t:'input',  ph:'+65 xxx xxxx' },
    { n:'notes',         l:'Notes',                       t:'textarea', span:2 },
  ],
  WALK: [
    { n:'route_type',    l:'Route Type',                        t:'select', options:['Walking','Driving','Cycling','Transit'] },
    { n:'from_location', l:'From (Label)',                      t:'input',  ph:'e.g., Hotel' },
    { n:'to_location',   l:'To (Label)',                        t:'input',  ph:'e.g., Goldenes Dachl' },
    { n:'from_address',  l:'From Address (Google Maps origin)', t:'input',  ph:'Full street address or place name' },
    { n:'to_address',    l:'To Address (Google Maps destination)', t:'input', ph:'Full street address or place name' },
    { n:'distance',      l:'Distance',                          t:'input',  ph:'e.g., 800m  or  12 km' },
    { n:'duration',      l:'Duration',                          t:'input',  ph:'e.g., ~10 mins  or  ~25 mins by car' },
    { n:'route_notes',   l:'Route Notes / Directions',          t:'textarea', span:2 },
  ],
  HOTEL: [
    { n:'hotel_name',       l:'Hotel Name',               t:'input',  ph:'e.g., ADLERS Hotel Innsbruck', span:2 },
    { n:'star_rating',      l:'Star Rating',              t:'select', options:['1','2','3','4','5'] },
    { n:'city',             l:'City',                     t:'input',  ph:'e.g., Innsbruck' },
    { n:'address',          l:'Full Address (for Maps)',  t:'input',  ph:'Hotel street address', span:2 },
    { n:'phone',            l:'Hotel Phone',              t:'input',  ph:'+43 512 xxxx' },
    { n:'conf_no',          l:'Confirmation / Voucher',   t:'input',  ph:'Booking reference' },
    { n:'check_in_date',    l:'Check-in Date',            t:'input',  ph:'e.g., 18 June 2026' },
    { n:'check_in_time',    l:'Check-in Time',            t:'input',  ph:'e.g., From 15:00' },
    { n:'check_out_date',   l:'Check-out Date',           t:'input',  ph:'e.g., 20 June 2026' },
    { n:'check_out_time',   l:'Check-out Time',           t:'input',  ph:'e.g., Until 11:00' },
    { n:'nights',           l:'Nights',                   t:'input',  ph:'e.g., 2' },
    { n:'room_type',        l:'Room Type',                t:'input',  ph:'e.g., Panorama Classic, Superior' },
    { n:'meal_plan',        l:'Meal Plan',                t:'select', options:['RO','BB','HB','FB','AI'] },
    { n:'inclusions',       l:'Inclusions',               t:'input',  ph:'e.g., Spa + Free WiFi + Pool' },
    { n:'special_requests', l:'Special Requests',         t:'input',  ph:'e.g., High Floor + Double Bed', span:2 },
    { n:'city_tax',         l:'City Tax',                 t:'input',  ph:'e.g., €4.50/person/night' },
    { n:'deposit',          l:'Hotel Deposit (Refundable)',t:'input', ph:'e.g., ~MYR 500 on arrival' },
    { n:'notes',            l:'Important Notes',          t:'textarea', span:2 },
  ],
  EATERIES: [
    { n:'meal_type',         l:'Meal Type',               t:'select', options:['Breakfast','Lunch','Dinner','Snack','Coffee / Tea','Brunch'] },
    { n:'restaurant_name',   l:'Restaurant Name',         t:'input',  ph:'e.g., Gasthof zur Goldenen Glocke' },
    { n:'cuisine',           l:'Cuisine Type',            t:'input',  ph:'e.g., Austrian, Italian, Thai' },
    { n:'address',           l:'Address (for Maps)',      t:'input',  ph:'Restaurant address', span:2 },
    { n:'phone',             l:'Phone',                   t:'input',  ph:'+43 xxx xxxx' },
    { n:'opening_hours',     l:'Opening Hours',           t:'input',  ph:'e.g., 12:00 – 22:00' },
    { n:'price_range',       l:'Price Range',             t:'input',  ph:'e.g., €10–15/person' },
    { n:'dietary_note',      l:'Dietary Note',            t:'input',  ph:'e.g., Veg options available, Jain food available' },
    { n:'reservation_advice',l:'Reservation Advice',      t:'input',  ph:'e.g., Book in advance!', span:2 },
    { n:'notes',             l:'Notes',                   t:'textarea', span:2 },
  ],
  EXCURSION: [
    { n:'name',            l:'Attraction / Activity Name', t:'input',  ph:'e.g., Nordkette Cable Car', span:2 },
    { n:'category',        l:'Category',                   t:'input',  ph:'e.g., Cable Car, Theme Park, Museum, City Tour' },
    { n:'location',        l:'Location / City',            t:'input',  ph:'e.g., Innsbruck' },
    { n:'address',         l:'Address (for Maps)',         t:'input',  ph:'Full address', span:2 },
    { n:'phone',           l:'Contact Phone',              t:'input',  ph:'+43 xxx xxxx' },
    { n:'opening_hours',   l:'Opening Hours',              t:'input',  ph:'e.g., 9:00 AM – 6:00 PM' },
    { n:'duration',        l:'Suggested Duration',         t:'input',  ph:'e.g., ~3 hours' },
    { n:'ticket_included', l:'Ticket Status',              t:'select', options:['Ticket Included','Extra Cost – Not Included','Free Entry','Covered by City Card'] },
    { n:'ticket_ref',      l:'Ticket / Booking Ref',       t:'input',  ph:'Reference number' },
    { n:'description',     l:'Description / What to Expect', t:'textarea', span:2 },
    { n:'notes',           l:'Important Notes (restrictions etc.)', t:'textarea', span:2 },
  ],
  MUST_TRY: [
    { n:'category',    l:'Category',    t:'select',   options:['Must Try','Must Buy','Must Remember'] },
    { n:'title',       l:'Title',       t:'input',    ph:'e.g., Apple Strudel at Café Sacher', span:1 },
    { n:'description', l:'Description', t:'textarea', span:2 },
    { n:'location',    l:'Location',    t:'input',    ph:'e.g., Vienna Old Town' },
    { n:'address',     l:'Address (for Maps)', t:'input', ph:'Optional address for Google Maps' },
    { n:'price_range', l:'Price Range', t:'input',    ph:'e.g., €4–6' },
    { n:'notes',       l:'Notes',       t:'textarea', span:2 },
  ],
  INFO: [
    { n:'severity', l:'Severity',      t:'select',   options:['info','warning','tip'] },
    { n:'title',    l:'Title',         t:'input',    ph:'e.g., Austria Vignette Required!', span:1 },
    { n:'content',  l:'Content / Message', t:'textarea', span:2 },
    { n:'notes',    l:'Additional Notes', t:'textarea', span:2 },
  ],
};

// ── Helper functions ──────────────────────────────────────────────────────────
const mapsUrl  = (addr) => addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null;
const directionsUrl = (from, to, mode = 'walking') => {
  if (!from || !to) return null;
  const modeMap = { Walking: 'walking', Driving: 'driving', Cycling: 'bicycling', Transit: 'transit' };
  const gmMode = modeMap[mode] || mode.toLowerCase() || 'walking';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=${gmMode}`;
};
const genId    = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2,6)}`;
const getColor = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2,'0');

// ── Micro-components ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_DEFS[status] || STATUS_DEFS.suggested;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + '55' }}>
      {cfg.label}
    </span>
  );
};

const MapLink = ({ address, label }) => {
  const url = mapsUrl(address);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs hover:underline"
      style={{ color: T_BLUE }} data-testid="block-map-link">
      <MapPin size={11} />{label || 'Maps'}
    </a>
  );
};

const PhoneLink = ({ phone }) => {
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/\s/g,'')}`}
      className="inline-flex items-center gap-1 text-xs hover:underline"
      style={{ color: T_BLUE }} data-testid="block-phone-link">
      <Phone size={11} />{phone}
    </a>
  );
};

const FieldRow = ({ label, children }) => (
  <div className="space-y-1">
    <Label className="text-xs font-medium" style={{ color: 'var(--app-muted)' }}>{label}</Label>
    {children}
  </div>
);

// ── Block Card ────────────────────────────────────────────────────────────────
const BlockCard = ({ block, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const def  = BLOCK_MAP[block.block_type] || BLOCK_MAP.INFO;
  const { Icon, color } = def;
  const d    = block.data || {};
  const bg   = color + '20';

  const renderBody = () => {
    switch (block.block_type) {

      case 'DEPARTURE':
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.from_city || 'Departure Point'}</p>
            <div className="flex flex-wrap gap-3 text-xs" style={{color:'var(--app-dim)'}}>
              {d.report_time && <span><Clock size={11} className="inline mr-1"/>Report by {d.report_time}</span>}
              {d.terminal    && <span>Terminal {d.terminal}</span>}
              {d.carrier     && <span>{d.carrier}</span>}
            </div>
            {d.address && <div className="mt-1"><MapLink address={d.address} label="Airport on Maps"/></div>}
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'FLIGHT':
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{color:'var(--app-fg)'}}>{[d.airline, d.flight_no].filter(Boolean).join(' · ')}</span>
              {d.flight_class && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{background:`${T_BLUE}22`,color:T_BLUE}}>{d.flight_class}</span>}
            </div>
            <p className="text-sm" style={{color:'var(--app-dim)'}}>{d.from_airport} → {d.to_airport}</p>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {(d.dep_time||d.arr_time) && <span className="font-mono">{d.dep_time} → {d.arr_time}</span>}
              {d.duration  && <span><Clock size={11} className="inline mr-0.5"/>{d.duration}</span>}
              {d.baggage   && <span>Baggage: {d.baggage}</span>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-muted)'}}>
              {d.pnr       && <span>PNR: <strong style={{color:'var(--app-fg)'}}>{d.pnr}</strong></span>}
              {d.meal_pref && <span>{d.meal_pref}</span>}
              {d.stopover  && <span>Stopover: {d.stopover}</span>}
            </div>
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'TRANSFER':
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.vehicle || 'Private Transfer'}</p>
            <p className="text-sm" style={{color:'var(--app-dim)'}}>{d.from_location} → {d.to_location}</p>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {d.dep_time && <span><Clock size={11} className="inline mr-0.5"/>Departs {d.dep_time}</span>}
              {d.duration && <span>{d.duration}</span>}
              {d.conf_no  && <span>Ref: {d.conf_no}</span>}
            </div>
            {(d.driver_name||d.driver_phone) && (
              <div className="flex gap-4 text-xs" style={{color:'var(--app-dim)'}}>
                {d.driver_name  && <span>Driver: {d.driver_name}</span>}
                {d.driver_phone && <PhoneLink phone={d.driver_phone}/>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {d.from_address && <MapLink address={d.from_address} label="From"/>}
              {d.to_address   && <MapLink address={d.to_address}   label="To"/>}
            </div>
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'FERRY':
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.operator || 'Ferry'}</p>
            <p className="text-sm" style={{color:'var(--app-dim)'}}>{d.from_terminal} → {d.to_terminal}</p>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {(d.dep_time||d.arr_time) && <span className="font-mono">{d.dep_time} → {d.arr_time}</span>}
              {d.duration   && <span><Clock size={11} className="inline mr-0.5"/>{d.duration}</span>}
              {d.ticket_ref && <span><Ticket size={11} className="inline mr-0.5"/>Ref: {d.ticket_ref}</span>}
            </div>
            {d.phone && <div className="mt-1"><PhoneLink phone={d.phone}/></div>}
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'WALK': {
        // Dynamic icon based on route type
        const routeIconMap = { Walking: Navigation, Driving: Car, Cycling: Navigation2, Transit: Navigation2 };
        const RouteTypeIcon = routeIconMap[d.route_type] || Route;
        // Google Maps Directions link (full navigation URL with travel mode)
        const navUrl = directionsUrl(d.from_address, d.to_address, d.route_type || 'Walking');
        return (
          <div className="space-y-1.5">
            {/* Route type badge + From → To */}
            <div className="flex items-center gap-2 flex-wrap">
              {d.route_type && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{background:`${T_BLUE}20`, color:T_BLUE, border:`1px solid ${T_BLUE}35`}}>
                  <RouteTypeIcon size={9}/>{d.route_type}
                </span>
              )}
              <p className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>
                {d.from_location || '—'} → {d.to_location || '—'}
              </p>
            </div>

            {/* Distance + Duration */}
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {d.distance && <span><Route size={10} className="inline mr-0.5"/>{d.distance}</span>}
              {d.duration && <span><Clock size={11} className="inline mr-0.5"/>{d.duration}</span>}
            </div>

            {/* Route notes */}
            {d.route_notes && <p className="text-xs mt-1 leading-relaxed" style={{color:'var(--app-dim)'}}>{d.route_notes}</p>}

            {/* Navigation links */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {navUrl ? (
                <a href={navUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-opacity duration-150 hover:opacity-80"
                  style={{background:`${T_BLUE}18`, color:T_BLUE, border:`1px solid ${T_BLUE}40`}}
                  data-testid="block-navigate-link">
                  <RouteTypeIcon size={12}/> Get Directions on Google Maps →
                </a>
              ) : (
                <>
                  {d.from_address && <MapLink address={d.from_address} label="From on Maps"/>}
                  {d.to_address   && <MapLink address={d.to_address}   label="To on Maps"/>}
                </>
              )}
            </div>
          </div>
        );
      }

      case 'HOTEL':
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{color:'var(--app-fg)'}}>{d.hotel_name || 'Hotel'}</span>
              {d.star_rating && <span style={{color:T_GOLD}}>{'★'.repeat(parseInt(d.star_rating)||0)}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {d.room_type  && <span className="px-1.5 py-0.5 rounded font-medium" style={{background:`${T_GOLD}18`,color:T_GOLD}}>{d.room_type}</span>}
              {d.meal_plan  && <span className="px-1.5 py-0.5 rounded font-medium" style={{background:`${T_GOLD}18`,color:T_GOLD}}>{MEAL_PLAN_LABELS[d.meal_plan]||d.meal_plan}</span>}
              {d.nights     && <span className="px-1.5 py-0.5 rounded font-medium" style={{background:`${T_GOLD}18`,color:T_GOLD}}>{d.nights} Night{d.nights>1?'s':''}</span>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {d.check_in_date  && <span>Check-in: {d.check_in_date}{d.check_in_time  ? ` · ${d.check_in_time}`  : ''}</span>}
              {d.check_out_date && <span>Check-out: {d.check_out_date}{d.check_out_time ? ` · ${d.check_out_time}` : ''}</span>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-muted)'}}>
              {d.conf_no   && <span>Conf: <strong style={{color:'var(--app-fg)'}}>{d.conf_no}</strong></span>}
              {d.city_tax  && <span>City Tax: {d.city_tax}</span>}
              {d.inclusions && <span>✓ {d.inclusions}</span>}
            </div>
            {d.special_requests && <p className="text-xs italic" style={{color:'var(--app-dim)'}}>Request: {d.special_requests}</p>}
            {d.deposit && <p className="text-xs" style={{color:`${T_GOLD}cc`}}>Deposit: {d.deposit}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
              {d.address && <MapLink address={d.address} label="Hotel on Maps"/>}
              {d.phone   && <PhoneLink phone={d.phone}/>}
            </div>
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'EATERIES':
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {d.meal_type && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{background:`${T_CORAL}20`,color:T_CORAL}}>{d.meal_type}</span>}
              <span className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.restaurant_name || 'Restaurant Suggestion'}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs" style={{color:'var(--app-dim)'}}>
              {d.cuisine        && <span>{d.cuisine}</span>}
              {d.price_range    && <span>{d.price_range}</span>}
              {d.opening_hours  && <span><Clock size={11} className="inline mr-0.5"/>{d.opening_hours}</span>}
            </div>
            {(d.dietary_note||d.reservation_advice) && (
              <div className="text-xs space-y-0.5" style={{color:'var(--app-dim)'}}>
                {d.dietary_note       && <p>🥗 {d.dietary_note}</p>}
                {d.reservation_advice && <p className="italic">{d.reservation_advice}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              {d.address && <MapLink address={d.address} label="Restaurant on Maps"/>}
              {d.phone   && <PhoneLink phone={d.phone}/>}
            </div>
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'EXCURSION':
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{color:'var(--app-fg)'}}>{d.name || 'Activity / Excursion'}</span>
              {d.category && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{background:`${T_GREEN}18`,color:T_GREEN}}>{d.category}</span>}
            </div>
            <div className="flex flex-wrap gap-4 text-xs" style={{color:'var(--app-dim)'}}>
              {d.opening_hours && <span><Clock size={11} className="inline mr-0.5"/>{d.opening_hours}</span>}
              {d.duration      && <span>{d.duration}</span>}
              {d.ticket_included && (
                <span className="font-semibold" style={{color: d.ticket_included.includes('Included')||d.ticket_included.includes('Card') ? T_GREEN : T_CORAL}}>
                  {d.ticket_included.includes('Included')||d.ticket_included.includes('Card') ? '✓ ' : '× '}{d.ticket_included}
                </span>
              )}
            </div>
            {d.ticket_ref && <p className="text-xs" style={{color:'var(--app-muted)'}}>Ref: {d.ticket_ref}</p>}
            {d.description && <p className="text-xs mt-1" style={{color:'var(--app-dim)'}}>{d.description.length>140?d.description.substring(0,140)+'…':d.description}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
              {d.address && <MapLink address={d.address} label="Location on Maps"/>}
              {d.phone   && <PhoneLink phone={d.phone}/>}
            </div>
            {d.notes && <p className="text-xs mt-1 font-medium" style={{color:`${T_GOLD}dd`}}>⚠ {d.notes}</p>}
          </div>
        );

      case 'MUST_TRY':
        return (
          <div className="space-y-1.5">
            {d.category && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
                style={{background:`${T_VIOLET}20`,color:T_VIOLET}}>{d.category}</span>
            )}
            <p className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.title}</p>
            {d.description && <p className="text-xs" style={{color:'var(--app-dim)'}}>{d.description}</p>}
            <div className="flex flex-wrap gap-3 text-xs" style={{color:'var(--app-dim)'}}>
              {d.location    && <span><MapPin size={11} className="inline mr-0.5"/>{d.location}</span>}
              {d.price_range && <span>{d.price_range}</span>}
            </div>
            {d.address && <div className="mt-1"><MapLink address={d.address} label="Location on Maps"/></div>}
            {d.notes && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );

      case 'INFO': {
        const sev = {
          warning: { color:T_GOLD,   Icon:AlertTriangle, label:'Warning' },
          tip:     { color:T_GREEN,  Icon:Lightbulb,     label:'Travel Tip' },
          info:    { color:T_BLUE,   Icon:Info,          label:'Info' },
        }[d.severity] || { color:T_BLUE, Icon:Info, label:'Info' };
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <sev.Icon size={14} style={{color:sev.color}}/>
              <span className="text-sm font-semibold" style={{color:'var(--app-fg)'}}>{d.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{background:`${sev.color}20`,color:sev.color}}>{sev.label}</span>
            </div>
            {d.content && <p className="text-xs leading-relaxed" style={{color:'var(--app-dim)'}}>{d.content}</p>}
            {d.notes   && <p className="text-xs mt-1 italic" style={{color:'var(--app-muted)'}}>{d.notes}</p>}
          </div>
        );
      }

      default: return <p className="text-xs" style={{color:'var(--app-muted)'}}>No data</p>;
    }
  };

  return (
    <div className="group relative flex gap-3" data-testid={`block-card-${block.id}`}>
      {/* Timeline connector */}
      <div className="relative flex flex-col items-center pt-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
          style={{background:bg, border:`1.5px solid ${color}55`}}>
          <Icon size={15} style={{color}}/>
        </div>
        <div className="w-px flex-1 mt-1 min-h-[20px]" style={{background:`${color}25`}}/>
      </div>

      {/* Card */}
      <div className="flex-1 mb-3 rounded-xl border overflow-hidden transition-shadow duration-150 hover:shadow-lg"
        style={{background:'var(--surface)', borderColor:'var(--stroke-soft)', borderLeft:`3px solid ${color}`}}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{borderColor:'var(--stroke-soft)'}}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{color}}>{def.label}</span>
            {block.time && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{background:`${color}18`, color}}>
                <Clock size={9} className="inline mr-0.5"/>{block.time}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={block.status}/>
            {/* Action buttons — visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
              {!isFirst && (
                <button onClick={onMoveUp} title="Move up"
                  className="p-1 rounded hover:bg-white/5 transition-colors duration-150"
                  style={{color:'var(--app-muted)'}} data-testid={`block-move-up-${block.id}`}>
                  <ChevronUp size={13}/>
                </button>
              )}
              {!isLast && (
                <button onClick={onMoveDown} title="Move down"
                  className="p-1 rounded hover:bg-white/5 transition-colors duration-150"
                  style={{color:'var(--app-muted)'}} data-testid={`block-move-down-${block.id}`}>
                  <ChevronDown size={13}/>
                </button>
              )}
              <button onClick={onEdit} title="Edit block"
                className="p-1 rounded hover:bg-white/5 transition-colors duration-150"
                style={{color:'var(--app-muted)'}} data-testid={`block-edit-${block.id}`}>
                <Pencil size={13}/>
              </button>
              <button onClick={onDelete} title="Delete block"
                className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors duration-150"
                data-testid={`block-delete-${block.id}`}>
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        </div>
        {/* Image thumbnail */}
        {block.data?.image_url && (
          <div className="relative w-full overflow-hidden" style={{maxHeight: 140}}>
            <img
              src={`${process.env.REACT_APP_BACKEND_URL}${block.data.image_url}`}
              alt="Block"
              className="w-full object-cover"
              style={{maxHeight: 140, borderBottom: '1px solid var(--stroke-soft)'}}
            />
          </div>
        )}
        {/* Body */}
        <div className="px-3 py-2.5">{renderBody()}</div>
      </div>
    </div>
  );
};

// ── Block Image Upload ────────────────────────────────────────────────────────
const BlockImageUpload = ({ blockId, imageUrl, onUploaded, onRemove }) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8 MB'); return; }
    setUploading(true);
    try {
      const res = await uploadsAPI.upload('itinerary_blocks', blockId, file);
      const url = res.data?.file_url;
      if (url) { onUploaded(url); toast.success('Image uploaded'); }
    } catch { toast.error('Image upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div data-testid="block-image-upload">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:'var(--app-muted)'}}>
        Block Photo
      </p>
      {imageUrl ? (
        <div className="relative rounded-lg overflow-hidden border" style={{borderColor:'var(--stroke-soft)'}}>
          <img
            src={`${process.env.REACT_APP_BACKEND_URL}${imageUrl}`}
            alt="Block preview"
            className="w-full object-cover rounded-lg"
            style={{maxHeight: 160}}
          />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition-colors"
            data-testid="block-image-remove"
          >
            <XIcon size={12} className="text-white"/>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-5 transition-colors"
          style={{borderColor:'var(--stroke-soft)', color:'var(--app-muted)'}}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cta)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--stroke-soft)')}
          data-testid="block-image-upload-btn"
        >
          {uploading
            ? <Loader2 size={20} className="animate-spin" style={{color:'var(--cta)'}}/>
            : <ImagePlus size={20}/>}
          <span className="text-xs">{uploading ? 'Uploading…' : 'Click to add a photo'}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
    </div>
  );
};

// ── Block Form Modal ──────────────────────────────────────────────────────────
const BlockFormModal = ({ open, onClose, onSave, existingBlock }) => {
  const isEdit = !!existingBlock;
  // Pre-generate block ID so image uploads can reference it before save
  const [pregenId] = useState(() => existingBlock?.id || genId());
  const [blockType, setBlockType]       = useState(existingBlock?.block_type || '');
  const [status,    setStatus]          = useState(existingBlock?.status || 'suggested');
  const [time,      setTime]            = useState(existingBlock?.time   || '');
  const [formData,  setFormData]        = useState(existingBlock?.data   || {});

  // Smart URL fill state
  const [urlInput,       setUrlInput]       = useState('');
  const [extracting,     setExtracting]     = useState(false);
  const [autoFilledKeys, setAutoFilledKeys] = useState(new Set());
  const [extractResult,  setExtractResult]  = useState(null); // { count } | { error }

  useEffect(() => {
    if (open) {
      setBlockType(existingBlock?.block_type || '');
      setStatus(existingBlock?.status || 'suggested');
      setTime(existingBlock?.time || '');
      setFormData(existingBlock?.data || {});
      setUrlInput('');
      setAutoFilledKeys(new Set());
      setExtractResult(null);
    }
  }, [open, existingBlock]);

  const handleTypeSelect = (key) => {
    setBlockType(key);
    if (!isEdit) setFormData({});
    setAutoFilledKeys(new Set());
    setExtractResult(null);
  };

  const setField = (name, value) => {
    setFormData(p => ({ ...p, [name]: value }));
    // Clear auto-fill highlight once user manually edits
    setAutoFilledKeys(prev => { const n = new Set(prev); n.delete(name); return n; });
  };

  // Smart URL extraction
  const handleExtract = async () => {
    if (!blockType)          { toast.error('Select a block type first');     return; }
    if (!urlInput.trim())    { toast.error('Paste a URL to extract from');   return; }
    setExtracting(true);
    setExtractResult(null);
    try {
      const res = await itineraryAPI.extractFromUrl({ url: urlInput.trim(), block_type: blockType });
      const { success, data, fields_found, error } = res.data;
      if (success && data && Object.keys(data).length > 0) {
        setFormData(prev => ({ ...prev, ...data }));
        setAutoFilledKeys(new Set(Object.keys(data)));
        setExtractResult({ count: fields_found || Object.keys(data).length });
        toast.success(`${fields_found || Object.keys(data).length} fields filled from link`);
      } else {
        setExtractResult({ error: error || 'Nothing could be extracted from this link' });
      }
    } catch {
      setExtractResult({ error: 'Could not reach the extraction service' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = () => {
    if (!blockType) { toast.error('Please select a block type'); return; }
    onSave({
      id:         pregenId,
      block_type: blockType,
      status,
      time,
      data:       formData,
      order:      existingBlock?.order ?? 0,
    });
    onClose();
  };

  const fields      = BLOCK_FIELDS[blockType] || [];
  const selectedDef = BLOCK_MAP[blockType];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl border"
        style={{background:'var(--qb-modal,#14203b)', borderColor:'var(--stroke-soft)', maxHeight:'90vh', display:'flex', flexDirection:'column'}}
        data-testid="block-form-modal">
        <DialogHeader className="flex-shrink-0 pb-3 border-b" style={{borderColor:'var(--stroke-soft)'}}>
          <DialogTitle className="text-lg" style={{fontFamily:'Georgia,serif', color:'var(--app-fg)'}}>
            {isEdit ? 'Edit Block' : 'Add New Block'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4 space-y-5">
            {/* Block type selector */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'var(--app-muted)'}}>Block Type</p>
              <div className="grid grid-cols-5 gap-2">
                {BLOCK_DEFS.map(({ key, label, Icon, color }) => (
                  <button key={key} onClick={() => handleTypeSelect(key)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all duration-150 hover:scale-105"
                    style={{
                      background: blockType === key ? `${color}22` : 'var(--surface)',
                      borderColor: blockType === key ? color : 'var(--stroke-soft)',
                      boxShadow: blockType === key ? `0 0 0 2px ${color}44` : 'none',
                    }}
                    data-testid={`block-type-${key}`}>
                    <Icon size={16} style={{color}}/>
                    <span className="text-[9px] font-semibold leading-tight text-center" style={{color: blockType===key ? color : 'var(--app-muted)'}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {blockType && (
              <>
                <Separator style={{background:'var(--stroke-soft)'}}/>

                {/* ── Smart URL Fill ─────────────────────────────────────── */}
                <div className="rounded-xl border p-3 space-y-2"
                  style={{background:'rgba(74,163,255,0.05)', borderColor:`${T_BLUE}30`}}>
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{color:T_BLUE}}>
                    <Globe size={13}/> Smart Fill from Link
                    <span className="text-[10px] font-normal ml-1" style={{color:'var(--app-muted)'}}>
                      — Paste a URL and AI extracts the details for you
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleExtract()}
                      placeholder="https://  —  hotel page, booking confirmation, restaurant, Google Maps…"
                      className="flex-1 text-sm h-9"
                      style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:`${T_BLUE}40`}}
                      data-testid="url-extract-input"/>
                    <Button
                      onClick={handleExtract}
                      disabled={extracting || !urlInput.trim()}
                      size="sm" className="h-9 gap-1.5 flex-shrink-0 transition-opacity duration-150"
                      style={{background:T_BLUE, color:'#fff'}}
                      data-testid="url-extract-btn">
                      {extracting
                        ? <><Loader2 size={13} className="animate-spin"/> Reading…</>
                        : <><Compass size={13}/> Auto-fill</>}
                    </Button>
                  </div>
                  {/* Result feedback */}
                  {extractResult && (
                    <div className={`text-xs flex items-center gap-1.5 ${extractResult.error ? 'text-red-400' : ''}`}
                      style={extractResult.count ? {color:T_GREEN} : {}}>
                      {extractResult.count
                        ? <><CheckCircle2 size={12}/> {extractResult.count} field{extractResult.count!==1?'s':''} filled — review below and edit as needed</>
                        : <><AlertCircle size={12}/> {extractResult.error}</>}
                    </div>
                  )}
                  {autoFilledKeys.size > 0 && !extractResult?.error && (
                    <p className="text-[10px]" style={{color:'var(--app-muted)'}}>
                      Fields with a <span style={{color:T_GOLD}}>golden border</span> were auto-filled — click any to edit
                    </p>
                  )}
                </div>

                <Separator style={{background:'var(--stroke-soft)'}}/>

                {/* Common fields: time + status */}
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Time (HH:MM)">
                    <Input value={time} onChange={e => setTime(e.target.value)}
                      placeholder="e.g., 09:30"
                      className="text-sm" style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                      data-testid="block-time-input"/>
                  </FieldRow>
                  <FieldRow label="Status">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}} data-testid="block-status-select">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent style={{background:'var(--surface-2)', borderColor:'var(--stroke-soft)'}}>
                        {Object.entries(STATUS_DEFS).map(([k,v]) => (
                          <SelectItem key={k} value={k} style={{color:'var(--app-fg)'}}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <Separator style={{background:'var(--stroke-soft)'}}/>

                {/* Type-specific fields */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color: selectedDef?.color}}>
                    {selectedDef?.label} Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map(f => {
                      const isAutoFilled = autoFilledKeys.has(f.n);
                      const fieldBorder  = isAutoFilled ? T_GOLD : 'var(--stroke-soft)';
                      return (
                        <div key={f.n} className={f.span === 2 ? 'col-span-2' : 'col-span-1'}>
                          <FieldRow label={
                            <span className="flex items-center gap-1">
                              {f.l}
                              {isAutoFilled && (
                                <span className="text-[9px] px-1 py-0.5 rounded font-bold"
                                  style={{background:`${T_GOLD}20`, color:T_GOLD}}>auto</span>
                              )}
                            </span>
                          }>
                            {f.t === 'textarea' ? (
                              <Textarea value={formData[f.n] || ''}
                                onChange={e => setField(f.n, e.target.value)}
                                placeholder={f.ph || ''}
                                rows={3}
                                className="text-sm resize-none"
                                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:fieldBorder, transition:'border-color 0.3s'}}
                                data-testid={`block-field-${f.n}`}/>
                            ) : f.t === 'select' ? (
                              <Select value={formData[f.n] || ''} onValueChange={v => setField(f.n, v)}>
                                <SelectTrigger style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:fieldBorder, transition:'border-color 0.3s'}} data-testid={`block-field-${f.n}`}>
                                  <SelectValue placeholder={`Select ${f.l}`}/>
                                </SelectTrigger>
                                <SelectContent style={{background:'var(--surface-2)', borderColor:'var(--stroke-soft)'}}>
                                  {(f.options||[]).map(o => (
                                    <SelectItem key={o} value={o} style={{color:'var(--app-fg)'}}>{o}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input value={formData[f.n] || ''}
                                onChange={e => setField(f.n, e.target.value)}
                                placeholder={f.ph || ''}
                                className="text-sm"
                                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:fieldBorder, transition:'border-color 0.3s'}}
                                data-testid={`block-field-${f.n}`}/>
                            )}
                          </FieldRow>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* ── Image Upload ──────────────────────────────────────────── */}
                <Separator style={{background:'var(--stroke-soft)'}}/>
                <BlockImageUpload
                  blockId={existingBlock?.id || pregenId}
                  imageUrl={formData.image_url || null}
                  onUploaded={(url) => setFormData(prev => ({...prev, image_url: url}))}
                  onRemove={() => setFormData(prev => ({...prev, image_url: ''}))}
                />
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-3 border-t gap-2" style={{borderColor:'var(--stroke-soft)'}}>
          <Button variant="outline" onClick={onClose}
            style={{borderColor:'var(--stroke-soft)', color:'var(--app-dim)'}}
            data-testid="block-form-cancel">Cancel</Button>
          <Button onClick={handleSave} disabled={!blockType}
            style={{background:'var(--cta,#e8a830)', color:'var(--brand-primary,#0a1628)'}}
            data-testid="block-form-save">
            {isEdit ? 'Save Changes' : 'Add Block'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Itinerary Builder ─────────────────────────────────────────────────────────
const ItineraryBuilder = ({ itinerary, onBack, onSaved }) => {
  const [local,    setLocal]    = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [isDirty,  setIsDirty]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [editBlock, setEditBlock] = useState(null);

  // ── Compass AI Auto-Build state ──────────────────────────────────────────
  const [aiOpen,       setAiOpen]       = useState(false);
  const [aiText,       setAiText]       = useState('');
  const [aiImage,      setAiImage]      = useState(null); // { b64, mime, name }
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    setLocal(JSON.parse(JSON.stringify(itinerary)));
    setIsDirty(false);
    setActiveDay(0);
  }, [itinerary.id]);

  const mutate = useCallback((updater) => {
    setLocal(prev => { const next = JSON.parse(JSON.stringify(prev)); updater(next); return next; });
    setIsDirty(true);
  }, []);

  // ── Compass AI Auto-Build handler ─────────────────────────────────────────
  const handleAIGenerate = useCallback(async () => {
    if (!aiText.trim() && !aiImage) {
      toast.error('Paste some text or upload an image first.');
      return;
    }
    setAiGenerating(true);
    try {
      const result = await aiGenerateItinerary({
        text_input:      aiText || null,
        image_b64:       aiImage?.b64 || null,
        image_mime_type: aiImage?.mime || null,
        existing_meta:   {
          client_name: local?.client_name || '',
          destination: local?.destination || '',
          start_date:  local?.start_date  || '',
          end_date:    local?.end_date    || '',
        },
      });
      if (result.success && result.itinerary) {
        const gen = result.itinerary;
        mutate(l => {
          if (gen.title)          l.title          = gen.title;
          if (gen.client_name)    l.client_name    = gen.client_name;
          if (gen.destination)    l.destination    = gen.destination;
          if (gen.start_date)     l.start_date     = gen.start_date;
          if (gen.end_date)       l.end_date       = gen.end_date;
          if (gen.pax_adults)     l.pax_adults     = gen.pax_adults;
          if (gen.pax_children != null) l.pax_children = gen.pax_children;
          if (gen.meal_preference) l.meal_preference = gen.meal_preference;
          if (gen.days?.length) {
            l.days = gen.days.map((d, i) => ({
              day_number: d.day_number ?? i + 1,
              date:       d.date       ?? '',
              day_label:  d.day_label  ?? `Day ${i + 1}`,
              blocks: (d.blocks || []).map(b => ({
                ...b,
                id: b.id || crypto.randomUUID(),
              })),
            }));
          }
        });
        setActiveDay(0);
        setAiOpen(false);
        setAiText('');
        setAiImage(null);
        toast.success('Itinerary built by Compass AI! Review and adjust.');
      } else {
        toast.error('AI could not generate the itinerary. Try more detailed input.');
      }
    } catch (e) {
      toast.error('Generation failed: ' + (e.message || 'Unknown error'));
    } finally {
      setAiGenerating(false);
    }
  }, [aiText, aiImage, local, mutate]);

  const handleAIImageUpload = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const full = e.target.result;
      const b64  = full.split(',')[1];
      setAiImage({ b64, mime: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  // Day operations
  const addDay = () => mutate(l => {
    const n = (l.days||[]).length + 1;
    l.days.push({ day_number: n, date: '', day_label: '', blocks: [] });
    setActiveDay(n - 1);
  });

  const removeDay = (idx) => {
    if ((local.days||[]).length <= 1) { toast.error('Cannot remove the only day'); return; }
    mutate(l => { l.days.splice(idx, 1); l.days.forEach((d,i) => { d.day_number = i+1; }); });
    setActiveDay(a => Math.max(0, a >= idx ? a - 1 : a));
  };

  const updateDayMeta = (idx, field, val) => mutate(l => { l.days[idx][field] = val; });

  // Block operations
  const openAdd  = ()    => { setEditBlock(null);  setShowBlock(true); };
  const openEdit = (blk) => { setEditBlock(blk);   setShowBlock(true); };

  const saveBlock = (block) => {
    mutate(l => {
      const day = l.days[activeDay];
      const existing = day.blocks.findIndex(b => b.id === block.id);
      if (existing >= 0) day.blocks[existing] = block;
      else { block.order = day.blocks.length; day.blocks.push(block); }
      day.blocks.sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
    });
  };

  const deleteBlock = (blockId) => {
    mutate(l => {
      l.days[activeDay].blocks = l.days[activeDay].blocks.filter(b => b.id !== blockId);
      l.days[activeDay].blocks.forEach((b,i) => { b.order = i; });
    });
    toast.success('Block removed');
  };

  const moveBlock = (blockId, dir) => {
    mutate(l => {
      const blocks = l.days[activeDay].blocks;
      const idx = blocks.findIndex(b => b.id === blockId);
      const target = idx + dir;
      if (target < 0 || target >= blocks.length) return;
      [blocks[idx], blocks[target]] = [blocks[target], blocks[idx]];
      blocks.forEach((b,i) => { b.order = i; });
    });
  };

  // ── PDF Export (BDV Format v3 — reference-matched layout) ──────────────────
  const generatePDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');

      // ── Page constants ────────────────────────────────────────────────────────
      const PW = 210, PH = 297, ML = 14, MR = 14;
      const CW = PW - ML - MR; // 182 mm

      // ── BDV Colour palette (matches reference PDF) ────────────────────────────
      const NAVY   = [12, 28, 65];        // deep navy background
      const NAVY2  = [22, 40, 85];        // slightly lighter navy (dot pattern)
      const GOLD   = [210, 162, 60];      // BDV gold accent
      const CREAM  = [255, 253, 235];     // warm white text on dark bg
      const CYAN   = [130, 190, 230];     // light blue accent / labels
      const LIGHT  = [245, 247, 252];     // very light bg for cards
      const MUTED  = [115, 138, 165];     // muted blue-grey labels
      const DARK   = [22, 38, 62];        // near-black navy for body text
      const DIVDR  = [210, 220, 235];     // thin divider lines

      // Block accent colours
      const BLOCK_COLORS = {
        DEPARTURE: [74, 163, 255], FLIGHT: [74, 163, 255], TRANSFER: [99, 179, 237],
        FERRY:     [74, 163, 255], WALK:   [99, 179, 237],
        HOTEL:     [210, 162,  60],
        EATERIES:  [218, 108,  70],
        EXCURSION: [42,  175, 105],
        MUST_TRY:  [148, 128, 255],
        INFO:      [148, 128, 255],
      };
      const BLOCK_LABELS = {
        DEPARTURE:'DEPARTURE', FLIGHT:'FLIGHT', TRANSFER:'TRANSFER',
        FERRY:'FERRY', WALK:'ROUTE', HOTEL:'HOTEL',
        EATERIES:'EATERIES', EXCURSION:'EXCURSION', MUST_TRY:'MUST TRY', INFO:'NOTE',
      };

      // ── Image pre-loader (CORS-safe via fetch → base64) ───────────────────────
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const imageCache = {};
      const imageDims  = {};

      const preload = async (relUrl) => {
        if (!relUrl || imageCache[relUrl] !== undefined) return;
        try {
          const res = await fetch(`${backendUrl}${relUrl}`);
          if (!res.ok) { imageCache[relUrl] = null; return; }
          const blob = await res.blob();
          const b64 = await new Promise(r => {
            const fr = new FileReader();
            fr.onloadend = () => r(fr.result);
            fr.readAsDataURL(blob);
          });
          await new Promise(r => {
            const img = new Image();
            img.onload  = () => { imageDims[relUrl] = { w: img.naturalWidth, h: img.naturalHeight }; r(); };
            img.onerror = () => { imageDims[relUrl] = { w: 16, h: 9 }; r(); };
            img.src = b64;
          });
          imageCache[relUrl] = b64;
        } catch { imageCache[relUrl] = null; }
      };

      // Pre-load all block images
      for (const day of (local.days || [])) {
        for (const blk of (day.blocks || [])) {
          if (blk.data?.image_url) await preload(blk.data.image_url);
        }
      }

      // ── jsPDF document ────────────────────────────────────────────────────────
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      let pageNum = 1;

      // ── Footer helper (gold bar, called on every content page) ────────────────
      const addPageFooter = () => {
        doc.setFillColor(...GOLD);
        doc.rect(0, PH - 10, PW, 10, 'F');
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('BLUE DIAMOND VOYAGE  ·  PREMIUM TRAVEL EXPERIENCE', ML, PH - 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${(local.title || 'Itinerary').substring(0, 40)}  ·  Page ${pageNum}`, PW - MR, PH - 4.5, { align: 'right' });
      };

      // ── Block detail extractors ───────────────────────────────────────────────
      const getBlockTitle = (block) => {
        const d = block.data || {};
        switch (block.block_type) {
          case 'DEPARTURE': return [d.from_city, d.carrier, d.flight_no].filter(Boolean).join(' · ') || 'Departure';
          case 'FLIGHT':    return ([d.airline, d.flight_no].filter(Boolean).join(' ') +
            (d.from_airport && d.to_airport ? `  ·  ${d.from_airport.split(/[-–]/)[0].trim()} → ${d.to_airport.split(/[-–]/)[0].trim()}` : '')) || 'Flight';
          case 'TRANSFER':  return [d.vehicle, d.from_location && d.to_location ? `${d.from_location} → ${d.to_location}` : null].filter(Boolean).join('  ·  ') || 'Transfer';
          case 'FERRY':     return [d.operator, d.from_terminal && d.to_terminal ? `${d.from_terminal} → ${d.to_terminal}` : null].filter(Boolean).join('  ·  ') || 'Ferry';
          case 'WALK':      return [d.route_type, d.from_location && d.to_location ? `${d.from_location} → ${d.to_location}` : null].filter(Boolean).join('  ·  ') || 'Route';
          case 'HOTEL':     return d.hotel_name || 'Hotel';
          case 'EATERIES':  return d.restaurant_name || 'Eateries';
          case 'EXCURSION': return d.name || 'Excursion';
          case 'MUST_TRY':  return d.title || 'Must Try';
          case 'INFO':      return d.title || 'Note';
          default:          return block.block_type;
        }
      };
      const getBlockDesc = (block) => {
        const d = block.data || {};
        return d.description || d.content || d.route_notes || '';
      };

      // ── PDF Link helpers ─────────────────────────────────────────────────────
      const pdfMapsUrl = (q) =>
        q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
      const pdfDirUrl  = (from, to, mode) => {
        if (!from || !to) return null;
        const gm = ({ Walking:'walking', Driving:'driving', Cycling:'bicycling', Transit:'transit' })[mode] || 'walking';
        return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=${gm}`;
      };
      const pdfTelUrl  = (ph) => ph ? `tel:${String(ph).replace(/\s+/g, '')}` : null;

      /** Returns array of {label, url} for clickable annotations at end of each block */
      const getBlockLinks = (block) => {
        const d = block.data || {};
        const L = [];
        switch (block.block_type) {
          case 'DEPARTURE':
            if (d.address)      L.push({ label: 'Airport on Maps',          url: pdfMapsUrl(d.address) });
            break;
          case 'HOTEL':
            if (d.address)      L.push({ label: 'Hotel on Maps',            url: pdfMapsUrl(d.address) });
            if (d.phone)        L.push({ label: `Call: ${d.phone}`,         url: pdfTelUrl(d.phone) });
            break;
          case 'TRANSFER':
            if (d.from_address) L.push({ label: 'Pick-up on Maps',          url: pdfMapsUrl(d.from_address) });
            if (d.to_address)   L.push({ label: 'Drop-off on Maps',         url: pdfMapsUrl(d.to_address) });
            if (d.driver_phone) L.push({ label: `Driver: ${d.driver_phone}`,url: pdfTelUrl(d.driver_phone) });
            break;
          case 'FERRY':
            if (d.phone)        L.push({ label: `Call: ${d.phone}`,         url: pdfTelUrl(d.phone) });
            break;
          case 'WALK':
            if (d.from_address && d.to_address)
              L.push({ label: 'Get Directions on Google Maps', url: pdfDirUrl(d.from_address, d.to_address, d.route_type) });
            else {
              if (d.from_address) L.push({ label: 'From on Maps',           url: pdfMapsUrl(d.from_address) });
              if (d.to_address)   L.push({ label: 'To on Maps',             url: pdfMapsUrl(d.to_address) });
            }
            break;
          case 'EXCURSION':
            if (d.address)      L.push({ label: 'Location on Maps',         url: pdfMapsUrl(d.address) });
            if (d.phone)        L.push({ label: `Call: ${d.phone}`,         url: pdfTelUrl(d.phone) });
            break;
          case 'EATERIES':
            if (d.address)      L.push({ label: 'Restaurant on Maps',       url: pdfMapsUrl(d.address) });
            if (d.phone)        L.push({ label: `Call: ${d.phone}`,         url: pdfTelUrl(d.phone) });
            break;
          case 'MUST_TRY':
            if (d.address)      L.push({ label: 'Location on Maps',         url: pdfMapsUrl(d.address) });
            break;
          default: break;
        }
        return L.filter(l => l.url);
      };

      const getBlockDetails = (block) => {
        const d = block.data || {};
        switch (block.block_type) {
          case 'DEPARTURE': return [
            ['From / Airport', d.from_city], ['Terminal', d.terminal],
            ['Report Time', d.report_time], ['Carrier', d.carrier], ['Address', d.address],
          ];
          case 'FLIGHT': return [
            ['Airline / Flight No.', [d.airline, d.flight_no].filter(Boolean).join('  ')],
            ['Route', [d.from_airport, d.to_airport].filter(Boolean).join(' → ')],
            ['Departure / Arrival', [d.dep_time && `${d.dep_time}${d.dep_date ? ' ' + d.dep_date : ''}`, d.arr_time && `${d.arr_time}${d.arr_date ? ' ' + d.arr_date : ''}`].filter(Boolean).join('  →  ')],
            ['Duration / Stopover', [d.duration, d.stopover].filter(Boolean).join('  |  ')],
            ['Class / Baggage', [d.flight_class, d.baggage].filter(Boolean).join('  ·  ')],
            ['PNR / Booking Ref', d.pnr], ['Meal Preference', d.meal_pref],
            ['Dep. Terminal', d.terminal_dep], ['Arr. Terminal', d.terminal_arr],
          ];
          case 'HOTEL': return [
            ['Hotel Name', [d.hotel_name, d.star_rating ? `${d.star_rating} Star` : null].filter(Boolean).join('  ')],
            ['Location', [d.city, d.address].filter(Boolean).join(' · ')],
            ['Check-in', [d.check_in_date, d.check_in_time].filter(Boolean).join('  ')],
            ['Check-out', [d.check_out_date, d.check_out_time].filter(Boolean).join('  ')],
            ['Nights / Rooms', [d.nights && `${d.nights} night${d.nights != 1 ? 's' : ''}`, d.no_of_rooms && `${d.no_of_rooms} room${d.no_of_rooms != 1 ? 's' : ''}`].filter(Boolean).join('  ·  ')],
            ['Room Type', d.room_type], ['Meal Plan', d.meal_plan],
            ['Inclusions', d.inclusions], ['Special Requests', d.special_requests],
            ['Confirmation No.', d.conf_no], ['Hotel Phone', d.phone],
            ['City Tax', d.city_tax], ['Deposit', d.deposit],
          ];
          case 'TRANSFER': return [
            ['Vehicle / Type', d.vehicle],
            ['Pick-up', d.from_location || d.from_address],
            ['Drop-off', d.to_location || d.to_address],
            ['Departure Time', d.dep_time], ['Duration', d.duration],
            ['Driver Name', d.driver_name], ['Driver Phone', d.driver_phone],
            ['Confirmation', d.conf_no],
          ];
          case 'FERRY': return [
            ['Operator', d.operator],
            ['From Terminal', d.from_terminal], ['To Terminal', d.to_terminal],
            ['Departure / Arrival', [d.dep_time, d.arr_time].filter(Boolean).join(' → ')],
            ['Duration', d.duration], ['Ticket Ref', d.ticket_ref], ['Phone', d.phone],
          ];
          case 'WALK': return [
            ['Route Type', d.route_type],
            ['From', d.from_location || d.from_address],
            ['To', d.to_location || d.to_address],
            ['Distance / Duration', [d.distance, d.duration].filter(Boolean).join('  ·  ')],
            ['Route Notes', d.route_notes],
          ];
          case 'EXCURSION': return [
            ['Attraction / Category', [d.name, d.category].filter(Boolean).join('  ·  ')],
            ['Location', d.location || d.address],
            ['Opening Hours', d.opening_hours], ['Duration', d.duration],
            ['Ticket Included', d.ticket_included], ['Ticket Ref', d.ticket_ref],
            ['Phone', d.phone],
          ];
          case 'EATERIES': return [
            ['Restaurant', d.restaurant_name], ['Cuisine', d.cuisine],
            ['Meal Type', d.meal_type], ['Address', d.address],
            ['Hours', d.opening_hours], ['Price Range', d.price_range],
            ['Phone', d.phone], ['Dietary Note', d.dietary_note],
            ['Reservation', d.reservation_advice],
          ];
          case 'MUST_TRY': return [
            ['Category', d.category], ['Location', d.location],
            ['Address', d.address], ['Price Range', d.price_range],
          ];
          case 'INFO': return [
            ['Severity', d.severity],
            ['Message', d.content],
          ];
          default: return [];
        }
      };

      // ═════════════════════════════════════════════════════════════════════════
      // COVER PAGE
      // ═════════════════════════════════════════════════════════════════════════

      // Full navy background
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, PW, PH, 'F');

      // Subtle dot pattern (simulates the cross/grid pattern in reference)
      doc.setFillColor(...NAVY2);
      for (let px = 6; px < PW - 4; px += 8) {
        for (let py = 6; py < PH - 14; py += 8) {
          doc.rect(px, py, 0.5, 0.5, 'F');
          doc.rect(px + 1.2, py, 0.5, 0.5, 'F');
          doc.rect(px, py + 1.2, 0.5, 0.5, 'F');
        }
      }

      // Gold top accent bar (full width)
      doc.setFillColor(...GOLD);
      doc.rect(0, 0, PW, 7, 'F');

      // ── Brand header ────────────────────────────────────────────────────────
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('BLUE DIAMOND VOYAGE', ML, 22);

      doc.setTextColor(...CYAN);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('PREMIUM TRAVEL EXPERIENCE  |  RAJKOT, GUJARAT, INDIA', ML, 29);

      // Gold separator line
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(ML, 33, PW - MR, 33);

      // ── Main client / trip name (large bold) ────────────────────────────────
      const coverName = local.client_name || local.title || 'Your Itinerary';
      doc.setTextColor(...CREAM);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      const coverNameLines = doc.splitTextToSize(coverName, CW);
      doc.text(coverNameLines, ML, 50);
      let afterCoverName = 50 + coverNameLines.length * 10;

      // Destination (light blue, smaller)
      if (local.destination) {
        doc.setTextColor(...CYAN);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.text(local.destination.toUpperCase(), ML, afterCoverName + 5);
        afterCoverName += 13;
      }

      // Trip title (if different from client name)
      if (local.title && local.client_name && local.title !== local.client_name) {
        doc.setTextColor(190, 210, 235);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(`"${local.title}"`, ML, afterCoverName + 2);
        afterCoverName += 10;
      }

      // ── Info boxes row (Departure | Return | Duration | Travellers) ──────────
      const totalDays   = (local.days || []).length;
      const totalBlocks = (local.days || []).reduce((s, d2) => s + (d2.blocks || []).length, 0);
      const hasPhotos   = (local.days || []).some(d2 => (d2.blocks || []).some(b => b.data?.image_url));

      const infoBoxData = [
        { label: 'DEPARTURE',  value: local.start_date || null },
        { label: 'RETURN',     value: local.end_date   || null },
        { label: 'DURATION',   value: totalDays > 0 ? `${totalDays} Day${totalDays !== 1 ? 's' : ''}` : null },
        { label: 'TRAVELLERS', value:
          [local.pax_adults   > 0 && `${local.pax_adults} Adult${local.pax_adults   !== 1 ? 's' : ''}`,
           local.pax_children > 0 && `${local.pax_children} Child${local.pax_children !== 1 ? 'ren' : ''}`
          ].filter(Boolean).join(' + ') || null },
      ].filter(b => b.value);

      if (infoBoxData.length > 0) {
        const boxY = Math.max(afterCoverName + 18, 135);
        const boxCount  = infoBoxData.length;
        const boxGap    = 3;
        const boxW      = (CW - boxGap * (boxCount - 1)) / boxCount;
        const boxH      = 22;

        infoBoxData.forEach((box, i) => {
          const bx = ML + i * (boxW + boxGap);
          // Outlined box (light blue border)
          doc.setDrawColor(...CYAN);
          doc.setLineWidth(0.4);
          doc.rect(bx, boxY, boxW, boxH);
          // Label (light blue, small caps)
          doc.setTextColor(...CYAN);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.text(box.label, bx + boxW / 2, boxY + 8, { align: 'center' });
          // Value (cream, bold)
          doc.setTextColor(...CREAM);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          const vl = doc.splitTextToSize(box.value, boxW - 4);
          doc.text(vl, bx + boxW / 2, boxY + 16, { align: 'center' });
        });

        // Meal preference (below boxes)
        const mpY = boxY + boxH + 8;
        if (local.meal_preference) {
          doc.setTextColor(...CYAN);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('MEAL PREFERENCE', ML, mpY);
          doc.setTextColor(...CREAM);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(local.meal_preference, ML + 42, mpY);
        }

        // What's included legend
        const lgY = Math.max(mpY + (local.meal_preference ? 10 : 2), boxY + boxH + 14);
        doc.setDrawColor(40, 60, 110);
        doc.setLineWidth(0.3);
        doc.line(ML, lgY, PW - MR, lgY);

        doc.setTextColor(...CYAN);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text("WHAT'S INCLUDED:", ML, lgY + 7);

        const lgItems = [
          { c: [74,163,255],  l: 'Flights & Transfers' },
          { c: [210,162, 60], l: 'Hotels' },
          { c: [218,108, 70], l: 'Dining' },
          { c: [42, 175,105], l: 'Excursions' },
          { c: [148,128,255], l: 'Tips & Notes' },
        ];
        let lgx = ML;
        lgItems.forEach((item) => {
          doc.setFillColor(...item.c);
          doc.rect(lgx, lgY + 10.5, 3, 3, 'F');
          doc.setTextColor(195, 213, 235);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.text(item.l, lgx + 4.5, lgY + 13.2);
          lgx += 37;
          if (lgx > PW - MR - 36) lgx = ML;
        });

        // Programme summary line
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(
          `${totalDays} Days  ·  ${totalBlocks} Activities${hasPhotos ? '  ·  Photos Included' : ''}`,
          ML, lgY + 22
        );
      }

      // Cover footer (gold)
      doc.setFillColor(...GOLD);
      doc.rect(0, PH - 11, PW, 11, 'F');
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(
        `Prepared on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        ML, PH - 5
      );
      doc.text('CONFIDENTIAL  ·  CLIENT TRAVEL DOCUMENT', PW - MR, PH - 5, { align: 'right' });

      // ═════════════════════════════════════════════════════════════════════════
      // PAGE 2 — FLIGHTS & ACCOMMODATION SUMMARY
      // ═════════════════════════════════════════════════════════════════════════
      {
        // Collect all flight and hotel blocks across all days
        const allFlights = [];
        const allHotels  = [];
        for (const day of (local.days || [])) {
          for (const blk of (day.blocks || [])) {
            if (blk.block_type === 'FLIGHT' || blk.block_type === 'DEPARTURE') {
              allFlights.push({ day, blk });
            }
            if (blk.block_type === 'HOTEL') {
              allHotels.push({ day, blk });
            }
          }
        }

        if (allFlights.length || allHotels.length) {
          doc.addPage();
          pageNum++;
          addPageFooter();

          // Section header bar
          doc.setFillColor(...NAVY);
          doc.rect(0, 0, PW, 18, 'F');
          doc.setFillColor(...GOLD);
          doc.rect(0, 0, PW, 1.5, 'F');
          doc.setFillColor(...GOLD);
          doc.rect(0, 0, 5, 18, 'F');
          doc.setTextColor(...GOLD);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text('FLIGHTS & ACCOMMODATION SUMMARY', ML + 4, 12);

          let sy = 24;

          // ── Flight schedule ─────────────────────────────────────────────
          if (allFlights.length) {
            // Section heading
            doc.setFillColor(...NAVY);
            doc.rect(ML, sy, CW, 7, 'F');
            doc.setTextColor(...CYAN);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('FLIGHT SCHEDULE', ML + 3, sy + 5);
            sy += 9;

            // Table header
            const fCols = [
              { label: 'DATE',     w: 24 },
              { label: 'FLIGHT',   w: 26 },
              { label: 'ROUTE',    w: 52 },
              { label: 'DEPARTS', w: 22 },
              { label: 'ARRIVES', w: 22 },
              { label: 'PNR / REF', w: 28 },
              { label: 'BAGGAGE',  w: 16 },
            ];
            let cx = ML;
            doc.setFillColor(22, 40, 85);
            doc.rect(ML, sy, CW, 6, 'F');
            fCols.forEach(col => {
              doc.setTextColor(...CYAN);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6);
              doc.text(col.label, cx + 1.5, sy + 4.2);
              cx += col.w;
            });
            sy += 7;

            // Table rows
            allFlights.forEach(({ blk }, ri) => {
              const d = blk.data || {};
              const rowData = [
                d.dep_date || '',
                [d.airline, d.flight_no].filter(Boolean).join(' '),
                [d.from_airport, d.to_airport].filter(Boolean).join(' → '),
                d.dep_time || '',
                d.arr_time || '',
                d.pnr || '',
                d.baggage || '',
              ];
              const rowH = 6.5;
              if (ri % 2 === 0) {
                doc.setFillColor(245, 247, 252);
                doc.rect(ML, sy, CW, rowH, 'F');
              }
              let rx = ML;
              fCols.forEach((col, ci) => {
                const txt = doc.splitTextToSize(rowData[ci] || '', col.w - 3);
                doc.setTextColor(...DARK);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.text(txt[0] || '', rx + 1.5, sy + 4.5);
                rx += col.w;
              });
              sy += rowH;
              if (sy > BODY_BOT - 30) { doc.addPage(); pageNum++; addPageFooter(); sy = 15; }
            });
            sy += 6;
          }

          // ── Accommodation list ──────────────────────────────────────────
          if (allHotels.length) {
            if (sy > BODY_BOT - 60) { doc.addPage(); pageNum++; addPageFooter(); sy = 15; }

            doc.setFillColor(...NAVY);
            doc.rect(ML, sy, CW, 7, 'F');
            doc.setTextColor(210, 162, 60);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('ACCOMMODATION', ML + 3, sy + 5);
            sy += 9;

            // Hotel table header
            const hCols = [
              { label: 'HOTEL',          w: 55 },
              { label: 'CITY',           w: 30 },
              { label: 'CHECK-IN',       w: 30 },
              { label: 'CHECK-OUT',      w: 30 },
              { label: 'ROOM / MEAL',    w: 24 },
              { label: 'CONF. NO.',      w: 18 },
            ];
            let hx = ML;
            doc.setFillColor(22, 40, 85);
            doc.rect(ML, sy, CW, 6, 'F');
            hCols.forEach(col => {
              doc.setTextColor(210, 162, 60);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6);
              doc.text(col.label, hx + 1.5, sy + 4.2);
              hx += col.w;
            });
            sy += 7;

            allHotels.forEach(({ blk }, ri) => {
              const d = blk.data || {};
              const rowData = [
                d.hotel_name || '',
                d.city || '',
                [d.check_in_date, d.check_in_time].filter(Boolean).join(' · '),
                [d.check_out_date, d.check_out_time].filter(Boolean).join(' · '),
                [d.room_type, d.meal_plan].filter(Boolean).join(' / '),
                d.conf_no || '',
              ];
              const rowH = 7;
              if (ri % 2 === 0) {
                doc.setFillColor(245, 247, 252);
                doc.rect(ML, sy, CW, rowH, 'F');
              }
              let rx = ML;
              hCols.forEach((col, ci) => {
                const txt = doc.splitTextToSize(rowData[ci] || '', col.w - 3);
                doc.setTextColor(...DARK);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.text(txt[0] || '', rx + 1.5, sy + 4.8);
                rx += col.w;
              });
              sy += rowH;
              if (sy > BODY_BOT - 20) { doc.addPage(); pageNum++; addPageFooter(); sy = 15; }
            });
          }
        }
      }

      // ═════════════════════════════════════════════════════════════════════════
      // DAY PAGES
      // ═════════════════════════════════════════════════════════════════════════
      const BODY_BOT = PH - 13;
      const HDR_H    = 26;

      (local.days || []).forEach((day) => {
        // ── Day header page ──────────────────────────────────────────────────
        doc.addPage();
        pageNum++;

        // Navy header band
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, PW, HDR_H, 'F');
        // Gold left stripe
        doc.setFillColor(...GOLD);
        doc.rect(0, 0, 5, HDR_H, 'F');
        // Gold thin top rule
        doc.setFillColor(...GOLD);
        doc.rect(0, 0, PW, 1.2, 'F');

        // DAY N — pull out day name + city from day_label
        const dayNum = String(day.day_number).padStart(2, '0');
        // Parse date to get weekday
        let weekday = '';
        if (day.date) {
          try {
            const parts = day.date.split(' ');
            // Try "17 June 2026" format
            const dateObj = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
            if (!isNaN(dateObj)) {
              weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
            }
          } catch (_) {}
        }
        // City/theme from day_label (strip "Day N - " prefix)
        const dayTheme = (day.day_label || '')
          .replace(/^day\s*\d+\s*[-–:·]?\s*/i, '')
          .trim()
          .toUpperCase();

        // "DAY 01" in gold, large
        doc.setTextColor(...GOLD);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text(`DAY ${dayNum}`, ML + 4, 16);
        const dayNumW = doc.getTextWidth(`DAY ${dayNum}`);

        // Separator dot
        doc.setTextColor(100, 130, 175);
        doc.setFontSize(14);
        doc.text('·', ML + 4 + dayNumW + 3, 16);
        const dotW = doc.getTextWidth('·');

        // Weekday in CYAN
        if (weekday) {
          doc.setTextColor(...CYAN);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(weekday, ML + 4 + dayNumW + 3 + dotW + 3, 16);
        }

        // Theme / city (second line)
        const subtitleParts = [day.date, dayTheme].filter(Boolean).join('   ·   ');
        if (subtitleParts) {
          doc.setTextColor(175, 200, 230);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(subtitleParts, ML + 4, 23);
        }

        // Page footer
        addPageFooter();

        // Light separator line below header
        doc.setFillColor(225, 232, 245);
        doc.rect(0, HDR_H, PW, 1.5, 'F');

        let y = HDR_H + 6;

        if (!(day.blocks || []).length) {
          doc.setTextColor(...MUTED);
          doc.setFontSize(9);
          doc.text('No activities scheduled for this day.', ML + 5, y + 8);
          return;
        }

        // ── Blocks ────────────────────────────────────────────────────────
        (day.blocks || []).forEach((block) => {
          const clr     = BLOCK_COLORS[block.block_type] || [120, 140, 165];
          const lbl     = BLOCK_LABELS[block.block_type] || block.block_type;
          const title   = getBlockTitle(block);
          const desc    = getBlockDesc(block);
          const details = getBlockDetails(block).filter(([, v]) => v);
          const notes   = block.data?.notes || '';
          const imgKey  = block.data?.image_url;
          const imgB64  = imgKey ? imageCache[imgKey] : null;
          const dims    = imgKey ? imageDims[imgKey] : null;

          // Estimate total block height (for page-break logic)
          let estH = 12; // type-bar row
          if (imgB64) estH += Math.min(52, dims ? (dims.h / dims.w) * CW : 46) + 3;
          const _tl = doc.splitTextToSize(title, CW - 10);
          estH += _tl.length * 5.5 + 3;
          estH += details.length * 5;
          if (desc)  estH += Math.ceil(desc.length / 65) * 4.5 + 4;
          if (notes) estH += Math.ceil(notes.length / 65) * 4.2 + 7;
          const _blinks = getBlockLinks(block);
          if (_blinks.length > 0) estH += _blinks.length * 5.5 + 6;
          estH += 8; // separator gap

          // Page break if not enough room
          if (y + estH > BODY_BOT) {
            doc.addPage();
            pageNum++;
            // Continuation mini header
            doc.setFillColor(...NAVY);
            doc.rect(0, 0, PW, 14, 'F');
            doc.setFillColor(...GOLD);
            doc.rect(0, 0, 5, 14, 'F');
            doc.setFillColor(...GOLD);
            doc.rect(0, 0, PW, 1.2, 'F');
            doc.setTextColor(...GOLD);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`DAY ${day.day_number}  (continued)`, ML + 2, 10);
            doc.setFillColor(225, 232, 245);
            doc.rect(0, 14, PW, 1.5, 'F');
            addPageFooter();
            y = 20;
          }

          // ── Block photo ──────────────────────────────────────────────────
          if (imgB64) {
            const maxH = 52;
            const imgW = CW;
            const ar   = dims ? dims.h / dims.w : 9 / 16;
            const imgH = Math.min(imgW * ar, maxH);
            try {
              doc.addImage(imgB64, 'JPEG', ML, y, imgW, imgH, undefined, 'FAST');
            } catch (e) {
              console.warn('[ItineraryDesigner] JPEG image failed, trying PNG fallback:', e);
              try { doc.addImage(imgB64, 'PNG', ML, y, imgW, imgH, undefined, 'FAST'); } catch (e2) { console.warn('[ItineraryDesigner] PNG fallback also failed, skipping image:', e2); }
            }
            y += imgH + 3;
          }

          // ── Type bar (coloured left stripe + badge text) ─────────────────
          doc.setFillColor(...clr);
          doc.rect(ML, y, 4, 10, 'F');

          // Badge label
          doc.setTextColor(...clr);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text(lbl, ML + 6, y + 6.5);

          // Time (if present)
          const lblPxW = lbl.length * 1.65 + 3;
          if (block.time) {
            doc.setTextColor(...MUTED);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(block.time, ML + 6 + lblPxW, y + 6.5);
          }

          // Status badge (right-aligned)
          if (block.status) {
            const sc = ({
              booked:    [42, 175, 105],
              included:  [42, 175, 105],
              optional:  [210, 162, 60],
              suggested: [120, 140, 165],
            })[block.status.toLowerCase()] || [120, 140, 165];
            doc.setTextColor(...sc);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text(block.status.toUpperCase(), PW - MR, y + 6.5, { align: 'right' });
          }
          y += 12;

          // ── Block title ─────────────────────────────────────────────────
          doc.setTextColor(...DARK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          const tLines = doc.splitTextToSize(title, CW - 10);
          doc.text(tLines, ML + 6, y);
          y += tLines.length * 5.5 + 2;

          // ── Detail rows ─────────────────────────────────────────────────
          if (details.length > 0) {
            const LW = 36, VW = CW - LW - 12;
            details.forEach(([lbl2, val]) => {
              if (!val) return;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(...MUTED);
              doc.text(String(lbl2), ML + 6, y);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(...DARK);
              const vl = doc.splitTextToSize(String(val), VW);
              doc.text(vl, ML + 6 + LW, y);
              y += Math.max(5, vl.length * 4.5);
            });
            y += 1;
          }

          // ── Description ─────────────────────────────────────────────────
          if (desc) {
            doc.setTextColor(...MUTED);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            const dLines = doc.splitTextToSize(desc, CW - 10);
            doc.text(dLines, ML + 6, y);
            y += dLines.length * 4.2 + 3;
          }

          // ── Notes (light info box with blue left accent) ─────────────────
          if (notes) {
            const noteLines = doc.splitTextToSize(`Note: ${notes}`, CW - 16);
            const noteH     = noteLines.length * 4.2 + 7;
            // Light box fill
            doc.setFillColor(235, 241, 252);
            doc.rect(ML + 4, y, CW - 4, noteH, 'F');
            // Blue left accent
            doc.setFillColor(...CYAN);
            doc.rect(ML + 4, y, 2.5, noteH, 'F');
            // Note text
            doc.setTextColor(45, 75, 130);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.text(noteLines, ML + 9, y + 4);
            y += noteH + 3;
          }

          // ── Clickable Links (Maps / Phone / Directions) ──────────────────
          const blockLinks = getBlockLinks(block);
          if (blockLinks.length > 0) {
            y += 2;
            const LINK_CLR = [74, 163, 255];
            blockLinks.forEach(({ label, url }) => {
              // Arrow prefix
              const fullLabel = '\u2192  ' + label;
              doc.setTextColor(...LINK_CLR);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7.5);
              const tw = doc.getTextWidth(fullLabel);
              // Render the text with an invisible link annotation on top
              doc.text(fullLabel, ML + 6, y);
              doc.link(ML + 6, y - 3.5, Math.min(tw, CW - 8), 5, { url });
              // Manual underline (blue, thin)
              doc.setDrawColor(...LINK_CLR);
              doc.setLineWidth(0.15);
              doc.line(ML + 6, y + 0.9, ML + 6 + tw, y + 0.9);
              y += 5.5;
            });
            y += 1;
          }

          // ── Divider ──────────────────────────────────────────────────────
          doc.setDrawColor(...DIVDR);
          doc.setLineWidth(0.2);
          doc.line(ML + 6, y + 1, PW - MR, y + 1);
          y += 7;
        });
      });

      // ═════════════════════════════════════════════════════════════════════════
      // TRIP AT A GLANCE (summary page)
      // ═════════════════════════════════════════════════════════════════════════
      doc.addPage();
      pageNum++;

      // Header band
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, PW, 24, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 0, 5, 24, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 0, PW, 1.2, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('TRIP AT A GLANCE', ML + 2, 15.5);
      addPageFooter();
      doc.setFillColor(225, 232, 245);
      doc.rect(0, 24, PW, 1.5, 'F');

      let sy = 32;

      (local.days || []).forEach((day) => {
        if (sy > BODY_BOT - 5) {
          doc.addPage();
          pageNum++;
          doc.setFillColor(...NAVY);
          doc.rect(0, 0, PW, 14, 'F');
          doc.setFillColor(...GOLD);
          doc.rect(0, 0, 5, 14, 'F');
          doc.setTextColor(...GOLD);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('TRIP AT A GLANCE (cont.)', ML + 2, 9.5);
          addPageFooter();
          sy = 20;
        }

        // Day row
        doc.setFillColor(235, 240, 252);
        doc.rect(ML, sy, CW, 8.5, 'F');
        doc.setFillColor(...GOLD);
        doc.rect(ML, sy, 4, 8.5, 'F');
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`Day ${day.day_number}`, ML + 6, sy + 5.8);
        if (day.date || day.day_label) {
          doc.setTextColor(...MUTED);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text([day.date, day.day_label].filter(Boolean).join('  ·  '), ML + 22, sy + 5.8);
        }
        sy += 10;

        (day.blocks || []).forEach((block) => {
          if (sy > BODY_BOT - 5) {
            doc.addPage();
            pageNum++;
            addPageFooter();
            sy = 10;
          }
          const clr = BLOCK_COLORS[block.block_type] || [120, 140, 165];
          // Colour dot
          doc.setFillColor(...clr);
          doc.rect(ML + 6, sy + 2, 3, 3.5, 'F');
          // Title
          doc.setTextColor(...DARK);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          const sl = doc.splitTextToSize(getBlockTitle(block), CW - 18);
          doc.text(sl, ML + 11, sy + 5);
          // Time
          if (block.time) {
            doc.setTextColor(...MUTED);
            doc.setFontSize(6.5);
            doc.text(block.time, PW - MR, sy + 5, { align: 'right' });
          }
          sy += sl.length * 4.5 + 2.5;
        });
        sy += 4;
      });

      // ─── CLOSING PAGE — Blue Diamond Voyage company info ──────────────────
      doc.addPage();
      pageNum++;

      // Full navy background
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, PW, PH, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 0, PW, 1.5, 'F');

      // Diamond logo placeholder area
      doc.setFillColor(22, 40, 85);
      doc.roundedRect(PW / 2 - 28, 40, 56, 56, 5, 5, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('\u25C6', PW / 2, 73, { align: 'center' });

      // Company name
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('BLUE DIAMOND VOYAGE', PW / 2, 110, { align: 'center' });

      doc.setTextColor(...CYAN);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('CRAFTING EXTRAORDINARY JOURNEYS SINCE 1999', PW / 2, 120, { align: 'center' });

      // Separator
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.line(PW / 2 - 40, 126, PW / 2 + 40, 126);

      // Contact info
      const cInfo = [
        'Rajkot, Gujarat, India',
        'bluediamondvoyage@gmail.com',
        'www.bluediamondvoyage.com',
      ];
      doc.setTextColor(175, 200, 230);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      cInfo.forEach((line, i) => {
        doc.text(line, PW / 2, 134 + i * 8, { align: 'center' });
      });

      // "Thank you" message
      doc.setTextColor(195, 213, 235);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const thankMsg = `Thank you for choosing Blue Diamond Voyage, ${local.client_name || 'our valued guest'}.`;
      doc.text(thankMsg, PW / 2, 168, { align: 'center' });
      doc.setFontSize(7.5);
      doc.text('We look forward to curating an unforgettable journey for you.', PW / 2, 178, { align: 'center' });

      // Document ref bar
      doc.setFillColor(22, 40, 85);
      doc.rect(0, PH - 20, PW, 20, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, PH - 20, PW, 1, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(
        `Document generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  CONFIDENTIAL`,
        PW / 2, PH - 8,
        { align: 'center' }
      );

      // ── Save ─────────────────────────────────────────────────────────────────
      const fname = `${(local.title || 'Itinerary').replace(/[^a-zA-Z0-9 _-]/g, '').trim()}_BDV.pdf`;
      doc.save(fname);
      toast.success(`PDF exported — ${pageNum} pages`);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('PDF export failed — check console for details');
    }
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: local.title, client_id: local.client_id, client_name: local.client_name,
        enquiry_id: local.enquiry_id, destination: local.destination,
        start_date: local.start_date, end_date: local.end_date,
        pax_adults: local.pax_adults || 2, pax_children: local.pax_children || 0,
        meal_preference: local.meal_preference, status: local.status || 'draft',
        days: local.days || [],
      };
      const res = await itineraryAPI.update(local.id, payload);
      setLocal(res.data);
      setIsDirty(false);
      onSaved && onSaved(res.data);
      toast.success('Itinerary saved');
    } catch (err) {
      toast.error('Failed to save itinerary');
    } finally {
      setSaving(false);
    }
  };

  if (!local) return null;

  const days    = local.days || [];
  const curDay  = days[activeDay] || { blocks:[] };
  const blocks  = curDay.blocks || [];

  return (
    <div className="flex flex-col h-full" data-testid="itinerary-builder">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{background:'var(--surface)', borderColor:'var(--stroke-soft)'}}>
        <button onClick={onBack} className="p-1.5 rounded hover:bg-white/5 transition-colors duration-150"
          style={{color:'var(--app-muted)'}} data-testid="builder-back-btn">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold truncate" style={{fontFamily:'Georgia,serif', color:'var(--app-fg)'}}>{local.title}</h2>
          <p className="text-xs" style={{color:'var(--app-muted)'}}>
            {[local.client_name, local.destination, local.start_date && local.end_date && `${local.start_date} → ${local.end_date}`].filter(Boolean).join(' · ')}
            {local.pax_adults > 0 && ` · ${local.pax_adults}A${local.pax_children ? `+${local.pax_children}C` : ''}`}
          </p>
        </div>

        {/* Status badge */}
        <Select value={local.status||'draft'}
          onValueChange={v => mutate(l => { l.status = v; })}>
          <SelectTrigger className="w-28 h-8 text-xs" style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}} data-testid="itinerary-status-select">
            <SelectValue/>
          </SelectTrigger>
          <SelectContent style={{background:'var(--surface-2)', borderColor:'var(--stroke-soft)'}}>
            {['draft','final','shared'].map(s => <SelectItem key={s} value={s} style={{color:'var(--app-fg)'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button onClick={generatePDF} variant="outline" size="sm"
          className="h-8 gap-1.5"
          style={{borderColor:'var(--stroke-soft)', color:'var(--app-muted)'}}
          data-testid="builder-export-pdf-btn">
          <FileDown size={13}/> PDF
        </Button>

        <Button onClick={() => setAiOpen(true)} variant="outline" size="sm"
          className="h-8 gap-1.5"
          style={{
            borderColor: 'rgba(148,128,255,0.45)',
            color:       '#9480FF',
            background:  'rgba(148,128,255,0.08)',
          }}
          data-testid="builder-ai-build-btn"
          title="Auto-build from text or image">
          <Sparkles size={13}/> AI Build
        </Button>

        <Button onClick={handleSave} disabled={!isDirty || saving} size="sm"
          className="h-8 gap-1.5 transition-all duration-150"
          style={{background: isDirty ? 'var(--cta,#e8a830)' : 'var(--surface)', color: isDirty ? 'var(--brand-primary,#0a1628)' : 'var(--app-muted)', borderColor:'var(--stroke-soft)'}}
          data-testid="builder-save-btn">
          {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
          {isDirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {/* Day tabs row */}
      <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto flex-shrink-0"
        style={{background:'var(--surface)', borderColor:'var(--stroke-soft)'}}>
        {days.map((day, idx) => (
          <button key={day.day_number ?? `day-${idx}`} onClick={() => setActiveDay(idx)}
            className="flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg border text-xs transition-all duration-150 min-w-[72px]"
            style={{
              background: activeDay===idx ? 'rgba(232,168,48,0.15)' : 'var(--surface-2,#172040)',
              borderColor: activeDay===idx ? T_GOLD : 'var(--stroke-soft)',
              color: activeDay===idx ? T_GOLD : 'var(--app-dim)',
            }}
            data-testid={`day-tab-${idx}`}>
            <span className="font-bold">Day {day.day_number}</span>
            {day.date && <span className="text-[9px] opacity-70 truncate max-w-[64px]">{day.date}</span>}
            {(day.blocks||[]).length > 0 && (
              <span className="text-[9px] px-1 rounded-full mt-0.5" style={{background:`${T_GOLD}22`, color:T_GOLD}}>
                {(day.blocks||[]).length} block{(day.blocks||[]).length!==1?'s':''}
              </span>
            )}
          </button>
        ))}
        <button onClick={addDay}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors duration-150 hover:bg-white/5"
          style={{borderColor:'var(--stroke-soft)', color:'var(--app-muted)', borderStyle:'dashed'}}
          data-testid="add-day-btn">
          <Plus size={12}/> Day
        </button>
      </div>

      {/* Day content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Day metadata */}
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl border" style={{background:'var(--surface)', borderColor:'var(--stroke-soft)'}}>
            <div>
              <Label className="text-xs mb-1 block" style={{color:'var(--app-muted)'}}>Date</Label>
              <Input value={curDay.date||''} placeholder="e.g., 17 June 2026"
                onChange={e => updateDayMeta(activeDay,'date',e.target.value)}
                className="h-8 text-xs" style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="day-date-input"/>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{color:'var(--app-muted)'}}>Day Theme / Title</Label>
              <Input value={curDay.day_label||''} placeholder="e.g., Touchdown in Bavaria!"
                onChange={e => updateDayMeta(activeDay,'day_label',e.target.value)}
                className="h-8 text-xs" style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="day-label-input"/>
            </div>
            {days.length > 1 && (
              <div className="col-span-2 flex justify-end">
                <button onClick={() => removeDay(activeDay)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors duration-150"
                  data-testid={`remove-day-${activeDay}`}>
                  <Trash2 size={11}/> Remove Day {curDay.day_number}
                </button>
              </div>
            )}
          </div>

          {/* Day theme headline */}
          {curDay.day_label && (
            <div className="mb-3 px-1">
              <p className="text-xs font-semibold tracking-wide uppercase" style={{color:T_GOLD}}>
                Day {curDay.day_number} — {curDay.date && `${curDay.date} · `}{curDay.day_label}
              </p>
            </div>
          )}

          {/* Timeline blocks */}
          {blocks.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed" style={{borderColor:'var(--stroke-soft)'}}>
              <BookOpen size={32} className="mx-auto mb-3" style={{color:'var(--app-muted)'}}/>
              <p className="text-sm font-semibold" style={{color:'var(--app-dim)'}}>No blocks yet for Day {curDay.day_number}</p>
              <p className="text-xs mt-1 mb-4" style={{color:'var(--app-muted)'}}>Start building by adding your first block</p>
              <Button onClick={openAdd} size="sm" className="gap-1.5"
                style={{background:'var(--cta,#e8a830)', color:'var(--brand-primary,#0a1628)'}}
                data-testid="add-first-block-btn">
                <Plus size={14}/> Add First Block
              </Button>
            </div>
          ) : (
            <div>
              {blocks.map((blk, idx) => (
                <BlockCard key={blk.id} block={blk}
                  isFirst={idx===0} isLast={idx===blocks.length-1}
                  onEdit={()  => openEdit(blk)}
                  onDelete={() => deleteBlock(blk.id)}
                  onMoveUp={()   => moveBlock(blk.id, -1)}
                  onMoveDown={()  => moveBlock(blk.id,  1)}/>
              ))}
              {/* End dot */}
              <div className="flex gap-3 items-center">
                <div className="w-8 flex justify-center">
                  <div className="w-2 h-2 rounded-full" style={{background:'var(--stroke-soft)'}}/>
                </div>
                <p className="text-xs" style={{color:'var(--app-muted)'}}>End of Day {curDay.day_number}</p>
              </div>
            </div>
          )}

          {/* Add block button */}
          {blocks.length > 0 && (
            <div className="flex gap-3 mt-3">
              <div className="w-8"/>
              <Button variant="outline" onClick={openAdd} size="sm"
                className="gap-1.5 transition-all duration-150 hover:border-[#e8a830] hover:text-[#e8a830]"
                style={{borderColor:'var(--stroke-soft)', color:'var(--app-muted)', borderStyle:'dashed'}}
                data-testid="add-block-btn">
                <Plus size={14}/> Add Block to Day {curDay.day_number}
              </Button>
            </div>
          )}

          <div className="h-8"/>
        </div>
      </ScrollArea>

      {/* Block form modal */}
      <BlockFormModal
        open={showBlock} onClose={() => setShowBlock(false)}
        onSave={saveBlock} existingBlock={editBlock}/>

      {/* ── Compass AI Auto-Build drawer ───────────────────────────────── */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-stretch justify-end"
          data-testid="ai-build-drawer-overlay"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => !aiGenerating && setAiOpen(false)}
          />
          {/* Drawer */}
          <div
            className="relative z-10 flex flex-col w-full max-w-lg shadow-2xl overflow-hidden"
            style={{
              background:   '#0b1628',
              borderLeft:   '1px solid rgba(148,128,255,0.30)',
            }}
            data-testid="ai-build-drawer"
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(148,128,255,0.20)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(148,128,255,0.18)', border: '1px solid rgba(148,128,255,0.35)' }}>
                <Sparkles size={16} style={{ color: '#9480FF' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--app-fg)', fontFamily: 'Georgia,serif' }}>
                  Compass AI — Auto-Build Itinerary
                </h3>
                <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
                  Paste text or upload a screenshot · AI extracts and builds the full itinerary
                </p>
              </div>
              <button
                onClick={() => !aiGenerating && setAiOpen(false)}
                className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--app-muted)' }}
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* ① Text input */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Type size={13} style={{ color: '#9480FF' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--app-dim)' }}>
                    Paste raw text
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>
                    (WhatsApp, email, quote, any itinerary text)
                  </span>
                </div>
                <textarea
                  value={aiText}
                  onChange={e => setAiText(e.target.value)}
                  placeholder={`Paste any itinerary text here — eg:\n"Day 1 — Bangkok arrival. Check into Novotel Sukhumvit. Evening: Khao San Road walk.\nDay 2 — Morning flight to Chiang Mai at 07:30 (FD3116)..."`}
                  rows={9}
                  className="w-full rounded-xl text-xs leading-relaxed resize-none"
                  style={{
                    background:  'rgba(148,128,255,0.06)',
                    border:      '1px solid rgba(148,128,255,0.22)',
                    color:       'var(--app-dim)',
                    padding:     '12px',
                    outline:     'none',
                    fontFamily:  'ui-monospace, monospace',
                  }}
                  data-testid="ai-text-input"
                />
              </div>

              {/* ② Image upload */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ImagePlus size={13} style={{ color: '#9480FF' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--app-dim)' }}>
                    Or upload an image / screenshot
                  </span>
                </div>
                <label
                  className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all"
                  style={{
                    border:     '1.5px dashed rgba(148,128,255,0.35)',
                    background: aiImage ? 'rgba(148,128,255,0.08)' : 'rgba(148,128,255,0.04)',
                    padding:    '16px',
                    minHeight:  80,
                  }}
                  data-testid="ai-image-upload-area"
                >
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => handleAIImageUpload(e.target.files?.[0])}
                  />
                  {aiImage ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#9480FF' }}>
                      <CheckCircle2 size={14} />
                      <span>{aiImage.name}</span>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setAiImage(null); }}
                        className="ml-1 text-xs hover:opacity-70"
                        style={{ color: 'var(--app-muted)' }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-xs" style={{ color: 'var(--app-muted)' }}>
                      <Upload size={18} style={{ color: 'rgba(148,128,255,0.6)' }} />
                      <span>Click to upload · JPG, PNG, PDF, screenshot</span>
                    </div>
                  )}
                </label>
              </div>

              {/* How it works */}
              <div
                className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{
                  background: 'rgba(74,163,255,0.06)',
                  border:     '1px solid rgba(74,163,255,0.15)',
                  color:      'var(--app-muted)',
                }}
              >
                <span className="font-semibold" style={{ color: '#4AA3FF' }}>How it works: </span>
                Compass AI reads your input, extracts destinations, dates, day-wise activities, hotels, flights, and transfers — then builds a fully editable itinerary in the Designer. You can then refine each block manually.
              </div>
            </div>

            {/* Footer CTA */}
            <div
              className="flex-shrink-0 px-5 py-4 flex gap-2"
              style={{ borderTop: '1px solid rgba(148,128,255,0.20)' }}
            >
              <button
                onClick={() => setAiOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                style={{
                  background: 'rgba(143,179,199,0.07)',
                  border:     '1px solid var(--stroke-soft)',
                  color:      'var(--app-muted)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={aiGenerating || (!aiText.trim() && !aiImage)}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: aiGenerating ? 'rgba(148,128,255,0.25)' : 'rgba(148,128,255,0.20)',
                  border:     '1px solid rgba(148,128,255,0.45)',
                  color:      '#9480FF',
                  opacity:    (!aiText.trim() && !aiImage) ? 0.5 : 1,
                  cursor:     (!aiText.trim() && !aiImage) ? 'not-allowed' : 'pointer',
                }}
                data-testid="ai-generate-btn"
              >
                {aiGenerating
                  ? <><Loader2 size={14} className="animate-spin" /> Compass AI is building…</>
                  : <><Sparkles size={14} /> Generate Full Itinerary</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── New Itinerary Dialog ──────────────────────────────────────────────────────
const NewItineraryDialog = ({ open, onClose, onCreate, prefill }) => {
  const defaultForm = { title:'', destination:'', start_date:'', end_date:'', pax_adults:2, pax_children:0, meal_preference:'', client_id:'', client_name:'', enquiry_id:'' };
  const [form,    setForm]    = useState(defaultForm);
  const [clients, setClients] = useState([]);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (open) {
      const prefilledForm = {
        ...defaultForm,
        ...(prefill?.client_id  ? { client_id: prefill.client_id,  client_name: prefill.client_name || '' } : {}),
        ...(prefill?.enquiry_id ? { enquiry_id: prefill.enquiry_id, destination: prefill.destination || '' }  : {}),
      };
      setForm(prefilledForm);
      clientsAPI.list().then(r => setClients(r.data||[])).catch(()=>{});
    }
  }, [open, prefill]);

  const set = (k,v) => setForm(p => ({...p, [k]:v}));

  const handleClientSelect = (id) => {
    const c = clients.find(c=>c.id===id);
    set('client_id', id);
    set('client_name', c?.full_name || '');
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        pax_adults:   parseInt(form.pax_adults)||2,
        pax_children: parseInt(form.pax_children)||0,
        enquiry_id:   form.enquiry_id || '',
        status: 'draft',
        days: [{ day_number:1, date:'', day_label:'', blocks:[] }],
      };
      const res = await itineraryAPI.create(payload);
      onCreate(res.data);
      onClose();
    } catch {
      toast.error('Failed to create itinerary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border"
        style={{background:'var(--qb-modal,#14203b)', borderColor:'var(--stroke-soft)'}}
        data-testid="new-itinerary-dialog">
        <DialogHeader className="pb-3 border-b" style={{borderColor:'var(--stroke-soft)'}}>
          <DialogTitle style={{fontFamily:'Georgia,serif', color:'var(--app-fg)'}}>New Itinerary</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Linked client */}
          <FieldRow label="Linked Client (optional)">
            <Select value={form.client_id||''} onValueChange={handleClientSelect}>
              <SelectTrigger style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}} data-testid="new-itin-client-select">
                <SelectValue placeholder="Select a client..."/>
              </SelectTrigger>
              <SelectContent style={{background:'var(--surface-2)', borderColor:'var(--stroke-soft)'}}>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} style={{color:'var(--app-fg)'}}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Title */}
          <FieldRow label="Itinerary Title *">
            <Input value={form.title} onChange={e=>set('title',e.target.value)}
              placeholder="e.g., Chintan & Ankita — Alps Dream Trip 2026"
              style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
              data-testid="new-itin-title"/>
          </FieldRow>

          {/* Destination */}
          <FieldRow label="Destination">
            <Input value={form.destination} onChange={e=>set('destination',e.target.value)}
              placeholder="e.g., Bavaria, Tyrol, Salzburg"
              style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
              data-testid="new-itin-destination"/>
          </FieldRow>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Start Date">
              <Input value={form.start_date} onChange={e=>set('start_date',e.target.value)}
                placeholder="e.g., 17 June 2026"
                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="new-itin-start-date"/>
            </FieldRow>
            <FieldRow label="End Date">
              <Input value={form.end_date} onChange={e=>set('end_date',e.target.value)}
                placeholder="e.g., 28 June 2026"
                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="new-itin-end-date"/>
            </FieldRow>
          </div>

          {/* PAX */}
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Adults">
              <Input type="number" min="1" value={form.pax_adults} onChange={e=>set('pax_adults',e.target.value)}
                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="new-itin-adults"/>
            </FieldRow>
            <FieldRow label="Children">
              <Input type="number" min="0" value={form.pax_children} onChange={e=>set('pax_children',e.target.value)}
                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="new-itin-children"/>
            </FieldRow>
            <FieldRow label="Meal Pref.">
              <Input value={form.meal_preference} onChange={e=>set('meal_preference',e.target.value)}
                placeholder="e.g., Veg"
                style={{background:'var(--qb-field,#0f1a33)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
                data-testid="new-itin-meal"/>
            </FieldRow>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t gap-2" style={{borderColor:'var(--stroke-soft)'}}>
          <Button variant="outline" onClick={onClose}
            style={{borderColor:'var(--stroke-soft)', color:'var(--app-dim)'}}
            data-testid="new-itin-cancel">Cancel</Button>
          <Button onClick={handleCreate} disabled={saving||!form.title.trim()}
            style={{background:'var(--cta,#e8a830)', color:'var(--brand-primary,#0a1628)'}}
            data-testid="new-itin-create">
            {saving ? <Loader2 size={14} className="animate-spin mr-1"/> : null}
            Create Itinerary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Itinerary List Card ───────────────────────────────────────────────────────
const ItineraryListCard = ({ itin, onOpen, onDelete }) => {
  const days  = itin.days?.length || 0;
  const total = (itin.days||[]).reduce((s,d)=>s+(d.blocks||[]).length,0);
  const statusColor = {draft:T_GOLD, final:T_GREEN, shared:T_BLUE}[itin.status||'draft']||T_GOLD;

  return (
    <div className="group rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:border-[#e8a830] hover:shadow-lg hover:-translate-y-0.5"
      style={{background:'var(--surface)', borderColor:'var(--stroke-soft)'}}
      onClick={onOpen} data-testid={`itin-card-${itin.id}`}>

      {/* Colored header strip */}
      <div className="h-1 w-full" style={{background:`linear-gradient(90deg,${T_GOLD},${T_GOLD}88,transparent)`}}/>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold leading-snug pr-2" style={{fontFamily:'Georgia,serif', color:'var(--app-fg)'}}>{itin.title}</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-bold uppercase"
            style={{background:`${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}44`}}>
            {itin.status||'draft'}
          </span>
        </div>

        {itin.client_name && (
          <p className="text-xs mb-2" style={{color:T_GOLD}}>
            <Users size={11} className="inline mr-1"/>{itin.client_name}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-[11px] mb-3" style={{color:'var(--app-dim)'}}>
          {itin.destination && <span><Globe size={10} className="inline mr-0.5"/>{itin.destination}</span>}
          {(itin.start_date||itin.end_date) && (
            <span><Calendar size={10} className="inline mr-0.5"/>{itin.start_date}{itin.end_date&&` → ${itin.end_date}`}</span>
          )}
          {itin.pax_adults > 0 && <span><Users size={10} className="inline mr-0.5"/>{itin.pax_adults}A{itin.pax_children ? `+${itin.pax_children}C` : ''}</span>}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-[11px]" style={{color:'var(--app-muted)'}}>
            <span className="px-1.5 py-0.5 rounded" style={{background:'var(--surface-2)'}}>{days} day{days!==1?'s':''}</span>
            <span className="px-1.5 py-0.5 rounded" style={{background:'var(--surface-2)'}}>{total} block{total!==1?'s':''}</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all duration-150"
            data-testid={`itin-delete-${itin.id}`}>
            <Trash2 size={13}/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Itinerary List View ────────────────────────────────────────────────────────
const ItineraryList = ({ onOpen, initFromClient, initFromEnquiry }) => {
  const [itineraries, setItineraries] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showNew,     setShowNew]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [initData,    setInitData]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itineraryAPI.list();
      setItineraries(res.data || []);
    } catch { toast.error('Failed to load itineraries'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open new dialog if navigated from Client Profile or CRM
  useEffect(() => {
    if (initFromClient || initFromEnquiry) {
      const prefill = initFromClient
        ? { client_id: initFromClient.id, client_name: initFromClient.name }
        : { enquiry_id: initFromEnquiry.id, destination: initFromEnquiry.destination };
      setInitData(prefill);
      setShowNew(true);
      window.history.replaceState({}, '');
    }
  }, [initFromClient, initFromEnquiry]);

  const handleCreate = (itin) => { setItineraries(p => [itin, ...p]); onOpen(itin); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this itinerary?')) return;
    try {
      await itineraryAPI.delete(id);
      setItineraries(p => p.filter(i => i.id !== id));
      toast.success('Itinerary deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = itineraries.filter(i =>
    !search ||
    i.title?.toLowerCase().includes(search.toLowerCase()) ||
    i.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.destination?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" data-testid="itinerary-list">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
        style={{borderColor:'var(--stroke-soft)'}}>
        <div>
          <h1 className="text-2xl font-semibold" style={{fontFamily:'Georgia,serif', color:'var(--app-fg)'}}>
            Itinerary Designer
          </h1>
          <p className="text-sm mt-0.5" style={{color:'var(--app-muted)'}}>
            Build day-wise travel plans with structured timeline blocks
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}
          className="gap-2 transition-transform duration-150 hover:scale-105"
          style={{background:'var(--cta,#e8a830)', color:'var(--brand-primary,#0a1628)'}}
          data-testid="new-itinerary-btn">
          <Plus size={15}/> New Itinerary
        </Button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b flex-shrink-0" style={{borderColor:'var(--stroke-soft)'}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search by title, client or destination…"
          className="max-w-sm h-9 text-sm"
          style={{background:'var(--surface)', color:'var(--app-fg)', borderColor:'var(--stroke-soft)'}}
          data-testid="itin-search"/>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" style={{background:'var(--surface)'}}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <FileText size={40} className="mx-auto mb-4" style={{color:'var(--app-muted)'}}/>
            <p className="text-base font-semibold" style={{color:'var(--app-dim)'}}>
              {search ? 'No itineraries match your search' : 'No itineraries yet'}
            </p>
            <p className="text-sm mt-1 mb-5" style={{color:'var(--app-muted)'}}>
              {search ? 'Try a different search term' : 'Create your first day-wise itinerary for a client'}
            </p>
            {!search && (
              <Button onClick={() => setShowNew(true)} className="gap-2"
                style={{background:'var(--cta,#e8a830)', color:'var(--brand-primary,#0a1628)'}}
                data-testid="empty-new-btn">
                <Plus size={14}/> Create Itinerary
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs mb-4" style={{color:'var(--app-muted)'}}>{filtered.length} itinerary{filtered.length!==1?'ies':''}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(itin => (
                <ItineraryListCard key={itin.id} itin={itin}
                  onOpen={()   => onOpen(itin)}
                  onDelete={() => handleDelete(itin.id)}/>
              ))}
            </div>
          </>
        )}
        <div className="h-6"/>
      </ScrollArea>

      <NewItineraryDialog open={showNew} onClose={() => { setShowNew(false); setInitData(null); }} onCreate={handleCreate} prefill={initData}/>
    </div>
  );
};

// ── Main Export ───────────────────────────────────────────────────────────────
export default function ItineraryDesigner() {
  const location = useLocation();
  const [view,     setView]     = useState('list');  // 'list' | 'builder'
  const [selected, setSelected] = useState(null);

  const openBuilder = async (itin) => {
    try {
      const res = await itineraryAPI.get(itin.id);
      setSelected(res.data);
      setView('builder');
    } catch {
      toast.error('Could not open itinerary');
    }
  };

  // Handle deep-link navigation from ClientProfile or CRM
  useEffect(() => {
    const state = location.state || {};
    if (state.openItineraryId) {
      itineraryAPI.get(state.openItineraryId)
        .then(res => { setSelected(res.data); setView('builder'); })
        .catch(() => {/* not found — stay on list */});
      // Clear state so refresh doesn't re-open
      window.history.replaceState({}, '');
    }
  }, []);  // run once on mount

  const handleSaved = (updated) => setSelected(updated);

  // Location state for new itinerary pre-fills (passed to ItineraryList)
  const initState = location.state || {};

  return (
    <div className="flex flex-col h-full" style={{background:'var(--app-bg)'}}>
      {view === 'list' ? (
        <ItineraryList
          onOpen={openBuilder}
          initFromClient={initState.newFromClient || null}
          initFromEnquiry={initState.newFromEnquiry || null}
        />
      ) : (
        <ItineraryBuilder
          itinerary={selected}
          onBack={() => setView('list')}
          onSaved={handleSaved}/>
      )}
    </div>
  );
}
