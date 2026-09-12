import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { toast } from 'sonner';
import { LOGIN } from '../constants/testIds';
import { Delete, Compass, Shield } from 'lucide-react';

const ROLE_LABELS = {
  admin:      'Administrator',
  sales:      'Sales Agent',
  operations: 'Operations',
  accounts:   'Accounts',
  tour_guide: 'Tour Guide',
};

function StaffCard({ staff, selected, onClick }) {
  return (
    <button
      data-testid={LOGIN.staffCard(staff.id)}
      onClick={onClick}
      className="flex flex-col items-center p-3 transition-all"
      style={{
        borderRadius: '4px',
        border: selected
          ? '1px solid var(--cta-45)'
          : '1px solid var(--stroke)',
        background: selected
          ? 'var(--cta-10)'
          : 'var(--j-panel)',
        boxShadow: selected
          ? '0 0 14px var(--cta-30), inset 0 0 8px var(--cta-5)'
          : 'none',
        backdropFilter: 'blur(8px)',
        transform: selected ? 'scale(1.04)' : 'scale(1)',
        transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
        clipPath: selected
          ? 'polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)'
          : 'none',
      }}
    >
      {/* Avatar ring */}
      <div
        className="w-11 h-11 flex items-center justify-center text-sm font-bold mb-2"
        style={{
          borderRadius: '50%',
          background: selected ? 'var(--cta-15)' : 'var(--cta-8)',
          border: `1.5px solid ${selected ? 'var(--cta-45)' : 'var(--cta-20)'}`,
          color: selected ? 'var(--cta)' : 'var(--app-muted)',
          fontFamily: 'Figtree, sans-serif',
          fontSize: '11px',
          boxShadow: selected ? '0 0 10px var(--cta-45)' : 'none',
        }}
      >
        {staff.initials || staff.name.charAt(0)}
      </div>
      <p
        className="text-[11px] font-semibold text-center leading-tight truncate w-full"
        style={{
          color: selected ? 'var(--app-fg)' : 'var(--app-muted)',
          fontFamily: 'Figtree, sans-serif',
          letterSpacing: '0.06em',
        }}
      >
        {staff.name}
      </p>
      <p
        className="text-[9px] mt-0.5 truncate w-full text-center uppercase tracking-wider"
        style={{
          color: selected ? 'var(--cta-45)' : 'var(--j-text-dim)',
          fontFamily: 'Figtree, sans-serif',
        }}
      >
        {ROLE_LABELS[staff.role] || staff.role}
      </p>
    </button>
  );
}

