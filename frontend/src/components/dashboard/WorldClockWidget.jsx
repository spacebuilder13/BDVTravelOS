import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

const CITIES = [
  { name: 'Mumbai',       tz: 'Asia/Kolkata',        flag: '🇮🇳', abbr: 'IST'  },
  { name: 'Zurich',       tz: 'Europe/Zurich',        flag: '🇨🇭', abbr: 'CET'  },
  { name: 'London',       tz: 'Europe/London',        flag: '🇬🇧', abbr: 'GMT'  },
  { name: 'Melbourne',    tz: 'Australia/Melbourne',  flag: '🇦🇺', abbr: 'AEDT' },
  { name: 'Bali',         tz: 'Asia/Makassar',        flag: '🇮🇩', abbr: 'WITA' },
  { name: 'Ho Chi Minh',  tz: 'Asia/Ho_Chi_Minh',    flag: '🇻🇳', abbr: 'ICT'  },
  { name: 'New York',     tz: 'America/New_York',     flag: '🇺🇸', abbr: 'ET'   },
  { name: 'Toronto',      tz: 'America/Toronto',      flag: '🇨🇦', abbr: 'ET'   },
  { name: 'Tokyo',        tz: 'Asia/Tokyo',           flag: '🇯🇵', abbr: 'JST'  },
  { name: 'Bogota',       tz: 'America/Bogota',       flag: '🇨🇴', abbr: 'COT'  },
  { name: 'Mexico City',  tz: 'America/Mexico_City',  flag: '🇲🇽', abbr: 'CST'  },
  { name: 'Miami',        tz: 'America/New_York',     flag: '🇺🇸', abbr: 'ET'   },
  { name: 'Dubai',        tz: 'Asia/Dubai',           flag: '🇦🇪', abbr: 'GST'  },
  { name: 'Singapore',    tz: 'Asia/Singapore',       flag: '🇸🇬', abbr: 'SGT'  },
];

function getCityInfo(tz) {
  try {
    const now = new Date();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(now).map(p => [p.type, p.value])
    );
    const hour = parseInt(parts.hour, 10);
    const hhmm = `${parts.hour}:${parts.minute}`;
    const isDay = hour >= 6 && hour < 20;
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
    }).format(now);
    const tzShort = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'short',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
    return { hhmm, isDay, dayStr, tzShort };
  } catch {
    return { hhmm: '--:--', isDay: true, dayStr: '', tzShort: '' };
  }
}

export default function WorldClockWidget() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000); // update every minute
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-1), var(--inner-glow)' }}
      data-testid="world-clock-widget"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--stroke-soft)' }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: 'var(--cta)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--app-fg)' }}>
            World Clock
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
          <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>Live</span>
        </div>
      </div>

      {/* 7-column grid (2 rows of 7) */}
      <div className="p-3 grid grid-cols-7 gap-2">
        {CITIES.map(city => {
          const { hhmm, isDay, dayStr, tzShort } = getCityInfo(city.tz);
          return (
            <div
              key={city.name}
              className="flex flex-col items-center justify-center p-2 rounded-xl border"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--stroke-soft)' }}
              data-testid={`clock-${city.name.toLowerCase().replace(/\s+/g, '-')}`}
              title={dayStr}
            >
              <span className="text-base leading-none">{city.flag}</span>
              <p
                className="text-[10px] font-semibold mt-1 text-center leading-tight"
                style={{ color: 'var(--app-fg)' }}
              >
                {city.name}
              </p>
              <p
                className="text-[13px] font-mono font-bold mt-1 tracking-tight"
                style={{ color: 'var(--cta)' }}
              >
                {hhmm}
              </p>
              <p className="text-[8px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
                {tzShort || city.abbr}
              </p>
              <span className="text-[9px] mt-0.5" aria-hidden="true">
                {isDay ? '☀️' : '🌙'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
