import { getROE, saveROE } from './roeStorage';

beforeEach(() => {
  localStorage.clear();
});

test('same currency is 1', () => {
  expect(getROE('INR', 'INR')).toBe(1);
  expect(getROE('USD', 'USD')).toBe(1);
  expect(getROE('', 'INR')).toBe(1);
});

test('preset USD to INR', () => {
  expect(getROE('USD')).toBe(84.5);
  expect(getROE('USD', 'INR')).toBe(84.5);
});

test('cross rate goes through INR', () => {
  expect(getROE('EUR', 'USD')).toBe(1.065089);
  expect(getROE('INR', 'USD')).toBe(0.011834);
});

test('cached value beats the preset', () => {
  saveROE('USD', 'INR', 90);
  expect(getROE('USD', 'INR')).toBe(90);
});

test('garbage cache still uses the preset', () => {
  localStorage.setItem('bdvv_roe_cache', '{not json');
  expect(getROE('USD')).toBe(84.5);
});
