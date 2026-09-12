import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // send httpOnly cookie on every request
});

// Response interceptor — handle 401 (session expired or cookie missing)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Guard: never redirect when already on the login page (would cause an infinite loop
      // because GET /api/auth/me on first load returns 401 for unauthenticated users)
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('bdvv_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  getStaff: () => api.get('/auth/staff'),
  login: (staff_id, pin) => api.post('/auth/login', { staff_id, pin }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
};

// Enquiries API
export const enquiriesAPI = {
  list: (params) => api.get('/enquiries', { params }),
  create: (data) => api.post('/enquiries', data),
  get: (id) => api.get(`/enquiries/${id}`),
  update: (id, data) => api.put(`/enquiries/${id}`, data),
  updateStage: (id, stage) => api.patch(`/enquiries/${id}/stage`, { stage }),
  updateFollowup: (id, followup_at) => api.patch(`/enquiries/${id}/followup`, { followup_at }),
  markLost: (id, lost_reason, lost_notes) => api.patch(`/enquiries/${id}/lost`, { lost_reason, lost_notes }),
  assign: (id, staff_id, staff_name) => api.patch(`/enquiries/${id}/assign`, { staff_id, staff_name }),
  linkClient: (id, client_id) => api.patch(`/enquiries/${id}/client`, { client_id }),
  getNotes: (id) => api.get(`/enquiries/${id}/notes`),
  addNote: (id, note) => api.post(`/enquiries/${id}/notes`, { note }),
  delete: (id) => api.delete(`/enquiries/${id}`)
};

// Clients API
export const clientsAPI = {
  list: (params) => api.get('/clients', { params }),
  create: (data) => api.post('/clients', data),
  get: (id) => api.get(`/clients/${id}`),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  addDocument: (id, data) => api.post(`/clients/${id}/documents`, data),
  deleteDocument: (clientId, docId) => api.delete(`/clients/${clientId}/documents/${docId}`),
  getNotes: (id) => api.get(`/clients/${id}/notes`),
  addNote: (id, note) => api.post(`/clients/${id}/notes`, { note }),
  getEnquiries: (id) => api.get(`/clients/${id}/enquiries`)
};

// Client Categorized Document Files API
export const clientDocumentsAPI = {
  upload: (clientId, file, category, note = '') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    if (note) fd.append('note', note);
    return api.post(`/clients/${clientId}/files`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  list: (clientId) => api.get(`/clients/${clientId}/files`),
  delete: (clientId, fileId) => api.delete(`/clients/${clientId}/files/${fileId}`),
};

// CRM API
export const crmAPI = {
  followups: () => api.get('/crm/followups')
};

// Dashboard API
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  alerts: () => api.get('/dashboard/alerts')
};

// Sites API
export const sitesAPI = {
  list: () => api.get('/sites'),
  add: (data) => api.post('/sites', data),
  delete: (id) => api.delete(`/sites/${id}`)
};

// Staff API (public - for login page)
export const staffAPI = {
  list: () => api.get('/auth/staff')
};

// Staff Management API (admin - for settings)
export const staffManagementAPI = {
  list: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  resetPin: (id, new_pin) => api.post(`/staff/${id}/reset-pin`, { new_pin }),
  delete: (id) => api.delete(`/staff/${id}`),
};

// Activity API
export const activityAPI = {
  list: (limit) => api.get('/activity', { params: { limit } })
};

// Quotes API
export const quotesAPI = {
  list: (params) => api.get('/quotes', { params }),
  create: (data) => api.post('/quotes', data),
  get: (id) => api.get(`/quotes/${id}`),
  update: (id, data) => api.put(`/quotes/${id}`, data),
  delete: (id) => api.delete(`/quotes/${id}`),
  updateStatus: (id, status) => api.patch(`/quotes/${id}/status`, { status }),
  exportPdf: (id) => api.get(`/quotes/${id}/export/pdf`, { responseType: 'blob' }),
  exportExcel: (id) => api.get(`/quotes/${id}/export/excel`, { responseType: 'blob' }),
};

// File Uploads API
export const uploadsAPI = {
  upload: (module, recordId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/file-upload/${module}/${recordId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  list: (module, recordId) => api.get(`/file-upload/${module}/${recordId}`),
  delete: (module, recordId, fileId) => api.delete(`/file-upload/${module}/${recordId}/${fileId}`),
  updateNote: (module, recordId, fileId, note) =>
    api.patch(`/file-upload/${module}/${recordId}/${fileId}/note`, { note }),
};

// Alerts API
export const alertsAPI = {
  list: () => api.get('/alerts'),
  create: (data) => api.post('/alerts', data),
  unreadCount: () => api.get('/alerts/unread-count'),
  dismiss: (id, re_alert = false) => api.patch(`/alerts/${id}/dismiss`, { re_alert }),
  snooze: (id, snoozed_until) => api.patch(`/alerts/${id}/snooze`, { snoozed_until }),
  markRead: (id) => api.patch(`/alerts/${id}/read`),
};

// Visa Applications API
export const visaAPI = {
  list: (enquiryId) => api.get('/visa-applications', { params: enquiryId ? { enquiry_id: enquiryId } : {} }),
  get: (id) => api.get(`/visa-applications/${id}`),
  create: (data) => api.post('/visa-applications', data),
  update: (id, data) => api.put(`/visa-applications/${id}`, data),
  delete: (id) => api.delete(`/visa-applications/${id}`),
  addApplicant: (appId, data) => api.post(`/visa-applications/${appId}/applicants`, data),
  updateApplicant: (appId, applicantId, data) => api.put(`/visa-applications/${appId}/applicants/${applicantId}`, data),
  deleteApplicant: (appId, applicantId) => api.delete(`/visa-applications/${appId}/applicants/${applicantId}`),
  updateChecklistItem: (appId, applicantId, docId, data) =>
    api.patch(`/visa-applications/${appId}/applicants/${applicantId}/checklist/${docId}`, data),
};

// Transport API
export const transportAPI = {
  list: (params) => api.get('/transport', { params }),
  create: (data) => api.post('/transport', data),
  get: (id) => api.get(`/transport/${id}`),
  update: (id, data) => api.put(`/transport/${id}`, data),
  delete: (id) => api.delete(`/transport/${id}`),
};

// Quick Links API
export const quickLinksAPI = {
  list: () => api.get('/quick-links'),
  create: (data) => api.post('/quick-links', data),
  delete: (id) => api.delete(`/quick-links/${id}`),
};

// Settings API
export const settingsAPI = {
  getBrand: () => api.get('/settings/brand'),
  updateBrand: (data) => api.put('/settings/brand', data),
};

// Compass AI Assistant API
export const aiAPI = {
  listSessions: () => api.get('/ai/sessions'),
  createSession: () => api.post('/ai/sessions'),
  deleteSession: (sessionId) => api.delete(`/ai/sessions/${sessionId}`),
  getMessages: (sessionId) => api.get(`/ai/sessions/${sessionId}/messages`),
  // Streaming chat is handled via native fetch in the component (POST + SSE)
};

// Itinerary Designer API
export const itineraryAPI = {
  list: (params) => api.get('/itineraries', { params }),
  create: (data) => api.post('/itineraries', data),
  get: (id) => api.get(`/itineraries/${id}`),
  update: (id, data) => api.put(`/itineraries/${id}`, data),
  delete: (id) => api.delete(`/itineraries/${id}`),
  extractFromUrl: (data) => api.post('/itinerary/extract-from-url', data),
};

export default api;
