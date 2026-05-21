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

import { CASE_STATUSES, type CaseStatus } from '@/lib/constants/enums';
import { ApiError, apiFetch } from '@/lib/utils/apiFetch';
import type { Case, CaseListFilters, CaseListMeta } from '@/types/case';

import { CaseCard } from './CaseCard';
import { PipelineColumn } from './PipelineColumn';

const STATUS_COLORS: Record<CaseStatus, string> = {
  open: '#60a5fa',
  in_progress: '#f59e0b',
  on_hold: '#94a3b8',
  closed: '#10b981',
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

type ListQueryData = { items: Case[]; meta: CaseListMeta };

type Props = {
  filters: CaseListFilters;
  cases: Case[];
};

export function CaseBoard({ filters, cases }: Props) {
  const qc = useQueryClient();

  // Same trick as the leads board — exact queryKey match for optimistic write.
  const queryKey = useMemo(() => ['cases', 'list', filters] as const, [filters]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCase = activeId ? (cases.find((c) => c._id === activeId) ?? null) : null;

  const statusMutation = useMutation({
    mutationFn: async (args: { caseId: string; newStatus: CaseStatus }) => {
      const res = await apiFetch<Case>(`/api/cases/${args.caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: args.newStatus }),
      });
      return res.data;
    },
    onMutate: async ({ caseId, newStatus }) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<ListQueryData>([...queryKey]);
      qc.setQueryData<ListQueryData>([...queryKey], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c) =>
            c._id === caseId ? { ...c, status: newStatus } : c,
          ),
        };
      });
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData([...queryKey], ctx.snapshot);
      const msg = err instanceof ApiError ? err.message : 'Failed to move case';
      toast.error(msg);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const byStatus = useMemo(() => {
    const out = {} as Record<CaseStatus, Case[]>;
    for (const s of CASE_STATUSES) out[s] = [];
    for (const c of cases) out[c.status].push(c);
    return out;
  }, [cases]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const caseId = String(active.id);
    const newStatus = String(over.id) as CaseStatus;
    if (!(CASE_STATUSES as readonly string[]).includes(newStatus)) return;

    const c = cases.find((x) => x._id === caseId);
    if (!c || c.status === newStatus) return;

    statusMutation.mutate({ caseId, newStatus });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-[calc(100vh-12rem)] gap-3 overflow-x-auto pb-2">
        {CASE_STATUSES.map((status) => {
          const items = byStatus[status];
          return (
            <PipelineColumn
              key={status}
              id={status}
              label={STATUS_LABELS[status]}
              color={STATUS_COLORS[status]}
              count={items.length}
              emptyMessage="Drop cases here"
            >
              {items.map((c) => (
                <CaseCard key={c._id} caseDoc={c} />
              ))}
            </PipelineColumn>
          );
        })}
      </div>
      {/* Drop animation disabled — see PipelineBoard for rationale. */}
      <DragOverlay dropAnimation={null}>
        {activeCase ? <CaseCard caseDoc={activeCase} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