function PinDots({ pin, maxLength = 4 }) {
  return (
    <div className="flex gap-4 justify-center" data-testid={LOGIN.pinInput}>
      {Array.from({ length: maxLength }).map((_, i) => (
        <div
          key={i}
          className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
          style={{
            transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

function NumPad({ onPress, onBackspace, disabled }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','<'];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {keys.map((key, i) => {
        if (key === '') return <div key={`spacer-${i}`} />;
        if (key === '<') {
          return (
            <button
              key="backspace"
              data-testid={LOGIN.backspace}
              onClick={onBackspace}
              disabled={disabled}
              className="pin-btn mx-auto"
            >
              <Delete className="w-5 h-5" />
            </button>
          );
        }
        return (
          <button
            key={key}
            data-testid={LOGIN.numpadKey(key)}
            onClick={() => onPress(key)}
            disabled={disabled}
            className="pin-btn mx-auto"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    authAPI.getStaff()
      .then(res => setStaffList(res.data))
      .catch(() => toast.error('Could not load staff list'))
      .finally(() => setLoadingStaff(false));
  }, []);

  const handleKeyPress = (digit) => {
    if (pin.length >= 4 || loading) return;
    const newPin = pin + digit;
    if (error && pin.length === 0) setError('');
    setPin(newPin);
    if (newPin.length === 4) handleLogin(newPin);
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const handleLogin = async (pinToUse) => {
    if (!selectedStaff) {
      setError('Select an operator profile first');
      setPin('');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(selectedStaff.id, pinToUse);
      navigate('/app/dashboard');
    } catch {
      setPin('');
      setError('Access denied — incorrect PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex hud-grid"
      style={{ backgroundColor: 'var(--app-bg)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Ambient radial glow top-right */}
      <div
        style={{
          position: 'absolute', top: '-120px', right: '-80px',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--cta-5) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Ambient radial glow bottom-left */}
      <div
        style={{
          position: 'absolute', bottom: '-100px', left: '-60px',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(27,156,252,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ─── Left brand panel ──────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-80 p-10 flex-shrink-0 hud-scanline"
        style={{
          background: 'rgba(10,18,32,0.90)',
          borderRight: '1px solid var(--stroke)',
          position: 'relative',
        }}
      >
        {/* Corner brackets */}
        <span style={{ position: 'absolute', top: 16, left: 16, fontSize: 18, color: 'var(--cta-45)', fontFamily: 'monospace', lineHeight: 1 }}>
          ¬
        </span>
        <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 18, color: 'var(--cta-45)', fontFamily: 'monospace', lineHeight: 1, transform: 'scaleX(-1)' }}>
          ¬
        </span>
        <span style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 18, color: 'var(--cta-45)', fontFamily: 'monospace', lineHeight: 1, transform: 'scaleY(-1)' }}>
          ¬
        </span>
        <span style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 18, color: 'var(--cta-45)', fontFamily: 'monospace', lineHeight: 1, transform: 'scale(-1,-1)' }}>
          ¬
        </span>

        {/* Brand top */}
        <div>
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex items-center justify-center rounded"
              style={{
                background: 'rgba(255,255,255,0.92)',
                padding: '5px 10px',
                height: '48px',
              }}
            >
              <img
                src="/assets/bdv-logo-horizontal.png"
                alt="Blue Diamond Voyage"
                style={{ height: '38px', width: 'auto', objectFit: 'contain', display: 'block' }}
                draggable={false}
              />
            </div>
          </div>

          <h1
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: '24px',
              fontWeight: '800',
              letterSpacing: '0.04em',
              color: 'var(--app-fg)',
              marginBottom: '8px',
              lineHeight: 1.2,
            }}
          >
            Blue Diamond
          </h1>
          <h1
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: '24px',
              fontWeight: '800',
              letterSpacing: '0.04em',
              color: 'var(--cta)',
              marginBottom: '16px',
              lineHeight: 1.2,
              textShadow: '0 0 12px var(--cta-45)',
            }}
          >
            Voyage
          </h1>
          <p
            style={{
              fontFamily: 'Figtree, sans-serif',
              color: 'var(--app-muted)',
              fontSize: '14px',
              lineHeight: 1.6,
              letterSpacing: '0.01em',
            }}
          >
            Your complete travel operations command center.
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'Lead Pipeline',       desc: 'Kanban CRM' },
            { label: 'Quotation Builder',   desc: 'INT & DOM packages' },
            { label: 'Itinerary Designer',  desc: 'Day-wise + PDF export' },
            { label: 'Compass AI',          desc: '480-destination intel' },
            { label: 'Alerts & Reminders',  desc: 'Auto follow-up system' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <span
                style={{
                  display: 'inline-block',
                  width: '5px', height: '5px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--cta)',
                  boxShadow: '0 0 5px var(--cta-45)',
                  marginTop: '6px',
                  flexShrink: 0,
                }}
              />
              <div>
                <p
                  style={{
                    fontFamily: 'Figtree, sans-serif',
                    fontWeight: 600,
                    color: 'var(--app-fg)',
                    fontSize: '13px',
                    letterSpacing: '0.05em',
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: 'Figtree, sans-serif',
                    color: 'var(--j-text-dim)',
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer badge */}
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5"
            style={{
              background: 'var(--cta-8)',
              border: '1px solid var(--cta-20)',
              borderRadius: '4px',
              clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)',
            }}
          >
            <Shield className="w-3 h-3" style={{ color: 'var(--cta)' }} />
            <span
              style={{
                fontFamily: 'Figtree, sans-serif',
                fontSize: '10px',
                color: 'var(--cta)',
                letterSpacing: '0.06em',
              }}
            >
              IATA: 14347782
            </span>
          </div>
          <p
            style={{
              fontFamily: 'Figtree, sans-serif',
              color: 'var(--j-text-dim)',
              fontSize: '9px',
              marginTop: '8px',
              letterSpacing: '0.04em',
            }}
          >
            RAJKOT, GUJARAT, INDIA
          </p>
        </div>
      </div>

      {/* ─── Right: Login form ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg animate-jarvis-enter">

          {/* Mobile brand header */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-14 h-14 flex items-center justify-center font-bold text-lg mx-auto mb-3"
              style={{
                background: 'var(--cta-10)',
                border: '1px solid var(--cta-45)',
                color: 'var(--cta)',
                clipPath: 'polygon(10px 0%,100% 0%,100% calc(100% - 10px),calc(100% - 10px) 100%,0% 100%,0% 10px)',
                fontFamily: 'Figtree, sans-serif',
                fontSize: '14px',
              }}
            >
              BDV
            </div>
            <h1
              style={{
                fontFamily: 'Figtree, sans-serif',
                color: 'var(--app-fg)',
                fontSize: '16px',
                letterSpacing: '0.14em',
              }}
            >
              TRAVEL OS
            </h1>
          </div>

          {/* Main auth card */}
          <div
            style={{
              background: 'rgba(10,18,32,0.80)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--stroke)',
              borderRadius: '8px',
              padding: '32px',
              boxShadow: '0 0 30px var(--cta-8), 0 20px 60px rgba(0,0,0,0.60)',
              clipPath: 'polygon(14px 0%,100% 0%,100% calc(100% - 14px),calc(100% - 14px) 100%,0% 100%,0% 14px)',
            }}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-1">
              <span style={{ color: 'var(--cta-45)', fontSize: '14px', lineHeight: 1 }}>&#172;</span>
              <h2
                style={{
                  fontFamily: 'Figtree, sans-serif',
                  fontSize: '13px',
                  letterSpacing: '0.18em',
                  color: 'var(--cta)',
                  textShadow: '0 0 8px var(--cta-45)',
                  textTransform: 'uppercase',
                }}
              >
                System Access
              </h2>
              <span style={{ color: 'var(--cta-45)', fontSize: '14px', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>&#172;</span>
            </div>
            <p
              className="mb-6"
              style={{
                fontFamily: 'Figtree, sans-serif',
                color: 'var(--app-muted)',
                fontSize: '13px',
                letterSpacing: '0.04em',
              }}
            >
              Select operator profile, then enter 4-digit PIN
            </p>

            {/* Staff grid */}
            {loadingStaff ? (
              <div className="grid grid-cols-5 gap-2 mb-8">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded animate-pulse"
                    style={{ background: 'var(--cta-5)', border: '1px solid var(--cta-10)' }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2 mb-8">
                {staffList.map(staff => (
                  <StaffCard
                    key={staff.id}
                    staff={staff}
                    selected={selectedStaff?.id === staff.id}
                    onClick={() => {
                      setSelectedStaff(staff);
                      setPin('');
                      setError('');
                    }}
                  />
                ))}
              </div>
            )}

            {/* PIN area */}
            <div
              className="pt-6"
              style={{ borderTop: '1px solid var(--cta-15)' }}
            >
              {selectedStaff ? (
                <>
                  <p
                    className="text-center mb-5"
                    style={{
                      fontFamily: 'Figtree, sans-serif',
                      fontSize: '13px',
                      letterSpacing: '0.06em',
                      color: 'var(--app-muted)',
                    }}
                  >
                    PIN for{' '}
                    <span style={{ color: 'var(--cta)', fontWeight: 700 }}>{selectedStaff.name}</span>
                  </p>
                  <div className="mb-6">
                    <PinDots pin={pin} />
                  </div>

                  {/* Error message */}
                  <div className="min-h-[36px] mb-3 flex items-center justify-center">
                    {error && (
                      <div
                        data-testid="login-error-message"
                        className="flex items-center gap-2 px-3 py-2"
                        style={{
                          background: 'rgba(255,59,78,0.10)',
                          border: '1px solid rgba(255,59,78,0.35)',
                          borderRadius: '4px',
                          clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)',
                        }}
                      >
                        <span
                          style={{
                            width: '5px', height: '5px',
                            borderRadius: '50%',
                            backgroundColor: '#FF3B4E',
                            boxShadow: '0 0 5px rgba(255,59,78,0.70)',
                            flexShrink: 0,
                            display: 'inline-block',
                          }}
                        />
                        <p
                          style={{
                            fontFamily: 'Figtree, sans-serif',
                            fontSize: '13px',
                            color: '#FF3B4E',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {error}
                        </p>
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex justify-center mb-6">
                      <div
                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{
                          borderColor: 'var(--cta)',
                          borderTopColor: 'transparent',
                          boxShadow: '0 0 8px var(--cta-30)',
                        }}
                      />
                    </div>
                  ) : (
                    <NumPad
                      onPress={handleKeyPress}
                      onBackspace={handleBackspace}
                      disabled={loading || pin.length >= 4}
                    />
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <Compass
                    className="w-8 h-8 mx-auto mb-3"
                    style={{ color: 'var(--cta-30)', filter: 'drop-shadow(0 0 4px var(--cta-20))' }}
                  />
                  <p
                    style={{
                      fontFamily: 'Figtree, sans-serif',
                      fontSize: '13px',
                      color: 'var(--j-text-dim)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    SELECT OPERATOR TO CONTINUE
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p
            className="text-center mt-4"
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: '10px',
              color: 'var(--j-text-dim)',
              letterSpacing: '0.06em',
            }}
          >
            IATA: 14347782
            <span style={{ color: 'var(--cta-20)', margin: '0 6px' }}>&#183;</span>
            BLUE DIAMOND VOYAGE &amp; VISION
          </p>
        </div>
      </div>
    </div>
  );
}
