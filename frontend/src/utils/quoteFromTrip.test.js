import { quoteItemsFromTrip } from './quoteFromTrip';

let seq = 0;
const nextId = () => {
  seq += 1;
  return `id-${seq}`;
};

function sampleTrip(overrides = {}) {
  return {
    currency: 'INR',
    adults: 2,
    children: [{ age: 5 }],
    origin_name: 'Mumbai',
    origin_country: 'India',
    start_date: '2026-10-01',
    stops: [
      { id: 'home', place_name: 'Mumbai', country: 'India', nights: 0, stays: [] },
      {
        id: 'dxb',
        place_name: 'Dubai',
        country: 'United Arab Emirates',
        nights: 3,
        arrive_date: '2026-10-01',
        depart_date: '2026-10-04',
        stays: [{ hotel_name: 'Marina', cost: 9000, room_type: 'Deluxe', board: 'BB', notes: '' }],
      },
    ],
    legs: [
      {
        from_stop_id: 'origin',
        to_stop_id: 'dxb',
        mode: 'flight',
        cost: 40000,
        operator: 'EK',
        depart_datetime: '2026-10-01T09:30',
        arrive_datetime: '2026-10-01T12:00',
        notes: '',
      },
      {
        from_stop_id: 'dxb',
        to_stop_id: 'origin',
        mode: 'bus',
        cost: 500,
        operator: '',
        notes: 'coach',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  seq = 0;
});

test('flights stay flights and other modes become transfers', () => {
  const items = quoteItemsFromTrip(sampleTrip(), nextId);
  const flight = items.find(i => i.category === 'Flights');
  const transfer = items.find(i => i.category === 'Transfers');

  expect(flight.title).toBe('Mumbai → Dubai');
  expect(flight.unit_price).toBe(40000);
  expect(flight.fare_adult).toBe(20000);
  expect(flight.flight_date).toBe('2026-10-01');
  expect(flight.dep_time).toBe('09:30');
  expect(flight.no_children).toBe(1);

  expect(transfer.title).toBe('Bus: Dubai → Mumbai');
  expect(transfer.unit_price).toBe(500);
  expect(transfer.rate_type).toBe('Per Group');
});

test('hotel nights come from the stop, or from the dates', () => {
  const withNights = quoteItemsFromTrip(sampleTrip(), nextId).find(i => i.category === 'Hotels');
  expect(withNights.nights).toBe(3);
  expect(withNights.qty).toBe(3);
  expect(withNights.unit_price).toBe(3000);
  expect(withNights.hotel_name).toBe('Marina');

  const dated = sampleTrip();
  dated.stops[1] = { ...dated.stops[1], nights: 0 };
  const fromDates = quoteItemsFromTrip(dated, nextId).find(i => i.category === 'Hotels');
  expect(fromDates.nights).toBe(3);
  expect(fromDates.qty).toBe(3);
});

test('visa lines skip the origin country', () => {
  const items = quoteItemsFromTrip(sampleTrip(), nextId);
  const visas = items.filter(i => i.category === 'Visa Fees');

  expect(visas).toHaveLength(1);
  expect(visas[0].title).toBe('United Arab Emirates Visa');
  expect(visas[0].qty).toBe(3);
  expect(visas.map(v => v.title)).not.toContain('India Visa');
  expect(visas.map(v => v.title)).not.toContain('Mumbai Visa');
});

test('visa line skips the origin country regardless of case', () => {
  const trip = sampleTrip();
  trip.stops[0].country = 'india';
  const visas = quoteItemsFromTrip(trip, nextId).filter(i => i.category === 'Visa Fees');

  expect(visas.map(v => v.title)).toEqual(['United Arab Emirates Visa']);
});
