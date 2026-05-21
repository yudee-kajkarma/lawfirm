'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import type { Case } from '@/types/case';

function formatValue(v: number | null): string | null {
  if (v == null) return null;
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function ageInDays(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

type Props = {
  caseDoc: Case;
  isOverlay?: boolean;
};

function CardBody({ caseDoc, isOverlay }: { caseDoc: Case; isOverlay: boolean }) {
  const value = formatValue(caseDoc.value);
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
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {caseDoc.caseNumber}
          </div>
          <div className="truncate text-sm font-medium">{caseDoc.title}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{value ?? '—'}</span>
        <span>{ageInDays(caseDoc.openedAt)}</span>
      </div>
    </>
  );
}

export function CaseCard({ caseDoc, isOverlay = false }: Props) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: caseDoc._id,
    disabled: isOverlay,
  });

  if (isOverlay) {
    return (
      <div className="flex w-[17rem] rotate-2 cursor-grabbing flex-col gap-1.5 rounded-md border border-primary/40 bg-card p-3 shadow-2xl ring-1 ring-primary/20">
        <CardBody caseDoc={caseDoc} isOverlay />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
        router.push(`/cases/${caseDoc._id}`);
      }}
      className={cn(
        'group flex cursor-pointer flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm transition-shadow',
        isDragging ? 'opacity-30' : 'hover:shadow-md',
      )}
    >
      <CardBody caseDoc={caseDoc} isOverlay={false} />
    </div>
  );
}
