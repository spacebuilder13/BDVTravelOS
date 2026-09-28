/**
 * Screen totals for a quote. Same contract as compute_quote_totals:
 * round each line to 2 decimals, then the exchange rate, then markup, GST, and TCS.
 * A missing quantity defaults to 1. A quantity of 0 stays 0.
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function finite(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function lineQty(qty) {
  if (qty == null || qty === '') return 1;
  const n = parseFloat(qty);
  return Number.isFinite(n) ? n : 1;
}

export function quoteTotals(items, form = {}) {
  const byCategory = {};
  let operatingCost = 0;

  (items || []).forEach((item) => {
    const qty = lineQty(item.qty);
    const unitPrice = finite(item.unit_price, 0);
    const roe = finite(item.roe_to_base, 1) || 1;
    const amount = round2(qty * unitPrice);
    const amountBase = round2(amount * roe);
    operatingCost += amountBase;
    const cat = item.category || 'Misc';
    byCategory[cat] = (byCategory[cat] || 0) + amountBase;
  });

  operatingCost = round2(operatingCost);
  Object.keys(byCategory).forEach((cat) => {
    byCategory[cat] = round2(byCategory[cat]);
  });

  const markupValue = finite(form.markup_value, 0);
  const markupAmount = (form.markup_type || 'percentage') === 'percentage'
    ? round2((operatingCost * markupValue) / 100)
    : round2(markupValue);
  const subtotal = round2(operatingCost + markupAmount);
  const gstAmount = round2((subtotal * finite(form.gst_rate, 0)) / 100);
  const tcsAmount = form.tcs_enabled
    ? round2(((subtotal + gstAmount) * finite(form.tcs_rate, 0)) / 100)
    : 0;
  const grandTotal = round2(subtotal + gstAmount + tcsAmount);

  return {
    operatingCost,
    byCategory,
    markupAmount,
    subtotal,
    gstAmount,
    tcsAmount,
    grandTotal,
  };
}
