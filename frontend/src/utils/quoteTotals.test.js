import { quoteTotals } from './quoteTotals';

test('rounds the line before the exchange rate, matching the server', () => {
  // 3 × 10.333 = 30.999 → 31.00, then × 2 = 62.00.
  // qty × price × rate in one float is 61.998.
  const totals = quoteTotals(
    [{ qty: 3, unit_price: 10.333, roe_to_base: 2, category: 'Hotels' }],
  );

  expect(totals.operatingCost).toBe(62);
  expect(totals.grandTotal).toBe(62);
  expect(totals.byCategory.Hotels).toBe(62);
});

test('a quantity of 0 stays 0', () => {
  const totals = quoteTotals(
    [{ qty: 0, unit_price: 500, roe_to_base: 2 }],
  );

  expect(totals.operatingCost).toBe(0);
  expect(totals.grandTotal).toBe(0);
});

test('a missing quantity defaults to 1', () => {
  const totals = quoteTotals([{ unit_price: 10, roe_to_base: 1 }]);

  expect(totals.operatingCost).toBe(10);
});
