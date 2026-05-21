import { Badge } from '@/components/ui/badge';
import type { TaskPriority, TaskStatus } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<
  TaskStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  todo: { variant: 'outline' },
  in_progress: {
    variant: 'outline',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  done: {
    variant: 'outline',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  cancelled: { variant: 'secondary' },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <Badge variant={s.variant} className={cn('whitespace-nowrap', s.className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#94a3b8',
  medium: '#60a5fa',
  high: '#f59e0b',
  urgent: '#ef4444',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function TaskPriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="inline-block size-2 flex-shrink-0 rounded-full"
      style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      aria-label={`Priority: ${PRIORITY_LABELS[priority]}`}
      title={`${PRIORITY_LABELS[priority]} priority`}
    />
  );
}

export { STATUS_LABELS as TASK_STATUS_LABELS, PRIORITY_LABELS as TASK_PRIORITY_LABELS };
