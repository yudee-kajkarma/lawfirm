'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { humanizeEnum } from '@/components/leads/LeadForm';
import { LEAD_STAGES, type LeadStage } from '@/lib/constants/enums';
import { ApiError, apiFetch } from '@/lib/utils/apiFetch';
import type { Lead, LeadListFilters, LeadListMeta } from '@/types/lead';

import { PipelineCard } from './PipelineCard';
import { PipelineColumn } from './PipelineColumn';

const STAGE_COLORS: Record<LeadStage, string> = {
  new_inquiry: '#94a3b8',
  contacted: '#7dd3fc',
  qualified: '#60a5fa',
  proposal: '#f59e0b',
  negotiation: '#f97316',
  converted: '#10b981',
  lost: '#ef4444',
};

type ListQueryData = { items: Lead[]; meta: LeadListMeta };

type Props = {
  filters: LeadListFilters;
  leads: Lead[];
};

export function PipelineBoard({ filters, leads }: Props) {
  const qc = useQueryClient();

  // Match the exact queryKey produced by `useLeadsList(filters)` so the
  // optimistic update lands on the right cache entry.
  const queryKey = useMemo(() => ['leads', 'list', filters] as const, [filters]);

  // Require an 8px drag distance before activation — lets the card stay
  // clickable for navigation without triggering a drag on every tap.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Track which lead is being dragged so we can render its clone in
  // `<DragOverlay>` — that's what escapes the column's `overflow-y-auto`
  // clip and keeps the card visible above every column.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLead = activeId ? (leads.find((l) => l._id === activeId) ?? null) : null;

  const stageMutation = useMutation({
    mutationFn: async (args: { leadId: string; newStage: LeadStage }) => {
      const res = await apiFetch<Lead>(`/api/leads/${args.leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: args.newStage }),
      });
      return res.data;
    },
    onMutate: async ({ leadId, newStage }) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<ListQueryData>([...queryKey]);
      qc.setQueryData<ListQueryData>([...queryKey], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((l) => (l._id === leadId ? { ...l, stage: newStage } : l)),
        };
      });
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData([...queryKey], ctx.snapshot);
      const msg = err instanceof ApiError ? err.message : 'Failed to move lead';
      toast.error(msg);
    },
    onSettled: () => {
      // Reconcile with server truth.
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const byStage = useMemo(() => {
    const out = {} as Record<LeadStage, Lead[]>;
    for (const s of LEAD_STAGES) out[s] = [];
    for (const lead of leads) out[lead.stage].push(lead);
    return out;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const newStage = String(over.id) as LeadStage;
    if (!(LEAD_STAGES as readonly string[]).includes(newStage)) return;

    const lead = leads.find((l) => l._id === leadId);
    if (!lead || lead.stage === newStage) return;

    stageMutation.mutate({ leadId, newStage });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-[calc(100vh-12rem)] gap-3 overflow-x-auto pb-2">
        {LEAD_STAGES.map((stage) => {
          const items = byStage[stage];
          return (
            <PipelineColumn
              key={stage}
              id={stage}
              label={humanizeEnum(stage)}
              color={STAGE_COLORS[stage]}
              count={items.length}
              emptyMessage="Drop leads here"
            >
              {items.map((lead) => (
                <PipelineCard key={lead._id} lead={lead} />
              ))}
            </PipelineColumn>
          );
        })}
      </div>
      {/* No drop animation — our optimistic update already moves the card to
          the target column, so dnd-kit's default "fly back to source" animation
          would chase a slot that no longer holds the card. Letting the overlay
          vanish on release feels instantaneous and correct. */}
      <DragOverlay dropAnimation={null}>
        {activeLead ? <PipelineCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
