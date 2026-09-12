// Test IDs for BDV TravelOS
export const HOME = {
  emergentLink: 'home-emergent-link'
};

export const LOGIN = {
  staffCard: (id) => `login-staff-card-${id}`,
  pinInput: 'login-pin-input',
  numpadKey: (digit) => `login-numpad-key-${digit}`,
  submit: 'login-submit',
  backspace: 'login-numpad-backspace'
};

export const SIDEBAR = {
  toggle: 'sidebar-collapse-toggle',
  navItem: (route) => `sidebar-nav-item-${route}`
};

export const TOPBAR = {
  brandSwitcher: 'topbar-brand-switcher',
  clock: 'topbar-live-clock',
  userMenu: 'topbar-user-menu',
  waStatus: 'topbar-wa-status',
  internetStatus: 'topbar-internet-status'
};

export const STATUSBAR = {
  connectivity: 'statusbar-connectivity',
  lastSync: 'statusbar-last-sync',
  offlineIndicator: 'offline-indicator'
};

export const DASHBOARD = {
  kanbanBoard: 'dashboard-kanban-board',
  kanbanColumn: (stage) => `dashboard-kanban-column-${stage.toLowerCase().replace(/ /g, '-')}`,
  kanbanCard: (id) => `dashboard-kanban-card-${id}`,
  newEnquiryBtn: 'dashboard-new-enquiry-btn',
  shortcutsPanel: 'dashboard-shortcuts-panel',
  shortcutItem: (name) => `dashboard-shortcut-${name.toLowerCase().replace(/ /g, '-')}`,
  alertsPanel: 'dashboard-alerts-panel',
  statsPanel: 'dashboard-stats-panel',
  kpi: (metric) => `dashboard-kpi-${metric}`
};
