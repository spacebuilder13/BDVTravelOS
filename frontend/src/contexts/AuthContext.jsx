import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brand, setBrandState] = useState(() => localStorage.getItem('bdvv_brand') || 'bdvv');

  // Apply brand to DOM
  const applyBrand = useCallback((b) => {
    document.documentElement.setAttribute('data-brand', b);
    localStorage.setItem('bdvv_brand', b);
    setBrandState(b);
  }, []);

  // Initialize: verify session via /auth/me (uses httpOnly cookie automatically)
  // User profile (non-sensitive) is cached in localStorage for instant hydration
  useEffect(() => {
    const savedUser = localStorage.getItem('bdvv_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem('bdvv_user'); }
    }
    // Always verify cookie session is still valid
    authAPI.me()
      .then(res => {
        setUser(res.data);
        localStorage.setItem('bdvv_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // Cookie expired or missing — clear cached user
        setUser(null);
        localStorage.removeItem('bdvv_user');
      })
      .finally(() => setLoading(false));

    // Apply saved brand
    const savedBrand = localStorage.getItem('bdvv_brand') || 'bdvv';
    document.documentElement.setAttribute('data-brand', savedBrand);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (staffId, pin) => {
    const res = await authAPI.login(staffId, pin);
    const { user: userData } = res.data;
    // Token is stored in httpOnly cookie by the server — do NOT store in localStorage
    localStorage.setItem('bdvv_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore — clear client side anyway */ }
    localStorage.removeItem('bdvv_user');
    setUser(null);
  }, []);

  const switchBrand = useCallback((newBrand) => {
    applyBrand(newBrand);
  }, [applyBrand]);

  return (
    <AuthContext.Provider value={{ user, loading, brand, login, logout, switchBrand }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
