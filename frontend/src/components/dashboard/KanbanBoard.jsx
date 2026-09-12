import React, { useState } from 'react';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { DASHBOARD } from '../../constants/testIds';
import { LEAD_STAGES } from '../../constants/stages';
import { Plane, Globe, Shield, CreditCard, ShieldCheck, Star, Users, Heart, MapPin, Plus } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const SERVICE_ICONS = {
  Tour: Globe, Flight: Plane, Visa: Shield, Passport: CreditCard, Insurance: ShieldCheck,
};
const TRAVEL_ICONS = { Honeymoon: Heart, Family: Users, Adventure: MapPin, Group: Users };

function CardContent({ card, isOverlay }) {
  const ServiceIcon = SERVICE_ICONS[card.service_type] || Star;
  const TravelIcon = TRAVEL_ICONS[card.travel_type];

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return dateStr;
      return format(d, 'dd MMM');
    } catch { return dateStr; }
  };

  return (
    <div className={`bg-white rounded-xl border p-3 ${
      isOverlay
        ? 'shadow-2xl rotate-1 scale-105 border-[var(--brand-accent)]'
        : 'border-[#E6E9F0] kanban-card cursor-grab active:cursor-grabbing'
    }`}>
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-xs font-semibold text-[#0b1220] leading-tight">{card.client_name}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ServiceIcon className="w-3 h-3 text-[#5b6475]" />
          {TravelIcon && <TravelIcon className="w-3 h-3 text-[#5b6475]" />}
        </div>
      </div>
      <div className="flex items-center gap-1 mb-2">
        <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} />
        <span className="text-xs text-[#0b1220] font-medium truncate">{card.destination}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {card.travel_date && (
            <span className="text-[10px] text-[#5b6475] bg-gray-50 px-1.5 py-0.5 rounded">
              {formatDate(card.travel_date)}
            </span>
          )}
          <span className="text-[10px] text-[#5b6475]">
            {card.pax_adults}A{card.pax_children > 0 ? `+${card.pax_children}C` : ''}
          </span>
        </div>
        {card.budget && (
          <span className="text-[10px] font-medium" style={{ color: 'var(--brand-accent)' }}>
            &#8377;{card.budget}
          </span>
        )}
      </div>
      {card.source && (
        <div className="mt-2">
          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {card.source}
          </span>
        </div>
      )}
    </div>
  );
}

function DraggableCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { type: 'card', card }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    touchAction: 'none'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={DASHBOARD.kanbanCard(card.id)}
    >
      <CardContent card={card} />
    </div>
  );
}

function KanbanColumn({ stage, cards }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[185px] flex-1" data-testid={DASHBOARD.kanbanColumn(stage.id)}>
      <div
        className="px-3 py-2 rounded-t-xl border-b flex items-center justify-between"
        style={{ backgroundColor: stage.color.header, borderColor: stage.color.border }}
      >
        <span className="text-xs font-semibold" style={{ color: stage.color.text }}>{stage.id}</span>
        <span
          className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full"
          style={{ backgroundColor: stage.color.badge, color: 'white', fontSize: '10px' }}
        >
          {cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[180px] rounded-b-xl p-2 space-y-2 transition-colors duration-150 border-l border-r border-b ${
          isOver ? 'drop-zone-active' : 'bg-gray-50/60'
        }`}
        style={{ borderColor: stage.color.border }}
      >
        {cards.map(card => <DraggableCard key={card.id} card={card} />)}
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <p className="text-[10px] text-[#5b6475] text-center">No leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ enquiries, onStageChange }) {
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = ({ active }) => setActiveCard(active.data.current?.card);

  const handleDragEnd = ({ active, over }) => {
    if (over) {
      const card = active.data.current?.card;
      if (card && card.pipeline_stage !== over.id) {
        onStageChange(active.id, over.id);
      }
    }
    setActiveCard(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid={DASHBOARD.kanbanBoard}>
        {LEAD_STAGES.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            cards={enquiries.filter(e => e.pipeline_stage === stage.id)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeCard ? (
          <div style={{ width: '185px' }}>
            <CardContent card={activeCard} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
