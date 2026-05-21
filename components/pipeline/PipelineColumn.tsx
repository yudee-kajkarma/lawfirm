'use client';

import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  /** Droppable id — typically a stage / status enum value. */
  id: string;
  label: string;
  color: string;
  count: number;
  /** Pre-rendered cards. Lets the column stay entity-agnostic. */
  children: ReactNode;
  emptyMessage?: string;
};

export function PipelineColumn({
  id,
  label,
  color,
  count,
  children,
  emptyMessage = 'Drop here',
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto bg-muted/20 p-2 transition-colors',
          isOver && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
        )}
      >
        {count === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
