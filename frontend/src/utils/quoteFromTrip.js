/**
 * Smart Fill: trip legs, stays, and countries → quote line items.
 * Ids are injectable so tests stay deterministic.
 */

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const calcNights = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000));
};

const extractDate = (dt) => {
  if (!dt) return '';
  try { return (dt.split('T')[0] || '').split(' ')[0] || ''; } catch { return ''; }
};

const extractTime = (dt) => {
  if (!dt) return '';
  try {
    const t = dt.split('T');
    if (t.length > 1) return t[1].slice(0, 5);
    const m = dt.match(/(\d{2}:\d{2})/);
    return m ? m[1] : '';
  } catch { return ''; }
};

export function quoteItemsFromTrip(trip, createId = newId) {
  if (!trip) return [];
  const stops    = trip.stops  || [];
  const legs     = trip.legs   || [];
  const currency = trip.currency || 'INR';
  const adults   = trip.adults   || 1;
  const children = (trip.children || []).length;

  const stopMap = {};
  stops.forEach(s => { stopMap[s.id] = s; });
  stopMap.origin = {
    place_name:  trip.origin_name,
    country:     trip.origin_country || '',
    arrive_date: trip.start_date,
    depart_date: trip.start_date,
  };

  const newItems = [];
  const addedCountries = new Set();

  for (const leg of legs) {
    const fromStop  = stopMap[leg.from_stop_id] || { place_name: leg.from_stop_id };
    const toStop    = stopMap[leg.to_stop_id]   || { place_name: leg.to_stop_id   };
    const fromName  = fromStop.place_name || leg.from_point  || leg.from_stop_id  || '';
    const toName    = toStop.place_name   || leg.to_point    || leg.to_stop_id    || '';
    const legDate   = extractDate(leg.depart_datetime) || fromStop.depart_date || trip.start_date || '';
    const depTime   = extractTime(leg.depart_datetime) || '';
    const arrTime   = extractTime(leg.arrive_datetime) || '';
    const legCost   = parseFloat(leg.cost) || 0;
    const isFlightMode = (leg.mode || '').toLowerCase() === 'flight';

    if (isFlightMode) {
      const fareAdult = adults > 0 && legCost > 0 ? Math.round(legCost / adults) : 0;
      newItems.push({
        id:           createId(),
        category:     'Flights',
        title:        fromName && toName ? `${fromName} \u2192 ${toName}` : 'Flight',
        description:  leg.notes || '',
        qty:          1,
        unit_price:   legCost,
        currency,
        roe_to_base:  1.0,
        from_location: fromName,
        to_location:  toName,
        flight_date:  legDate,
        dep_time:     depTime,
        arr_time:     arrTime,
        airline:      leg.operator || '',
        flight_no:    leg.from_point || '',
        flight_class: 'Economy',
        pnr:          '',
        fare_adult:   fareAdult,
        fare_child:   0,
        fare_infant:  0,
        no_adults:    adults,
        no_children:  children,
        no_infants:   0,
        stopovers:    [],
        show_stopovers: false,
      });
    } else {
      const modeLabel = leg.mode
        ? leg.mode.charAt(0).toUpperCase() + leg.mode.slice(1)
        : 'Transfer';
      newItems.push({
        id:           createId(),
        category:     'Transfers',
        title:        leg.operator || `${modeLabel}: ${fromName} \u2192 ${toName}`,
        description:  leg.notes || '',
        qty:          1,
        unit_price:   legCost,
        currency,
        roe_to_base:  1.0,
        rate_type:    'Per Group',
        service_count: 1,
        flight_date:  legDate,
      });
    }
  }

  for (const stop of stops) {
    const checkIn  = stop.arrive_date  || '';
    const checkOut = stop.depart_date  || '';
    const nights   = stop.nights || calcNights(checkIn, checkOut) || 1;

    for (const stay of (stop.stays || [])) {
      const stayCost     = parseFloat(stay.cost) || 0;
      const ratePerNight = nights > 0 ? stayCost / nights : stayCost;
      newItems.push({
        id:           createId(),
        category:     'Hotels',
        title:        stay.hotel_name || 'Hotel',
        description:  stay.notes || '',
        qty:          Math.max(1, nights),
        unit_price:   ratePerNight,
        currency,
        roe_to_base:  1.0,
        city:         stop.place_name || '',
        hotel_name:   stay.hotel_name || '',
        check_in:     checkIn,
        check_out:    checkOut,
        nights,
        room_type:    stay.room_type || 'Deluxe',
        meal_plan:    stay.board || 'BB',
        no_of_rooms:  1,
        rate_per_night: ratePerNight,
      });
    }

    const country = (stop.country || '').trim() || (stop.place_name || '').split(',').pop().trim();
    // "India" and "india" are the same home country, so neither gets a visa line.
    const countryKey = country.toLowerCase();
    const originCountry = String(trip.origin_country || '').trim().toLowerCase();
    const originName = String(trip.origin_name || '').trim().toLowerCase();
    if (country && !addedCountries.has(country)
        && countryKey !== originCountry
        && countryKey !== originName) {
      addedCountries.add(country);
    }
  }

  for (const country of addedCountries) {
    newItems.push({
      id:          createId(),
      category:    'Visa Fees',
      title:       `${country} Visa`,
      description: `Visa fees for ${country} — ${adults + children} pax`,
      qty:         adults + children,
      unit_price:  0,
      currency,
      roe_to_base: 1.0,
    });
  }

  for (const stop of stops) {
    const stopDate = stop.arrive_date || '';

    for (const r of (stop.restaurants || [])) {
      const cost = parseFloat(r.cost) || 0;
      if (cost > 0) {
        newItems.push({
          id:           createId(),
          category:     'Sightseeing',
          title:        r.name || 'Restaurant',
          description:  `${r.cuisine ? `${r.cuisine} restaurant` : 'Restaurant'} · ${stop.place_name}${r.address ? ` · ${r.address}` : ''}`,
          qty:          adults + children || 1,
          unit_price:   cost,
          currency,
          roe_to_base:  1.0,
          rate_type:    'Per Person',
          service_count: adults + children,
          city:         stop.place_name,
          flight_date:  stopDate,
        });
      }
    }

    for (const a of (stop.attractions || [])) {
      const cost = parseFloat(a.cost) || 0;
      if (cost > 0) {
        newItems.push({
          id:           createId(),
          category:     'Sightseeing',
          title:        a.name || 'Attraction',
          description:  `${a.category || 'Attraction'} · ${stop.place_name}${a.duration ? ` · ${a.duration}` : ''}${a.schedule ? ` · ${a.schedule}` : ''}`,
          qty:          adults + children || 1,
          unit_price:   cost,
          currency,
          roe_to_base:  1.0,
          rate_type:    'Per Person',
          service_count: adults + children,
          city:         stop.place_name,
          flight_date:  stopDate,
        });
      }
    }

    for (const mp of (stop.meeting_points || [])) {
      newItems.push({
        id:          createId(),
        category:    'Misc',
        title:       `Meeting Point: ${mp.name}`,
        description: `${mp.address || ''}${mp.meeting_url ? ` · ${mp.meeting_url}` : ''}`,
        qty:         1,
        unit_price:  0,
        currency,
        roe_to_base: 1.0,
      });
    }
  }

  return newItems;
}
