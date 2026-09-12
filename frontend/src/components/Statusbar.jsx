import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { STATUSBAR } from '../constants/testIds';

export default function Statusbar() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <footer
      className="h-6 flex-shrink-0 flex items-center justify-between px-5"
      style={{
        background: 'var(--panel-overlay)',
        borderTop: '1px solid var(--cta-12)',
      }}
    >
      {/* Left: connectivity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" data-testid={STATUSBAR.connectivity}>
          <span
            className="animate-pulse-dot"
            style={{
              display: 'inline-block',
              width: '5px', height: '5px',
              borderRadius: '50%',
              backgroundColor: 'var(--success)',
              boxShadow: '0 0 5px rgba(43,232,160,0.80)',
            }}
          />
          <span
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: '10px',
              color: 'rgba(43,232,160,0.70)',
              letterSpacing: '0.05em',
            }}
          >
            DB CONNECTED
          </span>
        </div>
        <span style={{ color: 'var(--cta-15)', fontSize: '10px' }}>|</span>
        <span
          data-testid={STATUSBAR.lastSync}
          style={{
            fontFamily: 'Figtree, sans-serif',
            fontSize: '10px',
            color: 'var(--j-text-dim)',
            letterSpacing: '0.04em',
          }}
        >
          SYNC {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      </div>

      {/* Center */}
      <div
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: '10px',
          color: 'var(--j-text-dim)',
          letterSpacing: '0.06em',
        }}
      >
        RAJKOT, GUJARAT
        <span style={{ color: 'var(--cta-20)', margin: '0 4px' }}>&#183;</span>
        IATA 14347782
      </div>

      {/* Right: version */}
      <div className="flex items-center gap-2">
        <span
          style={{
            fontFamily: 'Figtree, sans-serif',
            fontSize: '10px',
            color: 'var(--j-text-dim)',
            letterSpacing: '0.04em',
          }}
        >
          BDV TRAVELOS
        </span>
        <span
          style={{
            fontFamily: 'Figtree, sans-serif',
            fontSize: '10px',
            color: 'var(--cta-45)',
            letterSpacing: '0.04em',
            textShadow: '0 0 4px var(--cta-30)',
          }}
        >
          v2.0
        </span>
      </div>
    </footer>
  );
}
