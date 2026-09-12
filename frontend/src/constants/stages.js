// Unified lead pipeline stages for BDV TravelOS
export const LEAD_STAGES = [
  { id: 'New', color: { header: '#EFF6FF', border: '#BFDBFE', badge: '#1D4ED8', text: '#1E40AF', dot: '#3B82F6' } },
  { id: 'Qualified', color: { header: '#EEF2FF', border: '#C7D2FE', badge: '#4338CA', text: '#3730A3', dot: '#6366F1' } },
  { id: 'Quoted', color: { header: '#FFFBEB', border: '#FDE68A', badge: '#B45309', text: '#92400E', dot: '#F59E0B' } },
  { id: 'Follow-up', color: { header: '#FFF7ED', border: '#FDBA74', badge: '#C2410C', text: '#9A3412', dot: '#F97316' } },
  { id: 'Converted', color: { header: '#F0FDF4', border: '#86EFAC', badge: '#15803D', text: '#14532D', dot: '#22C55E' } },
  { id: 'Lost', color: { header: '#F9FAFB', border: '#D1D5DB', badge: '#4B5563', text: '#374151', dot: '#9CA3AF' } },
];

export const STAGE_MAP = Object.fromEntries(LEAD_STAGES.map(s => [s.id, s.color]));
