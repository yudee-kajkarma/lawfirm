'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { Lead } from '@/types/lead';

function formatValue(v: number | null): string | null {
  if (v == null) return null;
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function ageInDays(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

type Props = {
  lead: Lead;
  /**
   * When true, this is the floating clone rendered inside `<DragOverlay>`.
   * It opts out of `useDraggable` and skips click navigation — it's just the
   * visual that follows the cursor, escaping the column's `overflow` clip.
   */
  isOverlay?: boolean;
};

function CardBody({ lead, isOverlay }: { lead: Lead; isOverlay: boolean }) {
  const value = formatValue(lead.value);
  return (
    <>
      <div className="flex items-start gap-2">
        <span
          data-drag-handle
          aria-hidden
          className={cn(
            'cursor-grab text-muted-foreground transition-opacity active:cursor-grabbing',
            isOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <GripVertical className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {lead.firstName} {lead.lastName}
          </div>
          {lead.companyName && (
            <div className="truncate text-xs text-muted-foreground">{lead.companyName}</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{value ?? '—'}</span>
        <span>{ageInDays(lead.createdAt)}</span>
      </div>
    </>
  );
}

export function PipelineCard({ lead, isOverlay = false }: Props) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead._id,
    disabled: isOverlay,
  });

  if (isOverlay) {
    return (
      <div className="flex w-[17rem] rotate-2 cursor-grabbing flex-col gap-1.5 rounded-md border border-primary/40 bg-card p-3 text-sm shadow-2xl ring-1 ring-primary/20">
        <CardBody lead={lead} isOverlay />
      </div>
    );
  }

  // The "real" card stays in place during a drag — it just fades to a ghost
  // while the DragOverlay clone follows the cursor above all columns.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
        router.push(`/leads/${lead._id}`);
      }}
      className={cn(
        'group flex cursor-pointer flex-col gap-1.5 rounded-md border bg-card p-3 text-sm shadow-sm transition-shadow',
        isDragging ? 'opacity-30' : 'hover:shadow-md',
      )}
    >
      <CardBody lead={lead} isOverlay={false} />
    </div>
  );
}
