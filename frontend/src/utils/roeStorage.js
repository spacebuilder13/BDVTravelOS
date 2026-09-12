/**
 * ROE (Rate of Exchange) Storage Utility
 * Stores last-used ROE values per currency pair in localStorage.
 * Falls back to curated defaults for common travel currencies.
 */

const STORAGE_KEY = 'bdvv_roe_cache';

/** Default presets for common travel currencies → INR (updated periodically) */
const DEFAULT_ROE = {
  USD: 84.50,
  AED: 23.02,
  EUR: 90.00,
  GBP: 107.00,
  SGD: 62.50,
  THB: 2.42,
  MYR: 18.50,
  LKR: 0.27,
  NPR: 0.63,
};

/**
 * Get the ROE for a currency pair.
 * Returns 1.0 if fromCurrency === baseCurrency.
 * Priority: localStorage cache → DEFAULT_ROE preset → 1.0
 */
export function getROE(fromCurrency, baseCurrency = 'INR') {
  if (!fromCurrency || fromCurrency === baseCurrency) return 1.0;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const key = `${fromCurrency}_${baseCurrency}`;
    if (cache[key]) return parseFloat(cache[key]);

    // Direct preset (X → INR)
    if (baseCurrency === 'INR' && DEFAULT_ROE[fromCurrency]) {
      return DEFAULT_ROE[fromCurrency];
    }

    // Cross-rate via INR: from→INR / base→INR
    if (DEFAULT_ROE[fromCurrency] && DEFAULT_ROE[baseCurrency]) {
      return parseFloat((DEFAULT_ROE[fromCurrency] / DEFAULT_ROE[baseCurrency]).toFixed(6));
    }

    // Reverse: if we know base→INR and from is INR
    if (fromCurrency === 'INR' && DEFAULT_ROE[baseCurrency]) {
      return parseFloat((1 / DEFAULT_ROE[baseCurrency]).toFixed(6));
    }
  } catch { /* ignore — ROE lookup is best-effort */ }
  return 1.0;
}

/**
 * Persist a used ROE value so it's remembered next session.
 */
export function saveROE(fromCurrency, baseCurrency, roe) {
  if (!fromCurrency || fromCurrency === baseCurrency) return;
  const roeVal = parseFloat(roe);
  if (!roeVal || roeVal <= 0) return;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cache[`${fromCurrency}_${baseCurrency}`] = roeVal;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) { console.warn('[roeStorage] Failed to persist ROE cache:', e); }
}

/**
 * Bulk-save ROE values from an items array (call on quote save).
 */
export function bulkSaveROE(items, baseCurrency) {
  (items || []).forEach(item => {
    if (item.currency && item.currency !== baseCurrency && item.roe_to_base) {
      saveROE(item.currency, baseCurrency, item.roe_to_base);
    }
  });
}

/** Returns all known defaults + cached values for display (e.g. a ROE reference panel) */
export function getAllROE(baseCurrency = 'INR') {
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const result = { ...DEFAULT_ROE };
    Object.keys(cache).forEach(key => {
      const [from, base] = key.split('_');
      if (base === baseCurrency) result[from] = cache[key];
    });
    return result;
  } catch {
    return { ...DEFAULT_ROE };
  }
}
