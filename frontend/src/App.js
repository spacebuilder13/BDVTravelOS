import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import ClientProfile from './pages/ClientProfile';
import Quotations from './pages/Quotations';
import TripPlanner from './pages/TripPlanner';
import PlannerCanvas from './pages/PlannerCanvas';
import Visa from './pages/Visa';
import Maps from './pages/Maps';
import Transport from './pages/Transport';
import Browser from './pages/Browser';
import Settings from './pages/Settings';
import AIAssistant from './pages/AIAssistant';
import CompassHub from './pages/CompassHub';
import ItineraryDesigner from './pages/ItineraryDesigner';
import ComingSoon from './pages/ComingSoon';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--app-bg)]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{borderColor: 'var(--brand-accent)', borderTopColor: 'transparent'}} />
          <p className="text-sm text-gray-500">Loading BDV TravelOS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/app/dashboard" replace /> : <Login />} />
      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="crm" element={<CRM />} />
        <Route path="crm/client/:clientId" element={<ClientProfile />} />
        <Route path="quotations"        element={<Quotations />} />
        <Route path="planner"           element={<TripPlanner />} />
        <Route path="planner/:tripId"   element={<PlannerCanvas />} />
        <Route path="itinerary" element={<ItineraryDesigner />} />
        <Route path="visa" element={<Visa />} />
        <Route path="transport" element={<Transport />} />
        <Route path="maps" element={<Maps />} />
        <Route path="browser" element={<Browser />} />
        <Route path="training" element={<ComingSoon module="Training" />} />
        <Route path="ai" element={<CompassHub />} />
        <Route path="settings" element={<Settings />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>
      <Route path="/" element={<Navigate to={user ? '/app/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
