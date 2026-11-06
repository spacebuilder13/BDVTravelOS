/**
 * quoteSummaryPdf.js — "Internal Trip Summary" PDF for the Quote Drawer.
 *
 * Hand-drawn jsPDF layout with manual pagination (same approach as
 * QuoteExport.jsx). INTERNAL USE ONLY: every page is stamped
 * "INTERNAL - NOT FOR CLIENTS".
 *
 * Pure function of the data it is given — it reads nothing from the network
 * or the DOM, so the PDF always matches the drawer state it was built from.
 *
 * jsPDF's built-in fonts cannot draw the rupee sign or arrows, so amounts are
 * printed as "INR 12,000" and ranges as "A to B". Any other character outside
 * Latin-1 is replaced so it can't render as garbage.
 */
import { jsPDF } from 'jspdf';

// ── Layout constants (A4 portrait, mm) ───────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP_Y = 16;       // first content line on every page (below the banner)
const BOTTOM_Y = 282;   // last content line (above the footer)

const NAVY  = [46, 67, 116];
const DGRAY = [80, 100, 120];
const BLACK = [20, 30, 45];
const LGRAY = [240, 243, 248];
const RED   = [176, 28, 28];

// ── Type colours ─────────────────────────────────────────────────────────────
// Copied from TYPE_META in PlannerMap.jsx (not exported there, and that file
// is out of scope). If the map palette changes, update these to match.
const TYPE_COLORS = {
  flight: '#4AA3FF', train: '#06b6d4', bus: '#06b6d4', ferry: '#22d3ee',
  cruise: '#22d3ee', transfer: '#2aaf69', self_drive: '#2aaf69',
  stay: '#E8A830', activity: '#a78bfa', attraction: '#a78bfa',
  meal: '#f97316', visa: '#94a3b8', insurance: '#94a3b8', misc: '#94a3b8',
};
const DEFAULT_COLOR = '#8FBEC7';

const TYPE_LABELS = {
  flight: 'Flight', train: 'Train', bus: 'Bus', ferry: 'Ferry', cruise: 'Cruise',
  transfer: 'Transfer', self_drive: 'Self Drive', stay: 'Stay',
  activity: 'Activity', attraction: 'Attraction', meal: 'Meal',
  visa: 'Visa', insurance: 'Insurance', misc: 'Misc',
};

