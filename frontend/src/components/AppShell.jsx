import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Statusbar from './Statusbar';

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden hud-grid"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />

        <main
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{ backgroundColor: 'transparent' }}
        >
          <Outlet />
        </main>

        <Statusbar />
      </div>
    </div>
  );
}
