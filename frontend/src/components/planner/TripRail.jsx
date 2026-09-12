import React, { useState, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates,
  arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plane, Train, Bus, Ship, Car, BedDouble, Ticket, Utensils,
  Shield, Package, FileCheck, GripVertical, Pencil, Trash2,
  Plus, ChevronDown, Loader2, Route,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { deleteComponent, reorderComponents } from '../../services/plannerAPI';

// ── Type icon & color maps ────────────────────────────────────────────────────
const TYPE_CONFIG = {
  flight:        { Icon: Plane,      color: '#4FC3F7', label: 'Flight'      },
  train:         { Icon: Train,      color: '#4FC3F7', label: 'Train'       },
  bus:           { Icon: Bus,        color: '#4FC3F7', label: 'Bus'         },
  ferry:         { Icon: Ship,       color: '#4FC3F7', label: 'Ferry'       },
  cruise:        { Icon: Ship,       color: '#4FC3F7', label: 'Cruise'      },
  transfer:      { Icon: Car,        color: '#8FB3C7', label: 'Transfer'    },
  self_drive:    { Icon: Car,        color: '#8FB3C7', label: 'Self Drive'  },
  stay:          { Icon: BedDouble,  color: '#2F9E6F', label: 'Stay'        },
  activity:      { Icon: Ticket,     color: '#FFB300', label: 'Activity'    },
  attraction:    { Icon: Ticket,     color: '#FFB300', label: 'Attraction'  },
  meal:          { Icon: Utensils,   color: '#FFB300', label: 'Meal'        },
  visa:          { Icon: FileCheck,  color: '#8FB3C7', label: 'Visa'        },
  insurance:     { Icon: Shield,     color: '#8FB3C7', label: 'Insurance'   },
  misc:          { Icon: Package,    color: '#8FB3C7', label: 'Misc'        },
};

const COMPONENT_TYPES = Object.keys(TYPE_CONFIG);

const fmtDate = (d) => { try { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''; } catch { return ''; } };
const fmtCurrency = (amount, currency) => {
  if (amount == null) return '—';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency || ''}${amount}`; }
};

// ── Sortable Rail Item ────────────────────────────────────────────────────────
function RailItem({ component, tripId, onEdit, onDeleted }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id });
  const [deleting, setDeleting] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const config = TYPE_CONFIG[component.type] || TYPE_CONFIG.misc;
  const Icon = config.Icon;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${component.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteComponent(tripId, component.id);
      toast.success('Component removed');
      onDeleted(component.id);
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally { setDeleting(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-stretch rounded-lg overflow-hidden transition-shadow"
      data-testid={`rail-item-${component.id}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center px-2 cursor-grab active:cursor-grabbing"
        style={{ background: isDragging ? 'rgba(0,229,255,0.10)' : 'var(--surface-2)', borderRight: '1px solid var(--stroke-soft)' }}
      >
        <GripVertical className="w-3.5 h-3.5" style={{ color: 'var(--app-muted)', opacity: 0.5 }} />
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center gap-3 px-3 py-2.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--stroke-soft)', borderLeft: 'none' }}
      >
        {/* Type icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${config.color}18`, border: `1px solid ${config.color}30` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-fg)', fontFamily: 'Figtree, sans-serif' }}>
              {component.title}
            </p>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
              style={{ background: `${config.color}15`, color: config.color }}
            >
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {component.supplier_name && (
              <span className="text-[10px] truncate" style={{ color: 'var(--app-muted)' }}>{component.supplier_name}</span>
            )}
            {component.start_datetime && (
              <span className="text-[10px]" style={{ color: 'rgba(143,179,199,0.60)' }}>{fmtDate(component.start_datetime)}</span>
            )}
            {component.nights > 0 && (
              <span className="text-[10px]" style={{ color: 'rgba(143,179,199,0.60)' }}>{component.nights}N</span>
            )}
          </div>
        </div>

        {/* Price */}
        {component.sell_price != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold font-mono" style={{ color: 'var(--cta)' }}>
              {fmtCurrency(component.sell_price, component.sell_currency)}
            </p>
            {component.net_cost != null && (
              <p className="text-[9px] font-mono" style={{ color: 'var(--app-muted)' }}>
                net {fmtCurrency(component.net_cost, component.net_currency)}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(component); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--app-muted)' }}
            title="Edit"
            data-testid={`rail-edit-${component.id}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
            style={{ color: '#fca5a5' }}
            title="Delete"
            data-testid={`rail-delete-${component.id}`}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Component Dropdown ────────────────────────────────────────────────────
function AddComponentMenu({ onSelect }) {
  const [open, setOpen] = useState(false);

  const groups = [
    { label: 'Transport', types: ['flight', 'train', 'bus', 'ferry', 'cruise', 'transfer', 'self_drive'] },
    { label: 'Accommodation', types: ['stay'] },
    { label: 'Activities', types: ['activity', 'attraction', 'meal'] },
    { label: 'Other', types: ['visa', 'insurance', 'misc'] },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-150"
        style={{
          background: 'rgba(0,229,255,0.08)',
          color: 'var(--cta)',
          border: '1px solid rgba(0,229,255,0.20)',
        }}
        data-testid="add-component-btn"
      >
        <Plus className="w-3.5 h-3.5" /> Add Component <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl shadow-xl overflow-hidden"
            style={{ background: 'var(--qb-modal)', border: '1px solid var(--stroke-soft)', boxShadow: 'var(--qb-shadow)' }}
          >
            {groups.map(g => (
              <div key={g.label}>
                <p
                  className="px-3 py-1.5 text-[9px] uppercase tracking-[0.22em] font-semibold"
                  style={{ color: 'var(--cta)', borderBottom: '1px solid var(--qb-divider)' }}
                >
                  {g.label}
                </p>
                {g.types.map(type => {
                  const { Icon, label, color } = TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { onSelect(type); setOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/5"
                      style={{ color: 'var(--app-fg)' }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main TripRail ─────────────────────────────────────────────────────────────
export function TripRail({ tripId, components, onComponentsChange, onEditComponent, onAddComponent }) {
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = components.findIndex(c => c.id === active.id);
    const newIndex = components.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(components, oldIndex, newIndex);
    // Optimistic update
    onComponentsChange(reordered);

    // Persist
    const order = reordered.map((c, idx) => ({ id: c.id, sort_order: idx }));
    setSaving(true);
    try {
      await reorderComponents(tripId, order);
    } catch (err) {
      toast.error('Reorder failed: ' + err.message);
      // Revert
      onComponentsChange(components);
    } finally { setSaving(false); }
  }, [components, tripId, onComponentsChange]);

  const handleDeleted = useCallback((compId) => {
    onComponentsChange(prev => prev.filter(c => c.id !== compId));
  }, [onComponentsChange]);

  if (components.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--stroke-soft)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--app-muted)' }}>Trip Rail</p>
          <AddComponentMenu onSelect={onAddComponent} />
        </div>
        <div
          className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center"
          data-testid="rail-empty-state"
        >
          <Route className="w-10 h-10 opacity-15" style={{ color: 'var(--cta)' }} />
          <p className="text-sm" style={{ color: 'var(--app-muted)' }}>No components yet.</p>
          <p className="text-xs" style={{ color: 'var(--app-muted)', opacity: 0.6 }}>Add flights, stays, activities to build your trip rail.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="trip-rail">
      {/* Rail header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--stroke-soft)' }}
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--app-muted)' }}>Trip Rail</p>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(0,229,255,0.10)', color: 'var(--cta)' }}
          >
            {components.length}
          </span>
          {saving && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--cta)' }} />}
        </div>
        <AddComponentMenu onSelect={onAddComponent} />
      </div>

      {/* Sortable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={components.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {components.map(comp => (
              <RailItem
                key={comp.id}
                component={comp}
                tripId={tripId}
                onEdit={onEditComponent}
                onDeleted={handleDeleted}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