// Legend entries use the PlannerMap colours; Rail/Bus/Ferry has two
// (train/bus vs ferry) so it is drawn as a split swatch.
const LEGEND = [
  { label: 'Flight',         colors: [TYPE_COLORS.flight] },
  { label: 'Rail/Bus/Ferry', colors: [TYPE_COLORS.train, TYPE_COLORS.ferry] },
  { label: 'Transfer',       colors: [TYPE_COLORS.transfer] },
  { label: 'Hotel/Stay',     colors: [TYPE_COLORS.stay] },
  { label: 'Activity',       colors: [TYPE_COLORS.activity] },
  { label: 'Dining',         colors: [TYPE_COLORS.meal] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const h = (hex || DEFAULT_COLOR).replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};

const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Make arbitrary user text safe for jsPDF's WinAnsi fonts. */
const clean = (v) => {
  if (isEmpty(v)) return '';
  return String(v)
    .replace(/₹/g, 'INR ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, 'to')
    .replace(/\r/g, '')
    .replace(/[^\n\t\x20-\x7E -ÿ]/g, '?');
};

const orDash = (v) => (isEmpty(v) ? '-' : clean(v));

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNum = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "INR 12,000" (whole numbers). Empty -> "-". A real 0 prints. */
const money = (v, code) => {
  const n = toNum(v);
  if (n === null) return '-';
  return `${code ? `${clean(code)} ` : ''}${nf0.format(n)}`;
};

/** Net cost: whole numbers stay whole; fractional ones show 2 decimals (41,000.50). */
const moneyExact = (v, code) => {
  const n = toNum(v);
  if (n === null) return '-';
  const body = Number.isInteger(n) ? nf0.format(n) : nf2.format(n);
  return `${code ? `${clean(code)} ` : ''}${body}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format an ISO-ish string WITHOUT going through Date, so no timezone shift.
 * "2026-03-12T14:30:00" -> "12 Mar 2026 14:30"; date-only -> "12 Mar 2026".
 * Unparseable values are printed as-is; empty -> ''.
 */
const fmtDateTime = (str) => {
  if (isEmpty(str)) return '';
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return clean(str);
  const mon = MONTHS[parseInt(m[2], 10) - 1];
  if (!mon) return clean(str);
  const date = `${parseInt(m[3], 10)} ${mon} ${m[1]}`;
  return m[4] !== undefined ? `${date} ${m[4]}:${m[5]}` : date;
};

const fmtDateOnly = (str) => fmtDateTime(str).replace(/ \d{2}:\d{2}$/, '');

// ── Main ─────────────────────────────────────────────────────────────────────
/**
 * @param {object}   p
 * @param {object}   p.trip         trip record (client_name, quote_no, start_date, end_date, total_nights, adults, children)
 * @param {number}   p.version      quote version shown in the drawer
 * @param {object[]} p.components   drawer line items (with on-screen sell_price edits)
 * @param {object[]} p.taxProfiles  enabled tax profiles ({ label, rate })
 * @param {number}   p.discount     drawer discount
 * @param {object}   p.totals       drawer totals ({ subtotal, taxTotal, grand })
 * @param {string}   p.terms        drawer terms text
 * @param {string}   p.currency     trip currency code (sell price / totals)
 * @param {Date}     [p.generatedAt]
 * @returns {Blob} application/pdf
 */
export function buildQuoteSummaryPdf({
  trip, version, components = [], taxProfiles = [], discount = 0,
  totals = {}, terms = '', currency = 'INR', generatedAt = new Date(),
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = TOP_Y;

  const setText = (size, style = 'normal', color = BLACK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const checkPage = (needed = 10) => {
    if (y + needed > BOTTOM_Y) { doc.addPage(); y = TOP_Y; return true; }
    return false;
  };

  const sectionHeader = (title) => {
    checkPage(14);
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    setText(8.5, 'bold', [255, 255, 255]);
    doc.text(title, MARGIN + 3, y + 4.8);
    y += 9;
  };

  // ── 1. Header ──────────────────────────────────────────────────────────────
  setText(18, 'bold', NAVY);
  doc.text('Blue Diamond Voyage', MARGIN, y + 6);
  setText(11, 'normal', DGRAY);
  doc.text('Internal Trip Summary', MARGIN, y + 12.5);
  y += 17;

  const adults = toNum(trip?.adults);
  const kids = Array.isArray(trip?.children) ? trip.children.length : 0;
  const paxText = adults === null && !kids
    ? '-'
    : `${adults ?? 0} adult${adults === 1 ? '' : 's'}${kids ? `, ${kids} child${kids === 1 ? '' : 'ren'}` : ''}`;
  const nights = toNum(trip?.total_nights);
  const datesText = isEmpty(trip?.start_date) && isEmpty(trip?.end_date)
    ? '-'
    : `${fmtDateOnly(trip?.start_date) || '-'} to ${fmtDateOnly(trip?.end_date) || '-'}${nights ? ` (${nights} night${nights === 1 ? '' : 's'})` : ''}`;

  const info = [
    ['Client',          orDash(trip?.client_name)],
    ['Quote No',        orDash(trip?.quote_no)],
    ['Version',         isEmpty(version) ? '-' : `v${version}`],
    ['Trip Dates',      datesText],
    ['Pax',             paxText],
    ['Generated',       `${generatedAt.getDate()} ${MONTHS[generatedAt.getMonth()]} ${generatedAt.getFullYear()}`],
  ];
  const infoRowH = 6.5;
  const infoH = Math.ceil(info.length / 2) * infoRowH + 4;
  doc.setFillColor(...LGRAY);
  doc.rect(MARGIN, y, CONTENT_W, infoH, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, infoH);
  info.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 4 + col * (CONTENT_W / 2);
    const ty = y + 6 + row * infoRowH;
    setText(8, 'bold', DGRAY);
    doc.text(`${k}:`, x, ty);
    setText(8.5, 'normal', BLACK);
    const maxW = CONTENT_W / 2 - 30;
    doc.text(doc.splitTextToSize(v, maxW)[0], x + 24, ty);
  });
  y += infoH + 7;

  // ── 2. Component table ─────────────────────────────────────────────────────
  sectionHeader(`COMPONENTS  (${components.length})`);

  // Column x positions / widths (sum = CONTENT_W = 180)
  const cols = [
    { key: 'title',    label: 'Component / Type', w: 44 },
    { key: 'supplier', label: 'Supplier / Ref',   w: 34 },
    { key: 'dates',    label: 'Dates / Nights',   w: 42 },
    { key: 'pax',      label: 'Pax',              w: 10 },
    { key: 'net',      label: 'Net Cost',         w: 25, right: true },
    { key: 'sell',     label: 'Sell Price',       w: 25, right: true },
  ];
  let cx = MARGIN;
  cols.forEach(c => { c.x = cx; cx += c.w; });

  const drawTableHeader = () => {
    doc.setFillColor(...LGRAY);
    doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
    setText(6.8, 'bold', NAVY);
    cols.forEach(c => {
      if (c.right) doc.text(c.label, c.x + c.w - 1.5, y + 4.2, { align: 'right' });
      else doc.text(c.label, c.x + 1.5, y + 4.2);
    });
    y += 7;
  };
  drawTableHeader();

  const LINE_H = 3.6;
  const wrap = (text, w) => doc.splitTextToSize(text, w - 3);

  if (components.length === 0) {
    setText(8, 'normal', DGRAY);
    doc.text('-', MARGIN + 1.5, y + 4);
    y += 8;
  }

  components.forEach((c, idx) => {
    const titleCol = cols[0], supCol = cols[1], dateCol = cols[2];
    // Measure the title in the weight it is drawn in (bold is wider), and
    // leave room for the type colour bar (4mm indent).
    setText(7, 'bold', BLACK);
    const titleLines = wrap(orDash(c.title), titleCol.w - 2);
    setText(7, 'normal', BLACK);
    const typeLabel = isEmpty(c.type) ? '-' : clean(TYPE_LABELS[c.type] || c.type);
    const supLines = [
      ...wrap(orDash(c.supplier_name), supCol.w),
      ...wrap(`Ref: ${orDash(c.reference_no)}`, supCol.w),
    ];
    const start = fmtDateTime(c.start_datetime) || '-';
    const end = fmtDateTime(c.end_datetime) || '-';
    const n = toNum(c.nights);
    const dateLines = [
      ...wrap(start, dateCol.w),
      ...wrap(`to ${end}`, dateCol.w),
      n ? `${n} night${n === 1 ? '' : 's'}` : 'Nights: -',
    ];
    const netStr = toNum(c.net_cost) === null ? '-' : moneyExact(c.net_cost, c.net_currency);
    const netLines = wrap(netStr, cols[4].w);
    const sellLines = wrap(money(c.sell_price, currency), cols[5].w);

    const nLines = Math.max(titleLines.length + 1, supLines.length, dateLines.length, netLines.length, sellLines.length);
    const rowH = nLines * LINE_H + 3;

    if (checkPage(rowH + 1)) drawTableHeader();

    if (idx % 2 === 1) {
      doc.setFillColor(...LGRAY);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    // Type colour bar
    doc.setFillColor(...hexToRgb(TYPE_COLORS[c.type]));
    doc.rect(MARGIN, y, 1.6, rowH, 'F');

    const ty = y + 4.2;
    setText(7, 'bold', BLACK);
    titleLines.forEach((l, i) => doc.text(l, titleCol.x + 4, ty + i * LINE_H));
    setText(6.5, 'normal', DGRAY);
    doc.text(typeLabel, titleCol.x + 4, ty + titleLines.length * LINE_H);

    setText(7, 'normal', BLACK);
    supLines.forEach((l, i) => doc.text(l, supCol.x + 1.5, ty + i * LINE_H));
    dateLines.forEach((l, i) => doc.text(l, dateCol.x + 1.5, ty + i * LINE_H));
    doc.text(isEmpty(c.pax_count) ? '-' : clean(String(c.pax_count)), cols[3].x + 1.5, ty);
    netLines.forEach((l, i) => doc.text(l, cols[4].x + cols[4].w - 1.5, ty + i * LINE_H, { align: 'right' }));
    sellLines.forEach((l, i) => doc.text(l, cols[5].x + cols[5].w - 1.5, ty + i * LINE_H, { align: 'right' }));

    y += rowH;
  });
  y += 6;

  // ── 3. Route legend ────────────────────────────────────────────────────────
  checkPage(22);
  setText(8, 'bold', NAVY);
  doc.text('ROUTE LEGEND', MARGIN, y + 3);
  y += 6;
  const cellW = CONTENT_W / LEGEND.length;
  LEGEND.forEach((item, i) => {
    const x = MARGIN + i * cellW;
    const sw = 4;
    if (item.colors.length === 1) {
      doc.setFillColor(...hexToRgb(item.colors[0]));
      doc.rect(x, y, sw, sw, 'F');
    } else {
      doc.setFillColor(...hexToRgb(item.colors[0]));
      doc.rect(x, y, sw / 2, sw, 'F');
      doc.setFillColor(...hexToRgb(item.colors[1]));
      doc.rect(x + sw / 2, y, sw / 2, sw, 'F');
    }
    setText(7.5, 'normal', BLACK);
    doc.text(item.label, x + sw + 2, y + 3);
  });
  y += 12;

  // ── 4. Totals ──────────────────────────────────────────────────────────────
  const subtotal = toNum(totals.subtotal) ?? 0;
  const disc = toNum(discount) || 0;
  const totalRows = [
    { label: 'Subtotal', value: money(subtotal, currency) },
    ...taxProfiles.map(t => ({
      label: `${orDash(t.label)} (${toNum(t.rate) ?? 0}%)`,
      // Rounded per line, exactly as the drawer displays it.
      value: money(Math.round(subtotal * (toNum(t.rate) || 0) / 100), currency),
    })),
    ...(disc > 0 ? [{ label: 'Discount', value: `- ${money(disc, currency)}` }] : []),
  ];

  checkPage(totalRows.length * 7.5 + 20);
  sectionHeader('TOTALS');
  totalRows.forEach((r, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...LGRAY);
      doc.rect(MARGIN, y, CONTENT_W, 7.5, 'F');
    }
    setText(8.5, 'normal', DGRAY);
    doc.text(r.label, MARGIN + 4, y + 5);
    setText(8.5, 'normal', BLACK);
    doc.text(r.value, PAGE_W - MARGIN - 4, y + 5, { align: 'right' });
    y += 7.5;
  });
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, CONTENT_W, 9, 'F');
  setText(10, 'bold', [255, 255, 255]);
  doc.text('GRAND TOTAL', MARGIN + 4, y + 6.2);
  doc.text(money(totals.grand, currency), PAGE_W - MARGIN - 4, y + 6.2, { align: 'right' });
  y += 16;

  // ── 5. Terms & conditions ──────────────────────────────────────────────────
  checkPage(24);
  sectionHeader('TERMS & CONDITIONS');
  setText(8, 'normal', DGRAY);
  const termsText = clean(terms).trim();
  const termLines = termsText
    ? termsText.split('\n').flatMap(l => (l.trim() === '' ? [''] : doc.splitTextToSize(l, CONTENT_W - 8)))
    : ['-'];
  termLines.forEach(l => {
    checkPage(5);
    setText(8, 'normal', DGRAY);
    doc.text(l, MARGIN + 4, y + 3.5);
    y += 4.6;
  });

  // ── 6. Every page: INTERNAL banner + footer ────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...RED);
    doc.rect(0, 0, PAGE_W, 8, 'F');
    setText(8.5, 'bold', [255, 255, 255]);
    doc.text('INTERNAL - NOT FOR CLIENTS', PAGE_W / 2, 5.4, { align: 'center' });

    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    setText(7, 'bold', RED);
    doc.text('INTERNAL - NOT FOR CLIENTS', PAGE_W / 2, PAGE_H - 7, { align: 'center' });
    setText(7, 'normal', DGRAY);
    doc.text('Blue Diamond Voyage - Internal Trip Summary', MARGIN, PAGE_H - 7);
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  }

  return doc.output('blob');
}

/** Filename like "Trip-Summary-BDV-2026-0042-v2.pdf" (safe characters only). */
export function quoteSummaryFilename(trip, version) {
  const base = (trip?.quote_no || trip?.client_name || 'Quote')
    .toString().trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'Quote';
  return `Trip-Summary-${base}-v${version ?? 1}.pdf`;
}
